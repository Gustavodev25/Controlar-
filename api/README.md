# Controlar API (Backend)

Este é o backend da aplicação Controlar, configurado para deploy no Railway.

## 🚀 Deploy no Railway

### Passo 1: Configurar o Railway

1. Acesse [railway.app](https://railway.app) e faça login
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Escolha o repositório `Controlar-`
5. **IMPORTANTE**: Configure o Root Directory como `api`

### Passo 2: Configurar Root Directory

No Railway, vá em **Settings** do seu serviço e configure:
- **Root Directory**: `api`

### Passo 3: Adicionar Variáveis de Ambiente

No Railway, vá em **Variables** e adicione:

```
NODE_ENV=production
FIREBASE_SERVICE_ACCOUNT=<seu JSON do Firebase Admin como string>
PLUGGY_CLIENT_ID=<seu client id>
PLUGGY_CLIENT_SECRET=<seu client secret>
PLUGGY_WEBHOOK_URL=https://SEU_RAILWAY_URL.railway.app/api/pluggy/webhook
ASAAS_API_KEY=<sua chave>
GEMINI_API_KEY=<sua chave>
ANTHROPIC_API_KEY=<sua chave>
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<seu email>
SMTP_PASS=<sua senha>
SMTP_FROM=<email de envio>
```

### Passo 4: Deploy

O Railway vai detectar automaticamente o `package.json` e fazer o deploy.

Após o deploy, você terá uma URL como `https://controlar-api-production.up.railway.app`

### Passo 5: Atualizar Frontend

No frontend (Vercel), adicione a variável de ambiente:
```
VITE_API_URL=https://SEU_RAILWAY_URL.railway.app/api
```

## 📁 Estrutura

```
api/
├── server.js        # Entry point para Railway
├── index.js         # Entry point para Vercel (serverless)
├── routes.js        # Rotas principais (Asaas, Email, etc)
├── pluggy.js        # Rotas do Pluggy
├── gemini.js        # Rotas da AI Gemini
├── claude.js        # Rotas da AI Claude
├── firebaseAdmin.js # Inicialização do Firebase Admin
├── env.js           # Carregamento de variáveis de ambiente
└── package.json     # Dependências do backend
```

## 🔧 Desenvolvimento Local

```bash
cd api
npm install
npm run dev
```

O servidor vai rodar em `http://localhost:3001`

## ✅ Health Check

Endpoint: `GET /health`

Resposta:
```json
{
  "status": "ok",
  "timestamp": "2024-12-26T14:30:00.000Z",
  "env": "production"
}
```
