const { Client, LocalAuth } = require('./index');
const qrcode = require('qrcode-terminal');
const express = require('express');
const path = require('path');

// Load data
const contacts = require('./contacts.json');
const templates = require('./templates.json');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// WhatsApp client state
let clientReady = false;
let qrCodeString = null;

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    qrCodeString = qr;
    console.log('\nScan this QR code with your WhatsApp app:\n');
    qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
    console.log('Loading:', percent + '%', message);
});

client.on('authenticated', () => {
    console.log('Authenticated!');
    qrCodeString = null;
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    clientReady = true;
    qrCodeString = null;
});

client.on('disconnected', (reason) => {
    console.log('Client disconnected:', reason);
    clientReady = false;
});

// ============ API ENDPOINTS ============

// Get client status
app.get('/api/status', (req, res) => {
    res.json({
        ready: clientReady,
        needsQR: qrCodeString !== null
    });
});

// Get contacts
app.get('/api/contacts', (req, res) => {
    res.json(contacts);
});

// Get templates
app.get('/api/templates', (req, res) => {
    res.json(templates);
});

// Send message to single contact
app.post('/api/send', async (req, res) => {
    const { phone, message, contactName } = req.body;

    if (!clientReady) {
        return res.json({ success: false, error: 'WhatsApp client not ready' });
    }

    if (!phone || !message) {
        return res.json({ success: false, error: 'Phone and message are required' });
    }

    try {
        // Format phone number for WhatsApp
        const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;

        // Replace {name} placeholder in message
        const finalMessage = message.replace(/{name}/g, contactName || 'there');

        await client.sendMessage(chatId, finalMessage);

        console.log(`Message sent to ${phone}`);
        res.json({ success: true, phone });
    } catch (error) {
        console.error(`Failed to send to ${phone}:`, error.message);
        res.json({ success: false, phone, error: error.message });
    }
});

// Store for tracking bulk send progress
let bulkSendProgress = {
    isRunning: false,
    total: 0,
    sent: 0,
    currentContact: null,
    results: [],
    nextSendIn: 0
};

// Get random delay between min and max seconds
function getRandomDelay(minSec = 5, maxSec = 12) {
    return Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;
}

// Get bulk send progress
app.get('/api/send-progress', (req, res) => {
    res.json(bulkSendProgress);
});

// Cancel bulk send
app.post('/api/send-cancel', (req, res) => {
    if (bulkSendProgress.isRunning) {
        bulkSendProgress.isRunning = false;
        res.json({ success: true, message: 'Bulk send cancelled' });
    } else {
        res.json({ success: false, message: 'No bulk send in progress' });
    }
});

// Send message to multiple contacts (bulk)
app.post('/api/send-bulk', async (req, res) => {
    const { contactIds, message } = req.body;

    if (!clientReady) {
        return res.json({ success: false, error: 'WhatsApp client not ready' });
    }

    if (!contactIds || !contactIds.length || !message) {
        return res.json({ success: false, error: 'Contact IDs and message are required' });
    }

    if (bulkSendProgress.isRunning) {
        return res.json({ success: false, error: 'Bulk send already in progress' });
    }

    // Initialize progress
    bulkSendProgress = {
        isRunning: true,
        total: contactIds.length,
        sent: 0,
        currentContact: null,
        results: [],
        nextSendIn: 0
    };

    // Send response immediately, process in background
    res.json({ success: true, message: 'Bulk send started', total: contactIds.length });

    // Process messages in background
    for (const contactId of contactIds) {
        // Check if cancelled
        if (!bulkSendProgress.isRunning) {
            console.log('Bulk send cancelled by user');
            break;
        }

        const contact = contacts.find(c => c.id === contactId);

        if (!contact) {
            bulkSendProgress.results.push({ contactId, success: false, error: 'Contact not found' });
            bulkSendProgress.sent++;
            continue;
        }

        // Get display name based on category
        const name = contact.namaPeserta || contact.namaTenant || contact.namaPenanggungJawab || 'Bapak/Ibu';
        const pendaftar = contact.namaPendaftar || contact.namaPenanggungJawab || name;
        const noReg = contact.noRegistrasi || '';

        bulkSendProgress.currentContact = { name, phone: contact.phone };

        try {
            const chatId = `${contact.phone}@c.us`;

            // Replace all placeholders
            const finalMessage = message
                .replace(/{name}/g, name)
                .replace(/{pendaftar}/g, pendaftar)
                .replace(/{noreg}/g, noReg);

            await client.sendMessage(chatId, finalMessage);

            console.log(`[${bulkSendProgress.sent + 1}/${bulkSendProgress.total}] Sent to ${name} (${contact.phone})`);
            bulkSendProgress.results.push({
                contactId,
                name: name,
                phone: contact.phone,
                success: true
            });
        } catch (error) {
            console.error(`Failed to send to ${name}:`, error.message);
            bulkSendProgress.results.push({
                contactId,
                name: name,
                phone: contact.phone,
                success: false,
                error: error.message
            });
        }

        bulkSendProgress.sent++;

        // Random delay between 5-12 seconds before next message (if not last)
        if (bulkSendProgress.sent < bulkSendProgress.total && bulkSendProgress.isRunning) {
            const delay = getRandomDelay(5, 12);
            bulkSendProgress.nextSendIn = delay;
            console.log(`Waiting ${delay / 1000}s before next message...`);

            // Countdown the delay
            const startTime = Date.now();
            while (Date.now() - startTime < delay) {
                if (!bulkSendProgress.isRunning) break;
                bulkSendProgress.nextSendIn = delay - (Date.now() - startTime);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    bulkSendProgress.isRunning = false;
    bulkSendProgress.currentContact = null;
    bulkSendProgress.nextSendIn = 0;
    console.log('Bulk send completed');
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`\nServer running at http://localhost:${PORT}`);
    console.log('Initializing WhatsApp client...\n');
    client.initialize();
});
