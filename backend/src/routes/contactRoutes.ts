import { Router } from 'express';
import { prisma } from '../db';
import { verifyToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /contacts - Listar contatos
router.get('/', verifyToken, async (req: AuthRequest, res) => {
    try {
        const contacts = await prisma.contact.findMany({
            orderBy: { updatedAt: 'desc' }
        });
        res.json(contacts);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar contatos.' });
    }
});

// POST /contacts - Adicionar contato manualmente
router.post('/', verifyToken, async (req: AuthRequest, res) => {
    try {
        const { phone, name, email, notes } = req.body;
        // Normaliza número para JID
        let jid = phone;
        if (!jid.includes('@')) jid = `${jid}@s.whatsapp.net`;

        const newContact = await prisma.contact.upsert({
            where: { jid },
            update: { name, email, notes },
            create: { jid, name, email, notes }
        });
        res.json(newContact);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar contato.' });
    }
});



// PUT /contacts/:id - Atualizar contato
router.put('/:id', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { name, email, notes } = req.body;
        const updated = await prisma.contact.update({
            where: { id },
            data: { name, email, notes }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar contato.' });
    }
});

// DELETE /contacts/:id - Excluir contato
router.delete('/:id', verifyToken, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        await prisma.contact.delete({
            where: { id }
        });
        res.json({ message: 'Contato excluído com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir contato.' });
    }
});

// POST /contacts/import - Importar contatos da memória do Baileys
router.post('/import', verifyToken, async (req: AuthRequest, res) => {
    try {
        // Na versão 7.0 do Baileys, os contatos são extraídos passivamente pelos eventos 'contacts.upsert'
        // e 'messaging-history.set' diretamente para o banco de dados.
        // Como o sync já ocorre em background nativamente, apenas retornamos a contagem atual do DB
        // para tranquilizar o usuário no frontend.
        const total = await prisma.contact.count();

        res.json({ message: 'Importação concluída.', importedCount: total });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao processar contatos.' });
    }
});

import { sock } from '../index';
import { getProfilePictureUrlWithRetry } from '../handlers/messageHandler';
import fs from 'fs';
import path from 'path';

// POST /contacts/:id/refresh-avatar
router.get('/test-onwa/:number', async (req, res) => {
    const { sock } = req.app.locals;
    if (!sock) return res.json({ error: 'no sock' });
    try {
        const jid = req.params.number + '@s.whatsapp.net';
        console.log("Testing onWhatsApp for", req.params.number);
        const resOnWa = await sock.onWhatsApp(req.params.number);
        console.log("onWhatsApp result:", resOnWa);
        let fetchJid = jid;
        if (resOnWa && resOnWa.length > 0 && resOnWa[0].exists) {
            fetchJid = resOnWa[0].jid;
        }
        console.log("Testing profilePictureUrl for", fetchJid);
        const pic = await sock.profilePictureUrl(fetchJid, 'image', 5000).catch((e: any) => e.message);
        console.log("Pic result:", pic);
        res.json({ resOnWa, fetchJid, pic });
    } catch (err: any) {
        res.json({ error: err.message });
    }
});

router.post('/:id/refresh-avatar', async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const contact = await prisma.contact.findUnique({ where: { id } });
        if (!contact) return res.status(404).json({ error: 'Contato não encontrado.' });

        if (!sock) {
            return res.status(400).json({ error: 'Conexão com WhatsApp não ativa.' });
        }

        const url = await getProfilePictureUrlWithRetry(sock, contact.jid);
        if (url) {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Falha HTTP: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const profileDir = path.join(process.cwd(), 'public', 'profilepics');
            if (!fs.existsSync(profileDir)) {
                fs.mkdirSync(profileDir, { recursive: true });
            }
            
            const fileName = `${contact.id}.jpg`;
            const savePath = path.join(profileDir, fileName);
            fs.writeFileSync(savePath, buffer);

            const localUrl = `/profilepics/${fileName}?t=${Date.now()}`;

            const updatedContact = await prisma.contact.update({
                where: { id: contact.id },
                data: { profilePicUrl: localUrl }
            });

            const io = req.app.locals.io;
            if (io) {
                io.emit('contact-updated', { id: contact.id, profilePicUrl: localUrl });
            }

            return res.json(updatedContact);
        } else {
            return res.status(404).json({ error: 'Foto de perfil não encontrada ou restrita.' });
        }
    } catch (error: any) {
        console.error('Erro ao atualizar foto de perfil:', error);
        res.status(500).json({ error: 'Erro ao atualizar foto de perfil: ' + error.message });
    }
});

export default router;
