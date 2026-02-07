// plugins/owner/noprefix.js
import fs from 'fs';
import path from 'path';

const settingsPath = path.join(process.cwd(), 'settings.js');

export default {
  command: 'noprefix',
  alias: ['nopref'],
  category: 'owner',
  description: `\`Deskripsi:\`
Mengatur mode noprefix (tanpa prefix) untuk seluruh bot secara global.

\`Ketik:\` 
> noprefix saja → menampilkan status saat ini (aktif/nonaktif) beserta prefix yang berlaku sekarang.

\`Ketik\`
> .noprefix on / aktif / true → mengaktifkan mode noprefix (semua command bisa langsung diketik tanpa prefix).
\`Ketik\` 
> .noprefix off / matikan / nonaktif / false → menonaktifkan mode noprefix (harus pakai prefix seperti . ! #).

*Catatan📢*
Perubahan langsung berlaku \`tanpa perlu restart\` atau \`relog bot\`.
Nilai disimpan \`permanen\` ke file \`settings.js\` secara otomatis.
Hanya \`owner bot\` yang dapat menggunakan fitur ini.

*Contoh penggunaan:*
- .noprefix
- .noprefix \`on/off\`
- .noprefix \`aktif/matikan\``,
  help: '`<true/false>`',
  onlyOwner: true,

  async execute(m, sock, args) {
    const arg = args[0]?.toLowerCase();

    if (!arg) {
      const status = global.noprefix ? '✅ AKTIF' : '❌ NONAKTIF';
      const prefixInfo = global.noprefix ? 'tanpa prefix' : global.prefixes.join(', ');
      return sock.sendMessage(m.chat, {
        text: `Mode noprefix: ${status}\nPrefix sekarang: ${prefixInfo}\n\nKetik .noprefix on/off untuk ubah`
      }, { quoted: m });
    }

    let newValue;
    if (['on', 'aktif', 'true', '1'].includes(arg)) newValue = true;
    else if (['off', 'matikan', 'nonaktif', 'false', '0'].includes(arg)) newValue = false;
    else return sock.sendMessage(m.chat, { text: 'Gunakan: on / off / aktif / matikan' }, { quoted: m });

    global.noprefix = newValue;

    const statusText = newValue ? '✅ AKTIF' : '❌ NONAKTIF';
    await sock.sendMessage(m.chat, {
      text: `Mode noprefix diubah: ${statusText}\nPrefix sekarang: ${newValue ? 'tanpa prefix' : global.prefixes.join(', ')}`
    }, { quoted: m });

    try {
      let content = fs.readFileSync(settingsPath, 'utf-8');
      content = content.replace(/global\.noprefix\s*=\s*(true|false)/, `global.noprefix = ${newValue}`);
      if (!content.includes('global.noprefix')) {
        content = content.replace(
          /console\.log\("Global settings telah dimuat\."\);/,
          `global.noprefix = ${newValue};\nconsole.log("Global settings telah dimuat.");`
        );
      }
      fs.writeFileSync(settingsPath, content, 'utf-8');
    } catch {}
  }
};