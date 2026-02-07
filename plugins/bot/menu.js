import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGINS_DIR = path.join(__dirname, '..', '..', 'plugins');

export default {
  command: 'menu',
  //alias: ['help', 'cmds', 'perintah', 'm'],
  description: 'Tampilkan daftar perintah simpel',
  onlyOwner: false,
  onlyGroup: false,
  onlyPrivate: false,

  async execute(m, sock, args) {
    const prefix = global.prefixes?.[0] || '.';
    const requestedCategory = args[0] ? args[0].toLowerCase() : null;

    try {
      const categories = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.') && !dirent.name.startsWith('_'))
        .map(dirent => dirent.name)
        .sort();

      
      let hasMatchingCategory = false;
      if (requestedCategory) {
        hasMatchingCategory = categories.some(cat => cat.toLowerCase() === requestedCategory);
        if (!hasMatchingCategory) {
          return; 
        }
      }

      let text = `✨ *MENU BANGSULBOTZ* ✨\n\n`;
      text += `Halo @${m.sender.split('@')[0]}! Ini daftar fitur yang lagi aktif nih~ 🔥\n`;
      text += `Waktu sekarang: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n\n`;

      let totalCommands = 0;
      let shownCategories = 0;

      for (const category of categories) {
        if (requestedCategory && category.toLowerCase() !== requestedCategory) continue;

        const catPath = path.join(PLUGINS_DIR, category);
        const files = fs.readdirSync(catPath).filter(f => f.endsWith('.js'));

        if (files.length === 0) continue;

        let categoryCommands = [];

        for (const file of files) {
          try {
            const filePath = `file://${path.join(catPath, file)}`;
            const mod = await import(filePath);
            const plugin = mod.default;

            if (!plugin || !plugin.command) continue;

            let line = plugin.command;
            if (plugin.help && plugin.help.trim()) {
              line += ` ${plugin.help.trim()}`;
            }

            categoryCommands.push(`> .${line}`);
            totalCommands++;
          } catch (err) {
           
          }
        }

        if (categoryCommands.length > 0) {
          text += `*${category.toUpperCase()}* ( \`${categoryCommands.length} fitur\` )\n`;
          text += categoryCommands.join('\n');
          text += '\n\n';
          shownCategories++;
        }
      }

      if (shownCategories === 0) {
        return; 
      }

      text += `Total fitur keseluruhan: \`${totalCommands}\`\n`;
      text += `Total kategori: \`${shownCategories}\`/${categories.length}\n`;
      text += `\nKetik *.menu [nama kategori]* kalau mau lihat yang spesifik aja~`;

      await sock.sendMessage(m.chat, {
        text,
        mentions: [m.sender]
      }, { quoted: m });

    } catch (err) {
      console.error('[MENU ERROR]', err.message);
      
    }
  }
};