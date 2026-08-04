const { applicationDefault, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

let adminAuth;
let adminFirestore;

function getAdminApp() {
    return getApps().length
        ? getApps()[0]
        : initializeApp({
            credential: applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID || 'wa-finance-bot-i729',
        });
}

function getAdminAuth() {
    if (!adminAuth) {
        adminAuth = getAuth(getAdminApp());
    }
    return adminAuth;
}

function getAdminFirestore() {
    if (!adminFirestore) adminFirestore = getFirestore(getAdminApp());
    return adminFirestore;
}

module.exports = { FieldValue, getAdminAuth, getAdminFirestore };
