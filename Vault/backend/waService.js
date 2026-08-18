const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion, jidDecode, jidNormalizedUser } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const Groq = require('groq-sdk');
const { DEFAULT_AI_MODEL, normalizeAiModel } = require('./aiModels');
const { getUserSettings, saveUserSettings } = require('./settingsStore');
const { restoreSession, backupSession, deleteStoredSession, listStoredSessionUserIds, listStoredPhoneSessionJids } = require('./sessionStore');
const { FieldValue, getAdminFirestore } = require('./firebaseAdmin');
require('dotenv').config();

const fallbackGroqKey = process.env.GROQ_API_KEY || '';

const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

const activeSessions = new Map();
const qrCodes = new Map();
const sessionErrors = new Map();
const botMessageIds = new Map();
const sessionsNeedingFreshQr = new Set();
const manualDisconnects = new Set();
const backupTimers = new Map();
const backupRunning = new Set();
const backupAgain = new Set();
const lidPhoneJids = new Map();
const sessionGenerations = new Map();
const reconnectTimers = new Map();
const reconnectAttempts = new Map();
const unauthorizedMessageIds = new Map();
const DEFAULT_REKENING_CHANNELS = ['BCA', 'GOPAY', 'QRIS', 'SUPERBANK', 'TRANSFER', 'CASH'];

const DEFAULT_ALLOWED_WHATSAPP_NUMBERS = [
    '639917877997',
    '628196091283',
    '628970091283',
];

function getReconnectDelayMs(statusCode, attempt) {
    const baseDelay =
        statusCode === 428 ? 15000 :
        statusCode === 503 ? 10000 :
        statusCode === 405 ? 30000 :
        5000;
    const retryPenalty = Math.min(Math.max(attempt - 1, 0) * 10000, 90000);
    return Math.min(baseDelay + retryPenalty, 120000);
}

function scheduleReconnect(userId, statusCode, reason) {
    if (reconnectTimers.has(userId)) return;

    const attempt = (reconnectAttempts.get(userId) || 0) + 1;
    reconnectAttempts.set(userId, attempt);

    const reconnectDelay = getReconnectDelayMs(statusCode, attempt);
    const readableDelay = Math.round(reconnectDelay / 1000);
    const reconnectReason = reason || 'Connection lost';
    sessionErrors.set(userId, `${reconnectReason}; reconnecting in ${readableDelay}s`);
    console.log(`[${userId}] Scheduling WhatsApp reconnect attempt ${attempt} in ${readableDelay}s`);

    const timer = setTimeout(() => {
        reconnectTimers.delete(userId);
        activeSessions.delete(userId);
        sessionErrors.delete(userId);

        initSession(userId).catch((initError) => {
            const message = initError?.message || 'Reconnect failed';
            activeSessions.delete(userId);
            sessionErrors.set(userId, message);
            console.error(`[${userId}] WhatsApp reconnect attempt ${attempt} failed: ${message}`);
            scheduleReconnect(userId, statusCode, message);
        });
    }, reconnectDelay);

    timer.unref?.();
    reconnectTimers.set(userId, timer);
}

function rememberBotMessage(userId, messageId) {
    if (!messageId) return;
    const ids = botMessageIds.get(userId) || new Set();
    ids.add(messageId);
    botMessageIds.set(userId, ids);
    setTimeout(() => ids.delete(messageId), 10 * 60 * 1000);
}

function maskJid(jid = '') {
    const text = String(jid);
    if (!text) return 'unknown';
    return text.replace(/^(\d{2})\d+(\d{3})@/, '$1***$2@');
}

function jidToPhoneNumber(jid = '') {
    if (!jid) return '';
    const decoded = jidDecode(jidNormalizedUser(jid));
    const user = decoded?.user || '';
    return /^\d{8,15}$/.test(user) ? user : '';
}

function normalizePhoneNumber(value = '') {
    return String(value || '').replace(/\D/g, '');
}

function phoneNumberFromJidForAccess(jid = '') {
    if (!jid) return '';
    const normalized = jidNormalizedUser(jid);
    if (normalized.endsWith('@lid')) return '';
    return normalizePhoneNumber(jidToPhoneNumber(normalized));
}

function getAllowedWhatsappNumbers() {
    const configured = String(process.env.ALLOWED_WHATSAPP_NUMBERS || '')
        .split(/[,\s]+/)
        .map(normalizePhoneNumber)
        .filter(Boolean);
    return new Set(configured.length ? configured : DEFAULT_ALLOWED_WHATSAPP_NUMBERS);
}

function collectSenderPhoneNumbers(userId, remoteJid, senderPhoneJid, settings = {}) {
    const normalizedRemote = jidNormalizedUser(remoteJid || '');
    const mappedJid = settings.jid_mappings?.[normalizedRemote] || lidPhoneJids.get(userId)?.get(normalizedRemote);
    const candidates = [
        remoteJid,
        senderPhoneJid,
        mappedJid,
    ];

    return [...new Set(candidates
        .map(phoneNumberFromJidForAccess)
        .filter(Boolean))];
}

function getSenderAccess(userId, remoteJid, senderPhoneJid, settings = {}) {
    const allowedNumbers = getAllowedWhatsappNumbers();
    const senderNumbers = collectSenderPhoneNumbers(userId, remoteJid, senderPhoneJid, settings);
    return {
        allowed: senderNumbers.some((phone) => allowedNumbers.has(phone)),
        senderNumbers,
    };
}

function shouldHandleUnauthorizedMessage(userId, messageId) {
    if (!messageId) return true;
    const ids = unauthorizedMessageIds.get(userId) || new Set();
    if (ids.has(messageId)) return false;
    ids.add(messageId);
    unauthorizedMessageIds.set(userId, ids);
    setTimeout(() => ids.delete(messageId), 10 * 60 * 1000);
    return true;
}

function isBlockablePrivateChat(jid = '') {
    const normalized = jid ? jidNormalizedUser(jid) : '';
    return Boolean(
        normalized &&
        normalized !== 'status@broadcast' &&
        !normalized.endsWith('@g.us') &&
        !normalized.endsWith('@broadcast')
    );
}

function chooseUnauthorizedBlockTarget(userId, msg, remoteJid, senderPhoneJid, settings = {}) {
    const normalizedRemote = jidNormalizedUser(remoteJid);
    if (!isBlockablePrivateChat(normalizedRemote)) return '';

    const mappedJid = settings.jid_mappings?.[normalizedRemote] || lidPhoneJids.get(userId)?.get(normalizedRemote);
    const candidateJids = [
        msg.key.remoteJidAlt,
        msg.key.participantAlt,
        msg.key.senderPn,
        msg.key.participantPn,
        senderPhoneJid,
        mappedJid,
    ];

    const phoneTarget = candidateJids
        .filter(Boolean)
        .map((jid) => jidNormalizedUser(jid))
        .find((jid) => phoneNumberFromJidForAccess(jid));

    return phoneTarget || normalizedRemote;
}

async function blockUnauthorizedSender(sock, userId, msg, remoteJid, senderPhoneJid, settings = {}) {
    const targetJid = chooseUnauthorizedBlockTarget(userId, msg, remoteJid, senderPhoneJid, settings);
    if (!targetJid) {
        console.warn(`[${userId}] Unauthorized WhatsApp sender ignored; non-private chat ${maskJid(remoteJid)}`);
        return null;
    }

    await sock.updateBlockStatus(targetJid, 'block');
    console.warn(`[${userId}] Unauthorized WhatsApp sender blocked: ${maskJid(targetJid)} (remote ${maskJid(remoteJid)})`);
    return targetJid;
}

function getSheetSenderIdentity(userId, remoteJid, senderPhoneJid, settings = {}) {
    const normalizedRemote = jidNormalizedUser(remoteJid);
    const mappedJid = settings.jid_mappings?.[normalizedRemote] || lidPhoneJids.get(userId)?.get(normalizedRemote);
    const preferredJid = senderPhoneJid || mappedJid || (!normalizedRemote.endsWith('@lid') ? normalizedRemote : '');
    return jidToPhoneNumber(preferredJid) || normalizedRemote;
}

function rememberLidPhoneJid(userId, lid, jid) {
    if (!lid || !jid) return;
    const map = lidPhoneJids.get(userId) || new Map();
    map.set(jidNormalizedUser(lid), jidNormalizedUser(jid));
    lidPhoneJids.set(userId, map);
    console.log(`[${userId}] WhatsApp LID mapped ${maskJid(lid)} → ${maskJid(jid)}`);
}

function ownJidUsers(...jids) {
    return new Set(jids
        .flat()
        .filter(Boolean)
        .map((jid) => jidDecode(jidNormalizedUser(jid))?.user)
        .filter(Boolean));
}

function phoneSessionCandidates(sessionPath, ownJid, remoteJid) {
    if (!fs.existsSync(sessionPath)) return [];

    const ownUsers = ownJidUsers(ownJid);
    const remoteUser = jidDecode(jidNormalizedUser(remoteJid))?.user;
    const candidates = fs.readdirSync(sessionPath)
        .map((name) => name.match(/^session-(\d+)\.\d+\.json$/)?.[1])
        .filter(Boolean)
        .filter((user) => !ownUsers.has(user) && user !== remoteUser)
        // LID values can also look numeric, but phone-number sessions usually follow
        // E.164 without "+". Keep this country-agnostic because the sender can be +63,
        // +62, or any other valid personal WhatsApp number.
        .filter((user) => /^\d{8,15}$/.test(user));

    return [...new Set(candidates)].map((user) => `${user}@s.whatsapp.net`);
}

function filterOutKnownJids(candidates, ownJid, remoteJid) {
    const ownUsers = ownJidUsers(ownJid);
    const remoteUser = jidDecode(jidNormalizedUser(remoteJid))?.user;
    return [...new Set(candidates)].filter((jid) => {
        const user = jidDecode(jidNormalizedUser(jid))?.user;
        return user && !ownUsers.has(user) && user !== remoteUser;
    });
}

async function getReplyTargetJid(userId, remoteJid, sessionPath, ownJid, settings = {}) {
    const normalized = jidNormalizedUser(remoteJid);
    const savedMapped = settings.jid_mappings?.[normalized];
    if (savedMapped) return jidNormalizedUser(savedMapped);

    const mapped = lidPhoneJids.get(userId)?.get(normalized);
    if (mapped) return mapped;

    if (normalized.endsWith('@lid')) {
        let candidates = phoneSessionCandidates(sessionPath, ownJid, normalized);
        if (!candidates.length) {
            try {
                candidates = await listStoredPhoneSessionJids(userId);
            } catch (error) {
                console.warn(`[${userId}] WhatsApp LID Cloud Storage fallback lookup failed: ${error.message}`);
            }
        }
        candidates = filterOutKnownJids(candidates, ownJid, normalized);

        if (candidates.length === 1) {
            console.log(`[${userId}] WhatsApp LID fallback target ${maskJid(normalized)} → ${maskJid(candidates[0])}`);
            return candidates[0];
        }
        if (candidates.length > 1) {
            console.warn(`[${userId}] WhatsApp LID fallback skipped for ${maskJid(normalized)}; multiple phone candidates: ${candidates.map(maskJid).join(', ')}`);
        } else {
            console.warn(`[${userId}] WhatsApp LID fallback unavailable for ${maskJid(normalized)}; no phone candidate found`);
        }
    }

    return normalized;
}

function scheduleSessionBackup(userId, sessionPath, delayMs = 30000) {
    const existingTimer = backupTimers.get(userId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
        backupTimers.delete(userId);
        runSessionBackup(userId, sessionPath);
    }, delayMs);
    timer.unref?.();
    backupTimers.set(userId, timer);
}

async function runSessionBackup(userId, sessionPath) {
    if (backupRunning.has(userId)) {
        backupAgain.add(userId);
        return;
    }

    backupRunning.add(userId);
    try {
        await backupSession(userId, sessionPath);
    } catch (error) {
        console.error(`[${userId}] Session backup failed: ${error.message}`);
    } finally {
        backupRunning.delete(userId);
        if (backupAgain.delete(userId)) {
            scheduleSessionBackup(userId, sessionPath, 5000);
        }
    }
}

async function markIncomingMessage(userId, messageId) {
    if (!messageId) return true;
    const result = db.prepare(`
        INSERT OR IGNORE INTO processed_messages (user_id, message_id)
        VALUES (?, ?)
    `).run(userId, messageId);
    try {
        await getAdminFirestore()
            .collection('users').doc(userId).collection('processed_messages').doc(messageId)
            .create({
                status: 'processing',
                createdAt: FieldValue.serverTimestamp(),
            });
        return true;
    } catch (error) {
        if (error.code === 6 || error.message?.includes('ALREADY_EXISTS')) return false;
        console.error(`[${userId}] Firestore processed message marker failed: ${error.message}`);
        return result.changes > 0;
    }
}

function saveConversation(userId, phoneNumber, message, isFromMe, messageId = null) {
    db.prepare(`
        INSERT INTO conversations (user_id, message_id, phone_number, message, is_from_me)
        VALUES (?, ?, ?, ?, ?)
    `).run(userId, messageId, phoneNumber, message, isFromMe ? 1 : 0);

    getAdminFirestore()
        .collection('users').doc(userId).collection('conversations')
        .add({
            message_id: messageId,
            phone_number: phoneNumber,
            message,
            is_from_me: Boolean(isFromMe),
            source: 'WhatsApp',
            timestamp: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
        })
        .catch((error) => console.error(`[${userId}] Firestore conversation save failed: ${error.message}`));
}

async function saveExpenseRecord(userId, phoneNumber, extracted, source = 'WhatsApp', messageId = null) {
    if (!extracted?.amount) return null;

    if (messageId) {
        const existing = db.prepare(`
            SELECT id, user_id, phone_number, merchant, category, amount, date, confidence,
                   payment_channel, type, status, source, source_message_id, recap_id, recap_name, recap_status, created_at
            FROM expenses
            WHERE user_id = ? AND source_message_id = ?
            ORDER BY id DESC
            LIMIT 1
        `).get(userId, messageId);
        if (existing) {
            console.log(`[${userId}] Expense already saved for message ${messageId}; skipping duplicate insert (expense#${existing.id})`);
            return {
                ...existing,
                createdAt: existing.created_at ? new Date(existing.created_at) : new Date(),
            };
        }
    }

    const settings = await getUserSettings(userId).catch(() => ({}));
    const activeRecapId = settings.active_recap_id || null;
    const activeRecapName = settings.active_recap_name || null;
    const dateStr = extracted.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const paymentChannel = extracted.payment_channel || 'Cash';
    const transactionType = String(extracted.type || '').toLowerCase() === 'income' ? 'income' : 'expense';
    const merchant = extracted.merchant || extracted.deskripsi || 'Transaksi WhatsApp';
    const category = extracted.category || 'Lainnya';
    const confidence = extracted.confidence || 'High';

    db.prepare(`
        INSERT INTO expenses (user_id, phone_number, merchant, category, amount, date, confidence, payment_channel, type, status, source, source_message_id, recap_id, recap_name, recap_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, phoneNumber, merchant, category, extracted.amount, dateStr, confidence, paymentChannel, transactionType, 'Saved', source, messageId, activeRecapId, activeRecapName, 'active');

    const firestorePayload = {
        source_message_id: messageId,
        phone_number: phoneNumber,
        merchant,
        category,
        amount: Number(extracted.amount),
        date: dateStr,
        confidence,
        payment_channel: paymentChannel,
        type: transactionType,
        source,
        status: 'Saved',
        recap_id: activeRecapId,
        recap_name: activeRecapName,
        recap_status: 'active',
        timestamp: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
    };

    const firestoreRef = await getAdminFirestore()
        .collection('users').doc(userId).collection('expenses')
        .add(firestorePayload)
        .catch((error) => {
            console.error(`[${userId}] Firestore expense save failed: ${error.message}`);
            return null;
        });

    return {
        ...firestorePayload,
        id: firestoreRef?.id || null,
        createdAt: new Date(),
    };
}

function findLatestActiveExpenseRecord(userId, phoneNumber) {
    const activeStatusWhere = `COALESCE(status, 'Saved') NOT IN ('Cancelled', 'Canceled', 'Dibatalkan')`;
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    let row = null;

    if (normalizedPhone) {
        row = db.prepare(`
            SELECT * FROM expenses
            WHERE user_id = ? AND phone_number = ? AND ${activeStatusWhere}
            ORDER BY id DESC
            LIMIT 1
        `).get(userId, normalizedPhone);
    }

    if (!row) {
        row = db.prepare(`
            SELECT * FROM expenses
            WHERE user_id = ? AND ${activeStatusWhere}
            ORDER BY id DESC
            LIMIT 1
        `).get(userId);
    }

    return row || null;
}

async function cancelLastExpenseRecord(userId, phoneNumber, cancelMessageId = null) {
    const activeStatusWhere = `COALESCE(status, 'Saved') NOT IN ('Cancelled', 'Canceled', 'Dibatalkan')`;
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    let row = null;
    let firestoreCancelled = null;

    if (normalizedPhone) {
        row = db.prepare(`
            SELECT * FROM expenses
            WHERE user_id = ? AND phone_number = ? AND ${activeStatusWhere}
            ORDER BY id DESC
            LIMIT 1
        `).get(userId, normalizedPhone);
    }

    if (!row) {
        row = db.prepare(`
            SELECT * FROM expenses
            WHERE user_id = ? AND ${activeStatusWhere}
            ORDER BY id DESC
            LIMIT 1
        `).get(userId);
    }

    try {
        const collectionRef = getAdminFirestore()
            .collection('users').doc(userId).collection('expenses');
        const recent = await collectionRef
            .orderBy('createdAt', 'desc')
            .limit(30)
            .get();
        const match = recent.docs.find((docItem) => {
            const data = docItem.data();
            const status = String(data.status || 'Saved').toLowerCase();
            return (
                !['cancelled', 'canceled', 'dibatalkan'].includes(status) &&
                (!normalizedPhone || String(data.phone_number || '') === normalizedPhone)
            );
        });
        if (match) {
            await match.ref.update({
                status: 'Cancelled',
                cancelledAt: FieldValue.serverTimestamp(),
                cancelled_by_message_id: cancelMessageId || null,
            });
            firestoreCancelled = { id: match.id, ...match.data() };
        }
    } catch (error) {
        console.error(`[${userId}] Firestore latest cancel lookup failed: ${error.message}`);
    }

    if (!row) return firestoreCancelled;

    db.prepare(`
        UPDATE expenses
        SET status = 'Cancelled',
            cancelled_at = datetime('now', 'localtime'),
            cancelled_by_message_id = ?
        WHERE id = ?
    `).run(cancelMessageId, row.id);

    try {
        const snapshot = row.source_message_id
            ? await getAdminFirestore()
                .collection('users').doc(userId).collection('expenses')
                .where('source_message_id', '==', row.source_message_id)
                .limit(1)
                .get()
            : { empty: true, docs: [] };

        if (!snapshot.empty) {
            await snapshot.docs[0].ref.update({
                status: 'Cancelled',
                cancelledAt: FieldValue.serverTimestamp(),
                cancelled_by_message_id: cancelMessageId || null,
            });
        } else if (!firestoreCancelled) {
            const recent = await getAdminFirestore()
                .collection('users').doc(userId).collection('expenses')
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();
            const match = recent.docs.find((docItem) => {
                const data = docItem.data();
                return (
                    data.status !== 'Cancelled' &&
                    (!normalizedPhone || String(data.phone_number || '') === normalizedPhone) &&
                    Number(data.amount || 0) === Number(row.amount || 0) &&
                    String(data.payment_channel || '').toLowerCase() === String(row.payment_channel || '').toLowerCase()
                );
            });
            if (match) {
                await match.ref.update({
                    status: 'Cancelled',
                    cancelledAt: FieldValue.serverTimestamp(),
                    cancelled_by_message_id: cancelMessageId || null,
                });
            }
        }
    } catch (error) {
        console.error(`[${userId}] Firestore cancel failed: ${error.message}`);
    }

    return row;
}

function extractCancelMessageIds(text) {
    const normalized = String(text || '').trim();
    const match = normalized.match(/^(?:batal|cancel|hapus)\s+(?:id|message(?:\s+id)?|msg)?\s+([\s\S]+)$/i);
    if (!match) return [];
    return [...new Set(
        match[1]
            .split(/[\s,;]+/)
            .map((item) => item.trim().replace(/[^a-zA-Z0-9._:-]/g, ''))
            .filter((item) => /^[a-zA-Z0-9._:-]{8,80}$/.test(item))
    )];
}

async function cancelExpenseRecordsByMessageIds(userId, messageIds = [], cancelMessageId = null) {
    const ids = [...new Set((messageIds || []).map((item) => String(item || '').trim()).filter(Boolean))];
    if (!ids.length) return { cancelled: [], missing: [] };

    const result = { cancelled: [], missing: [] };
    const placeholders = ids.map(() => '?').join(', ');
    const rows = db.prepare(`
        SELECT * FROM expenses
        WHERE user_id = ? AND source_message_id IN (${placeholders})
          AND COALESCE(status, 'Saved') NOT IN ('Cancelled', 'Canceled', 'Dibatalkan')
    `).all(userId, ...ids);
    const foundLocal = new Set(rows.map((row) => row.source_message_id));

    for (const row of rows) {
        db.prepare(`
            UPDATE expenses
            SET status = 'Cancelled',
                cancelled_at = datetime('now', 'localtime'),
                cancelled_by_message_id = ?
            WHERE id = ?
        `).run(cancelMessageId, row.id);
    }

    try {
        const collectionRef = getAdminFirestore()
            .collection('users').doc(userId).collection('expenses');

        for (const id of ids) {
            const snapshot = await collectionRef
                .where('source_message_id', '==', id)
                .limit(10)
                .get();

            if (snapshot.empty && !foundLocal.has(id)) {
                result.missing.push(id);
                continue;
            }

            let firestoreHit = false;
            for (const docItem of snapshot.docs) {
                const status = String(docItem.data().status || 'Saved').toLowerCase();
                if (['cancelled', 'canceled', 'dibatalkan'].includes(status)) {
                    firestoreHit = true;
                    continue;
                }
                await docItem.ref.update({
                    status: 'Cancelled',
                    cancelledAt: FieldValue.serverTimestamp(),
                    cancelled_by_message_id: cancelMessageId || null,
                });
                firestoreHit = true;
            }

            if (firestoreHit || foundLocal.has(id)) result.cancelled.push(id);
            else result.missing.push(id);
        }
    } catch (error) {
        console.error(`[${userId}] Firestore cancel by message IDs failed: ${error.message}`);
        ids.forEach((id) => {
            if (foundLocal.has(id) && !result.cancelled.includes(id)) result.cancelled.push(id);
        });
    }

    return result;
}

function parseAmountValue(rawNumber, rawUnit = '') {
    const normalizedNumber = String(rawNumber || '').replace(/\./g, '').replace(',', '.');
    const value = Number(normalizedNumber);
    if (!Number.isFinite(value)) return 0;
    const unit = String(rawUnit || '').toLowerCase();
    if (['rb', 'ribu', 'k'].includes(unit)) return Math.round(value * 1000);
    if (['jt', 'juta'].includes(unit)) return Math.round(value * 1000000);
    return Math.round(value);
}

function detectForcedExpenseCategory(lowerText) {
    const text = String(lowerText || '').toLowerCase();
    const hasInstallment = /\b(cicil|cicilan|mencicil|angsuran)\b/.test(text);
    const hasRecurringBill = /\b(?:bayar|pembayaran)\s+(?:kos|kosan|motor|xl|banjar|internet)\b/.test(text);
    const hasUtilityBill = /\b(internet|pulsa|token listrik|tagihan)\b/.test(text);
    if (hasInstallment || hasRecurringBill || hasUtilityBill) return 'Tagihan';

    if (/\bbelanja\b/.test(text)) return 'Belanja';
    if (/\b(?:sayur|sayuran|beras)\b/.test(text)) return 'Belanja';

    const hasSpecificFood = /\b(tahu\s+kucek|risol|roti|pisang(?:\s+goreng)?|gorengan|napong|tempong|mizone)\b/.test(text);
    if (hasSpecificFood) return 'Makan';

    return null;
}

function detectCategory(lowerText) {
    const forcedCategory = detectForcedExpenseCategory(lowerText);
    if (forcedCategory) return forcedCategory;
    const categoryMap = [
        ['Makan', ['makan', 'minum', 'kopi', 'resto', 'warung', 'nasi', 'ayam', 'bakso', 'mie', 'tahu kucek', 'risol', 'roti', 'pisang', 'pisang goreng', 'gorengan', 'napong', 'tempong', 'mizone']],
        ['Transport', ['bensin', 'parkir', 'tol', 'grab', 'gojek', 'taxi', 'ojek', 'transport']],
        ['Belanja', ['belanja', 'sayur', 'sayuran', 'beras', 'shopee', 'tokopedia', 'lazada', 'beli barang']],
        ['Tagihan', ['listrik', 'air', 'internet', 'pulsa', 'token', 'tagihan', 'banjar']],
        ['Gaji', ['gaji', 'salary', 'bonus', 'terima uang', 'transfer masuk']],
    ];
    const found = categoryMap.find(([, keywords]) => keywords.some((keyword) => lowerText.includes(keyword)));
    return found ? found[0] : 'Lainnya';
}

function detectIncomeCategory(lowerText) {
    if (/\b(gaji|salary|upah|payroll)\b/.test(lowerText)) return 'Gaji';
    if (/\b(pembayaran|bayaran|dibayar|pelunasan|invoice|tagihan dibayar)\b/.test(lowerText)) return 'Pembayaran';
    if (/\b(bonus|thr|komisi|fee)\b/.test(lowerText)) return 'Bonus';
    return 'Pemasukan';
}

function detectPaymentChannel(text) {
    const knownChannels = ['BCA', 'MANDIRI', 'BRI', 'BNI', 'CIMB', 'PERMATA', 'SUPERBANK', 'JAGO', 'GOPAY', 'QRIS', 'OVO', 'DANA', 'SHOPEEPAY', 'TRANSFER', 'CASH'];
    const lowerText = text.toLowerCase();
    const direct = knownChannels.find((channel) => lowerText.includes(channel.toLowerCase()));
    if (direct) return direct;
    const afterKeyword = lowerText.match(/\b(?:dari|pake|pakai|via|rekening|rek)\s+([a-z0-9 ]{2,24})/i);
    if (!afterKeyword) return 'Cash';
    return afterKeyword[1].trim().split(/\s+/).slice(0, 2).join(' ').toUpperCase();
}

function parseLocalTransaction(text) {
    const trimmed = String(text || '').trim();
    const lowerText = trimmed.toLowerCase();
    if (!trimmed || ['help', 'bantuan'].includes(lowerText) || lowerText.startsWith('saldo') || lowerText.startsWith('laporan')) return null;

    const amountMatch = lowerText.match(/(?:rp\s*)?(\d+(?:[.,]\d+)?)(?:\s*(rb|ribu|k|jt|juta))?\b/i);
    if (!amountMatch) return null;
    const amount = parseAmountValue(amountMatch[1], amountMatch[2]);
    if (!amount) return null;

    const incomeWords = ['gaji', 'bonus', 'terima', 'masuk', 'dibayar', 'income', 'pemasukan', 'pembayaran', 'bayaran', 'komisi', 'fee'];
    const type = incomeWords.some((word) => lowerText.includes(word)) ? 'income' : 'expense';
    return {
        type,
        merchant: trimmed.replace(amountMatch[0], '').replace(/\b(dari|pake|pakai|via|rekening|rek)\b.*$/i, '').trim() || trimmed,
        amount,
        category: type === 'income' ? detectIncomeCategory(lowerText) : detectCategory(lowerText),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        payment_channel: detectPaymentChannel(trimmed),
        confidence: 'High',
    };
}

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)),
    ]);
}

function messageTimestampMs(message) {
    const timestamp = message?.messageTimestamp;
    if (!timestamp) return 0;
    if (typeof timestamp === 'number') return timestamp * 1000;
    if (typeof timestamp.toNumber === 'function') return timestamp.toNumber() * 1000;
    const numeric = Number(timestamp);
    return Number.isFinite(numeric) ? numeric * 1000 : 0;
}

function isRecentAppendMessage(message) {
    const timestamp = messageTimestampMs(message);
    if (!timestamp) return false;
    const ageMs = Date.now() - timestamp;
    return ageMs > -120000 && ageMs < 10 * 60 * 1000;
}

async function extractExpenseWithAI(text, settings = {}) {
    const apiKey = settings.groq_key || fallbackGroqKey;
    if (!apiKey) {
        console.warn('GROQ_API_KEY belum diatur; pemrosesan lokal Groq dilewati.');
        return null;
    }

    try {
        const groq = new Groq({ apiKey });
        const defaultSystemPrompt = `
        You are an AI assistant that extracts expense data from casual WhatsApp messages in Indonesian.
        Users will use informal formats like "75rb" (means 75,000), "120k" (means 120,000), "pake" (means using), "grab" etc.
        Extract the following information from the text:
        - type (string: "expense" if they spent money, or "income" if they received money like salary/gaji)
        - merchant (string, e.g., "Nasi Padang", "Shopee", "Kantor", "Gaji")
        - amount (number, the true numerical value, e.g., if user says "75rb", output 75000)
        - category (string: for expenses, use "Belanja" if the text contains "belanja" (like belanja sayuran, belanja beras) and for groceries like sayur/sayuran/beras; use "Makan" for food/drinks including tahu kucek, risol, any roti variant, pisang, pisang goreng, gorengan, napong/nasi tempong, mizone; use "Tagihan" for bills, kos, motor, cicilan, internet, pulsa; otherwise use "Transport", "Tagihan", or "Lainnya"; for income use "Gaji" only when the text explicitly mentions salary/gaji/upah/payroll, otherwise use "Pembayaran", "Bonus", or "Pemasukan")
        - date (string, formatted as "MMM DD, YYYY". If relative like "today", use today's date)
        - payment_channel (string: extract the bank or payment method used, e.g., "SUPERBANK", "BCA", "GOPAY", "QRIS", "TRANSFER", "OVO", "Cash". If not mentioned, default to "Cash")

        Respond ONLY with a valid JSON object. Do not include markdown formatting or explanations.
        Example 1: {"type": "expense", "merchant": "Belanja Sayuran", "amount": 50000, "category": "Belanja", "date": "May 21, 2024", "payment_channel": "BCA", "confidence": "High"}
        Example 2: {"type": "expense", "merchant": "Roti Matcha", "amount": 20000, "category": "Makan", "date": "May 21, 2024", "payment_channel": "Cash", "confidence": "High"}
        Example 3: {"type": "income", "merchant": "Gaji Bulanan", "amount": 5000000, "category": "Gaji", "date": "May 21, 2024", "payment_channel": "BCA", "confidence": "High"}
        `;
        const systemPrompt = settings.system_prompt || defaultSystemPrompt;

        const completion = await withTimeout(groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Pesan transaksi WhatsApp: ${text}` },
            ],
            model: normalizeAiModel(settings.ai_model || DEFAULT_AI_MODEL),
            temperature: 0.1,
        }), 8000, 'Groq extraction');

        const jsonString = completion.choices[0]?.message?.content || '{}';
        // Clean up potential markdown formatting from the response
        const cleanJsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJsonString);
        const rawType = String(parsed.type || '').toLowerCase();
        const transactionType = rawType === 'income' || rawType === 'masuk' ? 'income' : 'expense';
        return {
            ...parsed,
            category: transactionType === 'expense'
                ? detectForcedExpenseCategory(text) || parsed.category || parsed.cat || 'Lainnya'
                : parsed.category || parsed.cat || 'Pemasukan',
            amount: Number(parsed.amount ?? parsed.amt) || 0,
            type: transactionType,
            payment_channel: parsed.payment_channel || parsed.rek || 'Cash',
            merchant: parsed.merchant || parsed.deskripsi || text,
        };
    } catch (error) {
        console.error("Groq Extraction Error:", error);
        return null;
    }
}

async function forwardMessageToAppsScript(endpoint, payload, options = {}) {
    const timeoutMs = Number(options.timeoutMs || 20000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        const reply = await response.text();
        if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
        if (reply.trim().startsWith('❌')) throw new Error(reply.trim());
        return reply || '✅ Pesan diterima oleh Apps Script.';
    } catch (error) {
        if (error.name === 'AbortError' || error.message === 'This operation was aborted') {
            throw new Error(`Apps Script timeout after ${Math.round(timeoutMs / 1000)}s`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

function isAppsScriptTimeoutError(error) {
    return /timeout|aborted|operation was aborted|Apps Script HTTP (?:404|429|5\d\d)/i.test(String(error?.message || error || ''));
}

async function forwardMessageToAppsScriptWithRecovery(endpoint, payload, options = {}) {
    try {
        return await forwardMessageToAppsScript(endpoint, payload, options);
    } catch (error) {
        if (!isAppsScriptTimeoutError(error)) throw error;

        const label = options.label || payload?.message_id || payload?.command || 'request';
        const recoveryDelayMs = Number(options.recoveryDelayMs || 6000);
        const recoveryTimeoutMs = Number(options.recoveryTimeoutMs || Math.max(Number(options.timeoutMs || 20000), 60000));
        console.warn(`Apps Script timeout for ${label}; retrying idempotently after ${recoveryDelayMs}ms with timeout ${recoveryTimeoutMs}ms.`);
        await new Promise((resolve) => setTimeout(resolve, recoveryDelayMs));
        return await forwardMessageToAppsScript(endpoint, payload, {
            ...options,
            timeoutMs: recoveryTimeoutMs,
        });
    }
}

function appendMessageIdToTransactionReply(reply, messageId) {
    const text = String(reply || '')
        .split('\n')
        .filter((line) => (
            !/^\s*(?:📄\s*)?Sheet\s*:/i.test(line) &&
            !/^\s*(?:⚙️\s*)?Script\s*:/i.test(line) &&
            !/^\s*WA_FINANCE_SCRIPT_/i.test(line) &&
            !/^\s*SPREADSHEET_ID=/i.test(line) &&
            !/^\s*TIME=/i.test(line)
        ))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (!messageId || !/Transaksi Tercatat/i.test(text) || /Message ID/i.test(text)) return text;
    const marker = '━━━━━━━━━━━━━━━━━━\n✅ Berhasil disimpan';
    const messageIdLine = `🆔 Message ID : ${messageId}\n`;
    if (text.includes(marker)) {
        return text.replace(marker, `━━━━━━━━━━━━━━━━━━\n${messageIdLine}✅ Berhasil disimpan`);
    }
    return `${text}\n${messageIdLine.trim()}`;
}

function isAppsScriptDiagnosticReply(reply) {
    const text = String(reply || '').trim();
    return Boolean(
        /^WA_FINANCE_SCRIPT_/i.test(text) ||
        /\nSPREADSHEET_ID=/i.test(text) ||
        /\nTIME=\d{4}-\d{2}-\d{2}T/i.test(text)
    );
}

function buildTransactionReplyFromExtracted(extracted, messageId) {
    if (!extracted?.amount) return '';
    const type = String(extracted.type || '').toLowerCase() === 'income' ? 'Masuk' : 'Keluar';
    const category = extracted.category || (type === 'Masuk' ? 'Pemasukan' : 'Lainnya');
    const rekening = extracted.payment_channel || 'Cash';
    return [
        '📝 *Transaksi Tercatat*',
        '━━━━━━━━━━━━━━━━━━',
        `📂 Kategori  : ${category}`,
        `💰 Jumlah    : ${formatCurrencyId(extracted.amount)}`,
        `💳 Rekening  : ${rekening}`,
        `↔️ Tipe      : ${type}`,
        '━━━━━━━━━━━━━━━━━━',
        messageId ? `🆔 Message ID : ${messageId}` : '',
        '✅ Berhasil disimpan',
    ].filter(Boolean).join('\n');
}

function getSafeTransactionReply(appsScriptReply, extracted, messageId) {
    if (isAppsScriptDiagnosticReply(appsScriptReply)) {
        return buildTransactionReplyFromExtracted(extracted, messageId);
    }

    const cleaned = appendMessageIdToTransactionReply(appsScriptReply, messageId);
    if (extracted?.amount && !/Transaksi Tercatat/i.test(cleaned)) {
        return buildTransactionReplyFromExtracted(extracted, messageId);
    }

    return cleaned;
}

function formatCurrencyId(amount) {
    return `Rp ${Math.round(Number(amount || 0)).toLocaleString('id-ID')}`;
}

function currentBudgetMonthKey(now = new Date(), settings = {}) {
    if (settings.active_recap_start_date) return `recap-${settings.active_recap_start_date}`;
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function startOfCurrentMonth(now = new Date()) {
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfActiveBudgetPeriod(settings = {}, now = new Date()) {
    const raw = String(settings.active_recap_start_date || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (!Number.isNaN(date.getTime())) return date;
    }
    return startOfCurrentMonth(now);
}

function isActiveExpenseStatus(status) {
    return !['cancelled', 'canceled', 'dibatalkan'].includes(String(status || 'Saved').toLowerCase());
}

function firestoreDateValue(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function isSalaryIncomeItem(item = {}) {
    if (String(item.type || '').toLowerCase() !== 'income') return false;
    const text = [
        item.category,
        item.merchant,
        item.description,
        item.pesan,
        item.message,
    ].filter(Boolean).join(' ').toLowerCase();
    return /\b(gaji|salary|upah|payroll)\b/.test(text);
}

async function getMonthlyTotalsFromFirestore(userId, now = new Date(), settings = {}) {
    const periodStart = startOfActiveBudgetPeriod(settings, now);
    const snapshot = await getAdminFirestore()
        .collection('users').doc(userId).collection('expenses')
        .get();

    let expense = 0;
    let salaryIncome = 0;
    let extraIncome = 0;
    snapshot.forEach((doc) => {
        const item = doc.data() || {};
        if (!isActiveExpenseStatus(item.status)) return;
        if (String(item.recap_status || 'active').toLowerCase() === 'archived') return;
        const date = firestoreDateValue(item.createdAt || item.timestamp || item.date);
        if (date && date < periodStart) return;
        if (String(item.type || 'expense').toLowerCase() === 'income') {
            if (isSalaryIncomeItem(item)) salaryIncome += Number(item.amount || 0);
            else extraIncome += Number(item.amount || 0);
        } else {
            expense += Number(item.amount || 0);
        }
    });
    return { expense, salaryIncome, extraIncome, income: salaryIncome + extraIncome };
}

async function buildMonthlyBudgetAlertIfNeeded(userId, settings = {}, latestTransaction = null) {
    try {
    if (!latestTransaction || String(latestTransaction.type || '').toLowerCase() === 'income') return '';

    const budget = Number(settings.monthly_budget || 0);
    if (!budget) return '';

    const now = new Date();
    const monthKey = currentBudgetMonthKey(now, settings);
    const thresholds = Array.isArray(settings.budget_alert_thresholds) && settings.budget_alert_thresholds.length
        ? settings.budget_alert_thresholds.map(Number).filter((item) => Number.isFinite(item)).sort((a, b) => a - b)
        : [80, 90, 95, 100];
    const sentLevels = settings.budget_alert_month === monthKey && Array.isArray(settings.budget_alert_levels)
        ? settings.budget_alert_levels.map(Number)
        : [];

    const monthlyTotals = await getMonthlyTotalsFromFirestore(userId, now, settings);
    const monthlySpend = monthlyTotals.expense;
    const monthlyExtraIncome = monthlyTotals.extraIncome;
    const usedPercent = budget ? (monthlySpend / budget) * 100 : 0;
    const crossed = thresholds.filter((level) => usedPercent >= level && !sentLevels.includes(level));
    if (!crossed.length) return '';

    const nextLevels = [...new Set([...sentLevels, ...crossed])].sort((a, b) => a - b);
    await saveUserSettings(userId, {
        budget_alert_month: monthKey,
        budget_alert_levels: nextLevels,
    });

    const remaining = budget + monthlyExtraIncome - monthlySpend;
    const crossedLabel = crossed[crossed.length - 1];
    const statusLine = remaining >= 0
        ? 'Pengeluaran periode aktif sudah mendekati batas budget.'
        : 'Budget periode aktif sudah terlewati.';

    return [
        '',
        'Monthly Budget Alert ⚠️‼️',
        '━━━━━━━━━━━━━━━━━━',
        `💰 Budget       : ${formatCurrencyId(budget)}`,
        `📥 Masuk        : ${formatCurrencyId(monthlyExtraIncome)}`,
        `💸 Pengeluaran  : ${formatCurrencyId(monthlySpend)}`,
        `🚨 Sisa Budget  : ${formatCurrencyId(remaining)}`,
        `🙅🏼 Terpakai    : ${usedPercent.toFixed(1)}%`,
        `📍 Alert Level  : ${crossedLabel}%`,
        '━━━━━━━━━━━━━━━━━━',
        statusLine,
    ].join('\n');
    } catch (error) {
        console.error(`[${userId}] Monthly budget alert failed: ${error.message}`);
        return '';
    }
}

async function handleIncomingMessage(sock, userId, msg, eventType, sessionPath, ownJids) {
    if (!msg.message) return;
    if (eventType === 'append' && !isRecentAppendMessage(msg)) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    const remoteJid = msg.key.remoteJid;
    const isFromMe = msg.key.fromMe;
    const messageId = msg.key.id || null;

    if (isFromMe && botMessageIds.get(userId)?.has(msg.key.id)) return;
    if (!isBlockablePrivateChat(remoteJid)) {
        console.log(`[${userId}] Ignored non-private WhatsApp message from ${maskJid(remoteJid)}`);
        return;
    }

    const userSettings = await getUserSettings(userId);
    const senderPhoneJid = msg.key.remoteJidAlt || msg.key.participantAlt || msg.key.senderPn || msg.key.participantPn;
    const senderAccess = getSenderAccess(userId, remoteJid, senderPhoneJid, userSettings);
    if (!isFromMe && !senderAccess.allowed) {
        console.warn(`[${userId}] Unauthorized WhatsApp sender blocked: phones=${senderAccess.senderNumbers.join(',') || 'unknown'}, remote=${maskJid(remoteJid)}, message=${messageId || 'no-id'}`);
        if (shouldHandleUnauthorizedMessage(userId, messageId)) {
            await blockUnauthorizedSender(sock, userId, msg, remoteJid, senderPhoneJid, userSettings);
        }
        return;
    }

    if (!(await markIncomingMessage(userId, messageId))) {
        console.log(`[${userId}] Duplicate WhatsApp message skipped: ${messageId}`);
        return;
    }

    if (remoteJid.endsWith('@lid') && senderPhoneJid) {
        rememberLidPhoneJid(userId, remoteJid, senderPhoneJid);
        const nextMappings = {
            ...(userSettings.jid_mappings || {}),
            [jidNormalizedUser(remoteJid)]: jidNormalizedUser(senderPhoneJid),
        };
        userSettings.jid_mappings = nextMappings;
        saveUserSettings(userId, { jid_mappings: nextMappings })
            .catch((error) => console.error(`[${userId}] Automatic LID mapping save failed: ${error.message}`));
    } else if (remoteJid.endsWith('@lid')) {
        console.warn(`[${userId}] WhatsApp LID message has no PN/Alt mapping for ${maskJid(remoteJid)}; key fields: ${JSON.stringify({
            remoteJidAlt: maskJid(msg.key.remoteJidAlt || ''),
            senderLid: maskJid(msg.key.senderLid || ''),
            senderPn: maskJid(msg.key.senderPn || ''),
            participant: maskJid(msg.key.participant || ''),
            participantAlt: maskJid(msg.key.participantAlt || ''),
            participantPn: maskJid(msg.key.participantPn || ''),
            participantLid: maskJid(msg.key.participantLid || ''),
            addressingMode: msg.key.addressingMode || '',
        })}`);
    }
    const conversationPhone = getSheetSenderIdentity(userId, remoteJid, senderPhoneJid, userSettings);
    saveConversation(userId, conversationPhone, text, isFromMe, messageId);
    if (isFromMe) {
        console.log(`[${userId}] Stored outgoing WhatsApp message ${messageId || 'no-id'} for ${conversationPhone}; command processing skipped`);
        return;
    }

    const sendReply = async (replyText) => {
        const resolvedIdentityJid = await getReplyTargetJid(userId, remoteJid, sessionPath, ownJids, userSettings);
        const normalizedRemote = jidNormalizedUser(remoteJid);
        const inboundAddressingMode = String(msg.key.addressingMode || '').toLowerCase();
        const alternateJid = msg.key.remoteJidAlt || msg.key.participantAlt || senderPhoneJid;
        const normalizedAlt = alternateJid ? jidNormalizedUser(alternateJid) : '';
        let sendTargetJid = normalizedRemote;

        if (normalizedRemote.endsWith('@lid')) {
            if (inboundAddressingMode === 'pn' && normalizedAlt) {
                sendTargetJid = normalizedAlt;
            } else if (inboundAddressingMode === 'lid') {
                sendTargetJid = normalizedRemote;
            } else {
                sendTargetJid = normalizedAlt || resolvedIdentityJid || normalizedRemote;
            }
        } else {
            sendTargetJid = resolvedIdentityJid || normalizedRemote;
        }

        const getActiveSock = () => {
            const current = activeSessions.get(userId);
            return (current && typeof current !== 'string') ? current : sock;
        };

        const attemptSend = async (targetSocket) => {
            const normalizedTarget = jidNormalizedUser(sendTargetJid);
            const sendOptions = {};
            if (remoteJid.endsWith('@lid') && resolvedIdentityJid !== normalizedRemote) {
                console.log(`[${userId}] WhatsApp LID reply target selected ${maskJid(normalizedTarget)}; chat ${maskJid(remoteJid)}, alt ${maskJid(normalizedAlt)}, addressing ${inboundAddressingMode || 'unknown'}, resolved identity ${maskJid(resolvedIdentityJid)}`);
            } else if (normalizedRemote !== normalizedTarget) {
                console.log(`[${userId}] WhatsApp reply target differs from inbound chat (${maskJid(normalizedRemote)} → ${maskJid(normalizedTarget)})`);
            }
            return await targetSocket.sendMessage(sendTargetJid, { text: replyText }, sendOptions);
        };

        try {
            let activeSock = getActiveSock();
            let sent;
            try {
                sent = await attemptSend(activeSock);
            } catch (firstErr) {
                console.warn(`[${userId}] First WhatsApp reply attempt failed (${firstErr.message}), waiting 2s for active socket retry...`);
                await new Promise((r) => setTimeout(r, 2000));
                activeSock = getActiveSock();
                sent = await attemptSend(activeSock);
            }

            rememberBotMessage(userId, sent?.key?.id);
            saveConversation(userId, conversationPhone, replyText, true, sent?.key?.id || null);
            console.log(`[${userId}] WhatsApp reply sent for ${messageId || 'no-id'} as ${sent?.key?.id || 'no-sent-id'} to ${maskJid(sendTargetJid)} (chat ${maskJid(remoteJid)}, status ${sent?.status ?? 'unknown'})`);
            return sent;
        } catch (sendError) {
            console.error(`[${userId}] sendMessage failed after retry:`, sendError.message);
            throw sendError;
        }
    };

    console.log(`[${userId}] Received WhatsApp ${eventType} message ${messageId || 'no-id'} from ${maskJid(remoteJid)}`);

    const startedAt = Date.now();
    const appsScriptEndpoint = userSettings.apps_script_url || process.env.APPS_SCRIPT_URL;
    const cmd = text.trim().toLowerCase();
    const isPingCommand = cmd === 'ping';
    const isHelpCommand = cmd === 'help' || cmd === 'bantuan';
    const isCancelCommand = /^(batal|batal terakhir|undo|cancel|hapus terakhir)$/i.test(cmd);
    const cancelMessageIds = extractCancelMessageIds(text);
    const registrationMatch = cmd.match(/^(?:daftar|register)\s+(\+?\d{10,16})$/);

    if (registrationMatch && remoteJid.endsWith('@lid')) {
        const phone = registrationMatch[1].replace(/\D/g, '');
        const targetJid = `${phone}@s.whatsapp.net`;
        const nextMappings = {
            ...(userSettings.jid_mappings || {}),
            [jidNormalizedUser(remoteJid)]: targetJid,
        };
        await saveUserSettings(userId, { jid_mappings: nextMappings });
        const sent = await sock.sendMessage(targetJid, { text: `✅ Nomor WhatsApp Anda sudah terdaftar untuk bot keuangan.\n\nLID: ${maskJid(remoteJid)}\nNomor: ${maskJid(targetJid)}\n\nSekarang kirim *help* untuk test reply.` });
        rememberBotMessage(userId, sent?.key?.id);
        saveConversation(userId, phone, '✅ Nomor WhatsApp Anda sudah terdaftar untuk bot keuangan.', true, sent?.key?.id || null);
        console.log(`[${userId}] WhatsApp LID manually mapped ${maskJid(remoteJid)} → ${maskJid(targetJid)}`);
        return;
    }

    if (isPingCommand) {
        await sendReply('Pong! Bot is active. 🤖');
        return;
    }

    if (isHelpCommand) {
        const reply = `🤖 *Panduan Bot Keuangan*\n\n---\n💬 *Catat Transaksi:*\nKetik transaksi bebas, contoh:\n• Beli makan siang 25000\n• Terima gaji 5000000 BCA\n• Bayar bensin 80rb gopay\n\n↩️ *Pembatalan:*\n• batal -> batalkan transaksi terakhir\n• batal id 3AA..., 3AB... -> batalkan transaksi sesuai Message ID\n\n📊 *Cek Saldo:*\n• saldo -> semua rekening\n• saldo BCA -> saldo spesifik\n\n📋 *Laporan:*\n• laporan hari ini\n• laporan minggu ini\n• laporan bulan ini`;
        await sendReply(reply);
        return;
    }

    if (appsScriptEndpoint) {
        let extracted = null;
        let aiResult = null;
        try {
            if (cancelMessageIds.length) {
                const scriptStartedAt = Date.now();
                const sheetFrom = getSheetSenderIdentity(userId, remoteJid, senderPhoneJid, userSettings);
                const reply = await forwardMessageToAppsScriptWithRecovery(appsScriptEndpoint, {
                    session: userId,
                    from: sheetFrom,
                    from_jid: remoteJid,
                    body: text,
                    command: 'cancel_by_message_id',
                    cancel_message_ids: cancelMessageIds,
                    message_id: messageId || undefined,
                    spreadsheet_id: userSettings.spreadsheet_id || undefined,
                }, { timeoutMs: 45000, recoveryDelayMs: 6000, recoveryTimeoutMs: 70000, label: `cancel-by-id:${messageId || cancelMessageIds.join(',')}` });
                const scriptSupportsCancelById = /Pembatalan by Message ID|Dibatalkan|Sudah dibatalkan|Tidak ditemukan/i.test(String(reply || ''));
                if (!scriptSupportsCancelById) {
                    await sendReply(
                        '⚠️ Apps Script belum mendukung pembatalan berdasarkan Message ID.\n\n' +
                        'Update Apps Script production dengan template terbaru dulu, lalu kirim ulang command ini.'
                    );
                    return;
                }
                const localResult = await cancelExpenseRecordsByMessageIds(userId, cancelMessageIds, messageId);
                console.log(`[${userId}] Cancel by message ID completed for ${messageId || 'no-id'} in ${Date.now() - scriptStartedAt}ms (ids=${cancelMessageIds.join(',')}, firestore=${localResult.cancelled.length}, missing=${localResult.missing.length})`);
                await sendReply(reply);
                return;
            }

            if (isCancelCommand) {
                const scriptStartedAt = Date.now();
                const sheetFrom = getSheetSenderIdentity(userId, remoteJid, senderPhoneJid, userSettings);
                const target = findLatestActiveExpenseRecord(userId, conversationPhone);
                if (!target) {
                    await sendReply('ℹ️ Tidak ada transaksi terakhir yang bisa dibatalkan untuk nomor Anda.');
                    return;
                }
                if (!target.source_message_id) {
                    await sendReply(
                        '⚠️ Transaksi terakhir belum punya Message ID, jadi tidak aman dibatalkan otomatis.\n\n' +
                        'Gunakan format aman: *batal id MESSAGE_ID*'
                    );
                    return;
                }
                const reply = await forwardMessageToAppsScriptWithRecovery(appsScriptEndpoint, {
                    session: userId,
                    from: sheetFrom,
                    from_jid: remoteJid,
                    body: `batal id ${target.source_message_id}`,
                    command: 'cancel_by_message_id',
                    cancel_message_ids: [target.source_message_id],
                    message_id: messageId || undefined,
                    spreadsheet_id: userSettings.spreadsheet_id || undefined,
                }, { timeoutMs: 45000, recoveryDelayMs: 6000, recoveryTimeoutMs: 70000, label: `cancel-last:${messageId || target.source_message_id}` });
                const scriptSupportsCancelById = /Pembatalan by Message ID|Dibatalkan|Sudah dibatalkan|Tidak ditemukan/i.test(String(reply || ''));
                if (!scriptSupportsCancelById) {
                    await sendReply(
                        '⚠️ Apps Script belum membatalkan transaksi berdasarkan Message ID.\n\n' +
                        'Webapp tidak diubah agar data tidak pecah. Coba ulangi dengan format aman:\n' +
                        `*batal id ${target.source_message_id}*`
                    );
                    return;
                }
                const localResult = await cancelExpenseRecordsByMessageIds(userId, [target.source_message_id], messageId);
                console.log(`[${userId}] Cancel command resolved to message ID ${target.source_message_id} for ${messageId || 'no-id'} in ${Date.now() - scriptStartedAt}ms (firestore=${localResult.cancelled.length}, missing=${localResult.missing.length})`);
                await sendReply(reply);
                return;
            }

            const command = cmd;
        if (!command.startsWith('saldo') && !command.startsWith('laporan') && !isCancelCommand) {
                const extractStartedAt = Date.now();
                extracted = parseLocalTransaction(text);
                if (extracted) {
                    console.log(`[${userId}] Local transaction parser completed for ${messageId || 'no-id'} in ${Date.now() - extractStartedAt}ms`);
                } else {
                    extracted = await extractExpenseWithAI(text, userSettings);
                    console.log(`[${userId}] AI extraction completed for ${messageId || 'no-id'} in ${Date.now() - extractStartedAt}ms`);
                }
                if (extracted?.amount && extracted?.type) {
                    aiResult = {
                        cat: extracted.category || 'Lainnya',
                        amt: extracted.amount,
                        type: extracted.type.toLowerCase() === 'income' ? 'Masuk' : 'Keluar',
                        rek: extracted.payment_channel || 'Cash',
                    };
                }
            }
            const scriptStartedAt = Date.now();
            const sheetFrom = getSheetSenderIdentity(userId, remoteJid, senderPhoneJid, userSettings);
            const reply = await forwardMessageToAppsScriptWithRecovery(appsScriptEndpoint, {
                session: userId,
                from: sheetFrom,
                from_jid: remoteJid,
                body: text,
                message_id: messageId || undefined,
                ai_result: aiResult,
                spreadsheet_id: userSettings.spreadsheet_id || undefined,
            }, { timeoutMs: 45000, recoveryDelayMs: 6000, recoveryTimeoutMs: 70000, label: `transaction:${messageId || 'no-id'}` });
            console.log(`[${userId}] Apps Script completed for ${messageId || 'no-id'} in ${Date.now() - scriptStartedAt}ms (from ${maskJid(remoteJid)} → sheet ${sheetFrom})`);
            const savedTransaction = extracted?.amount
                ? await saveExpenseRecord(userId, conversationPhone, extracted, 'WhatsApp', messageId)
                : null;
            const budgetAlert = await buildMonthlyBudgetAlertIfNeeded(userId, userSettings, savedTransaction);
            const safeReply = getSafeTransactionReply(reply, extracted, messageId);
            await sendReply(`${safeReply || '✅ Transaksi berhasil diproses.'}${budgetAlert}`);
            console.log(`[${userId}] WhatsApp flow completed for ${messageId || 'no-id'} in ${Date.now() - startedAt}ms`);
        } catch (error) {
            console.error(`[${userId}] Apps Script forwarding error:`, error.message);
            if (!error.message.includes('reply target unresolved')) {
                if (cancelMessageIds.length && /GROQ_API_KEY|panggilGroq|Groq/i.test(error.message)) {
                    await sendReply(
                        '⚠️ Command *batal id* sudah dikenali backend, tapi Apps Script endpoint yang aktif masih menjalankan script lama.\n\n' +
                        'Pastikan deploy Web App Apps Script memakai versi terbaru, lalu update URL Web App di menu Settings jika URL deploy berubah.'
                    );
                    return;
                }
                if ((isCancelCommand || cancelMessageIds.length) && /timeout/i.test(error.message)) {
                    await sendReply(
                        '⚠️ Command pembatalan sedang lambat di Google Apps Script.\n\n' +
                        'Tunggu sebentar lalu cek Sheet/Webapp. Kalau belum batal, ulangi dengan format aman:\n' +
                        '*batal id MESSAGE_ID*'
                    );
                    return;
                }
                if (extracted?.amount && !isCancelCommand && !cancelMessageIds.length) {
                    console.warn(`[${userId}] Transaction NOT saved locally after Apps Script error for ${messageId || 'no-id'} to prevent Sheet/Webapp mismatch.`);
                    await sendReply(
                        '❌ Koneksi ke Google Apps Script gagal. Transaksi belum dicatat ke webapp agar saldo tidak selisih.\n\n' +
                        'Cek Google Sheet sebentar. Jika belum ada, kirim ulang pesan transaksi yang sama.'
                    );
                    return;
                }
                await sendReply('❌ Koneksi ke Google Apps Script gagal. Periksa endpoint dan akses Web App Anda.');
            }
        }
        return;
    }

    if (cmd === 'help' || cmd === 'bantuan') {
        const reply = `🤖 *Panduan Bot Keuangan*\n\n---\n💬 *Catat Transaksi:*\nKetik transaksi bebas, contoh:\n• Beli makan siang 25000\n• Terima gaji 5000000 BCA\n• Bayar bensin 80rb gopay\n\n↩️ *Pembatalan:*\n• batal -> batalkan transaksi terakhir\n• batal id 3AA..., 3AB... -> batalkan transaksi sesuai Message ID\n\n📊 *Cek Saldo:*\n• saldo -> semua rekening\n• saldo BCA -> saldo spesifik\n• set saldo BCA 10000 -> set manual\n\n📋 *Laporan:*\n• laporan hari ini\n• laporan minggu ini\n• laporan bulan ini`;
        await sendReply(reply);
        return;
    }

    if (cancelMessageIds.length) {
        const localResult = await cancelExpenseRecordsByMessageIds(userId, cancelMessageIds, messageId);
        const lines = [
            '↩️ *Pembatalan berdasarkan Message ID*',
            '',
            localResult.cancelled.length ? `✅ Dibatalkan: ${localResult.cancelled.join(', ')}` : '✅ Dibatalkan: -',
            localResult.missing.length ? `⚠️ Tidak ditemukan di webapp: ${localResult.missing.join(', ')}` : '',
            '',
            'Catatan: mode tanpa Apps Script hanya merapihkan data webapp.',
        ].filter(Boolean);
        await sendReply(lines.join('\n'));
        return;
    }

    if (isCancelCommand) {
        const cancelled = await cancelLastExpenseRecord(userId, conversationPhone, messageId);
        if (!cancelled) {
            await sendReply('ℹ️ Tidak ada transaksi terakhir yang bisa dibatalkan.');
            return;
        }
        const typeLabel = cancelled.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        await sendReply(
            `↩️ *Transaksi Dibatalkan*\n\n` +
            `🧾 ${cancelled.merchant || 'Transaksi WhatsApp'}\n` +
            `📁 ${cancelled.category || 'Lainnya'}\n` +
            `💰 Rp${Number(cancelled.amount || 0).toLocaleString('id-ID')}\n` +
            `💳 ${cancelled.payment_channel || 'Cash'}\n` +
            `↔️ ${typeLabel}\n\n` +
            `✅ Data aplikasi sudah dikoreksi.`
        );
        return;
    }

    if (cmd.startsWith('set saldo ')) {
        const parts = text.trim().split(' ');
        if (parts.length >= 4) {
            const bank = parts[2].toUpperCase();
            const amount = parseInt(parts[3].replace(/[^0-9]/g, ''));
            if (!isNaN(amount)) {
                db.prepare(`
                    INSERT INTO balances (user_id, payment_channel, manual_balance, last_updated)
                    VALUES (?, ?, ?, datetime('now', 'localtime'))
                `).run(userId, bank, amount);
                await sendReply(`✅ Saldo awal *${bank}* berhasil diatur ke *Rp${amount.toLocaleString('id-ID')}*.`);
            }
        }
        return;
    }

    if (cmd.startsWith('saldo')) {
        const parts = text.trim().split(' ');
        const targetBank = parts.length > 1 ? parts[1].toUpperCase() : null;
        let channels = [];
        if (targetBank) {
            channels = [targetBank];
        } else {
            const rows = db.prepare(`
                SELECT DISTINCT UPPER(payment_channel) as channel
                FROM expenses
                WHERE user_id = ? AND COALESCE(status, 'Saved') NOT IN ('Cancelled', 'Canceled', 'Dibatalkan')
            `).all(userId);
            channels = rows.map(r => r.channel);
            if (channels.length === 0) channels = DEFAULT_REKENING_CHANNELS;
        }

        let reply = `📊 *Informasi Saldo*\n\n`;
        let totalAll = 0;
        for (const bank of channels) {
            const manual = db.prepare(`SELECT manual_balance, last_updated FROM balances WHERE user_id = ? AND UPPER(payment_channel) = ? ORDER BY id DESC LIMIT 1`).get(userId, bank);
            let baseBalance = 0;
            let dateCondition = "";
            if (manual) {
                baseBalance = manual.manual_balance;
                dateCondition = `AND created_at >= '${manual.last_updated}'`;
            }
            const expenses = db.prepare(`SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND UPPER(payment_channel) = ? AND type = 'expense' AND COALESCE(status, 'Saved') NOT IN ('Cancelled', 'Canceled', 'Dibatalkan') AND COALESCE(recap_status, 'active') != 'archived' ${dateCondition}`).get(userId, bank);
            const incomes = db.prepare(`SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND UPPER(payment_channel) = ? AND type = 'income' AND COALESCE(status, 'Saved') NOT IN ('Cancelled', 'Canceled', 'Dibatalkan') AND COALESCE(recap_status, 'active') != 'archived' ${dateCondition}`).get(userId, bank);
            const currentSaldo = baseBalance + (incomes.total || 0) - (expenses.total || 0);
            totalAll += currentSaldo;
            reply += `• *${bank}:* Rp${currentSaldo.toLocaleString('id-ID')}\n`;
        }
        if (!targetBank && channels.length > 1) reply += `\n💰 *Total Semua:* Rp${totalAll.toLocaleString('id-ID')}`;
        await sendReply(reply);
        return;
    }

    if (cmd.startsWith('laporan')) {
        let dateFilter = "";
        let title = "";
        if (cmd.includes('hari ini')) {
            title = "Hari Ini";
            dateFilter = "date(created_at, 'localtime') = date('now', 'localtime')";
        } else if (cmd.includes('minggu ini')) {
            title = "Minggu Ini";
            dateFilter = "strftime('%W', created_at, 'localtime') = strftime('%W', 'now', 'localtime') AND strftime('%Y', created_at, 'localtime') = strftime('%Y', 'now', 'localtime')";
        } else if (cmd.includes('bulan ini')) {
            title = "Bulan Ini";
            dateFilter = "strftime('%m', created_at, 'localtime') = strftime('%m', 'now', 'localtime') AND strftime('%Y', created_at, 'localtime') = strftime('%Y', 'now', 'localtime')";
        } else {
            title = "Semua";
            dateFilter = "1=1";
        }

        const activeStatusWhere = `COALESCE(status, 'Saved') NOT IN ('Cancelled', 'Canceled', 'Dibatalkan') AND COALESCE(recap_status, 'active') != 'archived'`;
        const expRow = db.prepare(`SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND type = 'expense' AND ${activeStatusWhere} AND ${dateFilter}`).get(userId);
        const incRow = db.prepare(`SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND type = 'income' AND ${activeStatusWhere} AND ${dateFilter}`).get(userId);
        let reply = `📋 *Laporan ${title}*\n\n`;
        reply += `🟢 Pemasukan: Rp${(incRow.total || 0).toLocaleString('id-ID')}\n`;
        reply += `🔴 Pengeluaran: Rp${(expRow.total || 0).toLocaleString('id-ID')}\n\n`;
        reply += `*Top Kategori Pengeluaran:*\n`;
        const topCat = db.prepare(`SELECT category, SUM(amount) as total FROM expenses WHERE user_id = ? AND type = 'expense' AND ${activeStatusWhere} AND ${dateFilter} GROUP BY category ORDER BY total DESC LIMIT 3`).all(userId);
        reply += topCat.length ? topCat.map(c => `- ${c.category}: Rp${c.total.toLocaleString('id-ID')}`).join('\n') : '- Belum ada pengeluaran\n';
        await sendReply(reply);
        return;
    }

    console.log(`[${userId}] Extracting fallback AI for ${messageId || 'no-id'}`);
    const extracted = parseLocalTransaction(text) || await extractExpenseWithAI(text, userSettings);
    if (extracted && extracted.amount && extracted.merchant && extracted.type) {
        const dateStr = extracted.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const paymentChannel = extracted.payment_channel || 'Cash';
        const transactionType = extracted.type.toLowerCase() === 'income' ? 'income' : 'expense';
        const savedTransaction = await saveExpenseRecord(userId, remoteJid, { ...extracted, date: dateStr, payment_channel: paymentChannel, type: transactionType }, 'WhatsApp', messageId);
        try {
            const { addExpenseToSheet } = require('./googleSheets');
            await addExpenseToSheet({
                date: dateStr,
                merchant: extracted.merchant,
                category: extracted.category || 'Other',
                amount: extracted.amount,
                payment_channel: paymentChannel,
                confidence: extracted.confidence || 'High',
                type: transactionType
            });
        } catch (sheetError) {
            console.error("Failed to sync to Google Sheets:", sheetError);
        }
        const icon = transactionType === 'income' ? '🟢' : '🔴';
        const typeLabel = transactionType === 'income' ? 'Pemasukan' : 'Pengeluaran';
        const budgetAlert = await buildMonthlyBudgetAlertIfNeeded(userId, userSettings, savedTransaction);
        await sendReply(`✅ *${typeLabel} Dicatat!*\n\n${icon} *${extracted.merchant}*\n💰 Rp${extracted.amount.toLocaleString('id-ID')}\n📁 ${extracted.category || 'Other'}\n💳 ${paymentChannel}${budgetAlert}`);
    }
}

async function initSession(userId) {
    if (activeSessions.has(userId)) {
        console.log(`[${userId}] Session already active or initializing, ignoring duplicate init`);
        return activeSessions.get(userId) !== 'initializing' ? activeSessions.get(userId) : null;
    }

    activeSessions.set(userId, 'initializing');
    const pendingReconnect = reconnectTimers.get(userId);
    if (pendingReconnect) {
        clearTimeout(pendingReconnect);
        reconnectTimers.delete(userId);
    }
    const generation = (sessionGenerations.get(userId) || 0) + 1;
    sessionGenerations.set(userId, generation);

    // Ensure user exists in DB
    db.prepare(`INSERT OR IGNORE INTO users (id) VALUES (?)`).run(userId);

    const sessionPath = path.join(sessionsDir, userId);
    try {
        if (!sessionsNeedingFreshQr.has(userId)) await restoreSession(userId, sessionPath);
    } catch (error) {
        console.error(`[${userId}] Session restore failed: ${error.message}`);
    }
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: process.env.LOG_LEVEL || 'info' }),
        browser: Browsers.macOS('Chrome'),
    });

    sock.ev.on('connection.update', (update) => {
        if (sessionGenerations.get(userId) !== generation) {
            console.log(`[${userId}] Ignored stale WhatsApp connection update from generation ${generation}`);
            return;
        }
        const { connection, lastDisconnect, qr } = update;
        if (connection) console.log('[' + userId + '] WhatsApp connection: ' + connection);

        if (qr) {
            console.log(`[${userId}] New QR Code generated`);
            qrCodes.set(userId, qr);
            sessionErrors.delete(userId);
        }

        if (connection === 'close') {
            const error = lastDisconnect?.error;
            const statusCode = error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            const errorMessage = error?.message || 'Unknown connection error';
            sessionErrors.set(userId, errorMessage);
            console.error('[' + userId + '] Connection closed (' + (statusCode || 'unknown') + '): ' + errorMessage + '. Reconnecting: ' + shouldReconnect);
            if (shouldReconnect) {
                activeSessions.delete(userId);
                scheduleReconnect(userId, statusCode, errorMessage);
            } else {
                activeSessions.delete(userId);
                qrCodes.delete(userId);
                sessionErrors.delete(userId);
                reconnectAttempts.delete(userId);
                fs.rmSync(sessionPath, { recursive: true, force: true });
                const wasManualDisconnect = manualDisconnects.delete(userId);
                if (!wasManualDisconnect) {
                    sessionsNeedingFreshQr.add(userId);
                    deleteStoredSession(userId)
                        .catch((storageError) => console.error(`[${userId}] Invalid session deletion failed: ${storageError.message}`))
                        .finally(() => setTimeout(() => initSession(userId).catch((initError) => console.error(`[${userId}] QR reinitialization failed: ${initError.message}`)), 300));
                }
            }
        } else if (connection === 'open') {
            const pendingReconnect = reconnectTimers.get(userId);
            if (pendingReconnect) {
                clearTimeout(pendingReconnect);
                reconnectTimers.delete(userId);
            }
            console.log(`[${userId}] Connection opened successfully`);
            activeSessions.set(userId, sock);
            qrCodes.delete(userId);
            sessionErrors.delete(userId);
            reconnectAttempts.delete(userId);
            sessionsNeedingFreshQr.delete(userId);
            scheduleSessionBackup(userId, sessionPath, 1000);
        }
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        scheduleSessionBackup(userId, sessionPath);
    });

    sock.ev.on('chats.phoneNumberShare', ({ lid, jid }) => {
        rememberLidPhoneJid(userId, lid, jid);
        getUserSettings(userId)
            .then((settings) => saveUserSettings(userId, {
                jid_mappings: {
                    ...(settings.jid_mappings || {}),
                    [jidNormalizedUser(lid)]: jidNormalizedUser(jid),
                },
            }))
            .catch((error) => console.error(`[${userId}] Phone number share mapping save failed: ${error.message}`));
    });

    sock.ev.on('lid-mapping.update', ({ lid, pn }) => {
        if (!lid || !pn) return;
        rememberLidPhoneJid(userId, lid, pn);
        getUserSettings(userId)
            .then((settings) => saveUserSettings(userId, {
                jid_mappings: {
                    ...(settings.jid_mappings || {}),
                    [jidNormalizedUser(lid)]: jidNormalizedUser(pn),
                },
            }))
            .catch((error) => console.error(`[${userId}] LID mapping event save failed: ${error.message}`));
    });

    sock.ev.on('messages.update', (updates) => {
        for (const update of updates || []) {
            const key = update.key || {};
            if (!botMessageIds.get(userId)?.has(key.id)) continue;
            console.log(`[${userId}] WhatsApp reply update ${key.id || 'no-id'} status=${update.update?.status ?? 'unknown'} remote=${maskJid(key.remoteJid || '')}`);
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const supportedTypes = new Set(['notify', 'append']);
        if (!supportedTypes.has(m.type)) {
            if (m.messages?.length) console.log(`[${userId}] Ignored WhatsApp upsert type ${m.type} with ${m.messages.length} message(s)`);
            return;
        }

        for (const msg of m.messages || []) {
            try {
                await handleIncomingMessage(sock, userId, msg, m.type, sessionPath, [
                    state.creds.me?.id,
                    state.creds.me?.lid,
                    sock.user?.id,
                    sock.user?.lid,
                ]);
            } catch (error) {
                console.error(`[${userId}] WhatsApp message handler failed: ${error.message}`);
            }
        }
    });

    return sock;
}

function getSessionStatus(userId) {
    const sock = activeSessions.get(userId);
    const qr = qrCodes.get(userId);

    if (qr) return { status: 'qr', qr };
    if (reconnectTimers.has(userId)) return { status: 'initializing', error: sessionErrors.get(userId) };
    if (sessionErrors.has(userId)) return { status: 'error', error: sessionErrors.get(userId) };
    if (sock === 'initializing') return { status: 'initializing' };
    if (sock && !qr) return { status: 'connected' };
    return { status: 'disconnected' };
}

function deleteSession(userId) {
    const sock = activeSessions.get(userId);
    manualDisconnects.add(userId);
    if (sock && typeof sock.logout === 'function') {
        sock.logout();
    }
    activeSessions.delete(userId);
    const sessionPath = path.join(sessionsDir, userId);
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    deleteStoredSession(userId).catch((error) => console.error(`[${userId}] Session deletion from Cloud Storage failed: ${error.message}`));
    return { status: 'deleted' };
}

async function resumeStoredSessions() {
    try {
        // In development, scan local sessions directory directly.
        // In production, listStoredSessionUserIds() reads from Cloud Storage.
        let userIds = await listStoredSessionUserIds();
        if (!userIds.length && fs.existsSync(sessionsDir)) {
            userIds = fs.readdirSync(sessionsDir).filter((name) => {
                const fullPath = path.join(sessionsDir, name);
                return fs.statSync(fullPath).isDirectory();
            });
        }
        if (!userIds.length) {
            console.log('No stored WhatsApp sessions found for auto-resume');
            return;
        }
        console.log(`Auto-resuming ${userIds.length} stored WhatsApp session(s)`);
        for (const userId of userIds) {
            initSession(userId).catch((error) => {
                console.error(`[${userId}] Auto-resume failed: ${error.message}`);
            });
        }
    } catch (error) {
        console.error(`WhatsApp auto-resume scan failed: ${error.message}`);
    }
}

async function sendDirectMessage(userId, to, message) {
    const sock = activeSessions.get(userId);
    if (!sock || sock === 'initializing') throw new Error('WhatsApp belum terhubung. Scan QR terlebih dahulu.');
    // Normalize phone number to JID
    const jid = to.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    await sock.sendMessage(jid, { text: message });
    console.log(`[${userId}] Quick Send → ${jid}: ${message.slice(0, 40)}`);
}

module.exports = {
    initSession,
    getSessionStatus,
    deleteSession,
    resumeStoredSessions,
    sendDirectMessage,
};
