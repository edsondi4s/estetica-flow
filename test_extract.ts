import fs from "fs";

function universalExtract(payload: any) {
    const p = Array.isArray(payload) ? payload[0] : payload;
    const data = p?.data || p;
    const inst = p?.instance || p?.instance_name || data?.instance;
    const msg = data?.message || data?.messages?.[0]?.message || data;
    const key = data?.key || data?.messages?.[0]?.key;
    
    const rawJid = key?.remoteJid || data?.sender || data?.from || '';
    const participant = data?.participant || (msg?.contactMessage?.vcard && msg.contactMessage.vcard.match(/waid=(\d+)/)?.[1]);
    const remoteJidAlt = key?.remoteJidAlt || '';
    const senderPn = data?.senderPn || '';

    let jid = rawJid;
    const candidates = [rawJid, participant, remoteJidAlt, senderPn].filter(Boolean);
    
    // First Priority: Find any proper whatsapp number (@s.whatsapp.net)
    const netMatch = candidates.find(c => typeof c === 'string' && c.includes('@s.whatsapp.net'));
    if (netMatch) {
        jid = netMatch;
    } else {
        // Second Priority: Find any raw phone number string and format it
        const phoneMatch = candidates.find(c => typeof c === 'string' && !c.includes('@'));
        if (phoneMatch) {
            const clean = phoneMatch.replace(/\D/g, '');
            if (clean.length >= 8) jid = `${clean}@s.whatsapp.net`;
        } else {
            // Third Priority: Fallback to @lid or rawJid if no phone is found
            const lidMatch = candidates.find(c => typeof c === 'string' && c.includes('@lid'));
            if (lidMatch) jid = lidMatch;
        }
    }
    
    // Clean any trailing device ids from the winner (e.g 5511999:2@s.whatsapp.net -> 5511999@s.whatsapp.net)
    if (jid && jid.includes(':')) {
        const parts = jid.split('@');
        const userPart = parts[0].split(':')[0];
        jid = `${userPart}@${parts[1]}`;
    }
    
    const txt = msg?.conversation || msg?.extendedTextMessage?.text || data?.content || '';
    const fromMe = key?.fromMe ?? false;
    const possibleRealPhone = participant || jid;
    return { inst, jid, txt, fromMe, possibleRealPhone };
}

// Simulated payload from Evolution
const mockPayload = {
    "instance": "Test",
    "data": {
        "key": {
            "remoteJid": "212794305728763@lid",
            "fromMe": false,
            "participant": "559291571034@s.whatsapp.net"
        },
        "pushName": "Edson",
        "message": {
            "conversation": "Teste"
        },
        "sender": "212794305728763@lid",
        "participant": "559291571034@s.whatsapp.net"
    }
};

console.log(universalExtract(mockPayload));
