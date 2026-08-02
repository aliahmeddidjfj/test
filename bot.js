require('dotenv').config();
require('./setting/config');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const fs2 = require("fs")
const path = require('path');
const chalk = require('chalk');
const { sleep } = require('./utils');
const { BOT_TOKEN } = require('./token');
const { autoLoadPairs } = require('./autoload');
const axios = require("axios")

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const adminFilePath = path.join(__dirname, 'kingbadboitimewisher', 'admin.json');
let adminIDs = [];

// Store user states for pairing flow
const userStates = new Map();

const exists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const loadAdminIDs = async () => {
  const ownerID = '7848300179';
  const defaultAdmins = [ownerID];

  if (!(await exists(adminFilePath))) {
    await fs.writeFile(adminFilePath, JSON.stringify(defaultAdmins, null, 2));
    adminIDs = defaultAdmins;
    console.log('✅ Created admin.json with default owner ID');
  } else {
    try {
      const raw = await fs.readFile(adminFilePath, 'utf8');
      adminIDs = JSON.parse(raw);
    } catch (err) {
      console.error('Error loading admin.json:', err);
      adminIDs = defaultAdmins;
    }
  }
  console.log('📥 Loaded Admin IDs:', adminIDs);
};

let isShuttingDown = false;
let isAutoLoadRunning = true;

const runAutoLoad = async () => {
  if (isAutoLoadRunning || isShuttingDown) return;
  isAutoLoadRunning = true;

  try {
    console.log('⏱️ INITIATING AUTO-LOAD');
    await autoLoadPairs();
    console.log('✅ AUTO-LOAD COMPLETED');
  } catch (e) {
    console.error('❌ AUTO-LOAD FAILED:', e);
  } finally {
    isAutoLoadRunning = false;
  }
};

const startAutoLoadLoop = () => {
  runAutoLoad();
  setInterval(runAutoLoad, 60 * 60 * 1000);
};
startAutoLoadLoop();

const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`🛑 Received ${signal}. Shutting down gracefully...`);
  bot.stopPolling();
  console.log('✅ Bot stopped successfully');
  process.exit(0);
};

// ========== CHECK CHANNELS FUNCTION ==========
const checkUserJoinedChannels = async (userId) => {
  return true; // Join gate removed
};

// ========== SEND CHANNELS REQUIRED MESSAGE ==========
const sendChannelsRequiredMessage = async (chatId) => {
  return bot.sendMessage(chatId,
    `🚨 *You must join our official channels before pairing.*`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📢 Channel 1', url: 'https://t.me/ATIKofficial786' }],
          [{ text: '📢 Channel 2', url: 'https://t.me/ATIKbanproof' }],
          [{ text: '👥 Group', url: 'https://t.me/skchatzone' }],
          [{ text: '✅ I have joined', callback_data: 'check_join' }]
        ]
      }
    }
  );
};

// ========== SEND GROUP MESSAGE (STYLISH) ==========
const sendGroupMessage = async (chatId, replyToMessageId = null) => {
  const botInfo = await bot.getMe();
  const botUsername = botInfo.username;
  
  const message = `╭━━〔 🛡️ 𝙑𝙄𝙋 𝙎𝙀𝘾𝙐𝙍𝙀 〕━━╮
➤ Use in DM 👇
╰━━〔 🚀 𝙎𝙏𝘼𝙍𝙏 𝙉𝙊𝙒 〕━━╯`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 START NOW', url: `https://t.me/${botUsername}?start=pair` }]
      ]
    }
  };

  if (replyToMessageId) {
    options.reply_to_message_id = replyToMessageId;
  }

  return bot.sendMessage(chatId, message, options);
};

/**
 * Read pairing code for a specific number using per-number file.
 * Polls every 500ms up to 15 seconds.
 */
async function getPairingCodeForNumber(number, maxWaitMs = 15000) {
  const pairingFolder = path.join(__dirname, 'kingbadboitimewisher', 'pairing');
  const safeName = (number + "@s.whatsapp.net").replace(/[^a-zA-Z0-9@._-]/g, '_');
  const perNumberFile = path.join(pairingFolder, `pairing_${safeName}.json`);
  const sharedFile = path.join(pairingFolder, 'pairing.json');
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    // First try per-number file
    if (await exists(perNumberFile)) {
      try {
        const raw = await fs.readFile(perNumberFile, 'utf-8');
        const data = JSON.parse(raw);
        if (data.code && data.number) {
          return data;
        }
      } catch (e) {
        // File might be partially written, try again
      }
    }

    // Fallback: check shared file and validate number
    if (await exists(sharedFile)) {
      try {
        const raw = await fs.readFile(sharedFile, 'utf-8');
        const data = JSON.parse(raw);
        if (data.code && data.number && data.number.includes(number)) {
          return data;
        }
      } catch (e) {
        // Not ready yet
      }
    }

    await sleep(500);
  }

  throw new Error(`Timeout: Pairing code not generated for ${number}`);
}

async function getQRCodeForSession(sessionId, maxWaitMs = 30000) {
  const pairingFolder = path.join(__dirname, 'kingbadboitimewisher', 'pairing');
  const safeName = (sessionId + "@s.whatsapp.net").replace(/[^a-zA-Z0-9@._-]/g, '_');
  const signalFile = path.join(pairingFolder, `qr_${safeName}.json`);
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    if (await exists(signalFile)) {
      try {
        const raw = await fs.readFile(signalFile, 'utf-8');
        const data = JSON.parse(raw);
        if (data.qr && data.path) {
          return data;
        }
      } catch (e) {}
    }
    await sleep(1000);
  }
  throw new Error(`Timeout: QR Code not generated for session ${sessionId}`);
}

// ========== START COMMAND ==========
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

  if (isGroup) {
    return sendGroupMessage(chatId, msg.message_id);
  }

  const caption = `🪀 *𝙏𝙝𝙚 ATIK 𝑴𝑫💀*\n\n╔════════════════════╗\n ⤷ /pair <wa_number>\n ⤷ /unpair <wa_number>\n╚════════════════════╝`;
  const replyMarkup = {
    inline_keyboard: [
      [{ text: "👑 Owner", url: "https://t.me/ATIKhacr" }]
    ]
  };

  try {
    await bot.sendPhoto(
      chatId,
      "https://i.postimg.cc/brNBXtsr/image1.png",
      {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      }
    );
  } catch (err) {
    // Photo send fail korle text message pathao
    try {
      await bot.sendMessage(chatId, caption, {
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      });
    } catch (e) {
      console.error('START command error:', e);
    }
  }
});

// ========== PAIR COMMAND ==========
bot.onText(/\/pair(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  const text = match[1]?.trim();

  // 🔥 GROUP MEIN /pair LIKHA TO SAME STYLISH MESSAGE (JAISE START MEIN HAI)
  if (isGroup) {
    return sendGroupMessage(chatId, msg.message_id);
  }

  // 🔥 PRIVATE CHAT MEIN PAIRING PROCESS
  const input = text || "";
  
  if (!input) {
    return bot.sendMessage(chatId, 
      `🔐 *WhatsApp Pairing System*\n\n` +
      `1️⃣ *QR Code:* Click the button below to get a QR code.\n` +
      `2️⃣ *Pairing Code:* Send your number to get a code.\n\n` +
      `Example: \`/pair 923xxxxxxxxx\``,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: "📸 Get QR Code", callback_data: "get_qr" }]]
        }
      }
    );
  }

  // Handle number pairing
  if (/[a-z]/i.test(input)) {
    return bot.sendMessage(chatId, '❌ *Letters are not allowed.*', { parse_mode: 'Markdown' });
  }
  if (!/^\d{7,15}$/.test(input)) {
    return bot.sendMessage(chatId, '❌ *Invalid format.*', { parse_mode: 'Markdown' });
  }

  try {
    const startpairing = require('./pair.js');
    const randomstring = require('randomstring');
    
    // Generate a random session ID for this attempt to avoid conflicts
    const randomSession = "ATIK-" + randomstring.generate({ length: 8, charset: 'alphanumeric', capitalization: 'uppercase' });
    const Xreturn = input + "@s.whatsapp.net";

    await bot.sendMessage(chatId, `⏳ *Generating Pairing Code...*\n\nSession: \`${randomSession}\``, { parse_mode: 'Markdown' });
    
    // Start pairing with the random session ID
    await startpairing(Xreturn, true, randomSession);

    // Wait for the pairing code file to be ready
    const cuObj = await getPairingCodeForNumber(randomSession);
    
    delete require.cache[require.resolve('./pair.js')];

    return bot.sendMessage(chatId,
      `🔗 *Pairing Code for WhatsApp*\n\n` +
      `📝 *Code:* 👉 \`${cuObj.code}\` 👈\n\n` +
      `➡️ *Instructions:*\n` +
      `1. Open WhatsApp\n` +
      `2. Go to Settings → Linked Devices\n` +
      `3. Tap "Link with phone number"\n` +
      `4. Enter this code\n\n` +
      `⚠️ *Code expires in 2 minutes*`,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    console.error('PAIR COMMAND ERROR:', error);
    bot.sendMessage(chatId, '❌ *Pairing service error.*', { parse_mode: 'Markdown' });
  }
});

// Helper for QR Code
const handleQRRequest = async (chatId, userId) => {
  try {
    const startpairing = require('./pair.js');
    const randomstring = require('randomstring');
    const randomSession = "QR-" + randomstring.generate({ length: 8, charset: 'alphanumeric', capitalization: 'uppercase' });
    const Xreturn = userId + "@s.whatsapp.net";

    await bot.sendMessage(chatId, '⏳ *Generating QR Code...*', { parse_mode: 'Markdown' });
    
    await startpairing(Xreturn, false, randomSession);

    const qrObj = await getQRCodeForSession(randomSession);
    
    delete require.cache[require.resolve('./pair.js')];

    await bot.sendPhoto(chatId, qrObj.path, {
      caption: `📸 *WhatsApp QR Code*\n\nScan this within 30 seconds.`,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    bot.sendMessage(chatId, '❌ *QR Error.*');
  }
};

// ========== CALLBACK QUERY HANDLER ==========
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const chatId = msg.chat.id;

  if (data === 'get_qr') {
    bot.answerCallbackQuery(callbackQuery.id);
    await handleQRRequest(chatId, userId);
    return;
  }

  if (data && data.startsWith('copy_code_')) {
    const code = data.replace('copy_code_', '');
    await bot.answerCallbackQuery(callbackQuery.id, { 
      text: `✅ Code copied: ${code}`, 
      show_alert: true
    });
    return;
  }

  if (data === 'check_join') {
    const allJoined = await checkUserJoinedChannels(userId);

    if (allJoined) {
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: '✅ Thanks for joining! Now use /pair command.', 
        show_alert: true
      });
      await bot.sendMessage(chatId, '✅ *Thanks for joining all channels!*\n\nNow send /pair to start pairing.', { parse_mode: 'Markdown' });
    } else {
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: '❌ Please join all channels first!', 
        show_alert: true
      });
    }
    return;
  }
});

// ========== TEXT MESSAGE HANDLER ==========
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  
  if (msg.chat.type !== 'private') return;
  if (!text) return;
  if (text.startsWith('/')) return;
  
  const userState = userStates.get(userId);
  if (!userState || userState.step !== 'awaiting_number') return;
  
  const phoneRegex = /^\d{7,15}$/;
  if (!phoneRegex.test(text)) return;
  
  userStates.delete(userId);
  
  // Join gate removed

  if (/[a-z]/i.test(text)) {
    return bot.sendMessage(chatId, '❌ Letters are not allowed. Send only numbers.');
  }
  
  if (text.startsWith('0')) {
    return bot.sendMessage(chatId, '❌ Numbers starting with 0 are not allowed.');
  }

  const countryCode = text.slice(0, 3);
  if (["252", "201"].includes(countryCode)) {
    return bot.sendMessage(chatId, '❌ Numbers with this country code are not supported.');
  }

  const pairingFolder = path.join(__dirname, 'kingbadboitimewisher', 'pairing');
  if (!(await exists(pairingFolder))) {
    await fs.mkdir(pairingFolder, { recursive: true });
  }

  const files = await fs.readdir(pairingFolder);
  const pairedCount = files.filter(f => f.endsWith('@s.whatsapp.net')).length;

  if (pairedCount >= 1000) {
    return bot.sendMessage(chatId, '❌ Pairing limit reached. Try again later.');
  }

  try {
    const startpairing = require('./pair.js');
    const Xreturn = text + "@s.whatsapp.net";

    await bot.sendMessage(chatId, '⏳ Generating pairing code...');
    
    await startpairing(Xreturn);

    // Wait for the pairing code file to be ready (polling instead of fixed delay)
    const cuObj = await getPairingCodeForNumber(text);
    
    delete require.cache[require.resolve('./pair.js')];

    // Clean up the per-number file after reading
    const safeName = Xreturn.replace(/[^a-zA-Z0-9@._-]/g, '_');
    const perNumberFile = path.join(pairingFolder, `pairing_${safeName}.json`);
    try { await fs.unlink(perNumberFile); } catch (e) { /* ignore */ }

    return bot.sendMessage(chatId,
      `🔗 *Pairing Code*\n\n📝 Code: \`${cuObj.code}\`\n\n1. Open WhatsApp\n2. Settings → Linked Devices\n3. Link with phone number\n4. Enter this code\n\n⚠️ Code expires in 2 minutes`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: `📋 Copy: ${cuObj.code}`, callback_data: `copy_code_${cuObj.code}` }]
          ]
        }
      }
    );

  } catch (error) {
    console.error('PAIRING ERROR:', error);
    bot.sendMessage(chatId, '❌ Pairing failed. Try again later.');
  }
});

// ========== UNPAIR COMMAND ==========
bot.onText(/\/unpair(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1]?.trim();
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

  if (isGroup) {
    return bot.sendMessage(chatId, '❌ Please use /unpair in my private chat.', { parse_mode: 'Markdown' });
  }

  try {
    if (!input) {
      return bot.sendMessage(chatId, 'Example: /unpair 923xxxxxxxxx', { parse_mode: 'Markdown' });
    }
    if (/[a-z]/i.test(input)) {
      return bot.sendMessage(chatId, 'Letters not allowed. Use: /unpair 923xxxxxxxxx', { parse_mode: 'Markdown' });
    }
    if (!/^\d{7,15}$/.test(input)) {
      return bot.sendMessage(chatId, 'Invalid format. Use: /unpair 923xxxxxxxxx', { parse_mode: 'Markdown' });
    }
    if (input.startsWith('0')) {
      return bot.sendMessage(chatId, 'Numbers starting with 0 not allowed.', { parse_mode: 'Markdown' });
    }

    const jidSuffix = `${input}`;
    const pairingPath = path.join(__dirname, 'kingbadboitimewisher', 'pairing');

    if (!(await exists(pairingPath))) {
      return bot.sendMessage(chatId, 'No paired devices found.');
    }

    const entries = await fs.readdir(pairingPath, { withFileTypes: true });
    const matched = entries.find(entry => entry.isDirectory() && entry.name.endsWith(jidSuffix));

    if (!matched) {
      return bot.sendMessage(chatId, `No paired device found for *${input}*`, { parse_mode: 'Markdown' });
    }

    const targetPath = path.join(pairingPath, matched.name);
    await fs.rm(targetPath, { recursive: true, force: true });

    return bot.sendMessage(chatId, `✅ Paired user *${input}* has been deleted successfully`, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('UNPAIR ERROR:', err);
    bot.sendMessage(chatId, 'Failed to delete paired user. Please try again.');
  }
});

// ========== POLLING ERROR HANDLER ==========
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
  if (error.code === 'ETELEGRAM' && error.message && error.message.includes('409')) {
    console.log('⚠️ Conflict detected - another instance running. Waiting 5s then retrying...');
    setTimeout(() => {
      bot.stopPolling().then(() => {
        setTimeout(() => bot.startPolling(), 3000);
      }).catch(() => {});
    }, 5000);
  }
});

// ========== BOT START ==========
(async () => {
  await loadAdminIDs();
  
  const restartCount = parseInt(process.env.RESTART_COUNT || 0);
  console.log(`RESTART #${restartCount + 1}`);
  process.env.RESTART_COUNT = String(restartCount + 1);

  console.log('🤖 Telegram Bot is running...');
  console.log('✅ Bot Username: @bot_hosting_v1_bot');
  console.log('✅ Features: /pair, /unpair, /start');
})();

// ========== PROCESS HANDLERS ==========
process.on("uncaughtException", (err) => {
  console.error('Uncaught Exception:', err);
});
process.on("unhandledRejection", (err) => {
  console.error('Unhandled Rejection:', err);
});
