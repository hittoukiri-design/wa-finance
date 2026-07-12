const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// Store active socket instances and their QR codes
const activeSessions = new Map();
const qrCodes = new Map();

/**
 * Initialize a WhatsApp session for a given userId
 */
async function initSession(userId) {
    const sessionPath = path.join(sessionsDir, userId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }), // Suppress detailed logs
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log(`[${userId}] New QR Code generated`);
            qrCodes.set(userId, qr);
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[${userId}] Connection closed due to ${lastDisconnect.error?.message}. Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                initSession(userId);
            } else {
                console.log(`[${userId}] Logged out. Removing session.`);
                activeSessions.delete(userId);
                qrCodes.delete(userId);
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }
        } else if (connection === 'open') {
            console.log(`[${userId}] Connection opened successfully`);
            activeSessions.set(userId, sock);
            qrCodes.delete(userId); // Remove QR since we are connected
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        console.log(`[${userId}] Received message from ${msg.key.remoteJid}`);
        
        // TODO: Pass this message to the Groq AI Engine based on the user's config
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (text) {
            // For now, auto-reply to test connection
            if (text.toLowerCase() === 'ping') {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Pong! WA Finance Bot is active.' });
            }
        }
    });

    // Save initial socket
    activeSessions.set(userId, sock);
    return sock;
}

function getSessionStatus(userId) {
    const sock = activeSessions.get(userId);
    const qr = qrCodes.get(userId);
    
    if (sock && !qr) return { status: 'connected' };
    if (qr) return { status: 'qr', qr };
    return { status: 'disconnected' };
}

function deleteSession(userId) {
    const sock = activeSessions.get(userId);
    if (sock) {
        sock.logout();
        activeSessions.delete(userId);
    }
    const sessionPath = path.join(sessionsDir, userId);
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    return { status: 'deleted' };
}

module.exports = {
    initSession,
    getSessionStatus,
    deleteSession
};
