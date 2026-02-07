import os from 'os';
import speed from 'performance-now';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default {
  command: 'cekram',
  alias: ['ram'],
  category: 'owner',
  description: 'Menampilkan statistik penggunaan RAM server dan memori bot (Node.js).\n\n' +
               'Fungsi: Memantau performa sistem dan mendeteksi beban berlebih.\n' +
               'Manfaat: Melihat seberapa banyak RAM yang dipakai server dan bot.\n' +
               'Cara pakai: .cekram atau .ram\n' +
               'Menampilkan:\n' +
               '• Total RAM sistem\n' +
               '• RAM yang digunakan & persentase\n' +
               '• RAM tersedia\n' +
               '• Detail memori proses Node.js\n' +
               '• Latensi respons\n' +
               '• Grafik visual penggunaan RAM',
  onlyOwner: false,

  async execute(m, sock) {
    try {
      const used = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const usedPercent = (usedMem / totalMem * 100).toFixed(2);
      const latensi = (speed() - speed()).toFixed(4);

      const responseMessage = `
💾 *Statistik Penggunaan RAM*

📊 *RAM Sistem*
- Total: ${formatBytes(totalMem)}
- Digunakan: ${formatBytes(usedMem)} (${usedPercent}%)
- Tersedia: ${formatBytes(freeMem)}

🧠 *Memori Node.js*
${Object.keys(used).map(key => `- ${key.padEnd(8)}: ${formatBytes(used[key])}`).join('\n')}

⏱️ Latensi: ${latensi} detik
      `.trim();

      const chartConfig = {
        type: 'outlabeledPie',
        data: {
          labels: [`Digunakan (${formatBytes(usedMem)})`, `Tersedia (${formatBytes(freeMem)})`],
          datasets: [{
            backgroundColor: ['#FF3784', '#36A2EB'],
            data: [usedMem, freeMem]
          }]
        },
        options: {
          plugins: {
            legend: false,
            outlabels: {
              text: '%l %p',
              color: 'white',
              stretch: 35,
              font: { resizable: true, minSize: 12, maxSize: 18 }
            }
          },
          title: { display: true, text: '\n\n\n\n\n\n\n\n\n\n\n\nPenggunaan RAM' }
        }
      };

      const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
      const chartUrl = `https://quickchart.io/chart?c=${encodedConfig}&w=700&h=500`;

      await sock.sendMessage(m.chat, {
        text: responseMessage,
        contextInfo: {
          externalAdReply: {
            title: '💾 Cek RAM',
            body: 'Statistik Penggunaan Memori Server',
            thumbnailUrl: chartUrl,
            sourceUrl: chartUrl,
            mediaType: 1,
            previewType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: m });
    } catch (err) {
      await sock.sendMessage(m.chat, {
        text: 'Terjadi kesalahan saat cek RAM: ' + err.message
      }, { quoted: m });
    }
  }
};