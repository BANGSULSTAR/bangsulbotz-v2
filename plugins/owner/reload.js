import fs from 'fs/promises';
import path from 'path';

const pluginsDir = path.join(process.cwd(), 'plugins');

export default {
  command: 'reload',
  alias: ['rl', 'rld'],
  category: 'owner',
  description: 'Scan plugins per kategori. cara penggunaan :\nKetik `.reload`',
  help: '',
  onlyOwner: true,

  async execute(m, sock) {
    const status = await sock.sendMessage(m.chat, {
      text: '⏳ Sedang scan plugins...'
    }, { quoted: m });

    const summary = {};
    const failed = [];

    async function checkFile(fp, category) {
      if (!summary[category]) {
        summary[category] = { total: 0, ok: 0 };
      }

      summary[category].total++;

      try {
        await import(`${fp}?reload=${Date.now() + Math.random()}`);
        summary[category].ok++;
      } catch (e) {
        const fileName = path.basename(fp);
        failed.push({
          path: `/plugins/${path.relative(pluginsDir, fp)}`,
          error: e.message || String(e)
        });
      }
    }

    async function scan(dir = pluginsDir, category = 'root') {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of items) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subCategory = entry.name.toLowerCase().replace('grup', 'grup').replace('group', 'grup');
          await scan(full, subCategory);
        } else if (entry.isFile() && entry.name.endsWith('.js') && entry.name !== 'reload.js') {
          await checkFile(full, category);
        }
      }
    }

    await scan();

    let txt = '✅ Scan plugins selesai!\n\n';

    for (const [cat, data] of Object.entries(summary)) {
      const gagal = data.total - data.ok;
      if (gagal === 0) {
        txt += `Menu ${cat} (${data.total} plugins)✅\n`;
      }
    }

    if (failed.length > 0) {
      txt += '\n';
      txt += 'gagal:\n';
      failed.forEach(f => {
        txt += `${f.path}\n(${f.error})\n`;
      });
    }

    await sock.sendMessage(m.chat, { text: txt, edit: status.key });
  }
};