import { getBackendSettings, whatsappApi } from './whatsapp-api';

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeExpense(item) {
  return {
    ...item,
    id: String(item.id),
    amount: Number(item.amount || 0),
    createdAt: normalizeDate(item.createdAt || item.created_at || item.timestamp || item.date),
    timestamp: normalizeDate(item.timestamp || item.createdAt || item.created_at || item.date),
  };
}

function normalizeConversation(item) {
  return {
    ...item,
    id: String(item.id),
    timestamp: normalizeDate(item.timestamp || item.createdAt || item.created_at),
    createdAt: normalizeDate(item.createdAt || item.created_at || item.timestamp),
  };
}

export async function listExpenses(_uid, options = {}) {
  const search = new URLSearchParams();
  if (options.recapId) search.set('recapId', options.recapId);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  const data = await whatsappApi(`/api/expenses${suffix}`);
  return (Array.isArray(data) ? data : []).map(normalizeExpense);
}

export async function addExpense(_uid, values) {
  const data = await whatsappApi('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(values),
  });
  return normalizeExpense(data);
}

export async function updateExpense(_uid, expenseId, values) {
  const data = await whatsappApi(`/api/expenses/${encodeURIComponent(expenseId)}`, {
    method: 'PUT',
    body: JSON.stringify(values),
  });
  return normalizeExpense(data);
}

export async function deleteExpense(_uid, expenseId) {
  return whatsappApi(`/api/expenses/${encodeURIComponent(expenseId)}`, { method: 'DELETE' });
}

export async function listConversations(_uid, options = {}) {
  const search = new URLSearchParams();
  if (options.recapId) search.set('recapId', options.recapId);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  const data = await whatsappApi(`/api/conversations${suffix}`);
  return (Array.isArray(data) ? data : []).map(normalizeConversation);
}

export async function getSettings() {
  return getBackendSettings();
}

export async function saveSettings(_uid, values) {
  const data = await whatsappApi('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(values),
  });
  return data.settings || data;
}
