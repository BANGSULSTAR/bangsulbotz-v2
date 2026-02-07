import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
const rootDir = process.cwd();
const sampahDir = path.join(rootDir, 'sampah');

export default {
  command: 'backup',
  alias: ['getsc', 'getscript'],
  description: 'Backup semua script penting dan kirim ke nomor owner (ZIP).\ncara penggunaan:\nKetik perintah: \`.backup\`',
  onlyOwner: true,
  onlyGroup: false,
  onlyPrivate: false,
  async execute(m, sock, args) {
    if (!global.owner || typeof global.owner !== 'string') {
      return sock.sendMessage(m.chat, { text: '❌ Global.owner tidak ditemukan atau invalid!' }, { quoted: m });
    }

    const ownerJid = global.owner.includes('@s.whatsapp.net')
      ? global.owner
      : `${global.owner}@s.whatsapp.net`;

    const itemsToBackup = [
      'plugins',
      'session',
      'handler.js',
      'index.js',
      'settings.js',
      'package.json',
      'store.js'
    ];

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const zipName = `bangsul_newbase_${dateStr}.zip`;
    const zipPath = path.join(rootDir, zipName);

    let statusMessage;

    try {
      statusMessage = await sock.sendMessage(m.chat, {
        text: '⏳ Sedang membuat backup script...\nMohon tunggu beberapa saat.'
      }, { quoted: m });

      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('error', async (err) => {
        console.error('Archiver error:', err);
        await sock.sendMessage(m.chat, {
          text: `❌ Gagal membuat file ZIP: ${err.message}`,
          edit: statusMessage.key
        });
      });

      output.on('close', async () => {
        try {
          if (!fs.existsSync(sampahDir)) {
            fs.mkdirSync(sampahDir, { recursive: true });
          }

          const sampahZipPath = path.join(sampahDir, zipName);
          fs.renameSync(zipPath, sampahZipPath);

          await sock.sendMessage(ownerJid, {
            document: { url: sampahZipPath },
            mimetype: 'application/zip',
            fileName: zipName,
            caption: `Backup script bot berhasil dibuat.\nNama: ${zipName}`
          });
          await sock.sendMessage(m.chat, {
            text: `✅ Backup script selesai!\nSudah dikirim ke chat pribadi owner.`,
            edit: statusMessage.key
          });

          const files = fs.readdirSync(sampahDir);
          for (const file of files) {
            const filePath = path.join(sampahDir, file);
            fs.unlinkSync(filePath);
          }

        } catch (moveErr) {
          console.error('Error move/hapus sampah:', moveErr);

          await sock.sendMessage(m.chat, {
            text: `⚠️ Backup selesai tapi gagal kirim/pindah file: ${moveErr.message}\nFile ZIP ada di root: ${zipName}`,
            edit: statusMessage.key
          });
        }
      });

      archive.pipe(output);

      for (const item of itemsToBackup) {
        const itemPath = path.join(rootDir, item);
        if (fs.existsSync(itemPath)) {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            archive.directory(itemPath, item);
          } else if (stat.isFile()) {
            archive.file(itemPath, { name: item });
          }
        } else {
          console.warn(`Item tidak ditemukan: ${item}`);
        }
      }

      await archive.finalize();

    } catch (err) {
      console.error('Backup fatal error:', err);
      const errorText = `❌ Terjadi kesalahan saat proses backup:\n${err.message || err}`;

      if (statusMessage) {
        await sock.sendMessage(m.chat, {
          text: errorText,
          edit: statusMessage.key
        });
      } else {
        await sock.sendMessage(m.chat, { text: errorText }, { quoted: m });
      }
    }
  }
};