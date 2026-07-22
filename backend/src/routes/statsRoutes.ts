import { Router } from 'express';
import { prisma } from '../db';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/', verifyToken, async (req, res) => {
    try {
        const totalTickets = await prisma.ticket.count();
        
        const ticketsByStatusRaw = await prisma.ticket.groupBy({
            by: ['status'],
            _count: {
                id: true
            }
        });
        
        const ticketsByStatus = ticketsByStatusRaw.reduce((acc, curr) => {
            acc[curr.status] = curr._count.id;
            return acc;
        }, {} as Record<string, number>);

        const ticketsBySectorRaw = await prisma.ticket.findMany({
            where: { sectorId: { not: null } },
            include: { sector: true }
        });
        
        const ticketsBySector: Record<string, number> = {};
        for (const ticket of ticketsBySectorRaw) {
            const sectorName = ticket.sector?.name || 'Sem setor';
            ticketsBySector[sectorName] = (ticketsBySector[sectorName] || 0) + 1;
        }

        const ticketsByUserRaw = await prisma.ticket.findMany({
            where: { userId: { not: null } },
            include: { user: true }
        });

        const ticketsByUser: Record<string, number> = {};
        const ticketsByUserByMonth: Record<string, Record<string, number>> = {};
        
        for (const ticket of ticketsByUserRaw) {
            const userName = ticket.user?.name || 'Desconhecido';
            ticketsByUser[userName] = (ticketsByUser[userName] || 0) + 1;
            
            const monthStr = ticket.createdAt.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
            if (!ticketsByUserByMonth[monthStr]) ticketsByUserByMonth[monthStr] = {};
            ticketsByUserByMonth[monthStr][userName] = (ticketsByUserByMonth[monthStr][userName] || 0) + 1;
        }

        const resolvedTickets = await prisma.ticket.findMany({
            where: { status: 'Finalizado' },
            select: { createdAt: true, updatedAt: true }
        });

        let totalMinutes = 0;
        resolvedTickets.forEach(t => {
            const diffMs = t.updatedAt.getTime() - t.createdAt.getTime();
            totalMinutes += diffMs / (1000 * 60);
        });
        
        const averageResolutionTimeMinutes = resolvedTickets.length > 0 
            ? Math.round(totalMinutes / resolvedTickets.length) 
            : 0;

        const totalContacts = await prisma.contact.count();
        const totalMessages = await prisma.message.count();
        
        const messagesBySenderRaw = await prisma.message.groupBy({
            by: ['sender'],
            _count: { id: true }
        });
        const messagesBySender = messagesBySenderRaw.reduce((acc, curr) => {
            acc[curr.sender] = curr._count.id;
            return acc;
        }, {} as Record<string, number>);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentTicketsRaw = await prisma.ticket.findMany({
            where: { createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true, user: { select: { name: true } } }
        });
        
        const ticketsByDate: Record<string, Record<string, number>> = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            ticketsByDate[d.toLocaleDateString('pt-BR')] = { Total: 0 };
        }
        recentTicketsRaw.forEach(t => {
            const dateStr = t.createdAt.toLocaleDateString('pt-BR');
            if (ticketsByDate[dateStr] !== undefined) {
                ticketsByDate[dateStr].Total++;
                if (t.user?.name) {
                    const userName = t.user.name;
                    ticketsByDate[dateStr][userName] = (ticketsByDate[dateStr][userName] || 0) + 1;
                } else {
                    ticketsByDate[dateStr]['Desconhecido'] = (ticketsByDate[dateStr]['Desconhecido'] || 0) + 1;
                }
            }
        });

        res.json({
            totalTickets,
            ticketsByStatus,
            ticketsBySector,
            ticketsByUser,
            averageResolutionTimeMinutes,
            totalContacts,
            totalMessages,
            messagesBySender,
            ticketsByDate,
            ticketsByUserByMonth
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
    }
});

export default router;
