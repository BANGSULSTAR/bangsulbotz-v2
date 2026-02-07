import chalk from 'chalk';
import { getGroupMetadata, setGroupMetadata, hasGroupMetadata } from './store.js';
import { getOrUpdateUser,getPushName } from './database/db_user.js';

export async function updateGroupMetadata(sock, groupJid) {
  if (!groupJid.endsWith('@g.us')) return null;
  try {
    const metadata = await sock.groupMetadata(groupJid);
    setGroupMetadata(groupJid, metadata);
    return metadata;
  } catch (err) {
    console.log(chalk.red('Gagal update metadata grup:'), chalk.gray(err.message));
    return null;
  }
}
function normalizeJid(jid) {
  if (!jid) return jid;
  const [number] = jid.split(':');
  return number.includes('@') ? number : `${number}@s.whatsapp.net`;
}
function getDevice(id) {
  if (!id) return 'unknown';
  const clean = id.split('-')[0];
  if (/^[A-Z0-9]{18}$/.test(clean)) return 'ios';
  if (/^[A-Z0-9]{20}$/.test(clean)) return 'web';
  if (/^[A-Z0-9]{21,32}$/.test(clean)) return 'android';
  return 'unknown';
}
export async function serialize(m, sock) {
  if (!m.messages) return null;
  const msg = m.messages[0];
  if (!msg || !msg.message || msg.key.fromMe) return null; // skip pesan sendiri / invalid
  const botNumber = sock.user?.id ? normalizeJid(sock.user.id) : null;
  const extended = { ...msg };
  extended.key = msg.key;
  extended.id = msg.key.id;
  extended.fromMe = msg.key.fromMe;
  extended.chat = msg.key.remoteJid;
  extended.sender = normalizeJid(msg.key.participant || msg.key.remoteJid);
  extended.isGroup = extended.chat.endsWith('@g.us');
  extended.timestamp = msg.messageTimestamp?.low ?? msg.messageTimestamp ?? Date.now() / 1000;
  extended.pushName = msg.pushName || 'Unknown';
  extended.isOwner = extended.sender.split('@')[0] === global.owner;

  const context = msg.message?.contextInfo || msg.message?.extendedTextMessage?.contextInfo;
  if (
    extended.pushName && 
    extended.pushName !== 'Unknown' &&
    extended.sender !== botNumber 
  ) {
    getOrUpdateUser(extended.sender, extended.pushName);
  }
  extended.device = getDevice(extended.id);
  extended.groupMetadata = null;
  extended.metadataUpdated = false;
  if (extended.isGroup) {
    if (!hasGroupMetadata(extended.chat)) {
      console.log(chalk.yellow('Metadata grup belum ada → update otomatis...'));
      extended.groupMetadata = await updateGroupMetadata(sock, extended.chat);
      extended.metadataUpdated = !!extended.groupMetadata;
    } else {
      extended.groupMetadata = getGroupMetadata(extended.chat);
    }
    if (extended.groupMetadata) {
      extended.groupName = extended.groupMetadata.subject || 'Grup Tanpa Nama';
      extended.groupJid = extended.chat;
      extended.admins = extended.groupMetadata.participants
        .filter(p => p.admin)
        .map(p => p.id || p.jid);
      extended.isBotAdmin = extended.admins.includes(botNumber);
      extended.isAdmin = extended.admins.includes(extended.sender);
    } else {
      extended.groupName = 'Grup (metadata gagal)';
    }
  }
  
  const messageType = Object.keys(msg.message || {})[0] || 'unknown';
  extended.type = messageType;
  extended.msg = msg.message?.[messageType] || {};
  extended.body = (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    (extended.msg?.text && !extended.msg?.mimetype ? extended.msg.text : '') ||
    extended.msg?.selectedButtonId ||
    extended.msg?.singleSelectReply?.selectedRowId ||
    extended.msg?.caption || 
    ''
  ) ?? '';
  extended.body = extended.body.trim();
  extended.text = extended.body;
  
  extended.isMedia = !!extended.msg?.mimetype || !!extended.msg?.thumbnailDirectPath;
  extended.mediaType = null;
  if (extended.isMedia) {
    extended.mime = extended.msg.mimetype || '';
    if (extended.mime.startsWith('image/')) extended.mediaType = 'image';
    else if (extended.mime.startsWith('video/')) extended.mediaType = 'video';
    else if (extended.mime === 'image/webp') extended.mediaType = 'sticker';
    else if (extended.mime.includes('audio')) extended.mediaType = 'audio';
    else if (extended.mime.includes('pdf') || extended.mime.includes('msword') || extended.mime.includes('openxmlformats-officedocument')) {
      extended.mediaType = 'document';
    } else {
      extended.mediaType = 'file';
    }
    extended.caption = (extended.msg.caption || '[tanpa caption]').trim();
  } else {
    extended.caption = null;
  }
  
  extended.isViewOnce = !!extended.msg?.viewOnce;
  extended.isForwarded = !!extended.msg?.contextInfo?.isForwarded;
  extended.mentionedJid = extended.msg?.contextInfo?.mentionedJid || [];
  
  extended.buttonId = '';
  if (extended.type === 'buttonsResponseMessage') {
    extended.buttonId = extended.msg?.selectedButtonId || '';
  } else if (extended.type === 'listResponseMessage') {
    extended.buttonId = extended.msg?.singleSelectReply?.selectedRowId || '';
  } else if (extended.type === 'interactiveResponseMessage' && extended.msg?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const params = JSON.parse(extended.msg.nativeFlowResponseMessage.paramsJson || '{}');
      extended.buttonId = params.id || params.selected_row_id || params.rowId || params.selectedId || '';
    } catch {}
  }
  
  const botPrefixes = ['BAE5', '3EB0', 'WOLE', 'B1EY', 'HSK', 'FMSG', 'MSG'];
  
  extended.isBot = (() => {
    if (!extended.id || !botNumber) return { isBot: false, reasons: [], ruleDetails: [] };
    const cleanId = extended.id.split('-')[0];
    const flags = [];
    const reasons = [];
    const details = [];
    const isSelf = extended.fromMe || extended.sender === botNumber;
    flags.push(isSelf);
    if (isSelf) {
      reasons.push('Pesan dari bot sendiri');
      details.push('[Self] true');
    } else details.push('[Self] false');
    const isDeviceInvalid = extended.device === 'unknown';
    flags.push(isDeviceInvalid);
    if (isDeviceInvalid) {
      reasons.push(`Device unknown (${cleanId.length} char)`);
      details.push('[Device] true - unknown');
    } else details.push(`[Device] false - ${extended.device}`);
    const hasLower = /[a-z]/.test(cleanId);
    const hasSymbol = /[^A-Za-z0-9]/.test(cleanId);
    const invalidHex = cleanId.match(/[^0-9A-F]/g);
    const invalidFormat = hasLower || hasSymbol || !!invalidHex;
    flags.push(invalidFormat);
    if (invalidFormat) {
      const sub = [];
      if (hasLower) sub.push('lowercase');
      if (hasSymbol) sub.push('symbol');
      if (invalidHex) sub.push('invalid hex');
      reasons.push(`Format invalid: ${sub.join(', ')}`);
      details.push('[Format] true');
    } else details.push('[Format] false');
    const hasBotPrefix = botPrefixes.some(p => cleanId.startsWith(p));
    flags.push(hasBotPrefix);
    if (hasBotPrefix) {
      reasons.push(`Prefix bot: ${cleanId.slice(0,4)}`);
      details.push('[Prefix] true');
    } else details.push('[Prefix] false');
    const hasBotStruct = extended.msg?.protocolMessage || extended.msg?.messageStubType || extended.msg?.senderKeyDistributionMessage;
    flags.push(!!hasBotStruct);
    if (hasBotStruct) {
      reasons.push('Struktur bot (protocol/stub/senderKey)');
      details.push('[Struct] true');
    } else details.push('[Struct] false');
    const hasBotContext = !!extended.msg?.contextInfo?.isBotMessage;
    flags.push(hasBotContext);
    if (hasBotContext) {
      reasons.push('contextInfo.isBotMessage = true');
      details.push('[Context] true');
    } else details.push('[Context] false');
    const isBot = flags.some(f => f);
    return { isBot, reasons, ruleDetails: details };
  })();
  
  extended.quoted = null;
  if (context && context.quotedMessage) {
    const qMsg = context.quotedMessage;
    const qType = Object.keys(qMsg)[0] || 'unknown';
    extended.quoted = {
      key: {
        remoteJid: context.remoteJid || extended.chat,
        participant: normalizeJid(context.participant || extended.sender),
        fromMe: context.isForwarded ? false : undefined,
        id: context.stanzaId || 'tidak ada ID',
      },
      message: qMsg,
      type: qType,
      text: (qMsg[qType]?.text || qMsg[qType]?.caption || qMsg.conversation || '').trim(),
      sender: normalizeJid(context.participant || extended.sender),
    };
   
    if (extended.pushName && extended.pushName !== 'Unknown') {
      getOrUpdateUser(extended.sender, extended.pushName);
    }

    if (extended.quoted?.sender) {
      extended.quoted.pushName = getPushName(extended.quoted.sender);
    }
    extended.quoted.isMedia = !!qMsg?.mimetype || !!qMsg?.thumbnailDirectPath;
    extended.quoted.mediaType = null;
    extended.quoted.mime = qMsg?.mimetype || '';
    extended.quoted.caption = null;
    if (extended.quoted.isMedia) {
      if (extended.quoted.mime.startsWith('image/')) extended.quoted.mediaType = 'image';
      else if (extended.quoted.mime.startsWith('video/')) extended.quoted.mediaType = 'video';
      else if (extended.quoted.mime === 'image/webp') extended.quoted.mediaType = 'sticker';
      else if (extended.quoted.mime.includes('audio')) extended.quoted.mediaType = 'audio';
      else if (extended.quoted.mime.includes('pdf') || extended.quoted.mime.includes('msword') || extended.quoted.mime.includes('openxmlformats-officedocument')) {
        extended.quoted.mediaType = 'document';
      } else {
        extended.quoted.mediaType = 'file';
      }
      extended.quoted.caption = (qMsg.caption || '[tanpa caption]').trim();
    }
    extended.quoted.isBot = (() => {
      if (!extended.quoted.key.id || !botNumber) return { isBot: false, reasons: [], ruleDetails: [] };
      const qCleanId = extended.quoted.key.id.split('-')[0];
      const qFlags = [];
      const qReasons = [];
      const qDetails = [];
      const qIsSelf = extended.quoted.key.fromMe || extended.quoted.sender === botNumber;
      qFlags.push(qIsSelf);
      if (qIsSelf) {
        qReasons.push('Quoted dari bot sendiri');
        qDetails.push('[Self] true');
      } else qDetails.push('[Self] false');
      const qDevice = getDevice(extended.quoted.key.id);
      const qDeviceInvalid = qDevice === 'unknown';
      qFlags.push(qDeviceInvalid);
      if (qDeviceInvalid) {
        qReasons.push(`Quoted device unknown (${qCleanId.length} char)`);
        qDetails.push('[Device] true - unknown');
      } else qDetails.push(`[Device] false - ${qDevice}`);
      const qHasLower = /[a-z]/.test(qCleanId);
      const qHasSymbol = /[^A-Za-z0-9]/.test(qCleanId);
      const qInvalidHex = qCleanId.match(/[^0-9A-F]/g);
      const qInvalidFormat = qHasLower || qHasSymbol || !!qInvalidHex;
      qFlags.push(qInvalidFormat);
      if (qInvalidFormat) {
        const sub = [];
        if (qHasLower) sub.push('lowercase');
        if (qHasSymbol) sub.push('symbol');
        if (qInvalidHex) sub.push('invalid hex');
        qReasons.push(`Quoted format invalid: ${sub.join(', ')}`);
        qDetails.push('[Format] true');
      } else qDetails.push('[Format] false');
      const qHasPrefix = botPrefixes.some(p => qCleanId.startsWith(p));
      qFlags.push(qHasPrefix);
      if (qHasPrefix) {
        qReasons.push(`Quoted prefix bot: ${qCleanId.slice(0,4)}`);
        qDetails.push('[Prefix] true');
      } else qDetails.push('[Prefix] false');
      const qHasStruct = extended.quoted.message?.protocolMessage || extended.quoted.message?.messageStubType || extended.quoted.message?.senderKeyDistributionMessage;
      qFlags.push(!!qHasStruct);
      if (qHasStruct) {
        qReasons.push('Quoted struktur bot');
        qDetails.push('[Struct] true');
      } else qDetails.push('[Struct] false');
      const qHasContext = !!extended.msg?.contextInfo?.isBotMessage;
      qFlags.push(qHasContext);
      if (qHasContext) {
        qReasons.push('ContextInfo.isBotMessage = true');
        qDetails.push('[Context] true');
      } else qDetails.push('[Context] false');
      const qIsBot = qFlags.some(f => f);
      return { isBot: qIsBot, reasons: qReasons, ruleDetails: qDetails };
    })();
  }if (extended.isBot?.isBot) return null;
  return extended;
}
