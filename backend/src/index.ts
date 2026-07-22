import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { PrismaClient } from '@prisma/client';
import qrcode from 'qrcode-terminal';
import path from 'path';
import { handleMessageUpsert, handleMessageUpdate } from './handlers/messageHandler';
import authRoutes from './routes/authRoutes';
import ticketRoutes from './routes/ticketRoutes';
import whatsappRoutes from './routes/whatsappRoutes';
import contactRoutes from './routes/contactRoutes';
import userRoutes from './routes/userRoutes';
import sectorRoutes from './routes/sectorRoutes';
import settingsRoutes from './routes/settingsRoutes';
import statsRoutes from './routes/statsRoutes';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

// Configurar store em memória manual para permitir descriptografia
import fs from 'fs';
export const messageStore: { [id: string]: any } = {};
const STORE_PATH = './baileys_message_store.json';

// Função para restaurar Uint8Arrays que viraram objetos no JSON
const bufferReviver = (key: string, value: any) => {
    if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
        return new Uint8Array(value.data);
    }
    return value;
};

// Carregar store do disco se existir
if (fs.existsSync(STORE_PATH)) {
    try {
        const data = fs.readFileSync(STORE_PATH, 'utf-8');
        Object.assign(messageStore, JSON.parse(data, bufferReviver));
        console.log(`[STORE] Carregadas ${Object.keys(messageStore).length} chaves do disco.`);
    } catch (e) {
        console.error('[STORE] Erro ao carregar store do disco:', e);
    }
}

// Salvar store no disco a cada 15 segundos
setInterval(() => {
    try {
        fs.writeFileSync(STORE_PATH, JSON.stringify(messageStore, (k, v) => typeof v === 'bigint' ? v.toString() : v));
    } catch(e) {}
}, 15000);

// Inicializando o PrismaClient no Prisma 7 passando a url do db (SQLite file)
const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL
});

app.use(cors());
app.use(express.json());
// Rotas estáticas para as mídias (agora apontando para a raiz /public/uploads e /public/profilepics)
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
app.use('/profilepics', express.static(path.join(process.cwd(), 'public', 'profilepics')));

app.locals.io = io;

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/stats', statsRoutes);

app.locals.currentQR = null;
app.locals.connectionState = 'connecting';

// Armazena a instância do socket do WhatsApp globalmente (ou num serviço no futuro)
export let sock: ReturnType<typeof makeWASocket> | null = null;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Apenas para debug local inicial
        syncFullHistory: false,
        getMessage: async (key) => {
            return messageStore[key.id!] || undefined;
        }
    });

    app.locals.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('Novo QR Code gerado. Leia-o pelo WhatsApp.');
            app.locals.currentQR = qr;
            if (app.locals.io) app.locals.io.emit('whatsapp-qr', qr);
        }

        if (connection === 'close') {
            app.locals.connectionState = 'close';
            if (app.locals.io) app.locals.io.emit('whatsapp-status', 'close');
            
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Reconectar?', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('Você foi desconectado. Apague a pasta auth_info_baileys para gerar novo QR.');
            }
        } else if (connection === 'open') {
            app.locals.connectionState = 'open';
            app.locals.currentQR = null;
            if (app.locals.io) app.locals.io.emit('whatsapp-status', 'open');
            console.log('✅ WhatsApp Conectado com Sucesso!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        // Sempre salvar no store para poder descriptografar edições depois
        for (const msg of m.messages) {
            if (msg.key?.id && msg.message) {
                messageStore[msg.key.id] = msg.message;
                // Limpar store manualmente se ficar muito grande para evitar vazamento de memória
                if (Object.keys(messageStore).length > 5000) {
                    const keys = Object.keys(messageStore);
                    for (let i = 0; i < 1000; i++) delete messageStore[keys[i]];
                }
            }
        }
        
        if (m.type === 'notify') {
            await handleMessageUpsert(sock!, m.messages, io);
        }
    });

    sock.ev.on('messages.update', async (updates) => {
        await handleMessageUpdate(updates, io);
    });

    sock.ev.on('presence.update', (update) => {
        if (app.locals.io) {
            app.locals.io.emit('contact-presence', update);
        }
    });

    sock.ev.on('contacts.upsert', async (contacts) => {
        for (const c of contacts) {
            if (c.id && !c.id.includes('@g.us') && !c.id.includes('status')) {
                const name = c.name || c.notify || c.verifiedName;
                if (name) {
                    await prisma.contact.upsert({
                        where: { jid: c.id },
                        update: { name },
                        create: { jid: c.id, name }
                    }).catch(() => {});
                }
            }
        }
    });

    sock.ev.on('messaging-history.set', async ({ contacts }) => {
        for (const c of contacts) {
            if (c.id && !c.id.includes('@g.us') && !c.id.includes('status')) {
                const name = c.name || c.notify || c.verifiedName;
                if (name) {
                    await prisma.contact.upsert({
                        where: { jid: c.id },
                        update: { name },
                        create: { jid: c.id, name }
                    }).catch(() => {});
                }
            }
        }
    });

    sock.ev.on('groups.upsert', async (groups) => {
        for (const group of groups) {
            if (group.id && group.subject) {
                await prisma.contact.upsert({
                    where: { jid: group.id },
                    update: { name: group.subject },
                    create: { jid: group.id, name: group.subject, profilePicUrl: null }
                }).catch(() => {});
            }
        }
    });

    sock.ev.on('groups.update', async (groups) => {
        for (const group of groups) {
            if (group.id && group.subject) {
                await prisma.contact.update({
                    where: { jid: group.id },
                    data: { name: group.subject }
                }).catch(() => {});
            }
        }
    });
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

httpServer.listen(PORT, () => {
    console.log(`Servidor rodando em http://${HOST}:${PORT}`);
    connectToWhatsApp();
});
