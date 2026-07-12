const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initSession, getSessionStatus, deleteSession } = require('./waService');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Simple in-memory mock for user authentication (for demo purposes)
// In a real SaaS, this would check JWT tokens and a database
const authenticate = (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ error: 'Missing x-user-id header' });
    }
    req.userId = userId;
    next();
};

app.post('/api/whatsapp/connect', authenticate, async (req, res) => {
    try {
        await initSession(req.userId);
        res.json({ message: 'Session initialization started. Check status for QR code.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to initialize session' });
    }
});

app.get('/api/whatsapp/status', authenticate, (req, res) => {
    const status = getSessionStatus(req.userId);
    res.json(status);
});

app.delete('/api/whatsapp/disconnect', authenticate, (req, res) => {
    const result = deleteSession(req.userId);
    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
