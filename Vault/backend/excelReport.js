const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { getAdminFirestore } = require('./firebaseAdmin');

const DEFAULT_TEMPLATE_PATH = path.join(__dirname, 'templates', 'wa-finance-main-template.xlsx');
const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ACTIVE_STATUSES = new Set(['cancelled', 'canceled', 'dibatalkan']);

function getTemplatePath() {
    return process.env.EXCEL_TEMPLATE_PATH || DEFAULT_TEMPLATE_PATH;
}

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isArchived(item) {
    return String(item.recap_status || 'active').toLowerCase() === 'archived';
}

function isCancelled(item) {
    return ACTIVE_STATUSES.has(String(item.status || '').toLowerCase());
}

function matchesRecapFilter(item, recapId = 'active') {
    if (recapId === 'all') return true;
    if (recapId && recapId !== 'active') return String(item.recap_id || '') === String(recapId);
    return !isArchived(item);
}

function dateInRange(item, startDate, endDate) {
    if (!startDate && !endDate) return true;
    const itemDate = toDate(item.createdAt || item.timestamp || item.date);
    if (!itemDate) return true;
    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;
    return true;
}

function parseDateParam(value, endOfDay = false) {
    if (!value) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
}

function cleanSheetRows(worksheet) {
    const rowCount = worksheet.rowCount;
    if (rowCount > 1) worksheet.spliceRows(2, rowCount - 1);
}

function normalizeTransaction(doc) {
    const data = doc.data();
    const type = String(data.type || 'expense').toLowerCase() === 'income' ? 'Masuk' : 'Keluar';
    const statusText = isCancelled(data) ? 'Dibatalkan' : 'Tersimpan';
    const timestamp = toDate(data.createdAt || data.timestamp || data.date) || new Date();

    return {
        id: doc.id,
        ...data,
        timestamp,
        tipe: type,
        statusText,
    };
}

async function loadExpenses(userId, filters = {}) {
    const snapshot = await getAdminFirestore()
        .collection('users').doc(userId).collection('expenses')
        .orderBy('createdAt', 'asc')
        .get();
    const startDate = parseDateParam(filters.startDate);
    const endDate = parseDateParam(filters.endDate, true);
    return snapshot.docs
        .map(normalizeTransaction)
        .filter((item) => !isCancelled(item))
        .filter((item) => matchesRecapFilter(item, filters.recapId || 'active'))
        .filter((item) => dateInRange(item, startDate, endDate))
        .filter((item) => {
            if (!filters.type || filters.type === 'all') return true;
            return (filters.type === 'income' && item.tipe === 'Masuk') || (filters.type === 'expense' && item.tipe === 'Keluar');
        })
        .filter((item) => {
            if (!filters.category || filters.category === 'all') return true;
            return String(item.category || 'Lainnya') === String(filters.category);
        })
        .filter((item) => {
            const search = String(filters.search || '').trim().toLowerCase();
            if (!search) return true;
            return [
                item.merchant,
                item.description,
                item.pesan,
                item.category,
                item.payment_channel,
                item.source,
                item.source_message_id,
            ].some((value) => String(value || '').toLowerCase().includes(search));
        });
}

async function loadWallets(userId) {
    const snapshot = await getAdminFirestore()
        .collection('users').doc(userId).collection('settings').doc('config')
        .get();
    const wallets = snapshot.exists && Array.isArray(snapshot.data()?.wallets) ? snapshot.data().wallets : [];
    return wallets.filter((wallet) => wallet && wallet.is_active !== false);
}

function calculateWalletRows(expenses, wallets) {
    const rows = new Map();
    for (const wallet of wallets) {
        const name = String(wallet.name || '').trim();
        if (!name) continue;
        rows.set(name.toUpperCase(), {
            name,
            balance: Number(wallet.balance || 0),
        });
    }

    for (const item of expenses) {
        const channel = String(item.payment_channel || item.rekening || 'Cash').trim() || 'Cash';
        const key = channel.toUpperCase();
        if (!rows.has(key)) rows.set(key, { name: channel, balance: 0 });
        const row = rows.get(key);
        const amount = Number(item.amount || 0);
        row.balance += item.tipe === 'Masuk' ? amount : -amount;
    }

    if (!rows.size) {
        ['BCA', 'GOPAY', 'QRIS', 'SUPERBANK', 'Transfer', 'Cash'].forEach((name) => rows.set(name.toUpperCase(), { name, balance: 0 }));
    }

    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

function asExcelDate(value) {
    const date = toDate(value);
    return date || new Date();
}

function fillTransactionsSheet(workbook, expenses, userId) {
    const worksheet = workbook.getWorksheet('Transaksi') || workbook.addWorksheet('Transaksi');
    worksheet.getRow(1).values = ['Timestamp', 'Session', 'From', 'Pesan', 'Kategori', 'Jumlah', 'Tipe', 'Rekening', 'Message ID', 'Status', 'Cancelled At'];
    cleanSheetRows(worksheet);

    expenses.forEach((item, index) => {
        const row = worksheet.getRow(index + 2);
        row.values = [
            asExcelDate(item.timestamp),
            userId,
            item.phone_number || item.from || '',
            item.merchant || item.description || item.pesan || 'Transaksi WhatsApp',
            item.category || 'Lainnya',
            Number(item.amount || 0),
            item.tipe,
            item.payment_channel || item.rekening || 'Cash',
            item.source_message_id || item.message_id || item.id,
            item.statusText,
            item.cancelled_at || '',
        ];
        row.getCell(1).numFmt = 'yyyy-mm-dd hh:mm:ss';
        row.getCell(6).numFmt = '#,##0';
        row.commit();
    });
}

function fillWalletSheet(workbook, walletRows) {
    const worksheet = workbook.getWorksheet('Rekening') || workbook.addWorksheet('Rekening');
    worksheet.getRow(1).values = ['Rekening', 'Saldo'];
    cleanSheetRows(worksheet);

    walletRows.forEach((wallet, index) => {
        const row = worksheet.getRow(index + 2);
        row.values = [wallet.name, Number(wallet.balance || 0)];
        row.getCell(2).numFmt = '#,##0';
        row.commit();
    });
}

async function createWorkbook(userId, filters = {}) {
    const templatePath = getTemplatePath();
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template Excel belum tersedia di server: ${templatePath}`);
    }

    const [expenses, wallets] = await Promise.all([
        loadExpenses(userId, filters),
        loadWallets(userId),
    ]);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    workbook.creator = 'WA Finance Gateway';
    workbook.lastModifiedBy = 'WA Finance Gateway';
    workbook.modified = new Date();
    workbook.calcProperties = workbook.calcProperties || {};
    workbook.calcProperties.fullCalcOnLoad = true;

    fillTransactionsSheet(workbook, expenses, userId);
    fillWalletSheet(workbook, calculateWalletRows(expenses, wallets));

    const buffer = await workbook.xlsx.writeBuffer();
    return {
        buffer: Buffer.from(buffer),
        count: expenses.length,
        fileName: `${dateStamp()} - WA Finance Report.xlsx`,
    };
}

function dateStamp(date = new Date()) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('');
}

module.exports = {
    EXCEL_MIME,
    createWorkbook,
    getTemplatePath,
};
