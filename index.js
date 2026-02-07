import { makeWASocket, useMultiFileAuthState, DisconnectReason } from 'baileys';
import pino from 'pino';
import chalk from 'chalk';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { registerGroupMetadataListeners } from './lib/groupMetadata.js';
// Load settings
import './settings.js';
import { serialize , updateGroupMetadata} from './handler.js';
import { getGroupMetadata, setGroupMetadata, hasGroupMetadata } from './store.js';
const logger = pino({ level: 'silent' });

// Load plugins
const pluginsDir = path.join(process.cwd(), 'plugins');
const plugins = new Map();

function loadPlugins(dir = pluginsDir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadPlugins(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      import(fullPath).then(mod => {
        const plugin = mod.default;
        if (plugin && plugin.command) {
          plugins.set(plugin.command.toLowerCase(), plugin);
          if (plugin.alias) {
            plugin.alias.forEach(alias => plugins.set(alias.toLowerCase(), plugin));
          }
          console.log(chalk.green(`[PLUGIN LOADED] ${plugin.command}`));
        }
      }).catch(err => {
        console.log(chalk.red(`[PLUGIN ERROR] ${entry.name}:`), err.message);
      });
    }
  });
}

loadPlugins();

// Fungsi kirim error ke owner
async function sendErrorToOwner(sock, error, commandName = 'tidak diketahui', senderJid = 'unknown', senderName = 'Unknown') {
  const ownerJid = global.owner + '@s.whatsapp.net';
  const errorText = `
haii @${global.owner} ada fitur yang error nih, tolong perbaiki yaa:

Dari : ${senderJid.split('@')[0]} (${senderName})
Fitur : ${commandName}
Error :
${error.stack || error.message || error}
  `.trim();

  try {
    await sock.sendMessage(ownerJid, { 
      text: errorText,
      mentions: [ownerJid]
    });
    console.log(chalk.bgRed.black(' ERROR REPORTED TO OWNER '));
  } catch (sendErr) {
    console.log(chalk.red('Gagal kirim error ke owner:'), sendErr.message);
  }
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const parts = [];
  if (days > 0) parts.push(`${days} hari`);
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} menit`);
  return parts.join(' ');
}

function getServerInfo() {
  const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2);
  const freeMem = (os.freemem() / 1024 / 1024).toFixed(2);
  const usedMem = (totalMem - freeMem).toFixed(2);
  const rss = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
  const heapUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model?.trim() || 'Unknown CPU';
  const cpuCores = cpus.length;
  let diskInfo = null;
  try {
    const stats = fs.statvfsSync(os.homedir());
    const totalGB = (stats.blocks * stats.bsize / 1024 / 1024 / 1024).toFixed(2);
    const freeGB = (stats.bfree * stats.bsize / 1024 / 1024 / 1024).toFixed(2);
    const usedGB = (totalGB - freeGB).toFixed(2);
    diskInfo = { total: `${totalGB} GB`, used: `${usedGB} GB`, free: `${freeGB} GB` };
  } catch {}
  return {
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development',
    platformArch: `${os.platform()} (${os.arch()})`,
    hostname: os.hostname(),
    cpu: `${cpuModel} (${cpuCores} cores)`,
    ram: { total: `${totalMem} MB`, used: `${usedMem} MB`, free: `${freeMem} MB` },
    process: { rss: `${rss} MB`, heap: `${heapUsed} MB`, pid: process.pid },
    disk: diskInfo,
    uptime: formatUptime(os.uptime()),
    cwd: process.cwd(),
  };
}

function printServerInfo() {
  const info = getServerInfo();
  console.log(chalk.bgBlue.white.bold(' SERVER / HOSTING INFO (Pre-Connect) '));
  console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
  console.log(chalk.cyan('⚡ Node.js Version   :'), chalk.white(info.nodeVersion));
  console.log(chalk.cyan('⚡ Environment       :'), info.env.toUpperCase() === 'PRODUCTION' ? chalk.green.bold('PRODUCTION') : chalk.yellow.bold(info.env.toUpperCase()));
  console.log(chalk.cyan('💻 Platform / Arch   :'), chalk.white(info.platformArch));
  console.log(chalk.cyan('💻 Hostname          :'), chalk.white(info.hostname));
  console.log(chalk.cyan('💻 CPU               :'), chalk.white(info.cpu));
  console.log(chalk.cyan('🧠 RAM (Server)'));
  console.log(chalk.gray('     Total          :'), chalk.white(info.ram.total));
  console.log(chalk.gray('     Used           :'), chalk.white(info.ram.used));
  console.log(chalk.gray('     Free           :'), chalk.white(info.ram.free));
  console.log(chalk.cyan('🧠 Process Memory'));
  console.log(chalk.gray('     RSS            :'), chalk.white(info.process.rss));
  console.log(chalk.gray('     Heap Used      :'), chalk.white(info.process.heap));
  console.log(chalk.gray('     PID            :'), chalk.white(info.process.pid));
  if (info.disk) {
    console.log(chalk.cyan('💾 Disk (Home Dir)'));
    console.log(chalk.gray('     Total          :'), chalk.white(info.disk.total));
    console.log(chalk.gray('     Used           :'), chalk.white(info.disk.used));
    console.log(chalk.gray('     Free           :'), chalk.white(info.disk.free));
  }
  console.log(chalk.cyan('⏱️ Uptime Server     :'), chalk.white(info.uptime));
  console.log(chalk.cyan('📂 Current Directory :'), chalk.white(info.cwd));
  console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  printServerInfo();

  const sock = makeWASocket({
    logger,
    printQRInTerminal: true, 
    auth: state,
    syncFullHistory: false,
    shouldSyncHistoryMessage: false,
    shouldSyncMutation: false,
    markOnlineOnConnect: true,
	fireInitQueries: false, 
    browser: ['Chrome', 'Ubuntu', '126.0'],
    //defaultQueryTimeoutMs: 60000,            // naikin timeout query biar ga gampang disconnect
      //connectTimeoutMs: 60000,                 // timeout koneksi awal lebih panjang
      
      //transactionOpts: { maxRetries: 5 },      // retry lebih banyak kalau gagal kirim
      generateHighQualityLinkPreview: false,   // matikan preview link biar lebih ringan
    
    pairingCode: global.pairing || false, 
    cachedGroupMetadata: async (jid) => {
      if (jid?.endsWith('@g.us')) {
        return getGroupMetadata(jid);
      }
      return undefined;
    },
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;

   
    if (qr) {
      console.log(chalk.yellow.bold('QR CODE DIBUTUHKAN'));
      console.log(chalk.cyan('Scan di WA HP > Linked Devices > Scan QR'));
      console.log(qr);
    }

    if (global.pairing && update.pairingCode) {
      console.log(chalk.green.bold('MODE PAIRING CODE AKTIF'));
      console.log(chalk.cyan('Kode Pairing (masukkan di WA HP > Linked Devices > Link with Phone Number):'));
      console.log(chalk.bgGreen.black(`   ${update.pairingCode}   `));
      console.log(chalk.yellow('Kode ini berlaku 3 menit. Jangan bagikan ke orang lain!'));
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(chalk.red('Koneksi putus!'), chalk.gray(`Code: ${statusCode || 'unknown'}`));

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== DisconnectReason.loggedOut && statusCode !== 401;
      if (shouldReconnect) {
        console.log(chalk.yellow('Reconnect dalam 5 detik...'));
        setTimeout(() => connectToWhatsApp(), 5000);
      } else {
        console.log(chalk.red.bold('Logged out permanen! Hapus folder ./session dan coba lagi.'));
      }
    }

    if (connection === 'open') {
      const user = sock.user || {};
      const jid = user.id || 'belum tersedia';
      const number = jid.split('@')[0] || global.botNumber;
      const name = user.name || user.verifiedName || user.pushName || global.botName || 'belum tersedia';
      const lid = user.lid || user.lidJid || 'tidak ada LID';
      const device = user.device || 'tidak terdeteksi';
      const timeNow = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

      console.log(chalk.green.bold('\n╔════════════════════════════════════════════════════╗'));
      console.log(chalk.green.bold('║              BANGSULBOTZ CONNECTED SUCCESS         ║'));
      console.log(chalk.green.bold('╚════════════════════════════════════════════════════╝'));

      console.log(chalk.cyan('Waktu Connect       :'), chalk.white(`${timeNow} WIB`));
      console.log(chalk.cyan('JID Lengkap         :'), chalk.white(jid));
      console.log(chalk.cyan('Nomor Bot           :'), chalk.white(number));
      console.log(chalk.cyan('Nama Bot (WA)       :'), chalk.white(name));
      console.log(chalk.cyan('LID (Linked ID)     :'), chalk.white(lid));
      console.log(chalk.cyan('Device Info         :'), chalk.white(device));
      console.log(chalk.cyan('Owner               :'), chalk.white(`${global.ownerName} (${global.owner})`));
      console.log(chalk.cyan('Mode Login Terakhir :'), chalk.white(global.pairing ? 'Pairing Code' : 'QR Scan'));
      console.log(chalk.cyan('Sync History        :'), chalk.white('Disabled (hanya pesan baru)'));

      console.log(chalk.green.bold('\nBot online & siap! Kirim pesan tes ke nomor bot.'));
      console.log(chalk.green.bold('══════════════════════════════════════════════════════'));
    }
  });

  registerGroupMetadataListeners(sock);
  sock.ev.on('messages.upsert', async (m) => {
    const msg = await serialize(m, sock);
    if (!msg) return;
	if (msg.fromMe || msg.key.fromMe) return;
    //logPesanMasuk(msg);
    
	
    const text = msg.body || msg.text || '';
    let usedPrefix = '';
    let commandText = '';

    const matchedPrefix = global.prefixes.find(p => text.startsWith(p));
    if (matchedPrefix) {
      usedPrefix = matchedPrefix;
      commandText = text.slice(usedPrefix.length).trim().split(/ +/).shift().toLowerCase();
    } else if (global.noprefix) {
      commandText = text.trim().split(/ +/).shift().toLowerCase();
      usedPrefix = '';
    }

    if (!commandText) return;

    const plugin = plugins.get(commandText);
    if (!plugin) return;

    
    const chatJid = typeof msg.chat === 'string' && msg.chat 
      ? msg.chat 
      : (msg.key?.remoteJid || '');

    if (!chatJid) {
      console.log(chalk.yellow('Chat JID invalid, skip pesan'));
      return;
    }

    if (plugin.onlyOwner && !msg.isOwner) {
      return await sock.sendMessage(chatJid, { text: global.pesan.ownerOnly }, { quoted: msg });
    }
    if (plugin.onlyGroup && !msg.isGroup) {
      return await sock.sendMessage(chatJid, { text: global.pesan.groupOnly }, { quoted: msg });
    }
    if (plugin.onlyPrivate && msg.isGroup) {
      return await sock.sendMessage(chatJid, { text: global.pesan.privateOnly }, { quoted: msg });
    }

    try {
      const args = text.slice(usedPrefix.length + commandText.length).trim().split(/ +/);
      await plugin.execute(msg, sock, args);
    } catch (err) {
      console.error(chalk.red.bold(`Error execute ${commandText}:`), err.stack || err);

      await sendErrorToOwner(sock, err, commandText, msg.sender, msg.pushName);

      await sock.sendMessage(chatJid, { 
        text: global.pesan.error + '\nError: ' + err.message 
      }, { quoted: msg });
    }
  });

  return sock;
}

connectToWhatsApp().catch(err => {
  console.error(chalk.red('Error saat connect:'), err);
});