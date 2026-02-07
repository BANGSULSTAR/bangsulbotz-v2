// database/db_user.js
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database', 'db_user.json');

let userDB = {};

// Load sekali di awal
if (fs.existsSync(dbPath)) {
  try {
    userDB = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  } catch (err) {
    console.error('[DB] Gagal load:', err.message);
    userDB = {};
  }
}

// Simpan dengan debounce (3 detik setelah perubahan terakhir)
let saveTimeout = null;
function saveDB() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(userDB, null, 2), 'utf-8');
      console.log('[DB] db_user.json tersimpan');
    } catch (err) {
      console.error('[DB] Gagal simpan:', err.message);
    }
  }, 3000);
}

// Fungsi simpan/ambil (hanya untuk pengirim pesan asli)
export function getOrUpdateUser(jid, pushName) {
  if (!jid || !pushName || pushName === 'Unknown') return null;

  const key = jid.split(':')[0]; // key bersih

  // User belum ada → buat baru
  if (!userDB[key]) {
    userDB[key] = { pushName };
    saveDB();
    return userDB[key];
  }

  // User ada → cek apakah nama berubah
  const existing = userDB[key];
  if (pushName !== existing.pushName) {
    existing.pushName = pushName;
    saveDB();
  }

  return existing;
}

// Ambil pushName dari DB (untuk quoted atau siapa saja)
export function getPushName(jid) {
  if (!jid) return 'Unknown';
  const key = jid.split(':')[0];
  return userDB[key]?.pushName || 'Unknown';
}

export const db = { user: userDB, getOrUpdateUser, getPushName, save: saveDB };