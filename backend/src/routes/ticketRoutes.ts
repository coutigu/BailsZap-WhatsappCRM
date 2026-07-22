import { Router } from 'express';
import { prisma } from '../db';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { sock, messageStore } from '../index';
import { WASocket } from '@whiskeysockets/baileys';
import { Server } from 'socket.io';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configuração do multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

// GET /tickets - Listar tickets (Filas)
router.get('/', verifyToken, async (req: AuthRequest, res) => {
    try {
        const { role, id } = req.user!;
        
        let tickets;
        if (role === 'Admin') {
            // Admin vê tudo
            tickets = await prisma.ticket.findMany({
                include: { contact: true, user: { select: { name: true } }, sector: true },
                orderBy: { updatedAt: 'desc' }
            });
        } else {
            // Atendente vê os "Em espera" OU os que estão designados para ele
            tickets = await prisma.ticket.findMany({
                where: {
                    OR: [
                        { status: 'Em espera' },
                        { userId: id }
                    ]
                },
                include: { contact: true, user: { select: { name: true } }, sector: true },
                orderBy: { updatedAt: 'desc' }
            });
        }
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar tickets.' });
    }
});

// GET /tickets/groups - Listar tickets de grupos
router.get('/groups', verifyToken, async (req: AuthRequest, res) => {
    try {
        const groups = await prisma.ticket.findMany({
            where: { status: 'Grupo' },
            include: { contact: true },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar grupos.' });
    }
});

// POST /tickets - Criar ticket manualmente
router.post('/', verifyToken, async (req: AuthRequest, res) => {
    try {
        const { phone, name } = req.body;
        if (!phone) return res.status(400).json({ error: 'Telefone é obrigatório.' });

        const cleanPhone = phone.replace(/\D/g, '');
        const jid = `${cleanPhone}@s.whatsapp.net`;

        let contact = await prisma.contact.findUnique({ where: { jid } });
        if (!contact) {
            contact = await prisma.contact.create({
                data: { jid, name: name || cleanPhone, profilePicUrl: null }
            });
        }

        let ticket = await prisma.ticket.findFirst({
            where: {
                contactId: contact.id,
                status: { in: ['Em espera', 'Em atendimento'] }
            },
            include: { contact: true, user: { select: { name: true } }, sector: true }
        });

        const io: Server = req.app.locals.io;
        if (!ticket) {
            ticket = await prisma.ticket.create({
                data: { contactId: contact.id, status: 'Em atendimento', userId: req.user!.id },
                include: { contact: true, user: { select: { name: true } }, sector: true }
            });
            if (io) io.emit('new-ticket', ticket);
        }

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar ticket.' });
    }
});

// GET /tickets/:id/messages
router.get('/:id/messages', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        
        const messages = await prisma.message.findMany({
            where: { ticketId: id },
            orderBy: { timestamp: 'asc' }
        });
        
        const updatedTicket = await prisma.ticket.findUnique({
            where: { id },
            include: { contact: true, user: { select: { name: true } }, sector: true }
        });
        
        const io: Server = req.app.locals.io;
        if (io && updatedTicket) io.emit('ticket-updated', updatedTicket);

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar mensagens.' });
    }
});

// POST /tickets/:id/assign
router.post('/:id/assign', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const userId = req.user!.id;

        const ticket = await prisma.ticket.update({
            where: { id },
            data: { userId, status: 'Em atendimento' },
            include: { contact: true, user: { select: { name: true } }, sector: true }
        });

        const io: Server = req.app.locals.io;
        if (io) io.emit('ticket-updated', ticket);

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atribuir ticket.' });
    }
});

// POST /tickets/:id/transfer
router.post('/:id/transfer', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { targetUserId } = req.body;

        const ticket = await prisma.ticket.update({
            where: { id },
            data: { userId: targetUserId, status: 'Em atendimento' },
            include: { contact: true, user: { select: { name: true } }, sector: true }
        });

        const io: Server = req.app.locals.io;
        if (io) {
            io.emit('ticket-updated', ticket);
            io.emit('ticket-transferred', {
                ticketId: ticket.id,
                contactName: ticket.contact?.name || ticket.contact?.jid,
                toUserId: targetUserId,
                fromUserName: req.user!.name
            });
        }

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao transferir ticket.' });
    }
});

// POST /tickets/:id/send
router.post('/:id/send', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { content, quotedMessageId } = req.body;
        const sock: WASocket = req.app.locals.sock;

        if (!sock) {
            return res.status(500).json({ error: 'WhatsApp não está conectado no servidor.' });
        }

        const ticket = await prisma.ticket.update({
            where: { id },
            data: { unreadCount: 0 },
            include: { contact: true }
        });

        if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado.' });

        // Regra de Negócio: Nome do atendente em negrito
        const agentName = req.user!.name;
        const formattedContent = `*${agentName}*\n${content}`;

        let quotedMessage = undefined;
        let quotedMsgBodyToSave = null;
        if (quotedMessageId) {
            const quotedMsg = await prisma.message.findUnique({ where: { id: quotedMessageId } });
            if (quotedMsg && quotedMsg.messageId) {
                quotedMsgBodyToSave = quotedMsg.content;
                quotedMessage = {
                    key: {
                        remoteJid: ticket.contact.jid,
                        id: quotedMsg.messageId,
                        fromMe: quotedMsg.sender === 'Sistema' || quotedMsg.sender === agentName
                    },
                    message: {
                        conversation: quotedMsg.content
                    }
                };
            }
        }

        // Enviar via Baileys
        const jid = ticket.contact.jid;
        const sentMsg = await sock.sendMessage(jid, { text: formattedContent }, quotedMessage ? { quoted: quotedMessage as any } : undefined);
        
        if (sentMsg && sentMsg.key.id && sentMsg.message) {
            messageStore[sentMsg.key.id] = sentMsg.message;
        }

        // Salvar no DB
        const savedMessage = await prisma.message.create({
            data: {
                ticketId: ticket.id,
                messageId: sentMsg?.key.id || '',
                type: 'text',
                content: formattedContent,
                sender: 'Sistema',
                quotedMsgId: quotedMessageId || null,
                quotedMsgBody: quotedMsgBodyToSave
            }
        });

        // Emitir pro socket
        const io: Server = req.app.locals.io;
        if (io) {
            io.emit('new-message', savedMessage);
            io.emit('ticket-updated', ticket);
        }

        res.json(savedMessage);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao enviar mensagem.' });
    }
});

// POST /tickets/:id/send-media - Enviar mídia
router.post('/:id/send-media', verifyToken, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

        const id = req.params.id as string;
        const caption = req.body.caption || '';
        const ticket = await prisma.ticket.update({
            where: { id },
            data: { unreadCount: 0 },
            include: { contact: true }
        });

        if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado.' });

        const app = req.app;
        const sock = app.locals.sock;

        if (!sock) return res.status(500).json({ error: 'WhatsApp não conectado.' });

        const agentName = req.user!.name;
        const formattedCaption = caption ? `*${agentName}*\n${caption}` : `*${agentName}* enviou um arquivo.`;

        const mime = req.file.mimetype;
        const buffer = fs.readFileSync(req.file.path);
        const fileName = req.file.originalname;

        let sendOptions: any = {};

        if (mime.startsWith('image/')) {
            sendOptions = { image: buffer, caption: formattedCaption };
        } else if (mime.startsWith('video/')) {
            sendOptions = { video: buffer, caption: formattedCaption };
        } else if (mime.startsWith('audio/')) {
            sendOptions = { audio: buffer, mimetype: 'audio/ogg; codecs=opus' };
        } else {
            sendOptions = { document: buffer, mimetype: mime, fileName: fileName, caption: formattedCaption };
        }

        const contactJid = (ticket as any).contact?.jid;
        const sentMsg = await sock.sendMessage(contactJid, sendOptions);
        
        if (sentMsg && sentMsg.key.id && sentMsg.message) {
            messageStore[sentMsg.key.id] = sentMsg.message;
        }

        let type = 'document';
        if (mime.startsWith('image/')) type = 'image';
        else if (mime.startsWith('video/')) type = 'video';
        else if (mime.startsWith('audio/')) type = 'audio';

        const savedMessage = await prisma.message.create({
            data: {
                ticketId: ticket.id,
                messageId: sentMsg?.key?.id || '',
                type,
                content: caption || "",
                mediaUrl: `/uploads/${req.file.filename}`,
                fileName: fileName,
                sender: 'Sistema',
            }
        });

        app.locals.io.emit('new-message', savedMessage);
        app.locals.io.emit('ticket-updated', ticket);
        
        res.json({ message: 'Mídia enviada', savedMessage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao enviar mídia.' });
    }
});

// POST /tickets/:id/close
router.post('/:id/close', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const skipGoodbye = req.body.skipGoodbye === true;
        
        const ticket = await prisma.ticket.update({
            where: { id },
            data: { status: 'Finalizado', unreadCount: 0 },
            include: { contact: true, user: { select: { name: true } }, sector: true }
        });

        const goodbyeSetting = await prisma.setting.findUnique({
            where: { key: 'goodbyeMessage' }
        });

        if (!skipGoodbye && goodbyeSetting && goodbyeSetting.value.trim() !== '') {
            const sock: any = req.app.locals.sock;
            if (sock) {
                const jid = ticket.contact.jid;
                let formattedContent = goodbyeSetting.value.trim();
                formattedContent = formattedContent.replace(/\{nome\}/g, ticket.contact.name || 'Cliente');
                formattedContent = formattedContent.replace(/\{atendente\}/g, ticket.user?.name || 'Atendente');
                formattedContent = formattedContent.replace(/\{protocolo\}/g, ticket.id.toString());
                
                const sentMsg = await sock.sendMessage(jid, { text: formattedContent });

                const savedMessage = await prisma.message.create({
                    data: {
                        ticketId: ticket.id,
                        messageId: sentMsg?.key?.id || '',
                        type: 'text',
                        content: formattedContent,
                        sender: 'Sistema'
                    }
                });
                
                const io: Server = req.app.locals.io;
                if (io) io.emit('new-message', savedMessage);
            }
        }

        const io: Server = req.app.locals.io;
        if (io) io.emit('ticket-updated', ticket);

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao finalizar ticket.' });
    }
});

// POST /tickets/:id/reopen
router.post('/:id/reopen', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        
        const ticket = await prisma.ticket.update({
            where: { id },
            data: { status: 'Em espera', userId: null, sectorId: null }, // Volta pra fila de espera sem setor
            include: { contact: true, user: { select: { name: true } }, sector: true }
        });

        const io: Server = req.app.locals.io;
        if (io) io.emit('ticket-updated', ticket);

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao reabrir ticket.' });
    }
});

// POST /tickets/:id/return - Devolver para a fila
router.post('/:id/return', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        
        const ticket = await prisma.ticket.update({
            where: { id },
            data: { status: 'Em espera', userId: null }, // Volta pra fila de espera sem fechar
            include: { contact: true, user: { select: { name: true } }, sector: true }
        });

        const io: Server = req.app.locals.io;
        if (io) io.emit('ticket-updated', ticket);

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao devolver ticket para a fila.' });
    }
});

// POST /tickets/:id/sector - Transferir/atribuir setor do ticket
router.post('/:id/sector', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { sectorId } = req.body;

        const ticket = await prisma.ticket.update({
            where: { id },
            data: { sectorId: sectorId || null },
            include: { contact: true, user: { select: { name: true } }, sector: true }
        });

        const io: Server = req.app.locals.io;
        if (io) io.emit('ticket-updated', ticket);

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao transferir setor.' });
    }
});

// POST /tickets/:id/messages/:messageId/react
router.post('/:id/messages/:messageId/react', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const messageId = req.params.messageId as string;
        const { emoji } = req.body;
        const sock: WASocket = req.app.locals.sock;

        if (!sock) return res.status(500).json({ error: 'WhatsApp não conectado.' });

        const ticket = await prisma.ticket.findUnique({
            where: { id },
            include: { contact: true }
        });
        if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado.' });

        const message = await prisma.message.findUnique({
            where: { id: messageId }
        });
        if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });
        if (!message.messageId) return res.status(400).json({ error: 'Não é possível reagir a esta mensagem (sem ID nativo).' });

        const jid = ticket.contact.jid;

        await sock.sendMessage(jid, {
            react: {
                text: emoji,
                key: {
                    remoteJid: jid,
                    id: message.messageId,
                    fromMe: message.sender === 'Sistema' || message.sender === req.user!.name
                }
            }
        });

        await prisma.message.update({
            where: { id: message.id },
            data: { reaction: emoji || null }
        });

        const io: Server = req.app.locals.io;
        if (io) {
            io.emit('message-reaction', { messageId: message.messageId, ticketId: ticket.id, reaction: emoji || null });
        }

        res.json({ success: true, reaction: emoji });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao reagir à mensagem.' });
    }
});

// POST /tickets/:id/messages/:messageId/forward
router.post('/:id/messages/:messageId/forward', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string; // Target ticket
        const messageId = req.params.messageId as string;
        const sock: WASocket = req.app.locals.sock;

        if (!sock) return res.status(500).json({ error: 'WhatsApp não conectado.' });

        const targetTicket = await prisma.ticket.findUnique({ where: { id }, include: { contact: true } });
        if (!targetTicket) return res.status(404).json({ error: 'Ticket de destino não encontrado.' });

        const originalMsg = await prisma.message.findUnique({ where: { id: messageId } });
        if (!originalMsg) return res.status(404).json({ error: 'Mensagem não encontrada.' });
        if (!originalMsg.messageId) return res.status(400).json({ error: 'Não é possível encaminhar esta mensagem (sem ID nativo).' });

        const agentName = req.user!.name;
        
        let sentMsg: any;
        const jid = targetTicket.contact.jid;

        if (originalMsg.type === 'text') {
            const formattedContent = `*${agentName}* [Encaminhada]\n\n${originalMsg.content}`;
            sentMsg = await sock.sendMessage(jid, { text: formattedContent });
            
            const savedMessage = await prisma.message.create({
                data: {
                    ticketId: targetTicket.id,
                    messageId: sentMsg?.key.id || '',
                    type: 'text',
                    content: formattedContent,
                    sender: 'Sistema'
                }
            });
            
            const io: Server = req.app.locals.io;
            if (io) {
                io.emit('new-message', savedMessage);
                io.emit('ticket-updated', await prisma.ticket.update({ where: { id }, data: { unreadCount: 0 }, include: { contact: true } }));
            }
            return res.json(savedMessage);
        } else {
            const fileSource = originalMsg.mediaUrl || originalMsg.content;
            const filePath = path.join(process.cwd(), 'public', fileSource.replace('/uploads/', 'uploads/'));
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Arquivo de mídia não encontrado no servidor.' });
            }
            
            const buffer = fs.readFileSync(filePath);
            const formattedCaption = `*${agentName}* [Encaminhada]${originalMsg.content && !originalMsg.content.includes('/uploads/') ? '\n' + originalMsg.content : ''}`;
            
            let sendOptions: any = {};
            if (originalMsg.type === 'image') sendOptions = { image: buffer, caption: formattedCaption };
            else if (originalMsg.type === 'video') sendOptions = { video: buffer, caption: formattedCaption };
            else if (originalMsg.type === 'audio') sendOptions = { audio: buffer, mimetype: 'audio/ogg; codecs=opus' };
            else sendOptions = { document: buffer, mimetype: 'application/octet-stream', fileName: originalMsg.fileName || 'documento', caption: formattedCaption };
            
            sentMsg = await sock.sendMessage(jid, sendOptions);
            
            const savedMessage = await prisma.message.create({
                data: {
                    ticketId: targetTicket.id,
                    messageId: sentMsg?.key.id || '',
                    type: originalMsg.type,
                    content: originalMsg.content,
                    mediaUrl: originalMsg.mediaUrl,
                    fileName: originalMsg.fileName,
                    sender: 'Sistema'
                }
            });
            
            const io: Server = req.app.locals.io;
            if (io) {
                io.emit('new-message', savedMessage);
                io.emit('ticket-updated', await prisma.ticket.update({ where: { id }, data: { unreadCount: 0 }, include: { contact: true } }));
            }
            return res.json(savedMessage);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao encaminhar mensagem.' });
    }
});

// DELETE /tickets/:id/messages/:messageId
router.delete('/:id/messages/:messageId', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const messageId = req.params.messageId as string;
        const sock: WASocket = req.app.locals.sock;

        if (!sock) return res.status(500).json({ error: 'WhatsApp não conectado.' });

        const ticket = await prisma.ticket.findUnique({ where: { id }, include: { contact: true } });
        if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado.' });

        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });
        if (!message.messageId) return res.status(400).json({ error: 'Não é possível apagar esta mensagem (sem ID nativo).' });

        const jid = ticket.contact.jid;

        await sock.sendMessage(jid, { delete: { remoteJid: jid, id: message.messageId, fromMe: true } });

        await prisma.message.update({
            where: { id: messageId },
            data: { isDeleted: true }
        });

        const io: Server = req.app.locals.io;
        if (io) {
            io.emit('message-deleted', { ticketId: ticket.id, messageId: message.messageId });
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao apagar mensagem.' });
    }
});

// PUT /tickets/:id/messages/:messageId
router.put('/:id/messages/:messageId', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const messageId = req.params.messageId as string;
        const { newContent } = req.body;
        const sock: WASocket = req.app.locals.sock;

        if (!sock) return res.status(500).json({ error: 'WhatsApp não conectado.' });

        const ticket = await prisma.ticket.findUnique({ where: { id }, include: { contact: true } });
        if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado.' });

        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });
        if (!message.messageId) return res.status(400).json({ error: 'Não é possível editar esta mensagem (sem ID nativo).' });

        const agentName = req.user!.name;
        const formattedContent = `*${agentName}*\n${newContent}`;
        const jid = ticket.contact.jid;

        await sock.sendMessage(jid, { 
            text: formattedContent, 
            edit: { remoteJid: jid, id: message.messageId, fromMe: true } 
        });

        await prisma.message.update({
            where: { id: messageId },
            data: { content: formattedContent, isEdited: true }
        });

        const io: Server = req.app.locals.io;
        if (io) {
            io.emit('message-edited', { ticketId: ticket.id, messageId: message.messageId, content: formattedContent });
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao editar mensagem.' });
    }
});

// POST /tickets/:id/subscribe-presence
router.post('/:id/subscribe-presence', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const sock: WASocket = req.app.locals.sock;

        if (!sock) return res.status(500).json({ error: 'WhatsApp não conectado.' });

        const ticket = await prisma.ticket.findUnique({ where: { id }, include: { contact: true } });
        if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado.' });

        const jid = ticket.contact.jid;
        await sock.presenceSubscribe(jid);

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao subscrever presence.' });
    }
});

export default router;
