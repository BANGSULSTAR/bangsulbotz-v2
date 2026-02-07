export default {
  command: 'restart',
  alias: ['restartbot', 'botrs','botres','resbot'],
  description: 'Restart bot (apply semua perubahan plugin)',
  onlyOwner: true,

  async execute(m, sock) {
    await sock.sendMessage(m.chat, { text: '🔄 Bot restart!' }, { quoted: m });
    setTimeout(() => process.exit(0), 1000);
  }
};