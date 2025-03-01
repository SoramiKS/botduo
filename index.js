const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const fs = require('fs');
const cron = require("node-cron");
const qrcode = require('qrcode-terminal');
const http = require('http');
const moment = require("moment-timezone");

// Create auth directory if it doesn't exist
if (!fs.existsSync('./auth')) {
  fs.mkdirSync('./auth');
}

async function startWhatsApp() {
  const { state: authState, saveCreds } = await useMultiFileAuthState('./auth');

  const sock = makeWASocket({
    auth: authState,
    printQRInTerminal: true,
    browser: ['WhatsApp Bot', 'Chrome', '10.0'],
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 30000,
    keepAliveIntervalMs: 10000,
    markOnlineOnConnect: true,
    retryRequestDelayMs: 1000
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('QR Code received, please scan with your WhatsApp app:');
      qrcode.generate(qr, { small: true });
    }
    console.log('Connection state:', connection);

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed with status:', statusCode);

      if (statusCode !== 401) {
        console.log('Reconnecting...');
        setTimeout(startWhatsApp, 5000);
      } else {
        console.log('Authentication failed. Please scan the QR code again.');
        fs.rmSync('./auth', { recursive: true, force: true });
        fs.mkdirSync('./auth');
        setTimeout(startWhatsApp, 5000);
      }
    }

    if (connection === 'open') {
      console.log('Connection established successfully!');
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (m.key.remoteJid?.endsWith('@g.us')) {
      console.log('Group ID detected:', m.key.remoteJid);
    }
  });

  const targetGroup = "120363392281093231@g.us";

  async function sendGroupMessage(text) {
    await sock.sendMessage(targetGroup, { text });
    console.log("Pesan terkirim ke grup:", text);
  }

  // Menggunakan zona waktu WIB (Asia/Jakarta) untuk jadwal
  cron.schedule("0 7 * * *", () => sendGroupMessage("@everyone Selamat pagi! Mulai hari dengan latihan Duolingo yuk! 🌞🦉"), {
    scheduled: true,
    timezone: "Asia/Jakarta"
  });
  
  cron.schedule("0 10 * * *", () => sendGroupMessage("@everyone Sudah sarapan dan latihan Duolingo belum? 🍳🦉"), {
    scheduled: true,
    timezone: "Asia/Jakarta"
  });
  
  cron.schedule("0 14 * * *", () => sendGroupMessage("@everyone Siang-siang, yuk cek streak Duolingo kamu! 🔥😏"), {
    scheduled: true,
    timezone: "Asia/Jakarta"
  });
  
  cron.schedule("0 18 * * *", () => sendGroupMessage("@everyone Sore hari yang sempurna untuk latihan Duolingo! ☕🦉"), {
    scheduled: true,
    timezone: "Asia/Jakarta"
  });
  
  cron.schedule("0 21 * * *", () => sendGroupMessage("@everyone Jangan tidur sebelum latihan Duolingo hari ini! 🌙✨"), {
    scheduled: true,
    timezone: "Asia/Jakarta"
  });

  console.log("Bot WhatsApp siap jalan...");

  // Make sendGroupMessage available outside
  global.sendGroupMessage = sendGroupMessage;

  return sock;
}

startWhatsApp().catch(err => console.log("Error:", err));

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.setPrompt('Ketik pesan untuk grup: ');
rl.prompt();

rl.on('line', async (message) => {
  if (message.toLowerCase() === 'exit') {
    rl.close();
  } else {
    await sendGroupMessage(message);
    rl.prompt();
  }
});

rl.on('close', () => {
  console.log('Keluar dari mode input manual.');
});

// Buat server HTTP sederhana untuk keep-alive
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot WhatsApp aktif!\n');
});

server.listen(8080, '0.0.0.0', () => {
  console.log('Server keep-alive berjalan di port 8080');
});

// Keep alive dengan ping sendiri setiap 5 menit
setInterval(() => {
  http.get(`http://0.0.0.0:8080`, (res) => {
    console.log('Keep-alive ping berhasil, status:', res.statusCode);
  }).on('error', (err) => {
    console.error('Keep-alive ping gagal:', err.message);
  });
}, 5 * 60 * 1000);

// Fungsi untuk mendapatkan waktu WIB saat ini
function getWIBTime() {
  return moment().tz("Asia/Jakarta").format("HH:mm:ss DD-MM-YYYY");
}

// Log waktu saat ini dalam WIB setiap menit
setInterval(() => {
  console.log('Waktu WIB saat ini:', getWIBTime());
}, 60 * 1000);
