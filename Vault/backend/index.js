const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { initSession, getSessionStatus, deleteSession, resumeStoredSessions } = require('./waService');
const db = require('./db');
const { DEFAULT_AI_MODEL, normalizeAiModel } = require('./aiModels');
const { getAdminAuth, getAdminFirestore } = require('./firebaseAdmin');
const { getUserSettings, saveUserSettings } = require('./settingsStore');
const { FieldValue } = require('firebase-admin/firestore');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const INTERNAL_ADMIN_TOKEN = process.env.INTERNAL_ADMIN_TOKEN || '';

const authenticate = async (req, res, next) => {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

    if (!token && process.env.NODE_ENV !== 'production') {
        req.userId = req.headers['x-user-id'] || 'default-user';
        return next();
    }

    if (!token) return res.status(401).json({ error: 'Firebase authentication token diperlukan.' });

    try {
        const decoded = await getAdminAuth().verifyIdToken(token);
        req.userId = decoded.uid;
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Firebase token verification failed:', error.message);
        res.status(401).json({ error: 'Sesi Firebase tidak valid atau sudah kedaluwarsa.' });
    }
};

const authenticateInternal = (req, res, next) => {
    const token = req.headers['x-internal-token'] || '';
    if (!INTERNAL_ADMIN_TOKEN || token !== INTERNAL_ADMIN_TOKEN) {
        return res.status(401).json({ error: 'Internal token tidak valid.' });
    }
    next();
};

function publicSettings(settings) {
    const hasAppsScriptUrl = Boolean(settings.apps_script_url);
    const appsScriptStatus = hasAppsScriptUrl
        ? (settings.apps_script_status && settings.apps_script_status !== 'not_configured' ? settings.apps_script_status : 'configured')
        : 'not_configured';
    const jidDisplayMappings = Object.fromEntries(
        Object.entries(settings.jid_mappings || {})
            .map(([lidJid, targetJid]) => {
                const phone = String(targetJid || '').split('@')[0].replace(/\D/g, '');
                return [String(lidJid || '').toLowerCase(), phone];
            })
            .filter(([lidJid, phone]) => lidJid.endsWith('@lid') && phone)
    );

    return {
        apps_script_url: settings.apps_script_url || '',
        groq_api_key: settings.groq_key ? '••••••••••••••••' : '',
        has_groq_api_key: Boolean(settings.groq_key),
        spreadsheet_id: settings.spreadsheet_id || '',
        ai_model: normalizeAiModel(settings.ai_model),
        system_prompt: settings.system_prompt || '',
        apps_script_status: appsScriptStatus,
        apps_script_last_tested_at: settings.apps_script_last_tested_at || null,
        apps_script_last_status: settings.apps_script_last_status || null,
        apps_script_last_preview: settings.apps_script_last_preview || '',
        monthly_budget: Number(settings.monthly_budget || 0),
        budget_alert_thresholds: Array.isArray(settings.budget_alert_thresholds) && settings.budget_alert_thresholds.length
            ? settings.budget_alert_thresholds
            : [80, 90, 95, 100],
        budget_alert_month: settings.budget_alert_month || '',
        budget_alert_levels: Array.isArray(settings.budget_alert_levels) ? settings.budget_alert_levels : [],
        active_recap_id: settings.active_recap_id || '',
        active_recap_name: settings.active_recap_name || 'Periode Aktif',
        active_recap_start_date: settings.active_recap_start_date || '',
        settings_updated_at: settings.settings_updated_at || null,
        jid_display_mappings: jidDisplayMappings,
    };
}

function sanitizeBudgetThresholds(value) {
    const raw = Array.isArray(value) ? value : [80, 90, 95, 100];
    const next = raw
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0 && item <= 200)
        .sort((a, b) => a - b);
    return [...new Set(next)].length ? [...new Set(next)] : [80, 90, 95, 100];
}

function isAllowedEndpoint(value) {
    if (!value) return true;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname));
    } catch (_) {
        return false;
    }
}

async function callAppsScript(endpoint) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session: 'settings-test', from: 'dashboard', body: 'ping', command: 'ping' }),
            signal: controller.signal,
        });
        const responseText = await response.text();
        if (!response.ok) throw new Error(`Apps Script mengembalikan HTTP ${response.status}.`);
        return { status: response.status, preview: responseText.slice(0, 240) };
    } finally {
        clearTimeout(timeout);
    }
}

async function postAppsScript(endpoint, payload, timeoutMs = 45000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        const responseText = await response.text();
        if (!response.ok) throw new Error(`Apps Script mengembalikan HTTP ${response.status}.`);
        return responseText;
    } finally {
        clearTimeout(timeout);
    }
}

function safeRecapName(value) {
    const fallback = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    return String(value || fallback).trim().replace(/\s+/g, ' ').slice(0, 80) || fallback;
}

function dateInputValue(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return dateInputValue(new Date());
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function makeRecapId() {
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
    ].join('');
    return `recap_${stamp}`;
}

async function archiveFirestoreCollection(userId, collectionName, recap) {
    const collectionRef = getAdminFirestore().collection('users').doc(userId).collection(collectionName);
    const snapshot = await collectionRef.get();
    let batch = getAdminFirestore().batch();
    let pending = 0;
    let count = 0;

    for (const docItem of snapshot.docs) {
        const data = docItem.data();
        const status = String(data.status || '').toLowerCase();
        const recapStatus = String(data.recap_status || 'active').toLowerCase();
        if (['cancelled', 'canceled', 'dibatalkan'].includes(status)) continue;
        if (recapStatus === 'archived') continue;

        batch.update(docItem.ref, {
            recap_id: recap.id,
            recap_name: recap.name,
            recap_status: 'archived',
            archivedAt: FieldValue.serverTimestamp(),
        });
        pending += 1;
        count += 1;

        if (pending >= 400) {
            await batch.commit();
            batch = getAdminFirestore().batch();
            pending = 0;
        }
    }

    if (pending) await batch.commit();
    return count;
}

function activeStatusWhere() {
    return `COALESCE(status, 'Saved') NOT IN ('Cancelled', 'Canceled', 'Dibatalkan')`;
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', mode: 'multi-user' });
});

app.get('/api/settings', authenticate, async (req, res) => {
    try {
        res.json(publicSettings(await getUserSettings(req.userId)));
    } catch (error) {
        console.error('Settings read error:', error.message);
        res.status(500).json({ error: 'Pengaturan tidak dapat dibaca dari penyimpanan aman.' });
    }
});

app.put('/api/settings', authenticate, async (req, res) => {
    const body = req.body || {};
    const appsScriptUrl = String(body.apps_script_url || '').trim();

    if (!isAllowedEndpoint(appsScriptUrl)) {
        return res.status(400).json({ error: 'Web App Endpoint URL harus berupa URL HTTPS yang valid.' });
    }

    try {
        const incomingGroqKey = String(body.groq_api_key || '').trim();
        const current = await getUserSettings(req.userId);
        const nextSpreadsheetId = String(body.spreadsheet_id || '').trim() || undefined;
        const monthlyBudget = body.monthly_budget === undefined
            ? undefined
            : Math.max(0, Math.round(Number(body.monthly_budget || 0)));
        const budgetChanged = monthlyBudget !== undefined && Number(current.monthly_budget || 0) !== monthlyBudget;
        const connectionChanged = current.apps_script_url !== appsScriptUrl || current.spreadsheet_id !== nextSpreadsheetId;
        const saved = await saveUserSettings(req.userId, {
            apps_script_url: appsScriptUrl,
            groq_key: incomingGroqKey && !incomingGroqKey.includes('••••') ? incomingGroqKey : undefined,
            spreadsheet_id: nextSpreadsheetId,
            ai_model: normalizeAiModel(body.ai_model || DEFAULT_AI_MODEL),
            system_prompt: String(body.system_prompt || '').trim() || undefined,
            monthly_budget: monthlyBudget,
            budget_alert_thresholds: body.budget_alert_thresholds === undefined ? undefined : sanitizeBudgetThresholds(body.budget_alert_thresholds),
            budget_alert_month: budgetChanged ? '' : undefined,
            budget_alert_levels: budgetChanged ? [] : undefined,
            apps_script_status: appsScriptUrl ? (connectionChanged ? 'configured' : current.apps_script_status) : 'not_configured',
            apps_script_last_tested_at: connectionChanged ? null : current.apps_script_last_tested_at,
            apps_script_last_status: connectionChanged ? null : current.apps_script_last_status,
            apps_script_last_preview: connectionChanged ? '' : current.apps_script_last_preview,
        });
        res.json({ message: 'Settings saved.', settings: publicSettings(saved) });
    } catch (error) {
        console.error('Settings save error:', error.message);
        res.status(500).json({ error: 'Pengaturan tidak dapat disimpan ke penyimpanan aman.' });
    }
});

app.put('/api/settings/budget', authenticate, async (req, res) => {
    try {
        const monthlyBudget = Math.max(0, Math.round(Number(req.body?.monthly_budget || 0)));
        const current = await getUserSettings(req.userId);
        const budgetChanged = Number(current.monthly_budget || 0) !== monthlyBudget;
        const saved = await saveUserSettings(req.userId, {
            monthly_budget: monthlyBudget,
            budget_alert_thresholds: req.body?.budget_alert_thresholds === undefined
                ? undefined
                : sanitizeBudgetThresholds(req.body.budget_alert_thresholds),
            budget_alert_month: budgetChanged ? '' : undefined,
            budget_alert_levels: budgetChanged ? [] : undefined,
        });
        res.json({ message: 'Monthly budget saved.', settings: publicSettings(saved) });
    } catch (error) {
        console.error('Budget settings save error:', error.message);
        res.status(500).json({ error: 'Monthly budget tidak dapat disimpan.' });
    }
});

app.post('/api/apps-script/test', authenticate, async (req, res) => {
    const settings = await getUserSettings(req.userId);
    const endpoint = String(req.body?.apps_script_url || settings.apps_script_url || '').trim();
    if (!isAllowedEndpoint(endpoint) || !endpoint) {
        return res.status(400).json({ error: 'Masukkan Web App Endpoint URL yang valid terlebih dahulu.' });
    }

    try {
        const result = await callAppsScript(endpoint);
        const saved = await saveUserSettings(req.userId, {
            apps_script_url: endpoint,
            apps_script_status: 'connected',
            apps_script_last_tested_at: new Date().toISOString(),
            apps_script_last_status: result.status,
            apps_script_last_preview: result.preview,
        });
        res.json({ connected: true, ...result, settings: publicSettings(saved) });
    } catch (error) {
        const message = error.name === 'AbortError' ? 'Koneksi Apps Script melebihi batas waktu 10 detik.' : error.message;
        await saveUserSettings(req.userId, {
            apps_script_url: endpoint,
            apps_script_status: 'error',
            apps_script_last_tested_at: new Date().toISOString(),
            apps_script_last_status: null,
            apps_script_last_preview: message,
        }).catch((saveError) => console.error('Failed to persist Apps Script test failure:', saveError.message));
        res.status(502).json({ connected: false, error: message });
    }
});

app.post('/api/whatsapp/connect', authenticate, async (req, res) => {
    try {
        await initSession(req.userId);
        res.json({ message: 'Session initialization started' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to initialize session' });
    }
});

app.get('/api/whatsapp/status', authenticate, (req, res) => {
    const status = getSessionStatus(req.userId);
    res.json(status);
});

app.delete('/api/whatsapp/disconnect', authenticate, (req, res) => {
    const result = deleteSession(req.userId);
    res.json(result);
});

app.post('/api/internal/whatsapp/connect', authenticateInternal, async (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId wajib diisi.' });
    try {
        await initSession(userId);
        res.json({ message: 'Session initialization started', userId });
    } catch (error) {
        console.error('Internal WA connect error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to initialize session' });
    }
});

app.get('/api/internal/whatsapp/status', authenticateInternal, (req, res) => {
    const userId = String(req.query?.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId wajib diisi.' });
    res.json(getSessionStatus(userId));
});

app.delete('/api/internal/whatsapp/session', authenticateInternal, (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId wajib diisi.' });
    res.json(deleteSession(userId));
});

app.post('/api/whatsapp/send', authenticate, async (req, res) => {
    const { to, message } = req.body || {};
    if (!to || !message) return res.status(400).json({ error: 'Field "to" dan "message" wajib diisi.' });

    const { sendDirectMessage } = require('./waService');
    try {
        await sendDirectMessage(req.userId, to, message);
        res.json({ success: true, message: 'Pesan berhasil dikirim.' });
    } catch (error) {
        console.error('Send message error:', error.message);
        res.status(500).json({ error: error.message || 'Gagal mengirim pesan.' });
    }
});

app.put('/api/jid-mappings', authenticate, async (req, res) => {
    const lidJid = String(req.body?.lid_jid || '').trim();
    const phoneNumber = String(req.body?.phone_number || '').replace(/\D/g, '');

    if (!lidJid.endsWith('@lid')) {
        return res.status(400).json({ error: 'Mapping hanya diperlukan untuk chat @lid.' });
    }

    if (!/^\d{8,15}$/.test(phoneNumber)) {
        return res.status(400).json({ error: 'Nomor harus format internasional tanpa tanda +, contoh 639123456789 atau 6281234567890.' });
    }

    try {
        const current = await getUserSettings(req.userId);
        const targetJid = `${phoneNumber}@s.whatsapp.net`;
        const jidMappings = {
            ...(current.jid_mappings || {}),
            [lidJid]: targetJid,
        };
        await saveUserSettings(req.userId, { jid_mappings: jidMappings });
        res.json({
            success: true,
            lid_jid: lidJid,
            target_jid: targetJid.replace(/^(\d{2})\d+(\d{3})@/, '$1***$2@'),
        });
    } catch (error) {
        console.error('JID mapping save error:', error.message);
        res.status(500).json({ error: 'Mapping nomor pengirim gagal disimpan.' });
    }
});

app.get('/api/recaps', authenticate, (req, res) => {
    try {
        const recaps = db.prepare(`
            SELECT *
            FROM recap_periods
            WHERE user_id = ?
            ORDER BY closed_at DESC
        `).all(req.userId);
        res.json({ recaps });
    } catch (error) {
        console.error('Recap list error:', error.message);
        res.status(500).json({ error: 'Riwayat recap tidak dapat dibaca.' });
    }
});

app.post('/api/recaps/new', authenticate, async (req, res) => {
    const settings = await getUserSettings(req.userId);
    const endpoint = String(settings.apps_script_url || '').trim();
    const spreadsheetId = String(settings.spreadsheet_id || '').trim();
    const recapId = makeRecapId();
    const activeName = safeRecapName(req.body?.name || 'Periode Baru');
    const recapName = safeRecapName(req.body?.archive_name || `Arsip sebelum ${activeName}`);
    const startDate = dateInputValue(req.body?.start_date || new Date());
    const closedAt = new Date().toISOString();
    const recap = { id: recapId, name: recapName, start_date: startDate };

    if (!endpoint) {
        return res.status(400).json({ error: 'Apps Script endpoint belum dikonfigurasi. New Recap perlu backup Sheet terlebih dahulu.' });
    }
    if (!spreadsheetId) {
        return res.status(400).json({ error: 'Spreadsheet ID belum dikonfigurasi. New Recap perlu backup Sheet terlebih dahulu.' });
    }

    const activeWhere = activeStatusWhere();
    const summary = db.prepare(`
        SELECT
            COUNT(*) as expense_count,
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
            SUM(CASE WHEN type != 'income' OR type IS NULL THEN amount ELSE 0 END) as total_expense
        FROM expenses
        WHERE user_id = ?
          AND ${activeWhere}
          AND COALESCE(recap_status, 'active') != 'archived'
    `).get(req.userId);
    const conversationSummary = db.prepare(`
        SELECT COUNT(*) as conversation_count
        FROM conversations
        WHERE user_id = ?
          AND COALESCE(recap_status, 'active') != 'archived'
    `).get(req.userId);

    let sheetReply = '';
    try {
        sheetReply = await postAppsScript(endpoint, {
            command: 'new_recap',
            session: req.userId,
            from: 'dashboard',
            body: 'new recap',
            recap_id: recapId,
            recap_name: recapName,
            active_recap_name: activeName,
            start_date: startDate,
            closed_at: closedAt,
            spreadsheet_id: spreadsheetId,
        }, 60000);
        if (!/New Recap|Periode baru|Recap baru|Tutup Periode|backup sheet/i.test(sheetReply)) {
            throw new Error('Apps Script belum mengenali command new_recap. Update template Apps Script terlebih dahulu.');
        }
    } catch (error) {
        const message = error.name === 'AbortError'
            ? 'Apps Script timeout saat membuat backup Sheet.'
            : error.message;
        return res.status(502).json({ error: message });
    }

    try {
        const archivedExpenses = await archiveFirestoreCollection(req.userId, 'expenses', recap);
        const archivedConversations = await archiveFirestoreCollection(req.userId, 'conversations', recap);

        const tx = db.transaction(() => {
            db.prepare(`
                UPDATE expenses
                SET recap_id = ?,
                    recap_name = ?,
                    recap_status = 'archived',
                    archived_at = datetime('now', 'localtime')
                WHERE user_id = ?
                  AND ${activeWhere}
                  AND COALESCE(recap_status, 'active') != 'archived'
            `).run(recapId, recapName, req.userId);

            db.prepare(`
                UPDATE conversations
                SET recap_id = ?,
                    recap_name = ?,
                    recap_status = 'archived',
                    archived_at = datetime('now', 'localtime')
                WHERE user_id = ?
                  AND COALESCE(recap_status, 'active') != 'archived'
            `).run(recapId, recapName, req.userId);

            db.prepare(`
                INSERT OR REPLACE INTO recap_periods
                    (id, user_id, name, start_date, expense_count, conversation_count, total_income, total_expense, sheet_result)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                recapId,
                req.userId,
                recapName,
                startDate,
                Number(summary?.expense_count || archivedExpenses || 0),
                Number(conversationSummary?.conversation_count || archivedConversations || 0),
                Number(summary?.total_income || 0),
                Number(summary?.total_expense || 0),
                String(sheetReply || '').slice(0, 1000)
            );
        });
        tx();

        const savedSettings = await saveUserSettings(req.userId, {
            active_recap_id: '',
            active_recap_name: activeName,
            active_recap_start_date: startDate,
            budget_alert_month: '',
            budget_alert_levels: [],
        });

        res.json({
            success: true,
            recap: {
                id: recapId,
                name: recapName,
                active_name: activeName,
                start_date: startDate,
                expense_count: Number(summary?.expense_count || archivedExpenses || 0),
                conversation_count: Number(conversationSummary?.conversation_count || archivedConversations || 0),
                total_income: Number(summary?.total_income || 0),
                total_expense: Number(summary?.total_expense || 0),
            },
            settings: publicSettings(savedSettings),
            sheet_reply: sheetReply,
        });
    } catch (error) {
        console.error('New recap archive error:', error.message);
        res.status(500).json({ error: 'Sheet sudah dibackup, tapi archive webapp gagal. Jangan klik ulang sebelum dicek manual.' });
    }
});

// REST ENDPOINTS

app.get('/api/expenses', authenticate, (req, res) => {
    const expenses = db.prepare(`
        SELECT * FROM expenses
        WHERE user_id = ? AND COALESCE(status, 'Saved') NOT IN ('Cancelled', 'Canceled', 'Dibatalkan')
          AND COALESCE(recap_status, 'active') != 'archived'
        ORDER BY created_at DESC
    `).all(req.userId);
    res.json(expenses);
});

app.get('/api/conversations', authenticate, (req, res) => {
    const conversations = db.prepare(`
        SELECT * FROM conversations
        WHERE user_id = ?
          AND COALESCE(recap_status, 'active') != 'archived'
        ORDER BY timestamp DESC
    `).all(req.userId);
    res.json(conversations);
});

app.get('/api/analytics', authenticate, (req, res) => {
    const expenses = db.prepare(`
        SELECT * FROM expenses
        WHERE user_id = ? AND COALESCE(status, 'Saved') NOT IN ('Cancelled', 'Canceled', 'Dibatalkan')
          AND COALESCE(recap_status, 'active') != 'archived'
    `).all(req.userId);

    let totalSpend = 0;
    let totalIncome = 0;
    const categoryTotals = {};

    expenses.forEach(exp => {
        if (exp.type === 'income') {
            totalIncome += exp.amount;
        } else {
            totalSpend += exp.amount;
            categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        }
    });

    res.json({
        totalSpend,
        totalIncome,
        netCashflow: totalIncome - totalSpend,
        categories: categoryTotals,
        transactionCount: expenses.length
    });
});

const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, 'public');
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');

if (fs.existsSync(INDEX_HTML)) {
    app.use(express.static(PUBLIC_DIR, {
        etag: true,
        maxAge: '5m',
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('index.html')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
        },
    }));

    app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
        res.sendFile(INDEX_HTML);
    });
}

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint tidak ditemukan.' });
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    if (String(process.env.DISABLE_WA_AUTO_RESUME || '').toLowerCase() === 'true') {
        console.log('WhatsApp auto-resume disabled by DISABLE_WA_AUTO_RESUME=true');
    } else {
        setTimeout(() => {
            resumeStoredSessions();
        }, 1500);
    }
});
