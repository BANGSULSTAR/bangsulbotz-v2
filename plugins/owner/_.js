// plugins/owner/eval.js
import util from 'util';

export default {
  command: '>',
  alias: ['eval', 'ev', '=>'],
  description: `Execute JavaScript code (owner only).\nKetik > kode\nContoh:\n\`> m.sender\`\n\n\`> await sock.sendMessage(m.chat, {text:"test"})\`\n\n\`> const a=5; a*2\``,
  help: '`<code>`',
  onlyOwner: true,
  async execute(m, sock, args) {
    if (!args.length) {
      return await sock.sendMessage(m.chat, { text: 'Masukkan kode setelah >' }, { quoted: m });
    }

    let code = args.join(' ').trim();

    // Proteksi quoted
    if ((code.includes('quoted') || code.includes('m.quoted')) && !m.quoted) {
      return await sock.sendMessage(m.chat, { text: 'Reply pesan dulu kalau mau pakai m.quoted!' }, { quoted: m });
    }

    // Tangkap console.log
    const consoleOutput = [];
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      const str = args.map(arg =>
        typeof arg === 'object' && arg !== null
          ? util.inspect(arg, { depth: 2, colors: false })
          : String(arg)
      ).join(' ');
      consoleOutput.push(str);
      originalConsoleLog(...args); // tetap log ke terminal
    };

    try {
      let evaled;

      // Bungkus kode supaya lebih pintar handle berbagai kasus
      if (code.includes('return') && !code.includes('=>')) {
        // Kasus return langsung → bungkus async
        code = `(async () => { ${code} })()`;
      } else if (code.trim().startsWith('async') || code.includes('await')) {
        // Sudah async → eksekusi langsung
        code = `(${code})()`;
      } else {
        // Kasus biasa: tambah return di akhir + support const/let
        const lines = code.split('\n');
        const lastLine = lines[lines.length - 1].trim();

        // Kalau baris terakhir bukan expression → paksa return
        if (!lastLine.startsWith('return') && !lastLine.endsWith(';')) {
          lines[lines.length - 1] = `return (${lastLine});`;
        }

        code = `(async () => {
          try {
            ${lines.join('\n')}
          } catch (e) {
            throw e;
          }
        })()`;
      }

      // Eksekusi
      evaled = await eval(code);

      // Restore console
      console.log = originalConsoleLog;

      let output = '';
      if (consoleOutput.length > 0) {
        output += `📜 Console:\n${consoleOutput.join('\n')}\n\n`;
      }

      if (evaled === undefined) {
        output += 'undefined (kode berhasil, tapi tidak ada nilai return)';
      } else if (evaled === null) {
        output += 'null';
      } else if (typeof evaled === 'object') {
        output += util.inspect(evaled, { depth: 4, colors: false });
      } else {
        output += String(evaled);
      }

      await sock.sendMessage(m.chat, {
        text: '```' + output + '```'
      }, { quoted: m });

    } catch (err) {
      console.log = originalConsoleLog;

      let errMsg = err.stack || err.message || String(err);

      if (errMsg.length > 3800) {
        errMsg = errMsg.slice(0, 3700) + '\n... (truncated)';
      }

      await sock.sendMessage(m.chat, {
        text: `Error:\n\`\`\`js\n${errMsg}\n\`\`\``
      }, { quoted: m });
    }
  }
};