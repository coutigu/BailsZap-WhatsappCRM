import { Router } from 'express';
import { prisma } from '../db';
import { verifyToken, AuthRequest } from '../middleware/auth';
import bcrypt from 'bcrypt';

const router = Router();

// Middleware de Admin
const isAdmin = (req: AuthRequest, res: any, next: any) => {
    if (req.user?.role !== 'Admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    next();
};

// PUT /api/users/profile - Atualizar próprio perfil
router.put('/profile', verifyToken, async (req: AuthRequest, res) => {
    try {
        const { name, email, password } = req.body;
        const id = req.user!.id;
        
        const updateData: any = { name, email };
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            select: { id: true, name: true, email: true, role: true }
        });
        res.json(user);
    } catch (error) {
        console.error('Erro no /profile:', error);
        res.status(500).json({ error: 'Erro ao atualizar perfil.' });
    }
});

// GET /api/users/list - Listar usuários básico (para todos logados)
router.get('/list', verifyToken, async (req: AuthRequest, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar usuários.' });
    }
});

// GET /api/users - Listar todos os usuários (Admin)
router.get('/', verifyToken, isAdmin, async (req: AuthRequest, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar usuários.' });
    }
});

// POST /api/users - Criar usuário
router.post('/', verifyToken, isAdmin, async (req: AuthRequest, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ error: 'Email já cadastrado.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = await prisma.user.create({
            data: { name, email, password: hashedPassword, role: role || 'Atendente' },
            select: { id: true, name: true, email: true, role: true }
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar usuário.' });
    }
});

// PUT /api/users/:id - Atualizar usuário
router.put('/:id', verifyToken, isAdmin, async (req: AuthRequest, res) => {
    try {
        const { name, email, password, role } = req.body;
        const id = req.params.id as string;
        
        const updateData: any = { name, email, role };
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            select: { id: true, name: true, email: true, role: true }
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar usuário.' });
    }
});

// DELETE /api/users/:id - Excluir usuário
router.delete('/:id', verifyToken, isAdmin, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        // Não permitir deletar a si mesmo
        if (id === req.user?.id) {
            return res.status(400).json({ error: 'Você não pode excluir sua própria conta.' });
        }
        await prisma.user.delete({ where: { id } });
        res.json({ message: 'Usuário excluído com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir usuário.' });
    }
});

export default router;
