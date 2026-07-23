# BeilsZap - v0.1.0

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/node-20%2B-green.svg" alt="Node">
  <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License">
  <img src="https://img.shields.io/badge/status-stable-brightgreen.svg" alt="Status">
</p>

<p align="center">
  <strong>Plataforma de atendimento multiagentes para WhatsApp</strong><br>
  Desenvolvida com React, Node.js, Prisma e Baileys.
</p>

---

## 📖 Sobre o Sistema

**BeilsZap** é uma plataforma completa de atendimento multiagentes para WhatsApp, projetada para equipes de suporte, vendas e relacionamento com clientes. Com uma interface moderna e intuitiva, permite gerenciar múltiplas conversas de WhatsApp, distribuir conversas entre agentes e acompanhar todo o histórico de atendimentos em tempo real.

---

## 🎯 Funcionalidades

- ✅ **Multiagentes** - Gerencie vários atendentes na mesma plataforma
- ✅ **Chat em tempo real** - Interface de conversação instantânea
- ✅ **Histórico completo** - Registro de todas as conversas e interações
- ✅ **Painel administrativo** - Controle total sobre usuários e permissões
- ✅ **QR Code dinâmico** - Conexão rápida via leitura de QR Code
- ✅ **Tema claro/escuro** - Adaptação automática ao tema do sistema
- ✅ **Responsivo** - Funciona perfeitamente em desktop, tablet e mobile
- ✅ **Notificações em tempo real** - Alertas de novas mensagens
- ✅ **Gerenciamento de contatos** - Organize e categorize seus clientes
- ✅ **Relatórios e métricas** - Acompanhe o desempenho da equipe

---

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **Prisma** - ORM para banco de dados
- **Baileys** - Biblioteca WhatsApp Web
- **SQLite** - Banco de dados leve e local
- **JWT** - Autenticação e autorização
- **TypeScript** - JavaScript com tipagem

### Frontend
- **React** - Biblioteca UI
- **TypeScript** - JavaScript com tipagem
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS utilitário
- **React Router** - Navegação entre páginas
- **Context API** - Gerenciamento de estado

---
<img width="1198" height="794" alt="Screenshot_1" src="https://github.com/user-attachments/assets/268fd13f-a233-440e-b314-e75e7473e744" />

## 📁 Estrutura do Projeto

```text
beilayszap/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma # Modelos do banco de dados
│   ├── src/
│   │   ├── controllers/ # Controladores da aplicação
│   │   ├── routes/ # Rotas da API
│   │   ├── services/ # Serviços e lógica de negócio
│   │   ├── middlewares/ # Middlewares (auth, etc)
│   │   ├── utils/ # Funções utilitárias
│   │   └── index.ts # Ponto de entrada do servidor
│   ├── .env # Variáveis de ambiente
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/ # Componentes reutilizáveis
│   │   ├── pages/ # Páginas da aplicação
│   │   ├── contexts/ # Contextos React (Theme, Auth)
│   │   ├── hooks/ # Hooks personalizados
│   │   ├── services/ # Serviços de API
│   │   ├── utils/ # Funções utilitárias
│   │   ├── styles/ # Estilos globais
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env # Variáveis de ambiente
│   ├── package.json
│   └── vite.config.ts
├── README.md
└── LICENSE
```

---

## 🚀 Tutorial de Instalação Completo

### 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 20 ou superior)
  - Baixe em: https://nodejs.org/
  - Verifique a instalação: `node --version`
- **Git** (opcional, para clonar o projeto)
  - Baixe em: https://git-scm.com/
- **WhatsApp** instalado no celular para leitura do QR Code

---

### Passo 1: Clonar o Projeto

Abra o terminal e execute:

```bash
# Clone o repositório
git clone https://github.com/coutigu/BailsZap-WhatsappCRM.git

# Entre na pasta do projeto
cd BailsZap-WhatsappCRM
```
*Ou baixe o arquivo ZIP e extraia na pasta desejada.*

---

### Passo 2: Configurar o Backend

#### 2.1 Acesse a pasta do backend
```bash
cd backend
```

#### 2.2 Instale as dependências
```bash
npm install
```

#### 2.3 Configure as variáveis de ambiente
Crie um arquivo `.env` na raiz da pasta `backend`:

```bash
# Crie o arquivo .env
touch .env   # Linux/macOS
# ou
type nul > .env   # Windows
```

Edite o arquivo `.env` com o seguinte conteúdo:

```env
PORT=3000
HOST=0.0.0.0
DATABASE_URL="file:./dev.db"
JWT_SECRET="sua_chave_super_secreta_aqui"
NODE_ENV="development"
```

> **Importante:**
> - `HOST=0.0.0.0` permite conexões externas na rede local
> - Substitua `sua_chave_super_secreta_aqui` por uma chave forte
> - O banco de dados SQLite será criado automaticamente

#### 2.4 Configure o banco de dados
```bash
# Cria as tabelas no banco de dados
npx prisma db push

# Cria o usuário admin padrão
npx tsx seed.ts
```

#### 2.5 Inicie o servidor
```bash
# Compila o TypeScript
npx tsc

# Inicia o servidor
npm start
```

**O que esperar:**
- O servidor iniciará na porta 3000
- Um QR Code será exibido no terminal
- Mantenha este terminal aberto e em execução

#### 2.6 Conectar o WhatsApp
1. Abra o WhatsApp no seu celular
2. Toque em "Conectar dispositivo" ou "Linked Devices"
3. Aponte a câmera para o QR Code exibido no terminal
4. Aguarde a confirmação de conexão

⚠️ *Mantenha o celular próximo ao computador e com internet ativa durante o processo.*

---

### Passo 3: Configurar o Frontend

#### 3.1 Abra um novo terminal
Mantenha o terminal do backend rodando e abra um novo terminal para o frontend.

#### 3.2 Acesse a pasta do frontend
```bash
cd frontend
```

#### 3.3 Instale as dependências
```bash
npm install
```

#### 3.4 Configure as variáveis de ambiente
Crie um arquivo `.env` na raiz da pasta `frontend`:

```bash
# Crie o arquivo .env
touch .env   # Linux/macOS
# ou
type nul > .env   # Windows
```

Edite o arquivo `.env`:

```env
VITE_API_URL=http://localhost:3000
```

Para acessar de outros dispositivos na rede:
- Descubra seu IP local (veja o Passo 4 abaixo)
- Substitua `localhost` pelo seu IP:

```env
VITE_API_URL=http://192.168.1.15:3000
```

#### 3.5 Inicie o frontend
```bash
npm run dev -- --host 0.0.0.0
```

**O que esperar:**
- O frontend iniciará na porta 5173
- Você verá a mensagem: `Local: http://localhost:5173/`
- Também verá: `Network: http://192.168.1.15:5173/`

---

### Passo 4: Descobrir seu IP Local

Para acessar o sistema de outros dispositivos na rede, você precisa do IP da máquina.

#### Windows
```bash
# Abra o PowerShell ou CMD
ipconfig
```
Procure por **Endereço IPv4** (ex: `192.168.1.15`)

#### Linux / macOS
```bash
# No terminal
ifconfig
# ou
ip a
```
Procure por **inet** (ex: `192.168.1.15`)

---

### Passo 5: Acessar o Sistema

#### Localmente (na mesma máquina)
Abra o navegador e acesse:
```text
http://localhost:5173
```

#### Em outros dispositivos (rede local)
Em qualquer dispositivo conectado ao mesmo Wi-Fi, abra o navegador e acesse:
```text
http://192.168.1.15:5173
```
*(Substitua `192.168.1.15` pelo seu IP real)*

---

## 🔑 Credenciais Padrão

Ao acessar o sistema pela primeira vez, utilize estas credenciais:

| Campo | Valor |
| :--- | :--- |
| **E-mail** | `admin@admin.com` |
| **Senha** | `123` |

**Após o primeiro acesso:**
1. Clique no ícone de engrenagem ⚙️ no menu lateral
2. Acesse "Meu Perfil"
3. Altere seu nome, e-mail e senha
4. Clique em "Salvar"

---

## 💡 Dicas e Soluções de Problemas

#### O QR Code não aparece?
- Verifique se o servidor backend está rodando
- Aguarde alguns segundos após iniciar o backend
- Certifique-se de que a porta 3000 está livre

#### Não consigo acessar de outro dispositivo?
- Verifique se o firewall permite conexões nas portas 3000 e 5173
- Confirme que usou o IP correto (Passo 4)
- Certifique-se de que todos os dispositivos estão na mesma rede Wi-Fi
- Verifique se o frontend foi iniciado com `--host 0.0.0.0`

#### Erro de conexão com banco de dados?
- Execute `npx prisma db push` novamente
- Verifique se o arquivo `dev.db` existe na pasta `backend/prisma/`
- Confirme que o `.env` contém `DATABASE_URL="file:./dev.db"`

#### WhatsApp desconecta?
- O Baileys mantém a sessão ativa
- Se desconectar, reinicie o backend e escaneie o QR Code novamente
- A sessão é salva no banco de dados SQLite

---

## 📄 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para mais detalhes.
