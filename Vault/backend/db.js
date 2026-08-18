const Database = require('better-sqlite3');
const path = require('path');
const { DEFAULT_AI_MODEL } = require('./aiModels');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

function ensureColumn(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((item) => item.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

// Initialize schema
function initDB() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            groq_key TEXT,
            apps_script_url TEXT,
            spreadsheet_id TEXT,
            ai_model TEXT DEFAULT '${DEFAULT_AI_MODEL}',
            system_prompt TEXT,
            monthly_budget REAL DEFAULT 0,
            budget_alert_thresholds TEXT,
            budget_alert_month TEXT,
            budget_alert_levels TEXT,
            active_recap_id TEXT,
            active_recap_name TEXT,
            active_recap_start_date TEXT,
            settings_updated_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            message_id TEXT,
            phone_number TEXT,
            message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_from_me BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            phone_number TEXT,
            merchant TEXT,
            category TEXT,
            amount REAL,
            date TEXT,
            confidence TEXT,
            payment_channel TEXT DEFAULT 'Cash',
            type TEXT DEFAULT 'expense',
            status TEXT DEFAULT 'New',
            source TEXT DEFAULT 'WhatsApp',
            source_message_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS recap_periods (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            name TEXT,
            start_date TEXT,
            closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expense_count INTEGER DEFAULT 0,
            conversation_count INTEGER DEFAULT 0,
            total_income REAL DEFAULT 0,
            total_expense REAL DEFAULT 0,
            sheet_result TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS processed_messages (
            user_id TEXT,
            message_id TEXT,
            status TEXT DEFAULT 'processed',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, message_id)
        );

        CREATE TABLE IF NOT EXISTS balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            payment_channel TEXT,
            manual_balance REAL DEFAULT 0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `);

    // Migrate databases created by the earlier MVP without deleting user data.
    ensureColumn('users', 'apps_script_url', 'TEXT');
    ensureColumn('users', 'spreadsheet_id', 'TEXT');
    ensureColumn('users', 'ai_model', `TEXT DEFAULT '${DEFAULT_AI_MODEL}'`);
    ensureColumn('users', 'system_prompt', 'TEXT');
    ensureColumn('users', 'monthly_budget', 'REAL DEFAULT 0');
    ensureColumn('users', 'budget_alert_thresholds', 'TEXT');
    ensureColumn('users', 'budget_alert_month', 'TEXT');
    ensureColumn('users', 'budget_alert_levels', 'TEXT');
    ensureColumn('users', 'active_recap_id', 'TEXT');
    ensureColumn('users', 'active_recap_name', 'TEXT');
    ensureColumn('users', 'active_recap_start_date', 'TEXT');
    ensureColumn('users', 'settings_updated_at', 'DATETIME');
    ensureColumn('conversations', 'message_id', 'TEXT');
    ensureColumn('expenses', 'payment_channel', "TEXT DEFAULT 'Cash'");
    ensureColumn('expenses', 'type', "TEXT DEFAULT 'expense'");
    ensureColumn('expenses', 'status', "TEXT DEFAULT 'New'");
    ensureColumn('expenses', 'source', "TEXT DEFAULT 'WhatsApp'");
    ensureColumn('expenses', 'source_message_id', 'TEXT');
    ensureColumn('expenses', 'cancelled_at', 'DATETIME');
    ensureColumn('expenses', 'cancelled_by_message_id', 'TEXT');
    ensureColumn('expenses', 'recap_id', 'TEXT');
    ensureColumn('expenses', 'recap_name', 'TEXT');
    ensureColumn('expenses', 'recap_status', "TEXT DEFAULT 'active'");
    ensureColumn('expenses', 'archived_at', 'DATETIME');
    ensureColumn('conversations', 'recap_id', 'TEXT');
    ensureColumn('conversations', 'recap_name', 'TEXT');
    ensureColumn('conversations', 'recap_status', "TEXT DEFAULT 'active'");
    ensureColumn('conversations', 'archived_at', 'DATETIME');
}

initDB();

function ensureUser(userId) {
    db.prepare(`INSERT OR IGNORE INTO users (id) VALUES (?)`).run(userId);
}

function getUserSettings(userId) {
    ensureUser(userId);
    const row = db.prepare(`
        SELECT id, apps_script_url, groq_key, spreadsheet_id, ai_model, system_prompt,
               monthly_budget, budget_alert_thresholds, budget_alert_month, budget_alert_levels,
               active_recap_id, active_recap_name, active_recap_start_date,
               settings_updated_at
        FROM users WHERE id = ?
    `).get(userId);
    return {
        ...row,
        budget_alert_thresholds: parseJsonArray(row?.budget_alert_thresholds, [80, 90, 95, 100]),
        budget_alert_levels: parseJsonArray(row?.budget_alert_levels, []),
    };
}

function saveUserSettings(userId, settings) {
    ensureUser(userId);
    const current = getUserSettings(userId);
    const next = {
        ...current,
        ...Object.fromEntries(Object.entries(settings || {}).filter(([, value]) => value !== undefined)),
    };
    db.prepare(`
        UPDATE users
        SET apps_script_url = ?, groq_key = ?, spreadsheet_id = ?, ai_model = ?, system_prompt = ?,
            monthly_budget = ?, budget_alert_thresholds = ?, budget_alert_month = ?, budget_alert_levels = ?,
            active_recap_id = ?, active_recap_name = ?, active_recap_start_date = ?,
            settings_updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        next.apps_script_url || null,
        next.groq_key || null,
        next.spreadsheet_id || null,
        next.ai_model || DEFAULT_AI_MODEL,
        next.system_prompt || null,
        Number(next.monthly_budget || 0),
        JSON.stringify(next.budget_alert_thresholds || [80, 90, 95, 100]),
        next.budget_alert_month || null,
        JSON.stringify(next.budget_alert_levels || []),
        next.active_recap_id || null,
        next.active_recap_name || null,
        next.active_recap_start_date || null,
        userId
    );
    return getUserSettings(userId);
}

function parseJsonArray(value, fallback) {
    try {
        const parsed = JSON.parse(value || 'null');
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (_) {
        return fallback;
    }
}

module.exports = db;
module.exports.ensureUser = ensureUser;
module.exports.getUserSettings = getUserSettings;
module.exports.saveUserSettings = saveUserSettings;
