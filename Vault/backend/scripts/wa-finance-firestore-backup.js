#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getApps, initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const collectionName = process.env.FIRESTORE_MONTHLY_BACKUP_COLLECTION || 'wa_finance_monthly_backups';
const retention = Math.max(1, Number(process.env.FIRESTORE_MONTHLY_BACKUP_RETENTION || 12));
const chunkSize = 512 * 1024;

function usage() {
    console.error(`Usage:
  node wa-finance-firestore-backup.js upload <encrypted-file> <backup-id>
  node wa-finance-firestore-backup.js download <backup-id|latest> <destination>`);
    process.exit(2);
}

function firestore() {
    if (!getApps().length) {
        initializeApp({
            credential: applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID || 'wa-finance-bot-i729',
        });
    }
    return getFirestore();
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function deleteBackup(db, backupRef) {
    const chunks = await backupRef.collection('chunks').get();
    let batch = db.batch();
    let operations = 0;

    for (const chunk of chunks.docs) {
        batch.delete(chunk.ref);
        operations += 1;
        if (operations === 400) {
            await batch.commit();
            batch = db.batch();
            operations = 0;
        }
    }
    batch.delete(backupRef);
    await batch.commit();
}

async function pruneOldBackups(db) {
    const snapshots = await db.collection(collectionName).orderBy('created_at', 'desc').get();
    const stale = snapshots.docs.slice(retention);
    for (const document of stale) {
        await deleteBackup(db, document.ref);
        console.log(`Pruned old monthly backup: ${document.id}`);
    }
}

async function upload(sourcePath, backupId) {
    const payload = await fs.promises.readFile(sourcePath);
    if (!payload.length) throw new Error('Encrypted backup file is empty.');

    const db = firestore();
    const backupRef = db.collection(collectionName).doc(backupId);
    const existing = await backupRef.get();
    if (existing.exists) await deleteBackup(db, backupRef);

    const chunks = [];
    for (let offset = 0; offset < payload.length; offset += chunkSize) {
        chunks.push(payload.subarray(offset, Math.min(offset + chunkSize, payload.length)));
    }

    await backupRef.set({
        version: 1,
        filename: path.basename(sourcePath),
        size_bytes: payload.length,
        sha256: sha256(payload),
        chunk_count: chunks.length,
        encrypted: true,
        encryption: 'AES-256-CBC',
        storage: 'firestore-monthly-archive',
        created_at: FieldValue.serverTimestamp(),
    });

    let batch = db.batch();
    let operations = 0;
    for (const [index, chunk] of chunks.entries()) {
        batch.set(backupRef.collection('chunks').doc(String(index).padStart(6, '0')), {
            index,
            payload: chunk.toString('base64'),
        });
        operations += 1;
        if (operations === 400) {
            await batch.commit();
            batch = db.batch();
            operations = 0;
        }
    }
    if (operations) await batch.commit();

    await pruneOldBackups(db);
    console.log(`Firestore monthly backup saved: ${backupId} (${payload.length} bytes, ${chunks.length} chunk(s))`);
}

async function resolveBackupRef(db, backupId) {
    if (backupId !== 'latest') return db.collection(collectionName).doc(backupId);
    const snapshots = await db.collection(collectionName).orderBy('created_at', 'desc').limit(1).get();
    if (snapshots.empty) throw new Error('No monthly Firestore backup found.');
    return snapshots.docs[0].ref;
}

async function download(backupId, destination) {
    const db = firestore();
    const backupRef = await resolveBackupRef(db, backupId);
    const manifest = await backupRef.get();
    if (!manifest.exists) throw new Error(`Monthly Firestore backup not found: ${backupId}`);

    const chunks = await backupRef.collection('chunks').orderBy('index', 'asc').get();
    const metadata = manifest.data();
    if (chunks.size !== metadata.chunk_count) throw new Error('Monthly backup is incomplete: chunk count mismatch.');

    const payload = Buffer.concat(chunks.docs.map((chunk) => Buffer.from(chunk.get('payload'), 'base64')));
    if (payload.length !== metadata.size_bytes || sha256(payload) !== metadata.sha256) {
        throw new Error('Monthly backup integrity check failed.');
    }

    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.writeFile(destination, payload, { mode: 0o600 });
    console.log(destination);
}

async function main() {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'upload' && args[0] && args[1]) return upload(args[0], args[1]);
    if (command === 'download' && args[0] && args[1]) return download(args[0], args[1]);
    usage();
}

main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exit(1);
});
