import { Router } from 'express';
import { prisma } from '../db';
import { verifyToken } from '../middleware/auth';

const router = Router();

// GET /settings
router.get('/', verifyToken, async (req, res) => {
    try {
        const settings = await prisma.setting.findMany();
        // Return as a key-value object
        const settingsMap = settings.reduce((acc: any, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {});
        res.json(settingsMap);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /settings
router.post('/', verifyToken, async (req, res) => {
    try {
        const updates = req.body; // Expects an object { key: value }
        for (const key in updates) {
            const value = String(updates[key]);
            await prisma.setting.upsert({
                where: { key },
                update: { value },
                create: { key, value }
            });
        }
        res.json({ message: 'Settings updated successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
