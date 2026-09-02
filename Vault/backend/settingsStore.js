const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const db = require('./db');
const { DEFAULT_AI_MODEL } = require('./aiModels');

const SECRET_ID = process.env.USER_SETTINGS_SECRET_ID || 'wa-finance-user-settings';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'wa-finance-bot-i729';
const DEFAULT_SETTINGS = {
    apps_script_url: '',
    groq_key: '',
    spreadsheet_id: '',
    ai_model: DEFAULT_AI_MODEL,
    system_prompt: 'You are a precise Indonesian financial transaction extractor. Output ONLY valid JSON.',
    apps_script_status: 'not_configured',
    apps_script_last_tested_at: null,
    apps_script_last_status: null,
    apps_script_last_preview: '',
    jid_mappings: {},
    monthly_budget: 0,
    budget_alert_thresholds: [80, 90, 95, 100],
    budget_alert_month: '',
    budget_alert_levels: [],
    active_recap_id: '',
    active_recap_name: 'Periode Aktif',
    active_recap_start_date: '',
};

let client;

function useSecretManager() {
    return String(process.env.SETTINGS_STORE || '').toLowerCase() === 'secret-manager';
}

function getClient() {
    if (!client) client = new SecretManagerServiceClient();
    return client;
}

async function readAllSettings() {
    try {
        const [version] = await getClient().accessSecretVersion({
            name: `projects/${PROJECT_ID}/secrets/${SECRET_ID}/versions/latest`,
        });
        const raw = version.payload?.data?.toString() || '{}';
        const parsed = JSON.parse(raw);
        return parsed.users || {};
    } catch (error) {
        if (error.code === 5) return {};
        throw error;
    }
}

async function getUserSettings(userId) {
    if (!useSecretManager()) return db.getUserSettings(userId);
    const users = await readAllSettings();
    return { ...DEFAULT_SETTINGS, ...(users[userId] || {}) };
}

async function saveUserSettings(userId, updates) {
    if (!useSecretManager()) return db.saveUserSettings(userId, updates);

    const users = await readAllSettings();
    const current = { ...DEFAULT_SETTINGS, ...(users[userId] || {}) };
    const next = {
        ...current,
        ...Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)),
        settings_updated_at: new Date().toISOString(),
    };

    users[userId] = next;
    await getClient().addSecretVersion({
        parent: `projects/${PROJECT_ID}/secrets/${SECRET_ID}`,
        payload: { data: Buffer.from(JSON.stringify({ users })) },
    });
    return next;
}

module.exports = { getUserSettings, saveUserSettings };
