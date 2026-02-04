const { Client, LocalAuth } = require('./index');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('Scan this QR code with your WhatsApp app:\n');
    qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
    console.log('Loading:', percent + '%', message);
});

client.on('authenticated', () => {
    console.log('Authenticated!');
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', msg => {
    console.log('Message received:', msg.body);

    // Simple test: reply "pong" when someone sends "!ping"
    if (msg.body === '!ping') {
        msg.reply('pong');
    }
});

client.on('disconnected', (reason) => {
    console.log('Client disconnected:', reason);
});

console.log('Initializing WhatsApp client...');
client.initialize();
