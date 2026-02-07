// lib/groupMetadata.js
import chalk from 'chalk';
import {  updateGroupMetadata } from '../handler.js'; // sesuaikan path kalau beda
import { getGroupMetadata, setGroupMetadata, hasGroupMetadata } from '../store.js';
/**
 * @param {import('@whiskeysockets/baileys').BaileysInstance} sock
 */
export function registerGroupMetadataListeners(sock) {
  // 1. Grup metadata berubah (nama, deskripsi, pp, subject, dll)
  sock.ev.on('groups.update', async (updates) => {
    for (const update of updates) {
      const jid = update.id;
      if (!jid?.endsWith('@g.us')) continue;

      console.log(chalk.bgYellow.black(`[GROUP] Metadata update: ${jid}`));
      // console.log('Changes:', update); // debug jika perlu

      await safeUpdateMetadata(sock, jid);
    }
  });

  // 2. Anggota berubah (join, leave, promote, demote)
  sock.ev.on('group-participants.update', async (update) => {
    const jid = update.id;
    if (!jid?.endsWith('@g.us')) return;

    console.log(
      chalk.bgMagenta.black(`[GROUP] Participant update: ${jid}`),
      `→ ${update.action.toUpperCase()} (${update.participants.length} orang)`
    );

    await safeUpdateMetadata(sock, jid);
  });

  // 3. Bot baru ditambahkan ke grup (atau grup baru terdeteksi)
  sock.ev.on('groups.upsert', async (groups) => {
    for (const group of groups) {
      const jid = group.id;
      if (!jid?.endsWith('@g.us')) continue;

      console.log(chalk.bgCyan.black(`[GROUP] Bot baru masuk grup: ${jid}`));
      await safeUpdateMetadata(sock, jid);
    }
  });

  // Optional: bisa ditambah event lain di masa depan
  // sock.ev.on('group-revoke', ...)
}

/**
 * Wrapper biar aman + logging error
 * @private
 */
async function safeUpdateMetadata(sock, jid) {
  try {
    await updateGroupMetadata(sock, jid);
  } catch (err) {
    console.error(
      chalk.red(`[ERROR] Gagal update metadata ${jid}:`),
      err.message || err
    );
    // Optional: laporkan ke owner kalau error sering terjadi
  }
}

// Bonus: kalau mau satu fungsi manual trigger (misal buat command !updatemeta)
export async function forceUpdateAllGroups(sock) {
  // logic ambil semua grup → update satu per satu (rate limit friendly)
  // implementasi tergantung kebutuhan
  console.log("Force update all groups belum diimplementasi");
}