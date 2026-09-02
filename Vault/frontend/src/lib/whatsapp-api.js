import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL
  || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');

export async function whatsappApi(path, options = {}) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function downloadBlob(path, options = {}) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.blob();
}

export const getWhatsAppStatus = () => whatsappApi('/api/whatsapp/status');
export const connectWhatsApp = () => whatsappApi('/api/whatsapp/connect', { method: 'POST' });
export const disconnectWhatsApp = () => whatsappApi('/api/whatsapp/disconnect', { method: 'DELETE' });
export const getBackendSettings = () => whatsappApi('/api/settings');
export const listRecaps = () => whatsappApi('/api/recaps');
export const createNewRecap = (values) => whatsappApi('/api/recaps/new', {
  method: 'POST',
  body: JSON.stringify(values),
});
export const sendWhatsAppMessage = (to, message) => whatsappApi('/api/whatsapp/send', {
  method: 'POST',
  body: JSON.stringify({ to, message }),
});

export const saveJidMapping = (lidJid, phoneNumber) => whatsappApi('/api/jid-mappings', {
  method: 'PUT',
  body: JSON.stringify({ lid_jid: lidJid, phone_number: phoneNumber }),
});

export const listCategories = () => whatsappApi('/api/categories');

export const createCategory = (values) => whatsappApi('/api/categories', {
  method: 'POST',
  body: JSON.stringify(values),
});

export const updateCategory = (id, values) => whatsappApi(`/api/categories/${id}`, {
  method: 'PUT',
  body: JSON.stringify(values),
});

export const disableCategory = (id) => whatsappApi(`/api/categories/${id}`, {
  method: 'DELETE',
});

export const addCategoryKeyword = (id, keyword) => whatsappApi(`/api/categories/${id}/items`, {
  method: 'POST',
  body: JSON.stringify({ keyword }),
});

export const deleteCategoryKeyword = (categoryId, itemId) => whatsappApi(`/api/categories/${categoryId}/items/${itemId}`, {
  method: 'DELETE',
});

export const downloadExcelReport = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return downloadBlob(`/api/reports/excel${suffix}`);
};
