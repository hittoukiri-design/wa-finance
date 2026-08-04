import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL
  || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'https://wa-finance-bot-i729.web.app' : '');

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
