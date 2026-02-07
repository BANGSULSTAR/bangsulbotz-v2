import chalk from 'chalk';
// store.js
const groupStore = new Map(); // key: groupJid, value: metadata object

export function getGroupMetadata(jid) {
  return groupStore.get(jid) || null;
}

export function setGroupMetadata(jid, metadata) {
  groupStore.set(jid, metadata);
  console.log(chalk.bgGreen.black(' GROUP METADATA UPDATED '));
  console.log(chalk.green('Grup JID   :'), chalk.white(jid));
  console.log(chalk.green('Nama Grup  :'), chalk.white(metadata.subject || 'Tidak ada nama'));
  console.log(chalk.green('Jumlah Member :'), chalk.white(metadata.participants?.length || 'N/A'));
  console.log(chalk.gray('────────────────────────────────────────────────'));
}

export function hasGroupMetadata(jid) {
  return groupStore.has(jid);
}