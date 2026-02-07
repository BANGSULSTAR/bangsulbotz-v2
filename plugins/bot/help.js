// plugins/owner/help.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGINS_DIR = path.join(__dirname, '..', '..', 'plugins');

export default {
  command: 'help',
  alias: ['bantuan', 'keterangan'],
  category: 'owner',
  description: 'Menampilkan informasi lengkap tentang sebuah command/perintah bot.\n\n' +
               'Cara pakai:\n' +
               '• help <nama command>  → contoh: help ping\n' +
               '• bantuan <nama command>\n' +
               '• keterangan <nama command>\n\n' +
               'Menampilkan:\n' +
               '• Nama command utama\n' +
               '• Semua alias (jika ada)\n' +
               '• Deskripsi lengkap command\n' +
               '• Kategori/menu command tersebut\n' +
               '• Status akses (owner/group/private)',
  onlyOwner: false,

  async execute(m, sock, args) {
    if (!args.length) {
      return sock.sendMessage(m.chat, {
        text: 'Gunakan: help <nama command>\nContoh: help ping\n\nUntuk daftar semua command, ketik .menu'
      }, { quoted: m });
    }

    const query = args[0].toLowerCase().trim();

    try {
      const categories = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.') && !dirent.name.startsWith('_'))
        .map(dirent => dirent.name);

      let foundPlugin = null;
      let foundCategory = null;

      for (const category of categories) {
        const catPath = path.join(PLUGINS_DIR, category);
        const files = fs.readdirSync(catPath).filter(f => f.endsWith('.js'));

        for (const file of files) {
          const filePath = `file://${path.join(catPath, file)}`;
          const mod = await import(filePath);
          const plugin = mod.default;

          if (!plugin || !plugin.command) continue;

          if (plugin.command.toLowerCase() === query ||
              (plugin.alias && plugin.alias.some(a => a.toLowerCase() === query))) {
            foundPlugin = plugin;
            foundCategory = category;
            break;
          }
        }
        if (foundPlugin) break;
      }

      if (!foundPlugin) {
        return sock.sendMessage(m.chat, {
          text: 'Gunakan: help <nama command>\nContoh: help ping\n\nUntuk daftar semua command, ketik .menu'
        }, { quoted: m });
      }

      const cmdName = foundPlugin.command;
      const aliases = foundPlugin.alias?.length ? foundPlugin.alias.join(', ') : 'tidak ada';
      const desc = foundPlugin.description || 'Tidak ada deskripsi.';
      const cat = foundCategory || 'umum';
      let access = [];
      if (foundPlugin.onlyOwner) access.push('khusus owner');
      if (foundPlugin.onlyGroup) access.push('hanya di grup');
      if (foundPlugin.onlyPrivate) access.push('hanya di private chat');
      const accessText = access.length ? access.join(' & ') : 'bisa semua orang';

      const text = `\`\`\`📋 BANTUAN COMMAND: ${cmdName}\n
Nama command   : ${cmdName}
Alias          : ${aliases}
Kategori       : ${cat}
Akses          : ${accessText}\`\`\`\n
\`Deskripsi:\`\n${desc}`;

      await sock.sendMessage(m.chat, { text }, { quoted: m });

    } catch (err) {
      console.error('[HELP ERROR]', err.message);
      await sock.sendMessage(m.chat, {
        text: 'Terjadi error saat mencari command: ' + err.message
      }, { quoted: m });
    }
  }
};