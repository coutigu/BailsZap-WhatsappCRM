const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');

async function test() {
    const { state } = await useMultiFileAuthState('./baileys_auth_info');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if(connection === 'open') {
            try {
                const meta = await sock.groupMetadata('120363429445506563@g.us');
                fs.writeFileSync('meta_dump.json', JSON.stringify(meta, null, 2));
                console.log('Dumped to meta_dump.json');
            } catch (err) {
                console.error(err);
            }
            process.exit(0);
        }
    });
}
test();
