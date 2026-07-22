import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient({});
async function main() {
    const hashedPassword = await bcrypt.hash('123', 10);
    const user = await prisma.user.upsert({
        where: { email: 'admin@admin.com' },
        update: {},
        create: {
            email: 'admin@admin.com',
            name: 'Admin',
            password: hashedPassword,
            role: 'Admin',
        },
    });
    console.log('✅ Usuário Admin criado com sucesso!');
    console.log('Email:', user.email);
    console.log('Senha:', '123');
}
main()
    .catch(e => console.error(e))
    .finally(async () => {
    await prisma.$disconnect();
});
