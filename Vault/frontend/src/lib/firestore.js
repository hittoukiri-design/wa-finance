import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { firestore } from './firebase';

const userCollection = (uid, name) => collection(firestore, 'users', uid, name);

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
}

function normalizeDoc(item) {
  const data = item.data();
  return {
    id: item.id,
    ...data,
    createdAt: normalizeTimestamp(data.createdAt),
    timestamp: normalizeTimestamp(data.timestamp),
  };
}

function matchesRecapFilter(item, recapId = 'active') {
  const status = String(item.recap_status || 'active').toLowerCase();
  if (recapId === 'all') return true;
  if (recapId && recapId !== 'active') return String(item.recap_id || '') === recapId;
  return status !== 'archived';
}

export async function listExpenses(uid, options = {}) {
  const recapId = options.recapId || 'active';
  const snapshot = await getDocs(query(userCollection(uid, 'expenses'), orderBy('createdAt', 'desc')));
  return snapshot.docs
    .map(normalizeDoc)
    .filter((item) => !['cancelled', 'canceled', 'dibatalkan'].includes(String(item.status || '').toLowerCase()))
    .filter((item) => matchesRecapFilter(item, recapId));
}

export async function addExpense(uid, values) {
  return addDoc(userCollection(uid, 'expenses'), {
    merchant: values.merchant.trim(),
    category: values.category.trim() || 'Lainnya',
    amount: Number(values.amount),
    date: values.date,
    source: values.source || 'Manual',
    status: values.status || 'New',
    type: values.type || 'expense',
    payment_channel: values.payment_channel || 'Cash',
    recap_status: 'active',
    createdAt: serverTimestamp(),
  });
}

export async function updateExpense(uid, expenseId, values) {
  const payload = {
    updatedAt: serverTimestamp(),
  };
  if (values.merchant !== undefined) payload.merchant = String(values.merchant).trim();
  if (values.category !== undefined) payload.category = String(values.category).trim() || 'Lainnya';
  if (values.amount !== undefined) payload.amount = Number(values.amount);
  if (values.date !== undefined) payload.date = values.date;
  if (values.payment_channel !== undefined) payload.payment_channel = String(values.payment_channel).trim() || 'Cash';
  if (values.type !== undefined) payload.type = values.type;
  if (values.status !== undefined) payload.status = values.status;

  await setDoc(doc(firestore, 'users', uid, 'expenses', expenseId), payload, { merge: true });
}

export async function deleteExpense(uid, expenseId) {
  await deleteDoc(doc(firestore, 'users', uid, 'expenses', expenseId));
}

export async function listConversations(uid, options = {}) {
  const recapId = options.recapId || 'active';
  const snapshot = await getDocs(query(userCollection(uid, 'conversations'), orderBy('timestamp', 'desc')));
  return snapshot.docs.map(normalizeDoc).filter((item) => matchesRecapFilter(item, recapId));
}

export async function getSettings(uid) {
  const snapshot = await getDoc(doc(firestore, 'users', uid, 'settings', 'config'));
  return snapshot.exists() ? snapshot.data() : {};
}

export async function saveSettings(uid, values) {
  await setDoc(doc(firestore, 'users', uid, 'settings', 'config'), {
    ...values,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
