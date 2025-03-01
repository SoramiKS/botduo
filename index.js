require("dotenv").config();
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const fs = require("fs");
const cron = require("node-cron");
const qrcode = require("qrcode");
const http = require("http");
const express = require("express");
const moment = require("moment-timezone");

const app = express();
app.use(express.static(".")); // Menyediakan akses ke file qrcode.png

// Pastikan folder auth ada
if (!fs.existsSync("./auth")) fs.mkdirSync("./auth");

let latestQR = "";

async function startWhatsApp() {
  const { state: authState, saveCreds } = await useMultiFileAuthState("./auth");

  const sock = makeWASocket({
    auth: authState,
    browser: ["WhatsApp Bot", "Chrome", "10.0"],
    printQRInTerminal: false,
  });

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("Scan QR Code di: http://localhost:3000");
      latestQR = qr;
      await qrcode.toFile("./qrcode.png", qr);
    }

    if (connection === "close") {
      console.log("Koneksi terputus, mencoba reconnect...");
      setTimeout(startWhatsApp, 5000);
    } else if (connection === "open") {
      console.log("Bot terhubung ke WhatsApp!");
    }
  });

  sock.ev.on("creds.update", saveCreds);
  
  async function sendGroupMessage(text) {
    try {
      await sock.sendMessage(process.env.GROUP_ID, { text });
      console.log("[SENT] =>", text);
    } catch (error) {
      console.error("Gagal kirim pesan:", error);
    }
  }

  const schedules = [
    { time: "0 7 * * *", message: "@everyone Selamat pagi! 🌞🦉" },
    { time: "0 10 * * *", message: "@everyone Sudah sarapan dan latihan Duolingo? 🍳🦉" },
    { time: "0 14 * * *", message: "@everyone Siang-siang, yuk cek streak Duolingo kamu! 🔥😏" },
    { time: "0 18 * * *", message: "@everyone Sore hari yang sempurna untuk latihan Duolingo! ☕🦉" },
    { time: "0 21 * * *", message: "@everyone Jangan tidur sebelum latihan Duolingo! 🌙✨" },
  ];

  schedules.forEach(({ time, message }) => {
    cron.schedule(time, () => sendGroupMessage(message), {
      scheduled: true,
      timezone: "Asia/Jakarta",
    });
  });

  return sock;
}

startWhatsApp().catch(console.error);

// Server Express untuk menampilkan QR Code
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>QR Code WhatsApp</title>
        <meta http-equiv="refresh" content="5"> <!-- Auto-refresh setiap 5 detik -->
      </head>
      <body>
        <h2>Scan QR Code untuk Login</h2>
        <img src="qrcode.png" alt="QR Code" width="300">
        <p>QR Code diperbarui otomatis setiap kali ada perubahan.</p>
      </body>
    </html>
  `);
});

app.listen(3000, () => console.log("Akses QR Code di http://localhost:3000"));

// Server Keep-Alive
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot WhatsApp aktif!\n");
}).listen(8080, "0.0.0.0", () => console.log("Server Keep-Alive di port 8080"));

// Keep bot alive dengan ping
setInterval(() => {
  http.get("http://0.0.0.0:8080", (res) => console.log("Ping sukses, status:", res.statusCode))
    .on("error", (err) => console.error("Ping gagal:", err.message));
}, 5 * 60 * 1000);

// Tampilkan waktu WIB tiap menit
setInterval(() => {
  console.log("Waktu WIB sekarang:", moment().tz("Asia/Jakarta").format("HH:mm:ss DD-MM-YYYY"));
}, 60 * 1000);
