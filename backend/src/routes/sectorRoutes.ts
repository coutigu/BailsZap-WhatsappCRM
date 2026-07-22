import { Router } from 'express';
import { prisma } from '../db';
import { verifyToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Middleware de Admin
const isAdmin = (req: AuthRequest, res: any, next: any) => {
    if (req.user?.role !== 'Admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    next();
};

// GET /api/sectors - Listar todos os setores
router.get('/', verifyToken, async (req: AuthRequest, res) => {
    try {
        const sectors = await prisma.sector.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(sectors);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar setores.' });
    }
});

// POST /api/sectors - Criar novo setor (apenas Admin)
router.post('/', verifyToken, isAdmin, async (req: AuthRequest, res) => {
    try {
        const { name, message } = req.body;
        if (!name || !message) {
            return res.status(400).json({ error: 'Nome do setor e mensagem de boas-vindas são obrigatórios.' });
        }

        const existing = await prisma.sector.findUnique({ where: { name } });
        if (existing) {
            return res.status(400).json({ error: 'Já existe um setor com este nome.' });
        }

        const sector = await prisma.sector.create({
            data: { name, message }
        });
        res.status(201).json(sector);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar setor.' });
    }
});

// PUT /api/sectors/:id - Atualizar setor (apenas Admin)
router.put('/:id', verifyToken, isAdmin, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { name, message } = req.body;

        if (!name || !message) {
            return res.status(400).json({ error: 'Nome do setor e mensagem de boas-vindas são obrigatórios.' });
        }

        const existing = await prisma.sector.findFirst({
            where: {
                name,
                id: { not: id }
            }
        });
        if (existing) {
            return res.status(400).json({ error: 'Já existe um outro setor com este nome.' });
        }

        const sector = await prisma.sector.update({
            where: { id },
            data: { name, message }
        });
        res.json(sector);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar setor.' });
    }
});

// DELETE /api/sectors/:id - Excluir setor (apenas Admin)
router.delete('/:id', verifyToken, isAdmin, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;

        // Verificar se há tickets ativos usando este setor
        const activeTickets = await prisma.ticket.findFirst({
            where: { sectorId: id, status: { in: ['Em espera', 'Em atendimento'] } }
        });
        if (activeTickets) {
            return res.status(400).json({ error: 'Não é possível excluir um setor que possui tickets ativos.' });
        }

        await prisma.sector.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir setor.' });
    }
});

export default router;
