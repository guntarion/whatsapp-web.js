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

// Send message to multiple contacts (bulk)
app.post('/api/send-bulk', async (req, res) => {
    const { contactIds, message } = req.body;

    if (!clientReady) {
        return res.json({ success: false, error: 'WhatsApp client not ready' });
    }

    if (!contactIds || !contactIds.length || !message) {
        return res.json({ success: false, error: 'Contact IDs and message are required' });
    }

    const results = [];

    for (const contactId of contactIds) {
        const contact = contacts.find(c => c.id === contactId);

        if (!contact) {
            results.push({ contactId, success: false, error: 'Contact not found' });
            continue;
        }

        try {
            const chatId = `${contact.phone}@c.us`;
            const finalMessage = message.replace(/{name}/g, contact.name);

            await client.sendMessage(chatId, finalMessage);

            console.log(`Message sent to ${contact.name} (${contact.phone})`);
            results.push({
                contactId,
                name: contact.name,
                phone: contact.phone,
                success: true
            });

            // Small delay between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Failed to send to ${contact.name}:`, error.message);
            results.push({
                contactId,
                name: contact.name,
                phone: contact.phone,
                success: false,
                error: error.message
            });
        }
    }

    res.json({ results });
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`\nServer running at http://localhost:${PORT}`);
    console.log('Initializing WhatsApp client...\n');
    client.initialize();
});
