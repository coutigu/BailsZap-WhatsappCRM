import { Router } from 'express';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

router.get('/status', verifyToken, (req: AuthRequest, res) => {
    const qr = req.app.locals.currentQR;
    const status = req.app.locals.connectionState || 'connecting';
    res.json({ status, qr });
});

// GET /whatsapp/group-meta/:jid
router.get('/group-meta/:jid', async (req, res) => {
    try {
        const sock = req.app.locals.sock;
        if (!sock) return res.status(500).json({ error: 'No sock' });
        const metadata = await sock.groupMetadata(req.params.jid);
        
        // Enrich participants with names from the database
        if (metadata && metadata.participants) {
            for (let i = 0; i < metadata.participants.length; i++) {
                const p = metadata.participants[i];
                const realJid = p.phoneNumber || p.id;
                
                const contact = await prisma.contact.findUnique({
                    where: { jid: realJid }
                });
                
                if (contact && contact.name && contact.name !== realJid.split('@')[0]) {
                    p.dbName = contact.name;
                    p.whatsappName = contact.whatsappName;
                }
            }
        }
        
        res.json(metadata);
    } catch(err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /whatsapp/sync-groups
router.get('/sync-groups', async (req, res) => {
    try {
        const sock = req.app.locals.sock;
        if (!sock) return res.status(500).json({ error: 'No sock' });
        
        const groups = await sock.groupFetchAllParticipating();
        let count = 0;
        
        for (const jid in groups) {
            const group = groups[jid];
            if (group.subject) {
                await prisma.contact.upsert({
                    where: { jid: group.id },
                    update: { name: group.subject },
                    create: { jid: group.id, name: group.subject, profilePicUrl: null }
                });
                count++;
            }
        }
        res.json({ message: 'Groups synced', count });
    } catch(err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /whatsapp/contact-info/:jid
router.get('/contact-info/:jid', async (req, res) => {
    try {
        const sock = req.app.locals.sock;
        if (!sock) return res.status(500).json({ error: 'No sock' });
        
        const jid = req.params.jid;
        
        let status = null;
        try {
            status = await sock.fetchStatus(jid);
        } catch (e) {
            // Ignore error if status doesn't exist
        }

        const groups = await sock.groupFetchAllParticipating();
        const commonGroups = [];
        
        for (const groupId in groups) {
            const group = groups[groupId];
            const participants = group.participants || [];
            const isParticipant = participants.some((p: any) => p.id === jid || p.phoneNumber === jid);
            if (isParticipant) {
                const groupContact = await prisma.contact.findUnique({
                    where: { jid: group.id }
                });
                commonGroups.push({ 
                    id: group.id, 
                    subject: group.subject,
                    profilePicUrl: groupContact?.profilePicUrl || null,
                    dbId: groupContact?.id || null
                });
            }
        }
        
        res.json({ status, commonGroups });
    } catch(err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
