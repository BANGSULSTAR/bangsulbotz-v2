import axios from 'axios';

export default {
  command: 'ai',
  alias: ['gpt'],
  description: 'Chat dengan AI (GPT)',
  help: '`<pertanyaan>`',
  onlyOwner: false,
  onlyGroup: false,
  onlyPrivate: false,

  async execute(m, sock, args) {

    const text = args.join(' ');

    if (!text) {
      return sock.sendMessage(m.chat, {
        text: `Hai, ada yang bisa dibantu?\n\nContoh:\n\`${m.command} Jelaskan cara membuat bot WhatsApp\``
      }, { quoted: m });
    }

    // typing
    await sock.sendPresenceUpdate('composing', m.chat);

    try {

      const response = await axios.post("https://chateverywhere.app/api/chat/", {
        model: {
          id: "gpt-4",
          name: "GPT-4",
          maxLength: 32000,
          tokenLimit: 8000,
        },
        messages: [
          { role: "user", content: text }
        ],
        prompt: "jawab lah dengan bahasa yang natural dan humor manusia, jangan terlalu kaku dan jawab lah to the point, ga begitu basa basi, okeey. sertakan reaksi seperti manusia, bisa sedih bisa senang dan reaksi lain nya. boleh kok tambah beberapa emoji tapi ga spam. hanya seperlu nya aja, supaya menampilkan reaksi seperti nyata. pakai gaya bahasa seperti logat bahasa indonesia yaaa",
        temperature: 0.5
      }, {
        headers: {
          "Accept": "*/*",
          "User-Agent": "Mozilla/5.0"
        },
        timeout: 60000
      });

      let result = response.data || '';
      if (typeof result === 'object') result = JSON.stringify(result);

      const cleanText = result
        .replace(/\*\*(.*?)\*\*/g, '*$1*')
        .trim();

      await sock.sendMessage(m.chat, {
        text: cleanText || 'Tidak ada jawaban dari AI.'
      }, { quoted: m });

    } catch (err) {

      const msg = err.response?.data?.error || err.message || 'Terjadi kesalahan';

      await sock.sendMessage(m.chat, {
        text: `Gagal terhubung ke AI:\n\`${msg}\``
      }, { quoted: m });

    } finally {
      await sock.sendPresenceUpdate('available', m.chat);
    }

  }
};
