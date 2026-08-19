const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const archiver = require('archiver');
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
    // Default channels in master template
    const defaultChannels = ['BCA', 'GOPAY', 'QRIS', 'SUPERBANK', 'Transfer', 'Cash', 'DANA'];
    defaultChannels.forEach((name) => rows.set(name.toUpperCase(), { name, balance: 0 }));

    for (const wallet of wallets) {
        const name = String(wallet.name || '').trim();
        if (!name) continue;
        const initialBal = wallet.initial_balance !== undefined && !Number.isNaN(Number(wallet.initial_balance))
            ? Number(wallet.initial_balance)
            : 0;
        rows.set(name.toUpperCase(), {
            name,
            balance: initialBal,
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

    // Sort to match canonical order: BCA, GOPAY, QRIS, SUPERBANK, Transfer, Cash, DANA
    const order = ['BCA', 'GOPAY', 'QRIS', 'SUPERBANK', 'TRANSFER', 'CASH', 'DANA'];
    return [...rows.values()].sort((a, b) => {
        const idxA = order.indexOf(a.name.toUpperCase());
        const idxB = order.indexOf(b.name.toUpperCase());
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.name.localeCompare(b.name, 'id');
    });
}

function xmlEscape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function dateToExcelSerial(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return 46235.0;
    const epoch = new Date(1899, 11, 30, 0, 0, 0).getTime();
    return (d.getTime() - epoch) / 86400000;
}

function generateSheet3Xml(expenses, userId) {
    let rowsXml = `<x:row r="1" ht="22.5" customHeight="1">
<x:c r="A1" s="4" t="s"><x:v>9</x:v></x:c>
<x:c r="B1" s="4" t="s"><x:v>10</x:v></x:c>
<x:c r="C1" s="4" t="s"><x:v>11</x:v></x:c>
<x:c r="D1" s="4" t="s"><x:v>12</x:v></x:c>
<x:c r="E1" s="4" t="s"><x:v>13</x:v></x:c>
<x:c r="F1" s="4" t="s"><x:v>14</x:v></x:c>
<x:c r="G1" s="4" t="s"><x:v>15</x:v></x:c>
<x:c r="H1" s="4" t="s"><x:v>16</x:v></x:c>
<x:c r="I1" s="4" t="s"><x:v>17</x:v></x:c>
<x:c r="J1" s="4" t="s"><x:v>18</x:v></x:c>
<x:c r="K1" s="4" t="s"><x:v>19</x:v></x:c>
</x:row>`;

    expenses.forEach((item, index) => {
        const rowNum = index + 2;
        const serialDate = dateToExcelSerial(item.timestamp || item.date);
        const userStr = xmlEscape(userId || '');
        const fromStr = xmlEscape(item.phone_number || item.from || '');
        const descStr = xmlEscape(item.merchant || item.description || item.pesan || 'Transaksi WhatsApp');
        const catStr = xmlEscape(item.category || 'Lainnya');
        const amountNum = Number(item.amount || 0);
        const tipeStr = xmlEscape(item.tipe || (String(item.type || '').toLowerCase() === 'income' ? 'Masuk' : 'Keluar'));
        const rekStr = xmlEscape(item.payment_channel || item.rekening || 'Cash');
        const msgIdStr = xmlEscape(item.source_message_id || item.message_id || item.id || '');
        const statusStr = xmlEscape(item.statusText || 'Tersimpan');
        const cancelStr = xmlEscape(item.cancelled_at || '');

        rowsXml += `<x:row r="${rowNum}" ht="20" customHeight="1">
<x:c r="A${rowNum}" s="5"><x:v>${serialDate.toFixed(6)}</x:v></x:c>
<x:c r="B${rowNum}" s="2" t="inlineStr"><x:is><x:t>${userStr}</x:t></x:is></x:c>
<x:c r="C${rowNum}" s="2" t="inlineStr"><x:is><x:t>${fromStr}</x:t></x:is></x:c>
<x:c r="D${rowNum}" s="2" t="inlineStr"><x:is><x:t>${descStr}</x:t></x:is></x:c>
<x:c r="E${rowNum}" s="2" t="inlineStr"><x:is><x:t>${catStr}</x:t></x:is></x:c>
<x:c r="F${rowNum}" s="6"><x:v>${amountNum}</x:v></x:c>
<x:c r="G${rowNum}" s="2" t="inlineStr"><x:is><x:t>${tipeStr}</x:t></x:is></x:c>
<x:c r="H${rowNum}" s="2" t="inlineStr"><x:is><x:t>${rekStr}</x:t></x:is></x:c>
<x:c r="I${rowNum}" s="2" t="inlineStr"><x:is><x:t>${msgIdStr}</x:t></x:is></x:c>
<x:c r="J${rowNum}" s="2" t="inlineStr"><x:is><x:t>${statusStr}</x:t></x:is></x:c>
<x:c r="K${rowNum}" s="2" t="inlineStr"><x:is><x:t>${cancelStr}</x:t></x:is></x:c>
</x:row>`;
    });

    const maxRow = Math.max(expenses.length + 1, 2);

    return `<?xml version="1.0" encoding="utf-8"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetFormatPr defaultColWidth="12.630000114440918" defaultRowHeight="15.75" /><x:cols><x:col min="1" max="1" width="17.25" customWidth="1" /><x:col min="2" max="2" width="29" customWidth="1" /><x:col min="3" max="3" width="13.5" customWidth="1" /><x:col min="4" max="4" width="28.38" customWidth="1" /><x:col min="6" max="6" width="14.38" customWidth="1" /><x:col min="8" max="8" width="15.75" customWidth="1" /><x:col min="9" max="9" width="22" customWidth="1" /><x:col min="10" max="10" width="13.75" customWidth="1" /><x:col min="11" max="11" width="15" customWidth="1" /></x:cols><x:sheetData>${rowsXml}</x:sheetData><x:dataValidations count="5"><x:dataValidation type="custom" allowBlank="1" showDropDown="1" showErrorMessage="1" sqref="A2:A${maxRow}"><x:formula1>AND(ISNUMBER(A2), LEFT(CELL("format", A2), 1)="D")</x:formula1></x:dataValidation><x:dataValidation type="list" allowBlank="1" showDropDown="1" showErrorMessage="1" sqref="J2:J${maxRow}"><x:formula1>"Tersimpan,Dibatalkan"</x:formula1></x:dataValidation><x:dataValidation type="custom" allowBlank="1" showDropDown="1" showErrorMessage="1" sqref="K2:K${maxRow}"><x:formula1>OR(ISBLANK(K2), AND(ISNUMBER(K2), LEFT(CELL("format", K2), 1)="D"))</x:formula1></x:dataValidation><x:dataValidation type="custom" allowBlank="1" showDropDown="1" showErrorMessage="1" sqref="C2:C${maxRow}"><x:formula1>OR(ISBLANK(C2), AND(ISNUMBER(C2), AND(ISBLANK(C2)=FALSE, NOT(LEFT(CELL("format", C2))="D"))))</x:formula1></x:dataValidation><x:dataValidation type="list" allowBlank="1" showDropDown="1" showErrorMessage="1" sqref="G2:G${maxRow}"><x:formula1>"Masuk,Keluar"</x:formula1></x:dataValidation></x:dataValidations><x:pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3" /><x:tableParts count="1"><x:tablePart r:id="R4382ed52ec2b42ea" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" /></x:tableParts></x:worksheet>`;
}

function generateSheet2Xml(walletRows) {
    let rowsXml = `<x:row r="1"><x:c r="A1" s="1" t="s"><x:v>0</x:v></x:c><x:c r="B1" s="1" t="s"><x:v>1</x:v></x:c></x:row>`;

    walletRows.forEach((w, index) => {
        const rowNum = index + 2;
        const nameStr = xmlEscape(w.name || '');
        const balNum = Number(w.balance || 0);
        rowsXml += `<x:row r="${rowNum}"><x:c r="A${rowNum}" s="2" t="inlineStr"><x:is><x:t>${nameStr}</x:t></x:is></x:c><x:c r="B${rowNum}" s="3"><x:v>${balNum.toFixed(1)}</x:v></x:c></x:row>`;
    });

    return `<?xml version="1.0" encoding="utf-8"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetFormatPr defaultColWidth="12.630000114440918" defaultRowHeight="15.75" /><x:sheetData>${rowsXml}</x:sheetData><x:pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3" /></x:worksheet>`;
}

function updateDashboardSheet1(sheet1Xml, expenses, walletRows) {
    let totalIncome = 0;
    let totalExpense = 0;
    let activeTxCount = 0;

    const categorySums = {
        'Belanja': 0,
        'Tagihan': 0,
        'Transport': 0,
        'Transportasi': 0,
        'Makan': 0,
        'Lainnya': 0,
    };

    const dailyIncome = {};
    const dailyExpense = {};
    for (let i = 1; i <= 31; i++) {
        dailyIncome[i] = 0;
        dailyExpense[i] = 0;
    }

    expenses.forEach((item) => {
        const isCancel = ['cancelled', 'canceled', 'dibatalkan'].includes(String(item.status || item.statusText || '').toLowerCase());
        if (isCancel) return;
        activeTxCount++;
        const amt = Number(item.amount || 0);
        const isInc = String(item.tipe || item.type || '').toLowerCase() === 'masuk' || String(item.type || '').toLowerCase() === 'income';

        if (isInc) {
            totalIncome += amt;
        } else {
            totalExpense += amt;
            const rawCat = String(item.category || 'Lainnya').trim();
            if (categorySums[rawCat] !== undefined) {
                categorySums[rawCat] += amt;
            } else if (rawCat.toLowerCase().includes('transport')) {
                categorySums['Transport'] += amt;
            } else if (rawCat.toLowerCase().includes('makan')) {
                categorySums['Makan'] += amt;
            } else {
                categorySums['Lainnya'] += amt;
            }
        }

        const d = item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp || item.date || new Date());
        if (!Number.isNaN(d.getTime())) {
            const day = d.getDate();
            if (day >= 1 && day <= 31) {
                if (isInc) dailyIncome[day] += amt;
                else dailyExpense[day] += amt;
            }
        }
    });

    const netCashflow = totalIncome - totalExpense;
    const totalSaldo = walletRows.reduce((sum, w) => sum + Number(w.balance || 0), 0);

    const cellValues = {
        'AB1': totalIncome,
        'AB2': totalExpense,
        'AB3': netCashflow,
        'AB4': totalSaldo,
        'AB5': activeTxCount,
        'B5': `Rp ${totalIncome.toLocaleString('en-US')}`,
        'E5': `Rp ${totalExpense.toLocaleString('en-US')}`,
        'H5': `Rp ${netCashflow.toLocaleString('en-US')}`,
        'K5': `Rp ${totalSaldo.toLocaleString('en-US')}`,
        'N5': String(activeTxCount),
        'AA6': categorySums['Belanja'],
        'AA7': categorySums['Tagihan'],
        'AA8': categorySums['Transport'] + categorySums['Transportasi'],
        'AA9': categorySums['Makan'],
        'AA10': categorySums['Lainnya'],
        'AI5': categorySums['Belanja'],
        'AI6': categorySums['Tagihan'],
        'AI7': categorySums['Transport'] + categorySums['Transportasi'],
        'AI8': categorySums['Makan'],
        'AI9': categorySums['Lainnya'],
    };

    for (let day = 1; day <= 31; day++) {
        const row = day + 4;
        cellValues[`Y${row}`] = dailyIncome[day];
        cellValues[`Z${row}`] = dailyExpense[day];
        cellValues[`AF${row}`] = dailyIncome[day];
        cellValues[`AG${row}`] = dailyExpense[day];
    }

    let updatedXml = sheet1Xml;
    const isPrefixed = sheet1Xml.includes('<x:worksheet');
    const vTag = isPrefixed ? 'x:v' : 'v';

    for (const [cellRef, val] of Object.entries(cellValues)) {
        const strVal = String(val);
        const cellRegex = new RegExp(`(<(?:x:)?c r="${cellRef}"[^>]*>(?:<(?:x:)?f>[^<]*<\\/(?:x:)?f>)?)(?:<(?:x:)?v>[^<]*<\\/(?:x:)?v>)?(<\\/(?:x:)?c>)`, 'g');
        if (cellRegex.test(updatedXml)) {
            updatedXml = updatedXml.replace(cellRegex, `$1<${vTag}>${strVal}</${vTag}>$2`);
        }
    }

    return updatedXml;
}

function updateTable1Xml(tableXml, rowCount) {
    const maxRow = Math.max(rowCount + 1, 2);
    return tableXml.replace(/ref="A1:K\d+"/g, `ref="A1:K${maxRow}"`);
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

    const walletRows = calculateWalletRows(expenses, wallets);
    const directory = await unzipper.Open.file(templatePath);

    let sheet1Original = '';
    let table1Original = '';
    for (const file of directory.files) {
        if (file.path === 'xl/worksheets/sheet1.xml') {
            const buf = await file.buffer();
            sheet1Original = buf.toString('utf-8');
        }
        if (file.path === 'xl/tables/table1.xml') {
            const buf = await file.buffer();
            table1Original = buf.toString('utf-8');
        }
    }

    const sheet3Xml = generateSheet3Xml(expenses, userId);
    const sheet2Xml = generateSheet2Xml(walletRows);
    const sheet1Updated = updateDashboardSheet1(sheet1Original, expenses, walletRows);
    const table1Updated = table1Original ? updateTable1Xml(table1Original, expenses.length) : '';

    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks = [];
    archive.on('data', (chunk) => chunks.push(chunk));

    for (const file of directory.files) {
        if (file.path === 'xl/worksheets/sheet3.xml') {
            archive.append(Buffer.from(sheet3Xml, 'utf-8'), { name: file.path });
        } else if (file.path === 'xl/worksheets/sheet2.xml') {
            archive.append(Buffer.from(sheet2Xml, 'utf-8'), { name: file.path });
        } else if (file.path === 'xl/worksheets/sheet1.xml') {
            archive.append(Buffer.from(sheet1Updated, 'utf-8'), { name: file.path });
        } else if (file.path === 'xl/tables/table1.xml' && table1Updated) {
            archive.append(Buffer.from(table1Updated, 'utf-8'), { name: file.path });
        } else {
            const buf = await file.buffer();
            archive.append(buf, { name: file.path });
        }
    }

    await archive.finalize();
    const finalBuffer = Buffer.concat(chunks);

    return {
        buffer: finalBuffer,
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
