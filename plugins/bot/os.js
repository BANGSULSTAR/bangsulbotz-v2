export default {
  command: 'os',
  alias: ['sistem', 'serverinfo', 'hostinfo', 'stats'],  
  description: 'Cek detail sistem operasi, hardware, & resource server/bot',


  async execute(m, sock) {
    try {
      const os = await import('os');
      const process = await import('process');
      const fs = await import('fs');

      const platform = os.platform();
      const arch = os.arch();
      const release = os.release();
      const type = os.type();
      const hostname = os.hostname();
      const nodeVersion = process.version;
      const nodePath = process.execPath;
      const cwd = process.cwd();

      const cpus = os.cpus();
      const cpuModel = cpus[0]?.model?.trim() || 'Unknown';
      const cpuCores = cpus.length;
      const cpuSpeed = cpus[0]?.speed ? `${cpus[0].speed} MHz` : 'N/A';
      const loadAvg = os.loadavg().map(v => v.toFixed(2)).join(', ');

      const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB';
      const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB';
      const usedMem = (os.totalmem() - os.freemem()) / 1024 / 1024 / 1024;
      const usedMemStr = usedMem.toFixed(2) + ' GB';
      const memUsage = ((usedMem / (os.totalmem() / 1024 / 1024 / 1024)) * 100).toFixed(1) + '%';

      const processMem = process.memoryUsage();
      const rss = (processMem.rss / 1024 / 1024).toFixed(2) + ' MB';
      const heapUsed = (processMem.heapUsed / 1024 / 1024).toFixed(2) + ' MB';
      const heapTotal = (processMem.heapTotal / 1024 / 1024).toFixed(2) + ' MB';

      let diskInfo = 'Tidak tersedia';
      try {
        const stat = fs.statvfsSync('/');
        const total = (stat.blocks * stat.bsize / 1024 / 1024 / 1024).toFixed(2) + ' GB';
        const free = (stat.bfree * stat.bsize / 1024 / 1024 / 1024).toFixed(2) + ' GB';
        const used = (total - free).toFixed(2) + ' GB';
        const usagePercent = (((stat.blocks - stat.bfree) / stat.blocks) * 100).toFixed(1) + '%';
        diskInfo = `Total: ${total} | Used: ${used} (${usagePercent}) | Free: ${free}`;
      } catch {}

      const sysUptimeSec = os.uptime();
      const botUptimeSec = process.uptime();

      const formatUptime = (sec) => {
        const d = Math.floor(sec / 86400);
        sec %= 86400;
        const h = Math.floor(sec / 3600);
        sec %= 3600;
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${d > 0 ? d + ' hari ' : ''}${h} jam ${m} menit ${s} detik`;
      };

      let ipInfo = 'Tidak tersedia';
      try {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
          for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
              ipInfo = iface.address;
              break;
            }
          }
          if (ipInfo !== 'Tidak tersedia') break;
        }
      } catch {}

      const text = `
*🖥️ Sistem Info Server/Bot*  
━━━━━━━━━━━━━━━━━━━
*OS / Platform*  
├ Platform: ${platform} (${arch})
├ Release: ${release}
├ Type: ${type}
├ Hostname: ${hostname}
├ Node.js: ${nodeVersion}
├ CWD: ${cwd}
└ Exec Path: ${nodePath}

*CPU*  
├ Model: ${cpuModel}
├ Cores: ${cpuCores}
├ Speed: ${cpuSpeed}
└ Load Avg (1/5/15 min): ${loadAvg}

*Memory (RAM)*  
├ Total: ${totalMem}
├ Used: ${usedMemStr} (${memUsage})
├ Free: ${freeMem}
├ Bot RSS: ${rss}
└ Bot Heap Used: ${heapUsed} / ${heapTotal}

*Disk (/)*  
└ ${diskInfo}

*Uptime*  
├ Server: ${formatUptime(sysUptimeSec)}
└ Bot Online: ${formatUptime(botUptimeSec)}

*Network*  
└ Local IP: ${ipInfo}

*Waktu Saat Ini*  
└ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
━━━━━━━━━━━━━━━━━━━
Dibuat oleh BangsulBotz 🚀`;

      await sock.sendMessage(m.chat, { text }, { quoted: m });

    } catch (err) {
      console.error('Error di command .os:', err);
      await sock.sendMessage(m.chat, {
        text: `Error saat ambil info sistem: ${err.message || 'Unknown error'}`
      }, { quoted: m });
    }
  }
};