#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'wa-finance-bot-i729';
const bucketName = process.env.WA_FINANCE_BACKUP_BUCKET || 'wa-finance-bot-i729-selfhost-backups';
const secretId = process.env.WA_FINANCE_BACKUP_SECRET_ID || 'wa-finance-backup-passphrase';

const storage = new Storage({ projectId });
const secrets = new SecretManagerServiceClient();

function usage() {
  console.error(`Usage:
  node wa-finance-cloud-backup.js upload <localFile> <objectName> [contentType]
  node wa-finance-cloud-backup.js download <objectName> <localFile>
  node wa-finance-cloud-backup.js latest <prefix>
  node wa-finance-cloud-backup.js get-secret [secretId]
  node wa-finance-cloud-backup.js add-secret-version <localFile> [secretId]
`);
  process.exit(2);
}

async function upload(localFile, objectName, contentType = 'application/octet-stream') {
  await storage.bucket(bucketName).upload(localFile, {
    destination: objectName,
    resumable: false,
    metadata: {
      contentType,
      metadata: {
        uploadedBy: 'wa-finance-selfhost-backup',
        sourceHost: process.env.HOSTNAME || 'unknown',
      },
    },
  });
  console.log(`gs://${bucketName}/${objectName}`);
}

async function download(objectName, localFile) {
  await fs.promises.mkdir(path.dirname(localFile), { recursive: true });
  await storage.bucket(bucketName).file(objectName).download({ destination: localFile });
  console.log(localFile);
}

async function latest(prefix) {
  const [files] = await storage.bucket(bucketName).getFiles({ prefix });
  const encrypted = files
    .filter((file) => file.name.endsWith('.tar.gz.enc'))
    .sort((a, b) => {
      const aTime = new Date(a.metadata.updated || a.metadata.timeCreated || 0).getTime();
      const bTime = new Date(b.metadata.updated || b.metadata.timeCreated || 0).getTime();
      return bTime - aTime;
    });

  if (!encrypted.length) {
    console.error(`No backup found for prefix: ${prefix}`);
    process.exit(1);
  }

  console.log(encrypted[0].name);
}

async function getSecret(id = secretId) {
  const name = `projects/${projectId}/secrets/${id}/versions/latest`;
  const [version] = await secrets.accessSecretVersion({ name });
  process.stdout.write(version.payload.data.toString('utf8'));
}

async function addSecretVersion(localFile, id = secretId) {
  const parent = `projects/${projectId}/secrets/${id}`;
  const data = await fs.promises.readFile(localFile);
  const [version] = await secrets.addSecretVersion({
    parent,
    payload: { data },
  });
  console.log(version.name);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) usage();

  if (command === 'upload') {
    const [localFile, objectName, contentType] = args;
    if (!localFile || !objectName) usage();
    return upload(localFile, objectName, contentType);
  }

  if (command === 'download') {
    const [objectName, localFile] = args;
    if (!objectName || !localFile) usage();
    return download(objectName, localFile);
  }

  if (command === 'latest') {
    const [prefix] = args;
    if (!prefix) usage();
    return latest(prefix);
  }

  if (command === 'get-secret') {
    return getSecret(args[0]);
  }

  if (command === 'add-secret-version') {
    const [localFile, id] = args;
    if (!localFile) usage();
    return addSecretVersion(localFile, id);
  }

  usage();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
