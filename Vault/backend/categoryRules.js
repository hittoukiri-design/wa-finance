const db = require('./db');

const DEFAULT_CATEGORIES = [
    { name: 'Belanja', emoji: '🛒', type: 'expense', keywords: ['belanja', 'sayur', 'sayuran', 'beras', 'shopee', 'tokopedia', 'lazada'] },
    { name: 'Tagihan', emoji: '💳', type: 'expense', keywords: ['tagihan', 'listrik', 'air', 'internet', 'pulsa', 'token', 'kos', 'cicilan', 'angsuran', 'banjar'] },
    { name: 'Makan', emoji: '🍜', type: 'expense', keywords: ['makan', 'minum', 'kopi', 'resto', 'warung', 'nasi', 'ayam', 'bakso', 'mie', 'tempong', 'napong'] },
    { name: 'Snack', emoji: '🍟', type: 'expense', keywords: ['snack', 'cemilan', 'jajan', 'jajanan', 'gorengan', 'risol', 'roti', 'pisang goreng', 'mizone', 'tahu kucek'] },
    { name: 'Transportasi', emoji: '🚗', type: 'expense', keywords: ['transport', 'transportasi', 'bensin', 'parkir', 'tol', 'grab', 'gojek', 'taxi', 'ojek'] },
    { name: 'Keluarga', emoji: '👥', type: 'expense', keywords: ['keluarga', 'anak', 'istri', 'hadiah keluarga'] },
    { name: 'Rumah', emoji: '🏠', type: 'expense', keywords: ['rumah', 'sampah', 'galon', 'gas', 'perabot'] },
    { name: 'Hiburan', emoji: '🎮', type: 'expense', keywords: ['hiburan', 'game', 'nonton', 'netflix', 'spotify', 'bioskop'] },
    { name: 'Perawatan', emoji: '✨', type: 'expense', keywords: ['perawatan', 'skincare', 'salon', 'potong rambut'] },
    { name: 'Sosial', emoji: '🤝', type: 'expense', keywords: ['sosial', 'donasi', 'patungan', 'kado'] },
    { name: 'Kesehatan', emoji: '🏥', type: 'expense', keywords: ['kesehatan', 'obat', 'dokter', 'klinik', 'vitamin'] },
    { name: 'Tabungan', emoji: '🐷', type: 'expense', keywords: ['tabungan', 'nabung', 'saving'] },
    { name: 'Lainnya', emoji: '🏷️', type: 'expense', keywords: ['lainnya'] },
    { name: 'Gaji', emoji: '💰', type: 'income', keywords: ['gaji', 'salary', 'upah', 'payroll'] },
    { name: 'Pembayaran', emoji: '🧾', type: 'income', keywords: ['pembayaran', 'bayaran', 'dibayar', 'pelunasan', 'invoice'] },
    { name: 'Bonus', emoji: '🎁', type: 'income', keywords: ['bonus', 'thr', 'komisi', 'fee'] },
    { name: 'Pemasukan', emoji: '💸', type: 'income', keywords: ['terima', 'masuk', 'income', 'pemasukan', 'transfer masuk'] },
];

function normalizeKeyword(value = '') {
    return String(value)
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeCategoryType(value = 'expense') {
    return String(value).toLowerCase() === 'income' ? 'income' : 'expense';
}

function sanitizeEmoji(value) {
    const emoji = String(value || '').trim();
    return emoji ? Array.from(emoji).slice(0, 4).join('') : '🏷️';
}

function ensureDefaultCategories(userId) {
    db.ensureUser(userId);
    const existing = db.prepare('SELECT COUNT(*) as total FROM categories WHERE user_id = ?').get(userId);
    if (Number(existing?.total || 0) > 0) return;

    const insertCategory = db.prepare(`
        INSERT OR IGNORE INTO categories (user_id, name, emoji, type, sort_order)
        VALUES (?, ?, ?, ?, ?)
    `);
    const insertItem = db.prepare(`
        INSERT OR IGNORE INTO category_items (user_id, category_id, keyword, normalized_keyword)
        VALUES (?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
        DEFAULT_CATEGORIES.forEach((category, index) => {
            const result = insertCategory.run(userId, category.name, category.emoji, category.type, index);
            const categoryId = result.lastInsertRowid || db.prepare(`
                SELECT id FROM categories WHERE user_id = ? AND name = ?
            `).get(userId, category.name)?.id;

            for (const keyword of category.keywords) {
                const normalized = normalizeKeyword(keyword);
                if (normalized) insertItem.run(userId, categoryId, keyword, normalized);
            }
        });
    });
    tx();
}

function listCategories(userId) {
    ensureDefaultCategories(userId);
    const categories = db.prepare(`
        SELECT id, name, emoji, type, is_active, sort_order, created_at, updated_at
        FROM categories
        WHERE user_id = ?
        ORDER BY is_active DESC, sort_order ASC, name COLLATE NOCASE ASC
    `).all(userId);
    const items = db.prepare(`
        SELECT id, category_id, keyword, normalized_keyword, created_at
        FROM category_items
        WHERE user_id = ?
        ORDER BY LENGTH(normalized_keyword) DESC, keyword COLLATE NOCASE ASC
    `).all(userId);
    const groupedItems = items.reduce((acc, item) => {
        acc[item.category_id] = acc[item.category_id] || [];
        acc[item.category_id].push(item);
        return acc;
    }, {});

    return categories.map((category) => ({
        ...category,
        is_active: Boolean(category.is_active),
        items: groupedItems[category.id] || [],
    }));
}

function getCategory(userId, categoryId) {
    ensureDefaultCategories(userId);
    return db.prepare(`
        SELECT id, name, emoji, type, is_active, sort_order, created_at, updated_at
        FROM categories
        WHERE user_id = ? AND id = ?
    `).get(userId, categoryId);
}

function createCategory(userId, input = {}) {
    ensureDefaultCategories(userId);
    const name = String(input.name || '').replace(/\s+/g, ' ').trim();
    if (!name) throw new Error('Nama kategori wajib diisi.');

    const type = normalizeCategoryType(input.type);
    const emoji = sanitizeEmoji(input.emoji);
    const sortRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM categories WHERE user_id = ?').get(userId);
    const result = db.prepare(`
        INSERT INTO categories (user_id, name, emoji, type, sort_order)
        VALUES (?, ?, ?, ?, ?)
    `).run(userId, name, emoji, type, Number(sortRow?.next || 1));

    const categoryId = Number(result.lastInsertRowid);
    for (const keyword of input.keywords || []) {
        addCategoryItem(userId, categoryId, keyword);
    }
    return getCategoryWithItems(userId, categoryId);
}

function updateCategory(userId, categoryId, input = {}) {
    ensureDefaultCategories(userId);
    const category = getCategory(userId, categoryId);
    if (!category) throw new Error('Kategori tidak ditemukan.');

    const nextName = input.name === undefined ? category.name : String(input.name || '').replace(/\s+/g, ' ').trim();
    if (!nextName) throw new Error('Nama kategori wajib diisi.');

    db.prepare(`
        UPDATE categories
        SET name = ?, emoji = ?, type = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND id = ?
    `).run(
        nextName,
        input.emoji === undefined ? category.emoji : sanitizeEmoji(input.emoji),
        input.type === undefined ? category.type : normalizeCategoryType(input.type),
        input.is_active === undefined ? Number(category.is_active) : (input.is_active ? 1 : 0),
        userId,
        categoryId
    );
    return getCategoryWithItems(userId, categoryId);
}

function deleteCategory(userId, categoryId) {
    ensureDefaultCategories(userId);
    const category = getCategory(userId, categoryId);
    if (!category) throw new Error('Kategori tidak ditemukan.');
    db.prepare(`
        UPDATE categories
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND id = ?
    `).run(userId, categoryId);
    return getCategoryWithItems(userId, categoryId);
}

function addCategoryItem(userId, categoryId, keyword) {
    ensureDefaultCategories(userId);
    const category = getCategory(userId, categoryId);
    if (!category) throw new Error('Kategori tidak ditemukan.');

    const cleanKeyword = String(keyword || '').replace(/\s+/g, ' ').trim();
    const normalized = normalizeKeyword(cleanKeyword);
    if (!normalized) throw new Error('Item/kata kunci wajib diisi.');

    db.prepare(`
        INSERT OR REPLACE INTO category_items (user_id, category_id, keyword, normalized_keyword)
        VALUES (?, ?, ?, ?)
    `).run(userId, categoryId, cleanKeyword, normalized);
    db.prepare('UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?').run(userId, categoryId);
    return getCategoryWithItems(userId, categoryId);
}

function deleteCategoryItem(userId, itemId) {
    ensureDefaultCategories(userId);
    const item = db.prepare('SELECT category_id FROM category_items WHERE user_id = ? AND id = ?').get(userId, itemId);
    if (!item) throw new Error('Item/kata kunci tidak ditemukan.');
    db.prepare('DELETE FROM category_items WHERE user_id = ? AND id = ?').run(userId, itemId);
    db.prepare('UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?').run(userId, item.category_id);
    return getCategoryWithItems(userId, item.category_id);
}

function getCategoryWithItems(userId, categoryId) {
    const categories = listCategories(userId);
    return categories.find((category) => Number(category.id) === Number(categoryId)) || null;
}

function matchCategoryForText(userId, text, type = 'expense') {
    const normalizedText = ` ${normalizeKeyword(text)} `;
    if (!normalizedText.trim()) return null;
    const categoryType = normalizeCategoryType(type);
    const categories = listCategories(userId)
        .filter((category) => category.is_active && category.type === categoryType);

    let bestMatch = null;
    for (const category of categories) {
        for (const item of category.items || []) {
            const keyword = normalizeKeyword(item.normalized_keyword || item.keyword);
            if (!keyword) continue;
            const pattern = new RegExp(`(^|\\s)${escapeRegExp(keyword)}(?=\\s|$)`, 'i');
            if (!pattern.test(normalizedText)) continue;
            if (!bestMatch || keyword.length > bestMatch.keyword.length) {
                bestMatch = { category, keyword };
            }
        }
    }
    return bestMatch?.category || null;
}

function buildCategoryPrompt(userId, type = 'expense') {
    const categoryType = normalizeCategoryType(type);
    return listCategories(userId)
        .filter((category) => category.is_active && category.type === categoryType)
        .map((category) => {
            const keywords = (category.items || []).map((item) => item.keyword).slice(0, 12).join(', ');
            return `- ${category.name}${keywords ? `: ${keywords}` : ''}`;
        })
        .join('\n');
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    DEFAULT_CATEGORIES,
    addCategoryItem,
    buildCategoryPrompt,
    createCategory,
    deleteCategory,
    deleteCategoryItem,
    ensureDefaultCategories,
    listCategories,
    matchCategoryForText,
    normalizeKeyword,
    updateCategory,
};
