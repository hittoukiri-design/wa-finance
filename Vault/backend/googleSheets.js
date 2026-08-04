const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

function loadCredentials() {
  if (SERVICE_ACCOUNT_JSON) {
    return JSON.parse(SERVICE_ACCOUNT_JSON);
  }

  if (SERVICE_ACCOUNT_PATH) {
    return require(path.resolve(SERVICE_ACCOUNT_PATH));
  }

  throw new Error('Google Sheets service account belum dikonfigurasi. Set GOOGLE_SERVICE_ACCOUNT_PATH atau GOOGLE_SERVICE_ACCOUNT_JSON.');
}

const credentials = loadCredentials();

if (!SPREADSHEET_ID) {
  throw new Error('Google Sheets spreadsheet ID belum dikonfigurasi. Set GOOGLE_SHEETS_SPREADSHEET_ID atau SPREADSHEET_ID.');
}

const serviceAccountAuth = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

let isInitialized = false;

async function initSheet() {
  if (isInitialized) return;
  try {
    await doc.loadInfo();
    console.log('Google Sheets connected: ', doc.title);

    const sheet = doc.sheetsByIndex[0]; // use the first sheet

    // Ensure header row exists. This will set the headers if they are not already set.
    await sheet.setHeaderRow(['Date', 'Merchant', 'Category', 'Amount', 'Payment Channel', 'Type', 'Confidence']);
    isInitialized = true;
  } catch (error) {
    console.error('Error initializing Google Sheets:', error);
  }
}

async function addExpenseToSheet(expense) {
  try {
    await initSheet();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      'Date': expense.date,
      'Merchant': expense.merchant,
      'Category': expense.category,
      'Amount': expense.amount,
      'Payment Channel': expense.payment_channel,
      'Type': expense.type || 'expense',
      'Confidence': expense.confidence
    });
    console.log('Successfully added row to Google Sheets');
  } catch (error) {
    console.error('Error adding row to Google Sheets:', error);
  }
}

module.exports = {
  addExpenseToSheet
};
