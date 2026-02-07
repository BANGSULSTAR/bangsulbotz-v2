import os from 'os';
import process from 'process';

export default {
  command: 'runtime',
  alias: ['rt', 'uptime', 'status'],
  description: 'Menampilkan informasi runtime dan server bot',
  //help: `Ketik \`runtime\``,
  onlyOwner: false,
  onlyGroup: false,
  onlyPrivate: false,
  async execute(m, sock, args) {
    const uptimeSec = Math.floor(process.uptime());
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    const uptimeStr = [
      days > 0 ? `${days} hari` : '',
      hours > 0 ? `${hours} jam` : '',
      minutes > 0 ? `${minutes} menit` : '',
      `${seconds} detik`
    ].filter(Boolean).join(', ') || 'kurang dari 1 detik';

    const memUsage = process.memoryUsage();
    const formatMB = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

    const rss = formatMB(memUsage.rss);
    const heapTotal = formatMB(memUsage.heapTotal);
    const heapUsed = formatMB(memUsage.heapUsed);
    const external = formatMB(memUsage.external);
    const arrayBuffers = formatMB(memUsage.arrayBuffers);

    const systemTotalMem = formatMB(os.totalmem());
    const systemUsedMem = formatMB(os.totalmem() - os.freemem());
    const systemFreeMem = formatMB(os.freemem());

    const cpuCores = os.cpus().length;
    const loadAvg = os.loadavg().map(l => l.toFixed(2)).join(', ');
    const cpuUsagePercent = ((os.loadavg()[0] / cpuCores) * 100).toFixed(1) + '%';

    const nodeVersion = process.version;
    const platform = `${os.platform()} (${os.arch()})`;
    const pid = process.pid;

    const text = `
\`\`\`〔 𝙎𝙩𝙖𝙩𝙪𝙨 𝘽𝙤𝙩 〕
Uptime Bot : ${uptimeStr}
> Node.js  : ${nodeVersion}
> Platform : ${platform}
> PID      : ${pid}

𝙈𝙚𝙢𝙤𝙧𝙮 𝙐𝙨𝙖𝙜𝙚 (𝙉𝙤𝙙𝙚.𝙟𝙨)
> RSS (total)   : ${rss}
> Heap Total    : ${heapTotal}
> Heap Used     : ${heapUsed}
> External      : ${external}
> ArrayBuffers  : ${arrayBuffers}

𝙎𝙮𝙨𝙩𝙚𝙢 𝙈𝙚𝙢𝙤𝙧𝙮
> Total  : ${systemTotalMem}
> Used   : ${systemUsedMem}
> Free   : ${systemFreeMem}

𝘾𝙋𝙐 𝙄𝙣𝙛𝙤
> Cores        : ${cpuCores}
> Load Average : ${loadAvg}
> Usage (est.) : ${cpuUsagePercent}
\`\`\``;


    await sock.sendMessage(m.chat, { text }, { quoted: m });
  }
};