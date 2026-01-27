import express from 'express';
import axios from 'axios';
import { firebaseAdmin } from './firebaseAdmin.js';
import { loadEnv } from './env.js';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from "@anthropic-ai/sdk";

loadEnv();

const router = express.Router();

// Anthropic API Key for AI detection
const getAnthropicApiKey = () => (process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || "").trim();

// ============================================================
// SUBSCRIPTION DETECTION SYSTEM
// Lista de serviços de assinatura conhecidos para detecção automática
// ============================================================
const SUBSCRIPTION_KEYWORDS = [
    // Streaming de Vídeo
    { key: 'netflix', name: 'Netflix', category: 'Lazer' },
    { key: 'amazon prime', name: 'Amazon Prime', category: 'Lazer' },
    { key: 'prime video', name: 'Amazon Prime', category: 'Lazer' },
    { key: 'hbo', name: 'HBO Max', category: 'Lazer' },
    { key: 'max', name: 'HBO Max', category: 'Lazer' },
    { key: 'disney', name: 'Disney+', category: 'Lazer' },
    { key: 'star+', name: 'Star+', category: 'Lazer' },
    { key: 'globoplay', name: 'Globoplay', category: 'Lazer' },
    { key: 'globo', name: 'Globoplay', category: 'Lazer' },
    { key: 'paramount', name: 'Paramount+', category: 'Lazer' },
    { key: 'mubi', name: 'Mubi', category: 'Lazer' },
    { key: 'telecine', name: 'Telecine', category: 'Lazer' },
    { key: 'discovery', name: 'Discovery+', category: 'Lazer' },
    { key: 'crunchyroll', name: 'Crunchyroll', category: 'Lazer' },
    { key: 'apple tv', name: 'Apple TV+', category: 'Lazer' },
    { key: 'starz', name: 'Starzplay', category: 'Lazer' },

    // Streaming de Música
    { key: 'spotify', name: 'Spotify', category: 'Lazer' },
    { key: 'deezer', name: 'Deezer', category: 'Lazer' },
    { key: 'tidal', name: 'Tidal', category: 'Lazer' },
    { key: 'apple music', name: 'Apple Music', category: 'Lazer' },
    { key: 'youtube music', name: 'YouTube Music', category: 'Lazer' },
    { key: 'amazon music', name: 'Amazon Music', category: 'Lazer' },

    // YouTube Premium
    { key: 'youtube', name: 'YouTube Premium', category: 'Lazer' },

    // Cloud & Storage
    { key: 'icloud', name: 'iCloud', category: 'Tecnologia' },
    { key: 'google one', name: 'Google One', category: 'Tecnologia' },
    { key: 'google storage', name: 'Google One', category: 'Tecnologia' },
    { key: 'dropbox', name: 'Dropbox', category: 'Tecnologia' },
    { key: 'onedrive', name: 'OneDrive', category: 'Tecnologia' },

    // AI & Tools
    { key: 'chatgpt', name: 'ChatGPT', category: 'Tecnologia' },
    { key: 'openai', name: 'ChatGPT Plus', category: 'Tecnologia' },
    { key: 'claude', name: 'Claude AI', category: 'Tecnologia' },
    { key: 'anthropic', name: 'Claude AI', category: 'Tecnologia' },
    { key: 'midjourney', name: 'Midjourney', category: 'Tecnologia' },
    { key: 'copilot', name: 'GitHub Copilot', category: 'Tecnologia' },
    { key: 'notion', name: 'Notion', category: 'Tecnologia' },
    { key: 'figma', name: 'Figma', category: 'Trabalho' },

    // Work & Productivity
    { key: 'adobe', name: 'Adobe Creative Cloud', category: 'Trabalho' },
    { key: 'canva', name: 'Canva Pro', category: 'Trabalho' },
    { key: 'microsoft 365', name: 'Microsoft 365', category: 'Trabalho' },
    { key: 'microsoft', name: 'Microsoft 365', category: 'Trabalho' },
    { key: 'office 365', name: 'Microsoft 365', category: 'Trabalho' },
    { key: 'zoom', name: 'Zoom', category: 'Trabalho' },
    { key: 'slack', name: 'Slack', category: 'Trabalho' },
    { key: 'trello', name: 'Trello', category: 'Trabalho' },
    { key: 'asana', name: 'Asana', category: 'Trabalho' },
    { key: 'monday', name: 'Monday.com', category: 'Trabalho' },

    // Gaming (Subscriptions only - not game stores)
    { key: 'psn', name: 'PlayStation Plus', category: 'Lazer' },
    { key: 'playstation', name: 'PlayStation Plus', category: 'Lazer' },
    { key: 'xbox', name: 'Xbox Game Pass', category: 'Lazer' },
    { key: 'game pass', name: 'Xbox Game Pass', category: 'Lazer' },
    { key: 'nintendo', name: 'Nintendo Switch Online', category: 'Lazer' },
    { key: 'ea play', name: 'EA Play', category: 'Lazer' },
    { key: 'ubisoft+', name: 'Ubisoft+', category: 'Lazer' },
    // Note: Steam and Epic Games are game STORES, not subscriptions

    // Education
    { key: 'duolingo', name: 'Duolingo', category: 'Educação' },
    { key: 'alura', name: 'Alura', category: 'Educação' },
    { key: 'udemy', name: 'Udemy', category: 'Educação' },
    { key: 'coursera', name: 'Coursera', category: 'Educação' },
    { key: 'skillshare', name: 'Skillshare', category: 'Educação' },
    { key: 'linkedin learning', name: 'LinkedIn Learning', category: 'Educação' },
    { key: 'masterclass', name: 'MasterClass', category: 'Educação' },
    { key: 'domestika', name: 'Domestika', category: 'Educação' },
    { key: 'platzi', name: 'Platzi', category: 'Educação' },
    { key: 'rocketseat', name: 'Rocketseat', category: 'Educação' },

    // Health & Fitness
    { key: 'gympass', name: 'Gympass', category: 'Saúde' },
    { key: 'wellhub', name: 'Wellhub (Gympass)', category: 'Saúde' },
    { key: 'totalpass', name: 'TotalPass', category: 'Saúde' },
    { key: 'smartfit', name: 'Smart Fit', category: 'Saúde' },
    { key: 'bluefit', name: 'Bluefit', category: 'Saúde' },
    { key: 'bodytech', name: 'Bodytech', category: 'Saúde' },
    { key: 'strava', name: 'Strava', category: 'Saúde' },
    { key: 'calm', name: 'Calm', category: 'Saúde' },
    { key: 'headspace', name: 'Headspace', category: 'Saúde' },
    { key: 'meditopia', name: 'Meditopia', category: 'Saúde' },

    // News & Reading
    { key: 'kindle', name: 'Kindle Unlimited', category: 'Lazer' },
    { key: 'audible', name: 'Audible', category: 'Lazer' },
    { key: 'scribd', name: 'Scribd', category: 'Lazer' },
    { key: 'uol', name: 'UOL', category: 'Lazer' },
    { key: 'estadao', name: 'Estadão', category: 'Lazer' },
    { key: 'folha', name: 'Folha de S.Paulo', category: 'Lazer' },
    { key: 'o globo', name: 'O Globo', category: 'Lazer' },

    // VPN & Security
    { key: 'nordvpn', name: 'NordVPN', category: 'Tecnologia' },
    { key: 'expressvpn', name: 'ExpressVPN', category: 'Tecnologia' },
    { key: 'surfshark', name: 'Surfshark', category: 'Tecnologia' },
    { key: '1password', name: '1Password', category: 'Tecnologia' },
    { key: 'lastpass', name: 'LastPass', category: 'Tecnologia' },
    { key: 'bitwarden', name: 'Bitwarden', category: 'Tecnologia' },
    { key: 'dashlane', name: 'Dashlane', category: 'Tecnologia' },

    // Food & Delivery
    { key: 'ifood', name: 'iFood Club', category: 'Alimentação' },
    { key: 'rappi', name: 'Rappi Prime', category: 'Alimentação' },

    // Dating & Social
    { key: 'tinder', name: 'Tinder', category: 'Lazer' },
    { key: 'bumble', name: 'Bumble', category: 'Lazer' },
    { key: 'twitter', name: 'Twitter/X Premium', category: 'Lazer' },
    { key: 'reddit', name: 'Reddit Premium', category: 'Lazer' },

    // Other Services
    { key: 'apple', name: 'Apple Services', category: 'Tecnologia' },
    { key: 'google play', name: 'Google Play', category: 'Tecnologia' },
    { key: 'patreon', name: 'Patreon', category: 'Lazer' },
    { key: 'twitch', name: 'Twitch', category: 'Lazer' },
    { key: 'discord', name: 'Discord Nitro', category: 'Lazer' },
];

/**
 * Detecta se uma transação é uma assinatura conhecida
 * @param {string} description - Descrição da transação
 * @param {string} [originalCategory] - Categoria original (opcional)
 * @returns {{ isSubscription: boolean, name?: string, category?: string }}
 */
const detectSubscriptionService = (description, originalCategory) => {
    if (!description) return { isSubscription: false };

    const lowerDesc = description.toLowerCase();

    for (const service of SUBSCRIPTION_KEYWORDS) {
        if (lowerDesc.includes(service.key)) {
            return {
                isSubscription: true,
                name: service.name,
                category: service.category
            };
        }
    }

    return { isSubscription: false };
};

// ============================================================
// INTELLIGENT SUBSCRIPTION DETECTION
// Detecção heurística para assinaturas não listadas
// ============================================================

// Palavras-chave genéricas que indicam assinatura
const GENERIC_SUBSCRIPTION_KEYWORDS = [
    'assinatura', 'subscription', 'mensal', 'monthly', 'recorrente',
    'recorrencia', 'plano', 'premium', 'plus', 'pro', 'annual', 'anual',
    'renovacao', 'renewal', 'membership', 'mensalidade'
];

/**
 * Detecta se uma transação parece ser uma assinatura por heurísticas
 * @param {string} description - Descrição da transação
 * @returns {{ isLikelySubscription: boolean, detectedName?: string }}
 */
const detectLikelySubscription = (description) => {
    if (!description) return { isLikelySubscription: false };

    const lowerDesc = description.toLowerCase();

    // 1. Verificar palavras-chave genéricas
    for (const keyword of GENERIC_SUBSCRIPTION_KEYWORDS) {
        if (lowerDesc.includes(keyword)) {
            // Tentar extrair o nome do serviço (antes ou depois da palavra-chave)
            const cleanedName = extractServiceName(description);
            return {
                isLikelySubscription: true,
                detectedName: cleanedName || description.slice(0, 50)
            };
        }
    }

    return { isLikelySubscription: false };
};

/**
 * Extrai o nome do serviço de uma descrição de transação
 * @param {string} description - Descrição completa
 * @returns {string} Nome extraído e limpo
 */
const extractServiceName = (description) => {
    if (!description) return '';

    // Remover prefixos comuns de cartão
    let cleaned = description
        .replace(/^(pag\*|pagseguro\*|mp\*|mercadopago\*|paypal\*|stripe\*|pix\s)/i, '')
        .replace(/\s*(assinatura|subscription|mensal|monthly|plano)\s*/gi, ' ')
        .trim();

    // Pegar as primeiras palavras significativas (máx 3)
    const words = cleaned.split(/[\s\-\_\*\/]+/).filter(w => w.length > 2);
    const nameWords = words.slice(0, 3).join(' ');

    return nameWords || cleaned.slice(0, 30);
};

/**
 * Analisa transações para encontrar padrões de recorrência
 * @param {Array} transactions - Lista de transações
 * @returns {Map} Mapa de assinaturas detectadas por padrão
 */
const detectRecurringPatterns = (transactions) => {
    const patternMap = new Map(); // normalizedDesc -> { count, amounts, dates }
    const detectedRecurring = new Map();

    // Agrupar transações por descrição normalizada
    for (const tx of transactions) {
        if (tx.amount >= 0) continue; // Pular receitas

        // Normalizar descrição para agrupar variações
        const normalized = normalizeDescription(tx.description);
        const amount = Math.abs(tx.amount);

        if (!patternMap.has(normalized)) {
            patternMap.set(normalized, {
                count: 0,
                amounts: [],
                dates: [],
                originalDesc: tx.description
            });
        }

        const entry = patternMap.get(normalized);
        entry.count++;
        entry.amounts.push(amount);
        entry.dates.push(tx.date);
    }

    // Identificar padrões recorrentes (aparece 2+ vezes com valor similar)
    for (const [normalized, data] of patternMap) {
        if (data.count >= 2) {
            // Verificar se os valores são similares (variação até 10%)
            const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length;
            const allSimilar = data.amounts.every(amt =>
                Math.abs(amt - avgAmount) / avgAmount < 0.10
            );

            if (allSimilar) {
                // Verificar se as datas têm padrão mensal
                const sortedDates = data.dates.sort();
                const hasMonthlyPattern = checkMonthlyPattern(sortedDates);

                if (hasMonthlyPattern || data.count >= 3) {
                    const cleanName = extractServiceName(data.originalDesc);
                    detectedRecurring.set(cleanName, {
                        name: cleanName,
                        amount: avgAmount,
                        category: 'Outros', // Categoria genérica para desconhecidos
                        occurrences: data.count,
                        source: 'pattern_detection',
                        chargeDay: new Date(sortedDates[sortedDates.length - 1]).getDate() // Use day of most recent transaction
                    });
                }
            }
        }
    }

    return detectedRecurring;
};

/**
 * Normaliza descrição para comparação
 */
const normalizeDescription = (desc) => {
    if (!desc) return '';
    return desc
        .toLowerCase()
        .replace(/\d{2}\/\d{2}/g, '') // Remove datas tipo 01/12
        .replace(/\d+x/gi, '')        // Remove parcelas tipo 3x
        .replace(/[^\w\s]/g, '')      // Remove caracteres especiais
        .replace(/\s+/g, ' ')         // Normaliza espaços
        .trim();
};

/**
 * Verifica se as datas formam um padrão mensal
 */
const checkMonthlyPattern = (sortedDates) => {
    if (sortedDates.length < 2) return false;

    // Verificar se há intervalo de aproximadamente 1 mês entre transações
    for (let i = 1; i < sortedDates.length; i++) {
        const d1 = new Date(sortedDates[i - 1]);
        const d2 = new Date(sortedDates[i]);
        const daysDiff = Math.abs((d2 - d1) / (1000 * 60 * 60 * 24));

        // Considerar mensal se o intervalo é entre 25 e 35 dias
        if (daysDiff >= 25 && daysDiff <= 35) {
            return true;
        }
    }

    return false;
};

// ============================================================
// AI-POWERED SUBSCRIPTION DETECTION (Claude)
// Usa IA para identificar assinaturas que não estão na lista conhecida
// ============================================================

/**
 * Detecta assinaturas usando Claude AI
 * @param {Array} transactions - Lista de transações para analisar
 * @returns {Promise<Array>} - Lista de assinaturas detectadas pela IA
 */
const detectSubscriptionsWithAI = async (transactions) => {
    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
        console.log('[AI-Detection] ⚠️ No Anthropic API key, skipping AI detection');
        return [];
    }

    // Filtrar apenas transações de despesa e pegar uma amostra representativa
    const expenseTransactions = transactions
        .filter(tx => tx.amount < 0)
        .slice(0, 100) // Limitar para não exceder tokens
        .map(tx => ({
            description: enrichTransactionDescription(tx),
            amount: Math.abs(tx.amount),
            date: tx.date
        }));

    if (expenseTransactions.length === 0) {
        return [];
    }

    const client = new Anthropic({ apiKey });

    const prompt = `Analise as seguintes transações bancárias e identifique APENAS as que são assinaturas recorrentes (serviços que cobram mensalmente/anualmente).

TRANSAÇÕES:
${JSON.stringify(expenseTransactions, null, 2)}

REGRAS:
1. Identificar APENAS serviços de assinatura recorrente (streaming, software, academia, apps, etc)
2. NÃO incluir compras avulsas (mercado, restaurante, loja, combustível)
3. NÃO incluir compras em lojas de jogos (Steam, Epic Games, etc) - only subscriptions
4. Para cada assinatura detectada, fornecer:
   - name: Nome padronizado do serviço
   - amount: Valor mais recente
   - category: Uma de [Lazer, Tecnologia, Trabalho, Educação, Saúde, Alimentação, Outros]

RESPONDA APENAS em JSON válido no formato:
{"subscriptions": [{"name": "Serviço", "amount": 29.90, "category": "Lazer"}]}

Se não encontrar nenhuma assinatura, responda: {"subscriptions": []}`;

    try {
        console.log(`[AI-Detection] 🤖 Analyzing ${expenseTransactions.length} transactions with Claude AI...`);

        const response = await client.messages.create({
            model: 'claude-3-haiku-20240307', // Verified working model
            max_tokens: 1024,
            temperature: 0.1,
            system: 'Você é um especialista em identificar assinaturas e serviços recorrentes em extratos bancários. Seja preciso e retorne APENAS JSON válido.',
            messages: [{ role: 'user', content: prompt }]
        });

        const text = response.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');

        console.log('[AI-Detection] 🔍 Raw AI Response:', text);

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            const detected = result.subscriptions || [];
            console.log(`[AI-Detection] 🎯 AI found ${detected.length} potential subscriptions:`, JSON.stringify(detected));
            return detected.map(sub => ({
                ...sub,
                source: 'ai_detected'
            }));
        }
        return [];
    } catch (error) {
        console.error('[AI-Detection] ❌ Error calling Anthropic API:', error.message);
        if (error.status === 401) console.error('[AI-Detection] 🔑 Check your ANTHROPIC_API_KEY');
        return [];
    }
};

/**
 * Cria uma assinatura no Firestore se não existir
 * OU atualiza assinaturas existentes sem o campo 'source' para marcá-las como auto_detected
 * @param {FirebaseFirestore.Firestore} db - Instância do Firestore
 * @param {string} userId - ID do usuário
 * @param {object} subscriptionData - Dados da assinatura
 */
const createSubscriptionIfNotExists = async (db, userId, subscriptionData) => {
    try {
        const subsRef = db.collection('users').doc(userId).collection('subscriptions');

        // Verificar se já existe uma assinatura com o mesmo nome (case-insensitive)
        const snapshot = await subsRef.get();
        const targetName = subscriptionData.name.toLowerCase();

        let existingDoc = null;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            if ((data.name || '').toLowerCase() === targetName) {
                existingDoc = { id: doc.id, ...data };
                break;
            }
        }

        if (!existingDoc) {
            // Criar nova assinatura
            await subsRef.add({
                userId,
                name: subscriptionData.name,
                amount: subscriptionData.amount,
                category: subscriptionData.category,
                billingCycle: 'monthly', // Default
                status: 'active',
                createdAt: new Date().toISOString(),
                detectedAt: new Date().toISOString(),
                source: 'auto_detected', // Marca como detectada automaticamente
                confirmed: false, // Não confirmada ainda
                chargeDay: subscriptionData.chargeDay || null // Dia da cobrança detectado
            });
            console.log(`[SUBSCRIPTION] ✅ Auto-created: "${subscriptionData.name}" for user ${userId}`);
            return true;
        } else if (!existingDoc.source) {
            // Atualizar assinatura existente que não tem o campo source
            await subsRef.doc(existingDoc.id).update({
                source: 'auto_detected',
                confirmed: false,
                detectedAt: new Date().toISOString()
            });
            console.log(`[SUBSCRIPTION] 🔄 Updated existing: "${subscriptionData.name}" with auto_detected source`);
            return 'updated';
        }

        return false;
    } catch (error) {
        console.error(`[SUBSCRIPTION] ❌ Error creating subscription:`, error.message);
        return false;
    }
};

const CLIENT_ID = process.env.PLUGGY_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET?.trim();
const BASE_URL = 'https://api.pluggy.ai';

// Railway config (no 60s limit, optimize for speed)
const VERCEL_TIMEOUT = 55000;
const AXIOS_TIMEOUT = 10000; // 10s per request - faster timeout
const FAST_POLL_INTERVAL = 1500; // 1.5s between polls
const QUICK_SYNC_TIMEOUT = 35000; // 35s max wait for item ready

// Create optimized axios instance
const pluggyApi = axios.create({
    baseURL: BASE_URL,
    timeout: AXIOS_TIMEOUT,
    headers: { 'Content-Type': 'application/json' }
});

// Helper to determine Webhook URL
const getWebhookUrl = () => {
    // 1. Explicitly configured URL (best for production)
    if (process.env.PLUGGY_WEBHOOK_URL) return process.env.PLUGGY_WEBHOOK_URL;

    // 2. Railway Public Domain (fallback)
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/pluggy/webhook`;
    }

    // 3. Railway Static URL (legacy)
    if (process.env.RAILWAY_STATIC_URL) {
        return `https://${process.env.RAILWAY_STATIC_URL}/api/pluggy/webhook`;
    }

    // 4. Local dev fallback (only if not in prod)
    if (process.env.NODE_ENV !== 'production') {
        return null;
    }

    return null;
};

// Minimal startup log with check
const webhookUrl = getWebhookUrl();
console.log('Pluggy: Ready', {
    hasCredentials: !!(CLIENT_ID && CLIENT_SECRET),
    webhookUrl: webhookUrl || 'NOT_CONFIGURED (Will default to manual flow or error)'
});

// ============================================================
// HELPER: Validar e normalizar closingDay (1-28)
// ============================================================
const validateClosingDay = (day) => {
    if (!day || typeof day !== 'number') return 10; // Default
    // Limitar a 1-28 para evitar problemas com meses curtos (fevereiro)
    return Math.max(1, Math.min(28, day));
};

// HELPER: Remove undefined fields recursively for Firestore compatibility
const removeUndefined = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(removeUndefined);
    const newObj = {};
    for (const key in obj) {
        const val = removeUndefined(obj[key]);
        if (val !== undefined) newObj[key] = val;
    }
    return newObj;
};

// ============================================================
// HELPER: Enriquecer descrição de transações PIX/Transferências
// Usa paymentData.payer/receiver para mostrar nomes detalhados
// Também extrai nomes de descrições no formato C6: "PIX RECEBIDO   NOME"
// Ex: "PIX RECEBIDO" → "Pix Recebido De Giga Advisors Ltda"
// ============================================================
const enrichTransactionDescription = (tx) => {
    if (!tx) return tx?.description || '';

    const originalDesc = tx.description || '';
    const descLower = originalDesc.toLowerCase().trim();
    const paymentData = tx.paymentData;

    // Função auxiliar para formatar nome (Title Case)
    const formatName = (name) => {
        if (!name) return null;
        return name
            .trim()
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // ============================================================
    // ETAPA 1: Verificar se a descrição JÁ contém o nome (formato C6 Bank)
    // Padrões: "PIX RECEBIDO   NOME" ou "PIX ENVIADO   NOME"
    // ============================================================

    // Regex para extrair nome após PIX RECEBIDO/ENVIADO com múltiplos espaços
    const pixReceivedWithNameRegex = /^pix\s+recebido\s{2,}(.+)$/i;
    const pixSentWithNameRegex = /^pix\s+enviado\s{2,}(.+)$/i;
    const transfSentPixWithNameRegex = /^transf\s+enviada\s+pix\s{2,}(.+)$/i;
    const transfReceivedPixWithNameRegex = /^transf\s+recebida\s+pix\s{2,}(.+)$/i;

    // Também padrão alternativo: "PIX RECEBIDO C6 NOME" ou "PIX RECEBIDO NOME"
    const pixReceivedC6Regex = /^pix\s+recebido\s+c6\s+(.+)$/i;
    const pixSentC6Regex = /^pix\s+enviado\s+c6\s+(.+)$/i;

    // Verificar PIX RECEBIDO com nome
    let match = originalDesc.match(pixReceivedWithNameRegex);
    if (match && match[1] && match[1].trim().length > 2) {
        return `Pix Recebido De ${formatName(match[1])}`;
    }

    match = originalDesc.match(pixReceivedC6Regex);
    if (match && match[1] && match[1].trim().length > 2) {
        return `Pix Recebido De ${formatName(match[1])}`;
    }

    // Verificar PIX ENVIADO com nome
    match = originalDesc.match(pixSentWithNameRegex);
    if (match && match[1] && match[1].trim().length > 2) {
        return `Pix Enviado Para ${formatName(match[1])}`;
    }

    match = originalDesc.match(pixSentC6Regex);
    if (match && match[1] && match[1].trim().length > 2) {
        return `Pix Enviado Para ${formatName(match[1])}`;
    }

    // Verificar TRANSF com nome
    match = originalDesc.match(transfSentPixWithNameRegex);
    if (match && match[1] && match[1].trim().length > 2) {
        return `Pix Enviado Para ${formatName(match[1])}`;
    }

    match = originalDesc.match(transfReceivedPixWithNameRegex);
    if (match && match[1] && match[1].trim().length > 2) {
        return `Pix Recebido De ${formatName(match[1])}`;
    }

    // ============================================================
    // ETAPA 2: Tentar usar descriptionRaw se for diferente e mais detalhada
    // ============================================================
    const descriptionRaw = tx.descriptionRaw || '';
    if (descriptionRaw && descriptionRaw !== originalDesc && descriptionRaw.length > originalDesc.length) {
        // Verificar se descriptionRaw já contém um nome
        const rawLower = descriptionRaw.toLowerCase();

        match = descriptionRaw.match(pixReceivedWithNameRegex);
        if (match && match[1]) return `Pix Recebido De ${formatName(match[1])}`;

        match = descriptionRaw.match(pixSentWithNameRegex);
        if (match && match[1]) return `Pix Enviado Para ${formatName(match[1])}`;
    }

    // ============================================================
    // ETAPA 3: Usar paymentData.payer/receiver.name se disponível
    // ============================================================
    if (paymentData) {
        const payerName = paymentData.payer?.name;
        const receiverName = paymentData.receiver?.name;
        const reason = paymentData.reason;

        // Detectar tipo de transação
        const isPix = descLower.includes('pix') || paymentData.paymentMethod === 'PIX';
        const isTed = descLower.includes('ted') || paymentData.paymentMethod === 'TED';
        const isTransfer = descLower.includes('transf') || descLower.includes('transfer');
        const isReceived = descLower.includes('recebido') || descLower.includes('recebid') ||
            descLower.includes('credit') || descLower.includes('entrada') ||
            tx.type === 'CREDIT' || tx.amount > 0;
        const isSent = descLower.includes('enviado') || descLower.includes('enviad') ||
            descLower.includes('debit') || descLower.includes('saida') ||
            descLower.includes('saída') || tx.type === 'DEBIT' || tx.amount < 0;

        // Para PIX/Transferências recebidas, usar nome do pagador
        if ((isPix || isTed || isTransfer) && isReceived && payerName) {
            const formattedName = formatName(payerName);
            if (isPix) {
                return `Pix Recebido De ${formattedName}`;
            } else if (isTed) {
                return `TED Recebido De ${formattedName}`;
            } else {
                return `Transferência Recebida De ${formattedName}`;
            }
        }

        // Para PIX/Transferências enviadas, usar nome do recebedor
        if ((isPix || isTed || isTransfer) && isSent && receiverName) {
            const formattedName = formatName(receiverName);
            if (isPix) {
                return `Pix Enviado Para ${formattedName}`;
            } else if (isTed) {
                return `TED Enviado Para ${formattedName}`;
            } else {
                return `Transferência Enviada Para ${formattedName}`;
            }
        }

        // Se tem reason (motivo da transferência), usar como descrição adicional
        if (reason && reason.trim().length > 0) {
            // Se a descrição original é muito genérica, usar reason como base
            const genericPatterns = ['pix recebido', 'pix enviado', 'transf enviada pix', 'transferencia pix'];
            if (genericPatterns.some(p => descLower === p)) {
                return reason;
            }
            // Caso contrário, anexar reason se for diferente
            if (!originalDesc.toLowerCase().includes(reason.toLowerCase())) {
                return `${originalDesc} - ${reason}`;
            }
        }
    }

    // Fallback: retorna descrição original
    return originalDesc;
};


// ============================================================
// HELPER: Calcular períodos de fatura centralizados
// Esta função é a fonte única de verdade para cálculos de período
// ============================================================
const calculateInvoicePeriods = (closingDayRaw, dueDay, today = new Date()) => {
    const closingDay = validateClosingDay(closingDayRaw);

    // Helper para criar data de fechamento segura
    const getClosingDate = (year, month, day) => {
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        const safeDay = Math.min(day, lastDayOfMonth);
        return new Date(year, month, safeDay, 23, 59, 59);
    };

    // Helper para formatar data como string (apenas data, sem timezone)
    // IMPORTANTE: Usa método local para evitar conversão UTC que pode mudar a data
    const toDateStr = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Helper para criar monthKey (YYYY-MM)
    const toMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // Calcular fechamento da fatura ATUAL (próximo fechamento a partir de hoje)
    // REGRA DO APP MOBILE: Se hoje >= closingDay, a fatura desse mês JÁ FECHOU
    let currentClosingDate;
    if (today.getDate() < closingDay) {
        // Ainda não fechou este mês
        currentClosingDate = getClosingDate(today.getFullYear(), today.getMonth(), closingDay);
    } else {
        // Já fechou este mês, próximo é mês que vem
        const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
        const nextYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
        currentClosingDate = getClosingDate(nextYear, nextMonth, closingDay);
    }

    // Calcular ÚLTIMA fatura (um mês antes da atual)
    const lastClosingMonth = currentClosingDate.getMonth() === 0 ? 11 : currentClosingDate.getMonth() - 1;
    const lastClosingYear = currentClosingDate.getMonth() === 0 ? currentClosingDate.getFullYear() - 1 : currentClosingDate.getFullYear();
    const lastClosingDate = getClosingDate(lastClosingYear, lastClosingMonth, closingDay);

    // Calcular ANTES DA ÚLTIMA (dois meses antes da atual)
    const beforeLastMonth = lastClosingDate.getMonth() === 0 ? 11 : lastClosingDate.getMonth() - 1;
    const beforeLastYear = lastClosingDate.getMonth() === 0 ? lastClosingDate.getFullYear() - 1 : lastClosingDate.getFullYear();
    const beforeLastClosingDate = getClosingDate(beforeLastYear, beforeLastMonth, closingDay);

    // Calcular PRÓXIMA fatura (um mês após a atual)
    const nextClosingMonth = currentClosingDate.getMonth() === 11 ? 0 : currentClosingDate.getMonth() + 1;
    const nextClosingYear = currentClosingDate.getMonth() === 11 ? currentClosingDate.getFullYear() + 1 : currentClosingDate.getFullYear();
    const nextClosingDate = getClosingDate(nextClosingYear, nextClosingMonth, closingDay);

    // Calcular datas de INÍCIO de cada período (dia após fechamento anterior)
    const lastInvoiceStart = new Date(beforeLastClosingDate.getTime() + 24 * 60 * 60 * 1000);
    const currentInvoiceStart = new Date(lastClosingDate.getTime() + 24 * 60 * 60 * 1000);
    const nextInvoiceStart = new Date(currentClosingDate.getTime() + 24 * 60 * 60 * 1000);

    // Calcular datas de VENCIMENTO
    const safeDueDay = dueDay || closingDay + 10; // Default: 10 dias após fechamento

    const calculateDueDate = (closingDate) => {
        const dueMonth = closingDate.getMonth() === 11 ? 0 : closingDate.getMonth() + 1;
        const dueYear = closingDate.getMonth() === 11 ? closingDate.getFullYear() + 1 : closingDate.getFullYear();
        const lastDayOfDueMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
        return new Date(dueYear, dueMonth, Math.min(safeDueDay, lastDayOfDueMonth));
    };

    const lastDueDate = calculateDueDate(lastClosingDate);
    const currentDueDate = calculateDueDate(currentClosingDate);
    const nextDueDate = calculateDueDate(nextClosingDate);

    // Debug log removido para performance

    return {
        closingDay,
        dueDay: safeDueDay,
        calculatedAt: today.toISOString(),

        // Datas de fechamento
        beforeLastClosingDate: toDateStr(beforeLastClosingDate),
        lastClosingDate: toDateStr(lastClosingDate),
        currentClosingDate: toDateStr(currentClosingDate),
        nextClosingDate: toDateStr(nextClosingDate),

        // Períodos completos
        lastInvoice: {
            start: toDateStr(lastInvoiceStart),
            end: toDateStr(lastClosingDate),
            dueDate: toDateStr(lastDueDate),
            monthKey: toMonthKey(lastClosingDate)
        },
        currentInvoice: {
            start: toDateStr(currentInvoiceStart),
            end: toDateStr(currentClosingDate),
            dueDate: toDateStr(currentDueDate),
            monthKey: toMonthKey(currentClosingDate)
        },
        nextInvoice: {
            start: toDateStr(nextInvoiceStart),
            end: toDateStr(nextClosingDate),
            dueDate: toDateStr(nextDueDate),
            monthKey: toMonthKey(nextClosingDate)
        }
    };
};

// ============================================================
// HELPER: Calcular invoiceMonthKey para uma transação
// ============================================================
const calculateInvoiceMonthKey = (txDate, closingDay) => {
    const validClosingDay = validateClosingDay(closingDay);
    const date = new Date(txDate);

    // Regra: Se dia da transação > closingDay → pertence ao MÊS SEGUINTE
    if (date.getDate() > validClosingDay) {
        date.setMonth(date.getMonth() + 1);
    }

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return monthKey;
};

// Helper to get Pluggy API Key
let cachedApiKey = null;
let apiKeyExpiresAt = 0;

const getApiKey = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cachedApiKey && now < apiKeyExpiresAt) {
        return cachedApiKey;
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error('Pluggy credentials not configured');
    }

    const response = await pluggyApi.post('/auth', {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET
    });

    if (!response.data?.apiKey) {
        throw new Error('Invalid Auth Response');
    }

    cachedApiKey = response.data.apiKey;
    apiKeyExpiresAt = now + (1.9 * 60 * 60 * 1000); // 1.9h cache
    return cachedApiKey;
};

// Middleware to inject API Key (optimized)
const withPluggyAuth = async (req, res, next) => {
    try {
        req.pluggyApiKey = await getApiKey();
        if (!req.pluggyApiKey) throw new Error('No API Key');
        next();
    } catch (error) {
        res.status(500).json({ error: 'Auth failed' });
    }
};

// --- Endpoints ---

// 0. Test Auth Endpoint (minimal)
router.get('/test-auth', async (req, res) => {
    try {
        const apiKey = await getApiKey(true);
        const [connectors, items] = await Promise.all([
            pluggyApi.get('/connectors?sandbox=true', { headers: { 'X-API-KEY': apiKey } }).catch(() => null),
            pluggyApi.get('/items', { headers: { 'X-API-KEY': apiKey } }).catch(() => null)
        ]);

        res.json({
            success: true,
            connectorsOk: !!connectors,
            itemsOk: !!items,
            itemsCount: items?.data?.results?.length || 0
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 1. Create Connect Token (optimized)
router.post('/create-token', withPluggyAuth, async (req, res) => {
    try {
        const webhookUrl = getWebhookUrl();

        // Only include webhookUrl if we have a valid one
        const payload = {
            clientUserId: req.body.userId,
            ...(webhookUrl ? { webhookUrl } : {})
        };

        const response = await pluggyApi.post('/connect_token', payload, {
            headers: { 'X-API-KEY': req.pluggyApiKey }
        });

        res.json({ accessToken: response.data.accessToken });
    } catch (error) {
        console.error('Pluggy Create Token Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create token' });
    }
});

// 2. List Items (optimized)
router.get('/items', withPluggyAuth, async (req, res) => {
    try {
        const response = await pluggyApi.get('/items', { headers: { 'X-API-KEY': req.pluggyApiKey } });
        res.json({ success: true, items: response.data.results || [] });
    } catch (error) {
        if (error.response?.status === 401) {
            return res.status(401).json({ error: 'Unauthorized', items: [] });
        }
        res.status(500).json({ error: 'Failed to list items' });
    }
});

router.get('/connectors', withPluggyAuth, async (req, res) => {
    try {
        // sandbox=false para produção, sandbox=true para testes
        const response = await pluggyApi.get('/connectors?sandbox=false', {
            headers: { 'X-API-KEY': req.pluggyApiKey }
        });

        res.json({
            success: true,
            results: response.data.results || []
        });
    } catch (error) {
        console.error('Error fetching connectors:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch connectors'
        });
    }
});



// 11. Create Item (Connect Bank Account)
router.post('/create-item', withPluggyAuth, async (req, res) => {
    const { userId, connectorId, credentials } = req.body;

    console.log(`[Create-Item] Starting for user ${userId}, connector ${connectorId}`);

    try {
        // Criar item no Pluggy
        const response = await pluggyApi.post('/items', {
            connectorId,
            parameters: credentials
        }, {
            headers: { 'X-API-KEY': req.pluggyApiKey }
        });

        const item = response.data;
        console.log(`[Create-Item] Item created: ${item.id}, status: ${item.status}`);

        // Salvar referência no Firebase
        if (firebaseAdmin) {
            const db = firebaseAdmin.firestore();
            await db.collection('users').doc(userId).collection('pluggyItems').doc(item.id).set({
                itemId: item.id,
                connectorId,
                connectorName: item.connector?.name || null,
                status: item.status,
                createdAt: new Date().toISOString()
            });
        }

        res.json({
            success: true,
            item,
            message: 'Conexão iniciada com sucesso!'
        });

    } catch (error) {
        console.error('[Create-Item] Error:', error.response?.data || error.message);

        const errorMessage = error.response?.data?.message ||
            error.response?.data?.error ||
            'Falha ao conectar. Verifique suas credenciais.';

        res.status(error.response?.status || 500).json({
            success: false,
            error: errorMessage
        });
    }
});

// ============================================================
// HELPER: Detectar e corrigir pares duplicados (Compra + Estorno errado)
// Alguns bancos enviam o estorno como um segundo DEBITO (negativo)
// Se encontrarmos 2 transações IDÊNTICAS (mesma data, mesmo valor negativo, mesma descrição)
// Assumimos que a segunda é o estorno e forçamos virar CRÉDITO (Reembolso)
// ============================================================
const detectAndFixDoubledRefunds = (transactions) => {
    if (!transactions || transactions.length < 2) return transactions;

    // Agrupar por chave: Data|Valor|Descrição
    const groups = new Map();

    for (const tx of transactions) {
        // Analisar tanto positivos quanto negativos
        // Agrupar por valor absoluto para pegar par Expense (+359) e Expense (+359)
        const dateStr = tx.date.split('T')[0];
        const key = `${dateStr}|${Math.abs(tx.amount)}|${tx.description.trim()}`;

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(tx);
    }

    // Identificar duplicatas
    for (const [key, group] of groups) {
        // DUPLIICIDADE EXATA (Par): 2 transações iguais
        if (group.length === 2) {
            const [tx1, tx2] = group;

            // Verifica sinais: Se forem IGUAIS (ambos + ou ambos -), temos um problema
            // Se forem diferentes, já se anulam
            if ((tx1.amount > 0 && tx2.amount > 0) || (tx1.amount < 0 && tx2.amount < 0)) {

                // Marcar a segunda como estorno inferido
                tx2._isInferredRefund = true;

                console.log(`[SYNC] 🔄 Duplicidade detectada (Provável Estorno): "${tx2.description}" - Valor: ${tx2.amount}`);
            }
        }
    }

    return transactions;
};

// ============================================================
// HELPER: Corrigir duplicidades diretamente no Banco de Dados (Pós-processamento)
// Garante que transações antigas/já salvas também sejam corrigidas
// ============================================================
const fixDbDuplicates = async (db, userId) => {
    try {
        console.log(`[Fix-Duplicates] 🧹 Starting DB cleanup for user ${userId}`);

        // Buscar transações recentes (últimos 90 dias) de cartão
        // Focamos em cartão pois é onde ocorre o problema de estorno duplicado
        const ccRef = db.collection('users').doc(userId).collection('creditCardTransactions');
        const today = new Date();
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const fromDate = ninetyDaysAgo.toISOString().split('T')[0];

        const snapshot = await ccRef.where('date', '>=', fromDate).get();

        const transactions = [];


        snapshot.forEach(doc => {
            transactions.push({ id: doc.id, ...doc.data() });
        });

        // Agrupar por chave "Relaxada": Data|Valor
        // Depois verificamos a descrição dentro do grupo
        const groups = new Map();

        for (const tx of transactions) {
            const dateStr = (tx.date || '').split('T')[0];
            const amount = Math.abs(tx.amount); // Agrupar tudo por valor absoluto
            const key = `${dateStr}|${amount}`;

            // DEBUG PROBE para o caso específico do usuário (359.20)
            if (amount > 359 && amount < 360) {
                console.log(`[DEBUG_PROBE] ID: ${tx.id} | DateRaw: ${tx.date} -> KeyDate: ${dateStr} | AmountRaw: ${tx.amount} | Desc: "${tx.description}"`);
            }

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(tx);
        }

        const batch = db.batch();
        let updateCount = 0;
        const results = [];

        for (const [key, group] of groups) {
            // Se tivermos exatamente 2 transações com mesma data e valor absoluto
            if (group.length === 2) {
                const [tx1, tx2] = group;

                const d1 = (tx1.description || '').trim().toUpperCase();
                const d2 = (tx2.description || '').trim().toUpperCase();

                // COMPARAÇÃO DE DESCRIÇÃO (Fuzzy)
                // 1. Iguais
                // 2. Um contém o outro
                // 3. 8 primeiros caracteres iguais (para cobrir "COMPRA * XYZ" vs "COMPRA XYZ")
                const descriptionsMatch =
                    d1 === d2 ||
                    d1.includes(d2) ||
                    d2.includes(d1) ||
                    (d1.length > 5 && d2.length > 5 && d1.slice(0, 8) === d2.slice(0, 8));

                if (descriptionsMatch) {
                    // Verificar sinais
                    // Se ambos forem negativos (Expense) -> Problema relatado pelo usuário
                    // Se ambos forem positivos (Income) -> Pode ser duplicidade de estorno, também corrigimos
                    // Se forem sinais opostos -> Já está zerado, ignorar (ex: compra e estorno correto)

                    const type1 = tx1.type;
                    const type2 = tx2.type;

                    if (type1 === type2) {
                        console.log(`[Fix-Duplicates] ⚠️ Found duplicate pair: ${key} | "${d1}" vs "${d2}"`);

                        // Converter a segunda para o tipo oposto
                        const newType = type1 === 'expense' ? 'income' : 'expense';
                        const category = newType === 'income' ? 'Reembolso' : 'Uncategorized';

                        batch.update(ccRef.doc(tx2.id), {
                            type: newType,
                            category: category,
                            isRefund: true,
                            _fixedBy: 'db_cleanup_fuzzy'
                        });

                        results.push({
                            fixed: true,
                            pair: [tx1.description, tx2.description],
                            amount: tx2.amount,
                            reason: 'fuzzy_match_date_amount'
                        });
                        updateCount++;
                    }
                } else {
                    console.log(`[Fix-Duplicates] ℹ️ Candidate match rejected by description: "${d1}" vs "${d2}"`);
                }
            }
        }

        if (updateCount > 0) {
            await batch.commit();
            console.log(`[Fix-Duplicates] ✅ Fixed ${updateCount} transactions in DB`);
        } else {
            console.log(`[Fix-Duplicates] No duplicates found to fix.`);
        }

        return { success: true, fixed: updateCount, details: results };

    } catch (err) {
        console.error(`[Fix-Duplicates] ❌ Error:`, err.message);
        return { success: false, error: err.message };
    }
};

// ENDPOINT DE DEBUG: Forçar correção de duplicatas
router.get('/fix-duplicates-debug', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    if (!firebaseAdmin) return res.status(500).json({ error: 'Firebase not ready' });
    const db = firebaseAdmin.firestore();

    const result = await fixDbDuplicates(db, userId);
    res.json(result);
});


// 3. Trigger Sync (Update Item) - OPTIMIZED FOR VERCEL PRO
// Ultra-fast parallel processing
// fullSync: boolean - If true, fetches ALL transactions (12 months) regardless of lastSyncedAt
router.post('/trigger-sync', withPluggyAuth, async (req, res) => {
    const { itemId, userId, fullSync = false } = req.body;
    const startTime = Date.now();

    console.log(`[SYNC] Start: item=${itemId} user=${userId} fullSync=${fullSync}`);

    if (!firebaseAdmin) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    const db = firebaseAdmin.firestore();
    const jobDoc = await db.collection('users').doc(userId).collection('sync_jobs').add({
        itemId,
        status: 'processing',
        fullSync: fullSync, // Salva para referência

        progress: 0,
        type: 'MANUAL',
        createdAt: new Date().toISOString()
    });

    res.json({ success: true, message: 'Sync triggered', syncJobId: jobDoc.id });

    // OPTIMIZED Background Processing
    (async () => {
        const apiKey = req.pluggyApiKey;
        const syncTimestamp = new Date().toISOString();
        const accountsRef = db.collection('users').doc(userId).collection('accounts');
        const txCollection = db.collection('users').doc(userId).collection('transactions');
        const ccTxCollection = db.collection('users').doc(userId).collection('creditCardTransactions');

        // Helper to update job progress in consistent format
        const updateProgress = (current, step) => jobDoc.update({
            progress: { current, total: 100, step },
            updatedAt: new Date().toISOString()
        });

        try {
            // Trigger Pluggy refresh
            await updateProgress(5, 'Atualizando conexão...');

            // STEP 0: Quick check - if item was UPDATED recently, skip PATCH
            let itemBeforeSync = null;
            try {
                const beforeResp = await pluggyApi.get(`/items/${itemId}`, {
                    headers: { 'X-API-KEY': apiKey }
                });
                itemBeforeSync = beforeResp.data;

                // FAST PATH: If item was updated in last 5 minutes and is UPDATED, skip PATCH
                if (itemBeforeSync.status === 'UPDATED' && itemBeforeSync.lastUpdatedAt) {
                    const lastUpdate = new Date(itemBeforeSync.lastUpdatedAt).getTime();
                    const fiveMinAgo = Date.now() - (5 * 60 * 1000);
                    if (lastUpdate > fiveMinAgo) {
                        console.log(`[SYNC] Fast path: Item updated ${Math.round((Date.now() - lastUpdate) / 1000)}s ago, skipping PATCH`);
                        // Skip PATCH, go straight to fetching data
                        await updateProgress(15, 'Dados recentes encontrados...');
                        // Jump directly to fetching accounts
                    }
                }
            } catch (err) {
                // Continue anyway
            }

            try {
                await pluggyApi.patch(`/items/${itemId}`, {}, {
                    headers: { 'X-API-KEY': apiKey }
                });
            } catch (err) {
                if (err.response?.status === 404) {
                    await jobDoc.update({ status: 'failed', error: 'Item not found', needsReconnect: true });
                    return;
                }
                // Continue anyway
            }

            // Wait for Pluggy with faster timeout (Railway has no 60s limit)
            await updateProgress(10, 'Aguardando dados do banco...');
            const itemStatus = await waitForItemReady(apiKey, itemId, QUICK_SYNC_TIMEOUT, itemBeforeSync?.lastUpdatedAt);
            console.log(`[SYNC] Ready: status=${itemStatus.status}`);

            if (!itemStatus.ready && itemStatus.status === 'WAITING_USER_INPUT') {
                await jobDoc.update({
                    status: 'failed',
                    error: 'O banco requer ação adicional. Tente reconectar.',
                    needsReconnect: true
                });
                return;
            }

            if (itemStatus.status === 'LOGIN_ERROR') {
                await jobDoc.update({
                    status: 'failed',
                    error: 'Erro de login no banco. Reconecte sua conta.',
                    needsReconnect: true
                });
                return;
            }

            // Handle SLOW_BANK status - bank is still syncing after timeout
            if (itemStatus.status === 'SLOW_BANK') {
                console.log(`[Trigger-Sync] ⚠️ SLOW_BANK: ${itemStatus.item?.connector?.name || 'O banco'} está demorando para sincronizar.`);
                await jobDoc.update({
                    warning: `${itemStatus.item?.connector?.name || 'O banco'} está demorando para sincronizar. Tente novamente em alguns minutos.`
                });
                // Continue anyway - try to fetch whatever data is available
            }

            // Handle STALE status - Pluggy didn't actually fetch new data
            if (itemStatus.status === 'STALE') {
                console.log(`[Trigger-Sync] ⚠️ STALE: O banco ${itemStatus.item?.connector?.name || 'desconhecido'} não retornou dados novos.`);
                // Continue anyway - we'll still fetch whatever data is available
                // But add a warning to the job
                await jobDoc.update({
                    warning: 'Banco pode não ter retornado dados novos. Se transações recentes não aparecerem, tente reconectar.'
                });
            }

            // Handle OUTDATED status - connection might need refresh
            if (itemStatus.status === 'OUTDATED') {
                console.log(`[Trigger-Sync] ⚠️ OUTDATED: Conexão com ${itemStatus.item?.connector?.name || 'o banco'} pode precisar ser renovada.`);
            }

            await updateProgress(20, 'Buscando contas...');

            // STEP 1: Fetch accounts and existing data IN PARALLEL
            const [accountsResp, existingSnap] = await Promise.all([
                pluggyApi.get(`/accounts?itemId=${itemId}`, { headers: { 'X-API-KEY': apiKey } }),
                accountsRef.get()
            ]);

            const accounts = accountsResp.data.results || [];

            // Quick balance check log
            console.log(`[SYNC] ${accounts.length} accounts fetched`);

            const existingMap = {};
            existingSnap.forEach(doc => {
                const d = doc.data();
                existingMap[doc.id] = {
                    connectedAt: d.connectedAt,
                    lastSyncedAt: d.lastSyncedAt, // Track last sync for incremental fetching
                    customName: d.name, // Preservar o apelido customizado do usuário
                    originalName: d.originalName // Nome original da API para comparação
                };
            });

            // STEP 2: Save accounts (quick batch)
            const accBatch = db.batch();
            for (const acc of accounts) {
                const isCredit = acc.type === 'CREDIT' || acc.subtype === 'CREDIT_CARD';
                const existing = existingMap[acc.id];

                // Extrair e VALIDAR closingDay e dueDay (1-28)
                const rawClosingDay = acc.creditData?.balanceCloseDate ? new Date(acc.creditData.balanceCloseDate).getDate() : null;
                const rawDueDay = acc.creditData?.balanceDueDate ? new Date(acc.creditData.balanceDueDate).getDate() : null;
                const validClosingDay = validateClosingDay(rawClosingDay);
                const validDueDay = rawDueDay ? Math.max(1, Math.min(28, rawDueDay)) : null;

                const creditFields = isCredit && acc.creditData ? {
                    creditLimit: acc.creditData.creditLimit || null,
                    availableCreditLimit: acc.creditData.availableCreditLimit || null,
                    brand: acc.creditData.brand || null,
                    balanceCloseDate: acc.creditData.balanceCloseDate || null,
                    balanceDueDate: acc.creditData.balanceDueDate || null,
                    closingDay: validClosingDay,
                    dueDay: validDueDay,
                    // NOVO: Períodos de fatura pré-calculados
                    invoicePeriods: calculateInvoicePeriods(validClosingDay, validDueDay)
                } : {};

                // PRESERVAR APELIDO CUSTOMIZADO:
                // Se o usuário já renomeou a conta (customName existe e é diferente do que vem da API),
                // mantemos o customName. Caso contrário, usamos o nome da API.
                const apiName = acc.name || acc.marketingName || 'Conta';
                let nameToSave = apiName;

                if (existing?.customName) {
                    // CASO 1: Se temos originalName, comparar com ele
                    // CASO 2: Se não temos originalName (conta antiga), comparar diretamente com apiName
                    //         Se são diferentes, significa que o usuário renomeou
                    const previousOriginalName = existing.originalName || apiName;
                    if (existing.customName !== previousOriginalName) {
                        nameToSave = existing.customName; // Manter o apelido do usuário
                        console.log(`[SYNC] Preservando apelido: "${existing.customName}" (original: "${apiName}")`);
                    }
                }

                accBatch.set(accountsRef.doc(acc.id), removeUndefined({
                    ...acc,
                    name: nameToSave, // Usar nome preservado ou da API
                    originalName: apiName, // Sempre salvar o nome original da API para referência
                    ...creditFields,
                    ...(existing?.connectedAt ? {} : { connectedAt: syncTimestamp }),
                    accountNumber: acc.number || null,
                    itemId,
                    lastSyncedAt: syncTimestamp,
                    updatedAt: syncTimestamp
                }), { merge: true });
            }
            await accBatch.commit();

            await updateProgress(30, 'Buscando novas transações...');

            // STEP 3: Fetch transactions IN PARALLEL with PAGINATION (INCREMENTAL - only new transactions)
            // For each account, use lastSyncedAt as "from" date to avoid re-fetching old transactions
            // This saves Firebase costs and improves performance
            const defaultFromDate = new Date();
            defaultFromDate.setFullYear(defaultFromDate.getFullYear() - 1); // 12 meses para contas novas
            const defaultFromStr = defaultFromDate.toISOString().split('T')[0];

            // Alternative: Buscar última semana para contas com syncs muito recentes
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

            // NEW: For slow banks like C6, fetch at least 30 days to ensure we don't miss transactions
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

            // Determine if we need to force extended fetch (slow/problematic banks)
            const forceExtendedFetch = ['STALE', 'SLOW_BANK', 'TIMEOUT'].includes(itemStatus.status);

            const txPromises = accounts.map(async account => {
                const existing = existingMap[account.id];
                let fromStr = defaultFromStr;
                let syncMode = 'first';
                const connectorName = account.connector?.name || itemStatus.item?.connector?.name || 'unknown';

                // FULL SYNC: Ignora lastSyncedAt e busca 12 meses completos
                // Útil para recuperar transações deletadas ou reprocessar todas
                if (fullSync) {
                    fromStr = defaultFromStr; // 12 meses atrás
                    syncMode = 'full-sync';
                    console.log(`[SYNC] Full sync mode: fetching 12 months for account ${account.id}`);
                } else if (forceExtendedFetch) {
                    fromStr = thirtyDaysAgoStr;
                    syncMode = 'force-extended';
                } else if (existing?.lastSyncedAt) {
                    const lastSync = new Date(existing.lastSyncedAt);
                    const hoursSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

                    if (hoursSinceLastSync < 6) {
                        fromStr = oneWeekAgoStr;
                        syncMode = 'incremental-extended';
                    } else {
                        lastSync.setDate(lastSync.getDate() - 1);
                        fromStr = lastSync.toISOString().split('T')[0];
                        syncMode = 'incremental';
                    }
                }


                // Use pagination to fetch ALL transactions
                let transactions = await fetchAllTransactions(apiKey, account.id, fromStr);

                // FIXED: Detectar e corrigir duplicidades de estorno (2x negativo)
                transactions = detectAndFixDoubledRefunds(transactions);

                return { account, transactions, fromDate: fromStr, syncMode, connectorName };
            });

            const allTxResults = await Promise.all(txPromises);

            // Count transactions
            let totalNewTx = 0;
            allTxResults.forEach(({ transactions }) => {
                totalNewTx += transactions.length;
            });
            console.log(`[SYNC] Found ${totalNewTx} tx in ${accounts.length} accounts`);

            await updateProgress(50, `Salvando ${totalNewTx} transações...`);

            // STEP 4: Process and batch write all transactions
            let txCount = 0;
            let opCount = 0;
            let currentBatch = db.batch();
            const batchPromises = [];

            for (const { account, transactions } of allTxResults) {
                const isCredit = account.type === 'CREDIT' || account.subtype === 'CREDIT_CARD';
                const isSavings = account.subtype === 'SAVINGS' || account.subtype === 'SAVINGS_ACCOUNT';
                const targetColl = isCredit ? ccTxCollection : txCollection;

                for (const tx of transactions) {
                    let mappedTx;

                    if (isCredit) {
                        let invoiceMonthKey = tx.date.slice(0, 7);
                        if (account.creditData?.balanceCloseDate) {
                            const closingDay = new Date(account.creditData.balanceCloseDate).getDate();
                            const txDate = new Date(tx.date);
                            if (txDate.getDate() > closingDay) {
                                txDate.setMonth(txDate.getMonth() + 1);
                            }
                            invoiceMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                        }

                        // Extrair informações de parcelas da API Pluggy
                        // Pode vir como número ou objeto { number, total }
                        let totalInstallments = 1;
                        let installmentNumber = 1;
                        if (tx.installments) {
                            if (typeof tx.installments === 'object') {
                                totalInstallments = tx.installments.total || 1;
                                installmentNumber = tx.installments.number || 1;
                            } else if (typeof tx.installments === 'number') {
                                totalInstallments = tx.installments;
                                // Tentar extrair número da parcela da descrição (ex: "COMPRA 3/10")
                                const descMatch = (tx.description || '').match(/(\d+)\s*\/\s*(\d+)/);
                                if (descMatch) {
                                    installmentNumber = parseInt(descMatch[1]) || 1;
                                }
                            }
                        }

                        // Detectar se é transação de IOF (imposto sobre compra internacional)
                        const descLower = (tx.description || '').toLowerCase();
                        const isIOF = descLower.includes('iof') ||
                            descLower.includes('imposto') ||
                            descLower.includes('tax');

                        // ============================================================
                        // DETECÇÃO DE REEMBOLSOS/ESTORNOS (APENAS KEYWORDS ESPECÍFICAS)
                        // NÃO incluir palavras genéricas como 'crédito' ou 'desconto'
                        // que aparecem em transações normais de cartão
                        // ============================================================

                        // Keywords ESPECÍFICAS de reembolso (evitar genéricas!)
                        const refundKeywords = [
                            'estorno', 'reembolso', 'devolucao', 'devolução',
                            'cancelamento', 'cancelado', 'refund', 'chargeback',
                            'cashback'  // Cashback é crédito real
                        ];

                        const isRefundByKeyword = refundKeywords.some(kw => descLower.includes(kw));

                        // ATENÇÃO: NÃO usar tx.amount > 0 como critério único!
                        // Alguns bancos enviam despesas como positivo.
                        // Só considerar positivo se também for tipo CREDIT da API.
                        const isCreditType = tx.type === 'CREDIT';

                        // DECISÃO FINAL: É reembolso APENAS se:
                        // 1. Tem keyword específica de reembolso, OU
                        // 2. API Pluggy diz explicitamente que é CREDIT, OU
                        // 3. Foi detectado como duplicidade inferida (compra + estorno negativo)
                        const isRefund = isRefundByKeyword || isCreditType || tx._isInferredRefund;

                        // Log para debug quando detectar reembolso
                        if (isRefund) {
                            console.log(`[SYNC] 💳 Reembolso detectado: "${tx.description}" - Valor: ${tx.amount}, Motivo: ${isRefundByKeyword ? 'keyword' : 'CREDIT type'}`);
                        }

                        // Determinar tipo final
                        const isIncome = isRefund;

                        mappedTx = {
                            cardId: account.id,
                            date: tx.date.split('T')[0],
                            // Timestamp completo para ordenação precisa (ISO 8601)
                            timestamp: tx.date, // Mantém horário e fuso original
                            description: enrichTransactionDescription(tx),
                            amount: Math.abs(tx.amount),
                            type: isIncome ? 'income' : 'expense',
                            category: isRefund ? 'Reembolso' : (tx.category || 'Uncategorized'),
                            status: 'completed',
                            totalInstallments,
                            installmentNumber,
                            invoiceMonthKey,
                            // Flag para IOF/taxas internacionais
                            isIOF: isIOF || false,
                            // Dados de moeda para transações internacionais (USD, EUR, etc.)
                            currencyCode: tx.currencyCode || 'BRL',
                            // Se a moeda não é BRL, o amount original é o valor em moeda estrangeira
                            // e amountInAccountCurrency é o valor convertido (que usamos como amount)
                            ...(tx.currencyCode && tx.currencyCode !== 'BRL' && tx.amountInAccountCurrency ? {
                                amountOriginal: Math.abs(tx.amount), // Valor original em moeda estrangeira
                                amountInAccountCurrency: Math.abs(tx.amountInAccountCurrency), // Valor convertido para BRL
                                amount: Math.abs(tx.amountInAccountCurrency) // Usa o valor convertido como amount principal
                            } : {}),
                            pluggyRaw: tx
                        };
                    } else {
                        const descLower = (tx.description || '').toLowerCase();
                        // Detecção de reembolso para contas bancárias (não cartão)
                        const refundKeywords = ['estorno', 'reembolso', 'devolucao', 'devolução', 'cancelamento', 'refund'];
                        const isRefund = refundKeywords.some(kw => descLower.includes(kw));
                        const isIncome = isRefund || tx.amount > 0 || (tx.type === 'CREDIT');

                        mappedTx = {
                            providerId: tx.id,
                            description: enrichTransactionDescription(tx),
                            amount: Math.abs(tx.amount),
                            type: isIncome ? 'income' : 'expense',
                            date: tx.date.split('T')[0],
                            // Timestamp completo para ordenação precisa (ISO 8601)
                            timestamp: tx.date, // Mantém horário e fuso original
                            accountId: tx.accountId,
                            category: isRefund ? 'Reembolso' : (tx.category || 'Uncategorized'),
                            status: 'completed',
                            updatedAt: syncTimestamp,
                            isInvestment: isSavings,
                            pluggyRaw: tx
                        };
                    }

                    currentBatch.set(targetColl.doc(tx.id), removeUndefined(mappedTx), { merge: true });
                    opCount++;
                    txCount++;

                    if (opCount >= 450) {
                        batchPromises.push(currentBatch.commit());
                        currentBatch = db.batch();
                        opCount = 0;
                    }
                }
            }

            if (opCount > 0) batchPromises.push(currentBatch.commit());

            // Commit all batches and log results
            try {
                await Promise.all(batchPromises);
                console.log(`[SYNC] ✅ Saved ${txCount} transactions for user ${userId}`);
            } catch (batchError) {
                console.error(`[SYNC] ❌ Batch write FAILED for user ${userId}:`, batchError.message);
                console.error(`[SYNC] Batch error details:`, JSON.stringify(batchError, null, 2));
                throw batchError; // Re-throw to be caught by outer catch
            }



            // ============================================================
            // STEP 4.1: FIX DUPLICATES IN DB (POST-PROCESSING)
            // ============================================================
            await fixDbDuplicates(db, userId);

            await updateProgress(65, 'Verificando pagamentos...');

            // ============================================================
            // STEP 4.2: CONFIRM SUBSCRIPTIONS BASED ON TRANSACTIONS
            // ============================================================
            try {
                const subsRef = db.collection('users').doc(userId).collection('subscriptions');
                const subsSnap = await subsRef.where('status', '==', 'active').get();
                const activeSubscriptions = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                if (activeSubscriptions.length > 0) {
                    const subBatch = db.batch();
                    let updatesCount = 0;

                    for (const { account, transactions } of allTxResults) {
                        for (const tx of transactions) {
                            // Only expenses
                            if ((tx.amount >= 0 && tx.type !== 'expense') && tx.amount >= 0) continue;

                            const txDesc = normalizeDescription(tx.description);
                            const txAmount = Math.abs(tx.amount);

                            // Determine "Paid Month" key
                            let paidMonthKey;
                            if (account.type === 'CREDIT' || account.subtype === 'CREDIT_CARD') {
                                // For credit cards, use the invoice month logic
                                if (account.creditData?.balanceCloseDate) {
                                    const closingDay = new Date(account.creditData.balanceCloseDate).getDate();
                                    const d = new Date(tx.date);
                                    // Correct JS Date stuff: getDate returns 1-31
                                    if (d.getDate() > closingDay) {
                                        d.setMonth(d.getMonth() + 1);
                                    }
                                    paidMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                } else {
                                    paidMonthKey = tx.date.slice(0, 7); // Default YYYY-MM
                                }
                            } else {
                                paidMonthKey = tx.date.slice(0, 7); // YYYY-MM
                            }

                            // Find matching subscription
                            for (const sub of activeSubscriptions) {
                                // Skip if user manually marked specific matching rules (future feature) but here we do simple name match
                                const subName = normalizeDescription(sub.name);

                                // Robust matching:
                                // 1. Direct includes (normalized)
                                // 2. Keyword matching if provided in subscription (future)
                                const matchName = txDesc.includes(subName) || (sub.name.length > 3 && tx.description.toLowerCase().includes(sub.name.toLowerCase()));

                                if (matchName) {
                                    const currentPaid = sub.paidMonths || [];
                                    if (!currentPaid.includes(paidMonthKey)) {
                                        const subRefDoc = subsRef.doc(sub.id);
                                        const newPaidMonths = [...currentPaid, paidMonthKey];

                                        subBatch.update(subRefDoc, {
                                            paidMonths: newPaidMonths,
                                            lastPaymentDate: tx.date.split('T')[0],
                                            lastPaymentAmount: txAmount
                                        });
                                        updatesCount++;

                                        // Update local object to avoid re-adding same month in loop
                                        sub.paidMonths = newPaidMonths;
                                        console.log(`[SYNC] 💳 Confirmed payment for "${sub.name}" in ${paidMonthKey}`);
                                    }
                                }
                            }
                        }
                    }

                    if (updatesCount > 0) {
                        await subBatch.commit();
                        console.log(`[SYNC] ✅ Confirmed ${updatesCount} subscription payments`);
                    }
                }
            } catch (err) {
                console.error('[SYNC] ⚠️ Error confirming subscriptions:', err.message);
            }

            await updateProgress(68, 'Detectando novas assinaturas...');

            // ============================================================
            // STEP 4.5: AUTO-DETECT SUBSCRIPTIONS FROM TRANSACTIONS
            // ============================================================

            // 1. Coletar transações que acabaram de chegar da API
            const detectedSubscriptions = new Map();
            const recentTransactionsForAnalysis = [];

            // Adicionar novas transações da API
            for (const { account, transactions } of allTxResults) {
                for (const tx of transactions) {
                    recentTransactionsForAnalysis.push({ ...tx, _source: 'api' });
                }
            }

            // 2. Buscar TAMBÉM as últimas 100 transações salvas no banco para garantir que não perdemos nada
            // Isso permite detectar assinaturas em transações que já foram sincronizadas antes
            try {
                // Buscar últimas transações normais
                const txSnap = await db.collection('users').doc(userId).collection('transactions')
                    .orderBy('date', 'desc').limit(50).get();

                // Buscar últimas transações de cartão
                const ccTxSnap = await db.collection('users').doc(userId).collection('creditCardTransactions')
                    .orderBy('date', 'desc').limit(50).get();

                const historyTxs = [
                    ...txSnap.docs.map(d => d.data()),
                    ...ccTxSnap.docs.map(d => d.data())
                ];

                // Adicionar ao array de análise (evitando duplicatas pelo description + date + amount)
                for (const hTx of historyTxs) {
                    const isDuplicate = recentTransactionsForAnalysis.some(rTx =>
                        rTx.description === hTx.description &&
                        rTx.date === hTx.date &&
                        Math.abs(rTx.amount) === Math.abs(hTx.amount)
                    );

                    if (!isDuplicate) {
                        recentTransactionsForAnalysis.push({ ...hTx, _source: 'history' });
                    }
                }
                console.log(`[SYNC] 🧠 Analysis context: ${recentTransactionsForAnalysis.length} transactions (API + History)`);
            } catch (histErr) {
                console.warn('[SYNC] ⚠️ Could not fetch history for analysis:', histErr.message);
            }

            // Executar detecção sobre o conjunto combinado (API + Histórico Recente)
            for (const tx of recentTransactionsForAnalysis) {
                // Normalizar dados (garantir amount positivo para a lógica, mas checkar se é despesa)
                // Se o tx vem do history, o type já está setado. Se vem da API, checamos amount < 0
                const isExpense = tx.type === 'expense' || (tx.amount < 0 && !tx.type);
                if (!isExpense && tx.amount >= 0) continue; // Ignorar receitas

                // MÉTODO 1: Lista de serviços conhecidos
                let detection = detectSubscriptionService(tx.description);
                if (detection.isSubscription) {
                    const amount = Math.abs(tx.amount);
                    const existingEntry = detectedSubscriptions.get(detection.name);

                    if (!existingEntry || amount > existingEntry.amount) {
                        // Só adiciona se for recente (últimos 45 dias) para não pegar coisas muito velhas do histórico
                        const txDate = new Date(tx.date);
                        const daysAgo = (new Date() - txDate) / (1000 * 60 * 60 * 24);

                        if (daysAgo <= 45) {
                            detectedSubscriptions.set(detection.name, {
                                name: detection.name,
                                amount,
                                category: detection.category || 'Lazer',
                                lastTransactionDate: tx.date,
                                source: 'auto_detected',
                                confirmed: false
                            });
                        }
                    }
                }

                // MÉTODO 2: Detecção Heurística (Palavras-chave genéricas)
                if (!detection.isSubscription) {
                    const likely = detectLikelySubscription(tx.description);
                    if (likely.isLikelySubscription) {
                        detection = {
                            isSubscription: true,
                            name: likely.detectedName,
                            category: 'Outros'
                        };
                    }
                }

                if (detection.isSubscription) {
                    const amount = Math.abs(tx.amount);
                    const existingEntry = detectedSubscriptions.get(detection.name);

                    if (!existingEntry || amount > existingEntry.amount) {
                        // Só adiciona se for recente (últimos 45 dias) para não pegar coisas muito velhas do histórico
                        const txDate = new Date(tx.date);
                        const daysAgo = (new Date() - txDate) / (1000 * 60 * 60 * 24);

                        if (daysAgo <= 45) {
                            detectedSubscriptions.set(detection.name, {
                                name: detection.name,
                                amount,
                                category: detection.category || 'Outros',
                                lastTransactionDate: tx.date,
                                source: 'auto_detected',
                                confirmed: false
                            });
                        }
                    }
                }
            }

            // MÉTODO 3: Detecção de padrões de recorrência (sobre todo o conjunto)
            const recurringPatterns = detectRecurringPatterns(recentTransactionsForAnalysis);
            for (const [name, data] of recurringPatterns) {
                if (!detectedSubscriptions.has(name)) {
                    detectedSubscriptions.set(name, {
                        name: data.name,
                        amount: data.amount,
                        category: data.category,
                        source: 'auto_detected',
                        confirmed: false
                    });
                }
            }

            // MÉTODO 4: Detecção com IA (Claude) - Usando o conjunto expandido
            try {
                // Analisar com IA
                const aiDetected = await detectSubscriptionsWithAI(recentTransactionsForAnalysis);

                for (const sub of aiDetected) {
                    let exists = false;
                    for (const existingName of detectedSubscriptions.keys()) {
                        if (existingName.toLowerCase() === sub.name.toLowerCase()) {
                            exists = true;
                            break;
                        }
                    }

                    if (!exists) {
                        detectedSubscriptions.set(sub.name, {
                            name: sub.name,
                            amount: sub.amount,
                            category: sub.category,
                            source: 'auto_detected',
                            confirmed: false
                        });
                    }
                }
            } catch (aiErr) {
                console.error('[SYNC] ⚠️ AI Detection failed:', aiErr);
            }

            // Criar assinaturas detectadas
            if (detectedSubscriptions.size > 0) {
                console.log(`[SYNC] 🔍 Detected ${detectedSubscriptions.size} potential subscriptions for user ${userId}`);

                // Log detalhado das detecções
                for (const [name, data] of detectedSubscriptions) {
                    console.log(`[SUBSCRIPTION] 📌 ${data.source}: "${name}" - R$ ${data.amount.toFixed(2)}`);
                }

                const subscriptionPromises = [];
                for (const [name, data] of detectedSubscriptions) {
                    subscriptionPromises.push(
                        createSubscriptionIfNotExists(db, userId, data)
                    );
                }

                try {
                    const results = await Promise.all(subscriptionPromises);
                    const createdCount = results.filter(r => r === true).length;
                    if (createdCount > 0) {
                        console.log(`[SYNC] ✅ Created ${createdCount} new subscriptions for user ${userId}`);
                    }
                } catch (subError) {
                    console.error(`[SYNC] ⚠️ Error creating subscriptions (non-blocking):`, subError.message);
                    // Don't throw - subscription creation should not block sync
                }
            }

            await updateProgress(70, 'Buscando faturas...');

            // STEP 5: Fetch ALL credit card bills IN PARALLEL
            const creditAccounts = accounts.filter(a => a.type === 'CREDIT' || a.subtype === 'CREDIT_CARD');

            const billPromises = creditAccounts.map(account =>
                pluggyApi.get(`/bills?accountId=${account.id}`, { headers: { 'X-API-KEY': apiKey } })
                    .then(resp => ({ account, bills: resp.data.results || [] }))
                    .catch(() => ({ account, bills: [] }))
            );

            const allBillResults = await Promise.all(billPromises);

            const billUpdatePromises = allBillResults
                .filter(({ bills }) => bills.length > 0)
                .map(({ account, bills }) => {
                    const sorted = bills.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

                    // Smart Selection: Prioritize OPEN, then first Future, then Most Recent
                    let current = sorted.find(b => b.status === 'OPEN');
                    if (!current) {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const sortedAsc = [...sorted].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
                        current = sortedAsc.find(b => b.dueDate >= todayStr);
                    }
                    if (!current) current = sorted[0];

                    const previous = sorted.find(b => b.id !== current.id) || null;

                    // Extract finance charges
                    const financeCharges = current.financeCharges || [];

                    const iof = financeCharges.find(f => f.type === 'IOF')?.amount || 0;
                    const interest = financeCharges
                        .filter(f => f.type === 'LATE_PAYMENT_INTEREST' || f.type === 'LATE_PAYMENT_REMUNERATIVE_INTEREST' || f.type === 'INTEREST')
                        .reduce((sum, f) => sum + (f.amount || 0), 0);
                    const lateFee = financeCharges.find(f => f.type === 'LATE_PAYMENT_FEE' || f.type === 'LATE_FEE')?.amount || 0;
                    const otherCharges = financeCharges.find(f => f.type === 'OTHER')?.amount || 0;

                    // Calcular datas de período baseado no closingDay configurado
                    const closingDay = account.closingDay || 10;
                    const today = new Date();

                    // Helper para criar data de fechamento
                    const getClosingDate = (year, month, day) => {
                        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
                        const safeDay = Math.min(day, lastDayOfMonth);
                        return new Date(year, month, safeDay, 23, 59, 59);
                    };

                    // Calcular fechamento da fatura atual (próximo fechamento)
                    // REGRA DO APP MOBILE: Se hoje >= closingDay, a fatura desse mês JÁ FECHOU
                    let nextClosingDate;
                    if (today.getDate() < closingDay) {
                        nextClosingDate = getClosingDate(today.getFullYear(), today.getMonth(), closingDay);
                    } else {
                        const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
                        const nextYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
                        nextClosingDate = getClosingDate(nextYear, nextMonth, closingDay);
                    }

                    // Fechamento da última fatura (um mês antes)
                    const lastClosingMonth = nextClosingDate.getMonth() === 0 ? 11 : nextClosingDate.getMonth() - 1;
                    const lastClosingYear = nextClosingDate.getMonth() === 0 ? nextClosingDate.getFullYear() - 1 : nextClosingDate.getFullYear();
                    const lastClosingDate = getClosingDate(lastClosingYear, lastClosingMonth, closingDay);

                    return accountsRef.doc(account.id).update({
                        currentBill: {
                            // Dados básicos da fatura
                            id: current.id,
                            dueDate: current.dueDate,
                            closeDate: current.closeDate || null,
                            // Datas de período: Usar dados do banco se houver, senão null (deixar frontend calcular)
                            periodStart: current.periodStart || null,
                            periodEnd: current.periodEnd || null,
                            status: current.status || 'OPEN',
                            // Valores
                            totalAmount: current.totalAmount || null,
                            totalAmountCurrencyCode: current.totalAmountCurrencyCode || 'BRL',
                            minimumPaymentAmount: current.minimumPaymentAmount || null,
                            paidAmount: current.paidAmount || null,
                            // Flags
                            allowsInstallments: current.allowsInstallments || false,
                            isInstallment: current.isInstallment || false,
                            // Encargos financeiros (processado + original)
                            financeCharges: {
                                iof,
                                interest,
                                lateFee,
                                otherCharges,
                                total: iof + interest + lateFee + otherCharges,
                                details: financeCharges // Array original da API Pluggy
                            }
                        },
                        // Calcular período da fatura anterior
                        previousBill: previous ? (() => {
                            const beforeLastMonth = lastClosingDate.getMonth() === 0 ? 11 : lastClosingDate.getMonth() - 1;
                            const beforeLastYear = lastClosingDate.getMonth() === 0 ? lastClosingDate.getFullYear() - 1 : lastClosingDate.getFullYear();
                            const beforeLastClosingDate = getClosingDate(beforeLastYear, beforeLastMonth, closingDay);

                            return {
                                id: previous.id,
                                dueDate: previous.dueDate,
                                closeDate: previous.closeDate || null,
                                periodStart: new Date(beforeLastClosingDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                                periodEnd: lastClosingDate.toISOString(),
                                status: previous.status || 'CLOSED',
                                totalAmount: previous.totalAmount || null,
                                totalAmountCurrencyCode: previous.totalAmountCurrencyCode || 'BRL',
                                minimumPaymentAmount: previous.minimumPaymentAmount || null,
                                paidAmount: previous.paidAmount || null,
                                financeCharges: previous.financeCharges ? {
                                    iof: previous.financeCharges.find(f => f.type === 'IOF')?.amount || 0,
                                    interest: previous.financeCharges
                                        .filter(f => f.type === 'LATE_PAYMENT_INTEREST' || f.type === 'LATE_PAYMENT_REMUNERATIVE_INTEREST' || f.type === 'INTEREST')
                                        .reduce((sum, f) => sum + (f.amount || 0), 0),
                                    lateFee: previous.financeCharges.find(f => f.type === 'LATE_PAYMENT_FEE' || f.type === 'LATE_FEE')?.amount || 0,
                                    details: previous.financeCharges // Array original
                                } : null
                            };
                        })() : null,
                        bills: sorted.slice(0, 6).map(b => {
                            const bCharges = b.financeCharges || [];
                            return {
                                id: b.id,
                                dueDate: b.dueDate,
                                closeDate: b.closeDate || null,
                                status: b.status || 'UNKNOWN',
                                totalAmount: b.totalAmount || null,
                                totalAmountCurrencyCode: b.totalAmountCurrencyCode || 'BRL',
                                minimumPaymentAmount: b.minimumPaymentAmount || null,
                                paidAmount: b.paidAmount || null,
                                allowsInstallments: b.allowsInstallments || false,
                                financeCharges: {
                                    iof: bCharges.find(f => f.type === 'IOF')?.amount || 0,
                                    interest: bCharges
                                        .filter(f => f.type === 'LATE_PAYMENT_INTEREST' || f.type === 'LATE_PAYMENT_REMUNERATIVE_INTEREST' || f.type === 'INTEREST')
                                        .reduce((sum, f) => sum + (f.amount || 0), 0),
                                    lateFee: bCharges.find(f => f.type === 'LATE_PAYMENT_FEE' || f.type === 'LATE_FEE')?.amount || 0,
                                    details: bCharges // Array original
                                }
                            };
                        }),
                        billsUpdatedAt: syncTimestamp
                    });
                });

            await Promise.all(billUpdatePromises);

            const duration = Date.now() - startTime;

            // Prepare message based on results
            let finalMessage;
            if (txCount === 0) {
                finalMessage = `Sincronizado em ${(duration / 1000).toFixed(1)}s. Nenhuma transação nova.`;
            } else {
                finalMessage = `${txCount} transações em ${(duration / 1000).toFixed(1)}s`;
            }

            await jobDoc.update({
                status: 'completed',
                progress: { current: 100, total: 100, step: 'Sincronização concluída!' },
                updatedAt: syncTimestamp,
                message: finalMessage,
                transactionsFound: txCount,
                duration
            });

            console.log(`[Trigger-Sync] Done in ${duration}ms: ${txCount} tx`);

        } catch (err) {
            console.error(`[SYNC] ❌ FAILED for user ${userId}:`, err.message);
            console.error(`[SYNC] Error stack:`, err.stack);
            await jobDoc.update({ status: 'failed', error: err.message, updatedAt: new Date().toISOString() });
        }
    })();
});


// Helper: Wait for Pluggy item to be ready (UPDATED or LOGIN_ERROR)
// OPTIMIZED: Fast polling for Railway deployment
const waitForItemReady = async (apiKey, itemId, maxWaitMs = QUICK_SYNC_TIMEOUT, oldLastUpdatedAt = null) => {
    const startTime = Date.now();
    const pollInterval = FAST_POLL_INTERVAL;
    const readyStatuses = ['UPDATED', 'LOGIN_ERROR', 'OUTDATED'];
    const inProgressExecutionStatuses = [
        'COLLECTING_ACCOUNTS', 'COLLECTING_CREDIT_CARDS', 'COLLECTING_TRANSACTIONS',
        'COLLECTING_IDENTITY', 'COLLECTING_INVESTMENTS', 'CREATING', 'CREATED', 'ANALYZING', 'MERGING'
    ];

    let lastLoggedExecutionStatus = null;

    while (Date.now() - startTime < maxWaitMs) {
        try {
            const response = await pluggyApi.get(`/items/${itemId}`, {
                headers: { 'X-API-KEY': apiKey }
            });

            const item = response.data;
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const connectorName = item.connector?.name || 'unknown';

            // Log only when status changes (reduce noise)
            if (item.executionStatus !== lastLoggedExecutionStatus) {
                console.log(`[POLL] ${itemId}: ${item.status}/${item.executionStatus}`);
                lastLoggedExecutionStatus = item.executionStatus;
            }

            // Error states
            if (item.status === 'LOGIN_ERROR' || item.status === 'WAITING_USER_INPUT') {
                return { ready: false, status: item.status, error: 'Login failed or needs user input', item };
            }

            // Still syncing?
            if (item.status === 'UPDATING' || inProgressExecutionStatuses.includes(item.executionStatus)) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                continue;
            }

            // Check if status is ready
            if (readyStatuses.includes(item.status)) {
                // Ensure executionStatus is terminal
                const terminalExecutionStatuses = ['SUCCESS', 'PARTIAL_SUCCESS', 'ERROR', null, undefined];
                if (!terminalExecutionStatuses.includes(item.executionStatus) && item.executionStatus) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                    continue;
                }

                // Verify timestamp changed
                if (oldLastUpdatedAt && item.lastUpdatedAt === oldLastUpdatedAt) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                    continue;
                }

                // Ready!
                return { ready: true, status: item.status, item };
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        } catch (err) {
            return { ready: true, status: 'UNKNOWN', item: null };
        }
    }

    // Timeout reached
    // Try one final check
    try {
        const finalResp = await pluggyApi.get(`/items/${itemId}`, {
            headers: { 'X-API-KEY': apiKey }
        });
        const finalItem = finalResp.data;
        const connectorName = finalItem.connector?.name || 'unknown';

        console.log(`[SYNC] Timeout for ${itemId}: status=${finalItem.status}`);

        // If item is still UPDATING after timeout, it's a problem
        if (finalItem.status === 'UPDATING') {
            return {
                ready: true,
                status: 'SLOW_BANK',
                item: finalItem,
                warning: `${connectorName} is taking too long to sync.`
            };
        }

        if (oldLastUpdatedAt && finalItem.lastUpdatedAt === oldLastUpdatedAt && finalItem.status === 'UPDATED') {
            return { ready: true, status: 'STALE', item: finalItem, warning: 'Data may be stale' };
        }

        return { ready: true, status: finalItem.status || 'TIMEOUT', item: finalItem };
    } catch (err) {
        console.log(`[Sync] Timeout and final check failed for item ${itemId}, proceeding anyway`);
        return { ready: true, status: 'TIMEOUT', item: null };
    }
};

// Helper: Fetch ALL transactions with pagination (Pluggy limits 500 per page)
// OPTIMIZED: Reduced logging
const fetchAllTransactions = async (apiKey, accountId, fromDate) => {
    const allTransactions = [];
    let page = 1;
    const pageSize = 500;

    while (true) {
        try {
            const response = await pluggyApi.get(
                `/transactions?accountId=${accountId}&from=${fromDate}&pageSize=${pageSize}&page=${page}`,
                { headers: { 'X-API-KEY': apiKey } }
            );

            const results = response.data.results || [];
            allTransactions.push(...results);

            // Only log on first page or if pagination occurs
            if (page === 1) {
                console.log(`[TX] ${accountId}: ${results.length} tx (page 1)`);
            }

            if (results.length < pageSize) break;
            page++;
            if (page > 20) break; // Safety limit
        } catch (err) {
            console.error(`[TX] Error: ${accountId} page ${page}`);
            break;
        }
    }

    return allTransactions;
};

// 4. Manual Sync (Fetch & Save) - SYNCHRONOUS FOR VERCEL
// Vercel terminates serverless functions after res.json(), so we MUST process before responding
router.post('/sync', withPluggyAuth, async (req, res) => {
    const { itemId, userId } = req.body;
    const startTime = Date.now();

    console.log(`[Sync] Starting sync for item ${itemId}, user ${userId}`);

    if (!firebaseAdmin) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    const db = firebaseAdmin.firestore();
    const apiKey = req.pluggyApiKey;
    const syncTimestamp = new Date().toISOString();
    const accountsRef = db.collection('users').doc(userId).collection('accounts');
    const txCollection = db.collection('users').doc(userId).collection('transactions');
    const ccTxCollection = db.collection('users').doc(userId).collection('creditCardTransactions');

    // Increment credits (don't block on this)
    const today = new Date().toLocaleDateString('en-CA');
    const userRef = db.doc(`users/${userId}`);
    db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) return;
        const credits = userDoc.data().dailyConnectionCredits || { date: '', count: 0 };
        const newCredits = credits.date !== today
            ? { date: today, count: 1 }
            : { ...credits, count: credits.count + 1 };
        transaction.update(userRef, { dailyConnectionCredits: newCredits });
    }).catch(() => { }); // Silent fail for credits

    try {
        // Wait for Pluggy item
        const itemStatus = await waitForItemReady(apiKey, itemId);
        console.log(`[SYNC] item=${itemId} status=${itemStatus.status}`);

        if (!itemStatus.ready && itemStatus.status === 'WAITING_USER_INPUT') {
            return res.json({
                success: false,
                error: 'O banco requer ação adicional. Tente reconectar.',
                needsReconnect: true
            });
        }

        console.log(`[SYNC] Fetching accounts...`);
        const [accountsResp, existingSnap] = await Promise.all([
            pluggyApi.get(`/accounts?itemId=${itemId}`, { headers: { 'X-API-KEY': apiKey } }),
            accountsRef.get()
        ]);

        const accounts = accountsResp.data.results || [];
        console.log(`[SYNC] ${accounts.length} accounts`);

        if (accounts.length === 0) {
            return res.json({
                success: true,
                message: '0 contas encontradas.',
                accountsFound: 0,
                transactionsFound: 0
            });
        }

        const existingMap = {};
        existingSnap.forEach(doc => {
            const d = doc.data();
            existingMap[doc.id] = { lastSyncedAt: d.lastSyncedAt, connectedAt: d.connectedAt };
        });

        // STEP 2: Save accounts (quick batch)
        console.log(`[Sync] Saving ${accounts.length} accounts...`);
        const accBatch = db.batch();
        for (const acc of accounts) {
            const isCredit = acc.type === 'CREDIT' || acc.subtype === 'CREDIT_CARD';
            const existing = existingMap[acc.id];

            // Extrair e VALIDAR closingDay e dueDay (1-28)
            const rawClosingDay = acc.creditData?.balanceCloseDate ? new Date(acc.creditData.balanceCloseDate).getDate() : null;
            const rawDueDay = acc.creditData?.balanceDueDate ? new Date(acc.creditData.balanceDueDate).getDate() : null;
            const validClosingDay = validateClosingDay(rawClosingDay);
            const validDueDay = rawDueDay ? Math.max(1, Math.min(28, rawDueDay)) : null;

            const creditFields = isCredit && acc.creditData ? {
                creditLimit: acc.creditData.creditLimit || null,
                availableCreditLimit: acc.creditData.availableCreditLimit || null,
                brand: acc.creditData.brand || null,
                balanceCloseDate: acc.creditData.balanceCloseDate || null,
                balanceDueDate: acc.creditData.balanceDueDate || null,
                closingDay: validClosingDay,
                dueDay: validDueDay,
                // NOVO: Períodos de fatura pré-calculados
                invoicePeriods: calculateInvoicePeriods(validClosingDay, validDueDay)
            } : {};

            accBatch.set(accountsRef.doc(acc.id), removeUndefined({
                ...acc,
                ...creditFields,
                ...(existing?.connectedAt ? {} : { connectedAt: syncTimestamp }),
                accountNumber: acc.number || null,
                itemId,
                connector: itemStatus.item?.connector || null, // Save connector details provided by waitForItemReady
                lastSyncedAt: syncTimestamp,
                updatedAt: syncTimestamp
            }), { merge: true });
        }
        await accBatch.commit();

        // Fetch transactions
        // For each account, use lastSyncedAt as "from" date to avoid re-fetching old transactions
        const defaultFromDate = new Date();
        defaultFromDate.setFullYear(defaultFromDate.getFullYear() - 1); // 12 meses para contas novas
        const defaultFromStr = defaultFromDate.toISOString().split('T')[0];

        console.log(`[Sync] Fetching transactions (incremental mode with pagination)...`);
        const txPromises = accounts.map(async account => {
            const existing = existingMap[account.id];
            let fromStr = defaultFromStr;

            if (existing?.lastSyncedAt) {
                const lastSync = new Date(existing.lastSyncedAt);
                lastSync.setDate(lastSync.getDate() - 1);
                fromStr = lastSync.toISOString().split('T')[0];
            }

            // Use pagination to fetch ALL transactions
            let transactions = await fetchAllTransactions(apiKey, account.id, fromStr);

            // FIXED: Detectar e corrigir duplicidades de estorno (2x negativo)
            transactions = detectAndFixDoubledRefunds(transactions);

            return { account, transactions };
        });

        const allTxResults = await Promise.all(txPromises);

        // STEP 4: Process and batch write all transactions
        let txCount = 0;
        let opCount = 0;
        let currentBatch = db.batch();
        const batchPromises = [];

        for (const { account, transactions } of allTxResults) {
            const isCredit = account.type === 'CREDIT' || account.subtype === 'CREDIT_CARD';
            const isSavings = account.subtype === 'SAVINGS' || account.subtype === 'SAVINGS_ACCOUNT';
            const targetColl = isCredit ? ccTxCollection : txCollection;

            for (const tx of transactions) {
                let mappedTx;

                if (isCredit) {
                    // Credit Card Transaction
                    let invoiceMonthKey = tx.date.slice(0, 7);
                    if (account.creditData?.balanceCloseDate) {
                        const closingDay = new Date(account.creditData.balanceCloseDate).getDate();
                        const txDate = new Date(tx.date);
                        if (txDate.getDate() > closingDay) {
                            txDate.setMonth(txDate.getMonth() + 1);
                        }
                        invoiceMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                    }

                    // Extrair informações de parcelas da API Pluggy
                    let totalInstallments = 1;
                    let installmentNumber = 1;
                    if (tx.installments) {
                        if (typeof tx.installments === 'object') {
                            totalInstallments = tx.installments.total || 1;
                            installmentNumber = tx.installments.number || 1;
                        } else if (typeof tx.installments === 'number') {
                            totalInstallments = tx.installments;
                            const descMatch = (tx.description || '').match(/(\d+)\s*\/\s*(\d+)/);
                            if (descMatch) {
                                installmentNumber = parseInt(descMatch[1]) || 1;
                            }
                        }
                    }

                    mappedTx = {
                        cardId: account.id,
                        date: tx.date.split('T')[0],
                        description: enrichTransactionDescription(tx),
                        amount: Math.abs(tx.amount),
                        type: ((tx.type === 'CREDIT' || tx.amount < 0) || tx._isInferredRefund) ? 'income' : 'expense',
                        category: (tx.category || 'Uncategorized'),
                        status: 'completed',
                        totalInstallments,
                        installmentNumber,
                        invoiceMonthKey,
                        pluggyRaw: tx,
                        // Se foi inferido manual
                        ...(tx._isInferredRefund ? { isRefund: true, category: 'Reembolso' } : {})
                    };
                } else {
                    // Regular/Savings Transaction
                    mappedTx = {
                        providerId: tx.id,
                        description: enrichTransactionDescription(tx),
                        amount: Math.abs(tx.amount),
                        type: tx.amount < 0 ? 'expense' : 'income',
                        date: tx.date.split('T')[0],
                        accountId: tx.accountId,
                        category: tx.category || 'Uncategorized',
                        status: 'completed',
                        updatedAt: syncTimestamp,
                        isInvestment: isSavings,
                        pluggyRaw: tx
                    };
                }

                currentBatch.set(targetColl.doc(tx.id), removeUndefined(mappedTx), { merge: true });
                opCount++;
                txCount++;

                if (opCount >= 450) {
                    batchPromises.push(currentBatch.commit());
                    currentBatch = db.batch();
                    opCount = 0;
                }
            }
        }

        if (opCount > 0) batchPromises.push(currentBatch.commit());

        // Commit all batches in parallel
        await Promise.all(batchPromises);
        console.log(`[Sync] Saved ${txCount} transactions`);

        // ============================================================
        // STEP 4.1: FIX DUPLICATES IN DB (POST-PROCESSING)
        // ============================================================
        await fixDbDuplicates(db, userId);


        // ============================================================
        // STEP 4.5: AUTO-DETECT SUBSCRIPTIONS FROM TRANSACTIONS
        // Detectar assinaturas conhecidas e criar automaticamente
        // Usa 3 métodos: Lista conhecida, Palavras-chave, Padrão de recorrência
        // ============================================================
        const detectedSubscriptions = new Map(); // name -> { amount, category }
        const allTransactionsFlat = []; // Para análise de padrões

        for (const { account, transactions } of allTxResults) {
            for (const tx of transactions) {
                // Só detectar em transações de despesa (mas vamos coletar tudo para análise e usar Math.abs)
                // if (tx.amount >= 0) continue; // REMOVIDO: Pular receitas pode ser perigoso se o sinal vier trocado


                allTransactionsFlat.push(tx); // Coletar para análise de padrões

                // MÉTODO 1: Lista de serviços conhecidos
                const detection = detectSubscriptionService(tx.description);
                if (detection.isSubscription) {
                    const amount = Math.abs(tx.amount);
                    const existingEntry = detectedSubscriptions.get(detection.name);

                    if (!existingEntry || amount > existingEntry.amount) {
                        detectedSubscriptions.set(detection.name, {
                            name: detection.name,
                            amount,
                            category: detection.category || 'Lazer',
                            lastTransactionDate: tx.date,
                            source: 'known_service',
                            chargeDay: new Date(tx.date).getDate()
                        });
                    }
                    continue;
                }

                // MÉTODO 2: Palavras-chave genéricas
                const likelyDetection = detectLikelySubscription(tx.description);
                if (likelyDetection.isLikelySubscription) {
                    const amount = Math.abs(tx.amount);
                    const name = likelyDetection.detectedName;
                    const existingEntry = detectedSubscriptions.get(name);

                    if (!existingEntry) {
                        detectedSubscriptions.set(name, {
                            name,
                            amount,
                            category: 'Outros',
                            lastTransactionDate: tx.date,
                            source: 'keyword_detection',
                            chargeDay: new Date(tx.date).getDate()
                        });
                    }
                }
            }
        }

        // MÉTODO 3: Detecção de padrões de recorrência
        const recurringPatterns = detectRecurringPatterns(allTransactionsFlat);
        for (const [name, data] of recurringPatterns) {
            if (!detectedSubscriptions.has(name)) {
                detectedSubscriptions.set(name, {
                    name: data.name,
                    amount: data.amount,
                    category: data.category,
                    source: 'pattern_detection',
                    occurrences: data.occurrences,
                    chargeDay: data.chargeDay
                });
            }
        }

        // MÉTODO 4: Detecção com IA (Claude)
        try {
            const aiDetected = await detectSubscriptionsWithAI(allTransactionsFlat);
            for (const sub of aiDetected) {
                // Verificar se já foi detectado por outros métodos (priorizamos os métodos determinísticos locais)
                let exists = false;
                for (const existingName of detectedSubscriptions.keys()) {
                    if (existingName.toLowerCase() === sub.name.toLowerCase()) {
                        exists = true;
                        break;
                    }
                }

                if (!exists) {
                    detectedSubscriptions.set(sub.name, {
                        name: sub.name,
                        amount: sub.amount,
                        category: sub.category,
                        source: 'auto_detected',
                        confirmed: false
                    });
                }
            }
        } catch (aiErr) {
            console.error('[SYNC] ⚠️ AI Detection failed:', aiErr);
        }

        // Criar assinaturas detectadas
        if (detectedSubscriptions.size > 0) {
            console.log(`[Sync] 🔍 Detected ${detectedSubscriptions.size} potential subscriptions for user ${userId}`);

            for (const [name, data] of detectedSubscriptions) {
                console.log(`[SUBSCRIPTION] 📌 ${data.source}: "${name}" - R$ ${data.amount.toFixed(2)}`);
            }

            const subscriptionPromises = [];
            for (const [name, data] of detectedSubscriptions) {
                subscriptionPromises.push(
                    createSubscriptionIfNotExists(db, userId, data)
                );
            }

            try {
                const results = await Promise.all(subscriptionPromises);
                const createdCount = results.filter(r => r === true).length;
                if (createdCount > 0) {
                    console.log(`[Sync] ✅ Created ${createdCount} new subscriptions for user ${userId}`);
                }
            } catch (subError) {
                console.error(`[Sync] ⚠️ Error creating subscriptions (non-blocking):`, subError.message);
            }
        }

        // STEP 5: Fetch credit card bills
        const creditAccounts = accounts.filter(a => a.type === 'CREDIT' || a.subtype === 'CREDIT_CARD');

        if (creditAccounts.length > 0) {
            console.log(`[Sync] Fetching bills for ${creditAccounts.length} credit accounts...`);
            const billPromises = creditAccounts.map(account =>
                pluggyApi.get(`/bills?accountId=${account.id}`, { headers: { 'X-API-KEY': apiKey } })
                    .then(resp => ({ account, bills: resp.data.results || [] }))
                    .catch(() => ({ account, bills: [] }))
            );

            const allBillResults = await Promise.all(billPromises);

            // Update all accounts with bills in parallel
            const billUpdatePromises = allBillResults
                .filter(({ bills }) => bills.length > 0)
                .map(({ account, bills }) => {
                    const sorted = bills.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
                    const current = sorted[0];
                    const previous = sorted[1] || null;

                    // Extract finance charges from current bill
                    // Pluggy types: IOF, LATE_PAYMENT_FEE, LATE_PAYMENT_INTEREST, LATE_PAYMENT_REMUNERATIVE_INTEREST, OTHER
                    const financeCharges = current.financeCharges || [];
                    console.log(`[Sync] Finance charges for account ${account.id}:`, JSON.stringify(financeCharges));

                    const iof = financeCharges.find(f => f.type === 'IOF')?.amount || 0;
                    const interest = financeCharges
                        .filter(f => f.type === 'LATE_PAYMENT_INTEREST' || f.type === 'LATE_PAYMENT_REMUNERATIVE_INTEREST' || f.type === 'INTEREST')
                        .reduce((sum, f) => sum + (f.amount || 0), 0);
                    const lateFee = financeCharges.find(f => f.type === 'LATE_PAYMENT_FEE' || f.type === 'LATE_FEE')?.amount || 0;
                    const otherCharges = financeCharges.find(f => f.type === 'OTHER')?.amount || 0;

                    // Calcular datas de período baseado no closingDay configurado
                    const closingDay = account.closingDay || 10;
                    const today = new Date();

                    // Helper para criar data de fechamento
                    const getClosingDate = (year, month, day) => {
                        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
                        const safeDay = Math.min(day, lastDayOfMonth);
                        return new Date(year, month, safeDay, 23, 59, 59);
                    };

                    // Calcular fechamento da fatura atual (próximo fechamento)
                    // REGRA DO APP MOBILE: Se hoje >= closingDay, a fatura desse mês JÁ FECHOU
                    let nextClosingDate;
                    if (today.getDate() < closingDay) {
                        nextClosingDate = getClosingDate(today.getFullYear(), today.getMonth(), closingDay);
                    } else {
                        const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
                        const nextYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
                        nextClosingDate = getClosingDate(nextYear, nextMonth, closingDay);
                    }

                    // Fechamento da última fatura (um mês antes)
                    const lastClosingMonth = nextClosingDate.getMonth() === 0 ? 11 : nextClosingDate.getMonth() - 1;
                    const lastClosingYear = nextClosingDate.getMonth() === 0 ? nextClosingDate.getFullYear() - 1 : nextClosingDate.getFullYear();
                    const lastClosingDate = getClosingDate(lastClosingYear, lastClosingMonth, closingDay);

                    return accountsRef.doc(account.id).update({
                        currentBill: {
                            // Dados básicos da fatura
                            id: current.id,
                            dueDate: current.dueDate,
                            closeDate: current.closeDate || null,
                            // Datas de período calculadas
                            periodStart: new Date(lastClosingDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                            periodEnd: nextClosingDate.toISOString(),
                            status: current.status || 'OPEN',
                            // Valores
                            totalAmount: current.totalAmount || null,
                            totalAmountCurrencyCode: current.totalAmountCurrencyCode || 'BRL',
                            minimumPaymentAmount: current.minimumPaymentAmount || null,
                            paidAmount: current.paidAmount || null,
                            // Flags
                            allowsInstallments: current.allowsInstallments || false,
                            isInstallment: current.isInstallment || false,
                            // Encargos financeiros (processado + original)
                            financeCharges: {
                                iof,
                                interest,
                                lateFee,
                                otherCharges,
                                total: iof + interest + lateFee + otherCharges,
                                details: financeCharges // Array original da API Pluggy
                            }
                        },
                        // Calcular período da fatura anterior
                        previousBill: previous ? (() => {
                            const beforeLastMonth = lastClosingDate.getMonth() === 0 ? 11 : lastClosingDate.getMonth() - 1;
                            const beforeLastYear = lastClosingDate.getMonth() === 0 ? lastClosingDate.getFullYear() - 1 : lastClosingDate.getFullYear();
                            const beforeLastClosingDate = getClosingDate(beforeLastYear, beforeLastMonth, closingDay);

                            return {
                                id: previous.id,
                                dueDate: previous.dueDate,
                                closeDate: previous.closeDate || null,
                                periodStart: new Date(beforeLastClosingDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                                periodEnd: lastClosingDate.toISOString(),
                                status: previous.status || 'CLOSED',
                                totalAmount: previous.totalAmount || null,
                                totalAmountCurrencyCode: previous.totalAmountCurrencyCode || 'BRL',
                                minimumPaymentAmount: previous.minimumPaymentAmount || null,
                                paidAmount: previous.paidAmount || null,
                                financeCharges: previous.financeCharges ? {
                                    iof: previous.financeCharges.find(f => f.type === 'IOF')?.amount || 0,
                                    interest: previous.financeCharges
                                        .filter(f => f.type === 'LATE_PAYMENT_INTEREST' || f.type === 'LATE_PAYMENT_REMUNERATIVE_INTEREST' || f.type === 'INTEREST')
                                        .reduce((sum, f) => sum + (f.amount || 0), 0),
                                    lateFee: previous.financeCharges.find(f => f.type === 'LATE_PAYMENT_FEE' || f.type === 'LATE_FEE')?.amount || 0,
                                    details: previous.financeCharges // Array original
                                } : null
                            };
                        })() : null,
                        bills: sorted.slice(0, 6).map(b => {
                            const bCharges = b.financeCharges || [];
                            return {
                                id: b.id,
                                dueDate: b.dueDate,
                                closeDate: b.closeDate || null,
                                status: b.status || 'UNKNOWN',
                                totalAmount: b.totalAmount || null,
                                totalAmountCurrencyCode: b.totalAmountCurrencyCode || 'BRL',
                                minimumPaymentAmount: b.minimumPaymentAmount || null,
                                paidAmount: b.paidAmount || null,
                                allowsInstallments: b.allowsInstallments || false,
                                financeCharges: {
                                    iof: bCharges.find(f => f.type === 'IOF')?.amount || 0,
                                    interest: bCharges
                                        .filter(f => f.type === 'LATE_PAYMENT_INTEREST' || f.type === 'LATE_PAYMENT_REMUNERATIVE_INTEREST' || f.type === 'INTEREST')
                                        .reduce((sum, f) => sum + (f.amount || 0), 0),
                                    lateFee: bCharges.find(f => f.type === 'LATE_PAYMENT_FEE' || f.type === 'LATE_FEE')?.amount || 0,
                                    details: bCharges // Array original
                                }
                            };
                        }),
                        billsUpdatedAt: syncTimestamp
                    });
                });

            await Promise.all(billUpdatePromises);
        }

        const duration = Date.now() - startTime;
        console.log(`[Sync] Completed in ${duration}ms: ${accounts.length} accounts, ${txCount} transactions`);

        // Return success with details
        return res.json({
            success: true,
            message: `Sincronizado: ${accounts.length} contas, ${txCount} transações`,
            accountsFound: accounts.length,
            transactionsFound: txCount,
            duration
        });

    } catch (err) {
        console.error('[Sync] Failed:', err.message);
        return res.status(500).json({
            success: false,
            error: err.message || 'Erro na sincronização'
        });
    }
});

// 5. Delete Item (optimized)
router.delete('/item/:itemId', withPluggyAuth, async (req, res) => {
    try {
        await pluggyApi.delete(`/items/${req.params.itemId}`, { headers: { 'X-API-KEY': req.pluggyApiKey } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// 6. Get Item Status (optimized with retry)
router.get('/items-status', async (req, res) => {
    res.set('Cache-Control', 'no-store');

    try {
        let apiKey = await getApiKey(false);
        let response;

        try {
            response = await pluggyApi.get('/items', { headers: { 'X-API-KEY': apiKey } });
        } catch (err) {
            if (err.response?.status === 401) {
                apiKey = await getApiKey(true);
                response = await pluggyApi.get('/items', { headers: { 'X-API-KEY': apiKey } });
            } else throw err;
        }

        const items = (response.data.results || []).map(i => ({
            id: i.id,
            status: i.status,
            lastUpdatedAt: i.lastUpdatedAt,
            connectorName: i.connector?.name
        }));

        res.json({ success: true, items });
    } catch (error) {
        res.json({ success: true, items: [], error: error.message });
    }
});

// 7. DB Items (Fallback)
router.get('/db-items/:userId', async (req, res) => {
    // If we want to return items stored in Firebase
    // Useful if pluggy remote keys are problematic
    res.json({ items: [] });
});

// 7.5 Fix Credit Card Signs (Migration)
// One-time endpoint to fix credit card transactions that were saved with inverted signs
router.post('/fix-cc-signs/:userId', async (req, res) => {
    const { userId } = req.params;

    if (!firebaseAdmin) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    try {
        console.log(`[Fix CC Signs] Starting for user ${userId}...`);

        const ccTxCollection = firebaseAdmin.firestore()
            .collection('users').doc(userId).collection('creditCardTransactions');

        const snapshot = await ccTxCollection.get();

        if (snapshot.empty) {
            return res.json({ success: true, message: 'No transactions to fix', fixed: 0 });
        }

        let fixedCount = 0;
        let batch = firebaseAdmin.firestore().batch();
        let batchCount = 0;

        for (const doc of snapshot.docs) {
            const tx = doc.data();

            // Invert the type: expense -> income, income -> expense
            const newType = tx.type === 'expense' ? 'income' : 'expense';

            batch.update(doc.ref, {
                type: newType,
                _fixedSign: true,
                _fixedAt: new Date().toISOString()
            });

            fixedCount++;
            batchCount++;

            // Commit every 450 operations
            if (batchCount >= 450) {
                await batch.commit();
                batch = firebaseAdmin.firestore().batch();
                batchCount = 0;
                console.log(`[Fix CC Signs] Committed batch, ${fixedCount} fixed so far...`);
            }
        }

        // Commit remaining
        if (batchCount > 0) {
            await batch.commit();
        }

        console.log(`[Fix CC Signs] Completed! Fixed ${fixedCount} transactions.`);

        res.json({
            success: true,
            message: `Fixed ${fixedCount} credit card transactions`,
            fixed: fixedCount
        });

    } catch (error) {
        console.error('[Fix CC Signs] Error:', error.message);
        res.status(500).json({ error: 'Failed to fix transactions', message: error.message });
    }
});

// 7.6 Full Re-Sync (Force fetch 12 months of history)
// Use this to re-fetch all transactions for accounts that were connected before the fix
router.post('/full-sync', withPluggyAuth, async (req, res) => {
    const { itemId, userId } = req.body;
    const startTime = Date.now();

    console.log(`[Full-Sync] Starting full sync for item ${itemId}, user ${userId}`);

    if (!firebaseAdmin) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    const db = firebaseAdmin.firestore();
    const apiKey = req.pluggyApiKey;
    const syncTimestamp = new Date().toISOString();
    const accountsRef = db.collection('users').doc(userId).collection('accounts');
    const txCollection = db.collection('users').doc(userId).collection('transactions');
    const ccTxCollection = db.collection('users').doc(userId).collection('creditCardTransactions');

    try {
        // STEP 0: Wait for Pluggy item to be ready
        console.log(`[Full-Sync] Waiting for item ${itemId} to be ready...`);
        const itemStatus = await waitForItemReady(apiKey, itemId);
        console.log(`[Full-Sync] Item ready check: ${itemStatus.status}`);

        if (!itemStatus.ready && itemStatus.status === 'WAITING_USER_INPUT') {
            return res.json({
                success: false,
                error: 'O banco requer ação adicional. Tente reconectar.',
                needsReconnect: true
            });
        }

        // STEP 1: Fetch accounts
        console.log(`[Full-Sync] Fetching accounts...`);
        const accountsResp = await pluggyApi.get(`/accounts?itemId=${itemId}`, { headers: { 'X-API-KEY': apiKey } });
        const accounts = accountsResp.data.results || [];
        console.log(`[Full-Sync] Found ${accounts.length} accounts`);

        if (accounts.length === 0) {
            return res.json({
                success: true,
                message: '0 contas encontradas.',
                accountsFound: 0,
                transactionsFound: 0
            });
        }

        // STEP 2: Save accounts (quick batch)
        console.log(`[Full-Sync] Saving ${accounts.length} accounts...`);
        const accBatch = db.batch();
        for (const acc of accounts) {
            const isCredit = acc.type === 'CREDIT' || acc.subtype === 'CREDIT_CARD';

            // Extrair e VALIDAR closingDay e dueDay (1-28)
            const rawClosingDay = acc.creditData?.balanceCloseDate ? new Date(acc.creditData.balanceCloseDate).getDate() : null;
            const rawDueDay = acc.creditData?.balanceDueDate ? new Date(acc.creditData.balanceDueDate).getDate() : null;
            const validClosingDay = validateClosingDay(rawClosingDay);
            const validDueDay = rawDueDay ? Math.max(1, Math.min(28, rawDueDay)) : null;

            const creditFields = isCredit && acc.creditData ? {
                creditLimit: acc.creditData.creditLimit || null,
                availableCreditLimit: acc.creditData.availableCreditLimit || null,
                brand: acc.creditData.brand || null,
                balanceCloseDate: acc.creditData.balanceCloseDate || null,
                balanceDueDate: acc.creditData.balanceDueDate || null,
                closingDay: validClosingDay,
                dueDay: validDueDay,
                // NOVO: Períodos de fatura pré-calculados
                invoicePeriods: calculateInvoicePeriods(validClosingDay, validDueDay)
            } : {};

            console.log(`[Full-Sync] Account ${acc.id} (${acc.name}):`, {
                isCredit,
                rawClosingDay,
                validClosingDay,
                rawDueDay,
                validDueDay
            });

            accBatch.set(accountsRef.doc(acc.id), {
                ...acc,
                ...creditFields,
                accountNumber: acc.number || null,
                itemId,
                connector: itemStatus.item?.connector || null,
                lastSyncedAt: syncTimestamp,
                updatedAt: syncTimestamp
            }, { merge: true });
        }
        await accBatch.commit();
        console.log(`[Full-Sync] Accounts saved`);

        // STEP 3: FULL SYNC - Always fetch 12 months (ignores lastSyncedAt)
        const fromDate = new Date();
        fromDate.setFullYear(fromDate.getFullYear() - 1); // 12 meses
        const fromStr = fromDate.toISOString().split('T')[0];

        console.log(`[Full-Sync] Fetching ALL transactions from ${fromStr} (12 meses)...`);
        const txPromises = accounts.map(async account => {
            const transactions = await fetchAllTransactions(apiKey, account.id, fromStr);
            console.log(`[Full-Sync] Account ${account.id}: ${transactions.length} transactions`);
            return { account, transactions };
        });

        const allTxResults = await Promise.all(txPromises);

        // STEP 4: Process and batch write all transactions
        let txCount = 0;
        let opCount = 0;
        let currentBatch = db.batch();
        const batchPromises = [];

        for (const { account, transactions } of allTxResults) {
            const isCredit = account.type === 'CREDIT' || account.subtype === 'CREDIT_CARD';
            const isSavings = account.subtype === 'SAVINGS' || account.subtype === 'SAVINGS_ACCOUNT';
            const targetColl = isCredit ? ccTxCollection : txCollection;

            for (const tx of transactions) {
                let mappedTx;

                if (isCredit) {
                    let invoiceMonthKey = tx.date.slice(0, 7);
                    if (account.creditData?.balanceCloseDate) {
                        const closingDay = new Date(account.creditData.balanceCloseDate).getDate();
                        const txDate = new Date(tx.date);
                        if (txDate.getDate() > closingDay) {
                            txDate.setMonth(txDate.getMonth() + 1);
                        }
                        invoiceMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                    }

                    // Extrair informações de parcelas da API Pluggy
                    let totalInstallments = 1;
                    let installmentNumber = 1;
                    if (tx.installments) {
                        if (typeof tx.installments === 'object') {
                            totalInstallments = tx.installments.total || 1;
                            installmentNumber = tx.installments.number || 1;
                        } else if (typeof tx.installments === 'number') {
                            totalInstallments = tx.installments;
                            const descMatch = (tx.description || '').match(/(\d+)\s*\/\s*(\d+)/);
                            if (descMatch) {
                                installmentNumber = parseInt(descMatch[1]) || 1;
                            }
                        }
                    }

                    mappedTx = {
                        cardId: account.id,
                        date: tx.date.split('T')[0],
                        description: enrichTransactionDescription(tx),
                        amount: Math.abs(tx.amount),
                        type: tx.amount > 0 ? 'expense' : 'income',
                        category: tx.category || 'Uncategorized',
                        status: 'completed',
                        totalInstallments,
                        installmentNumber,
                        invoiceMonthKey,
                        pluggyRaw: tx
                    };
                } else {
                    mappedTx = {
                        providerId: tx.id,
                        description: enrichTransactionDescription(tx),
                        amount: Math.abs(tx.amount),
                        type: tx.amount < 0 ? 'expense' : 'income',
                        date: tx.date.split('T')[0],
                        accountId: tx.accountId,
                        category: tx.category || 'Uncategorized',
                        status: 'completed',
                        updatedAt: syncTimestamp,
                        isInvestment: isSavings,
                        pluggyRaw: tx
                    };
                }

                currentBatch.set(targetColl.doc(tx.id), mappedTx, { merge: true });
                opCount++;
                txCount++;

                if (opCount >= 450) {
                    batchPromises.push(currentBatch.commit());
                    currentBatch = db.batch();
                    opCount = 0;
                }
            }
        }

        if (opCount > 0) batchPromises.push(currentBatch.commit());
        await Promise.all(batchPromises);
        console.log(`[Full-Sync] Saved ${txCount} transactions`);

        const duration = Date.now() - startTime;
        console.log(`[Full-Sync] Completed in ${duration}ms: ${accounts.length} accounts, ${txCount} transactions`);

        return res.json({
            success: true,
            message: `Full sync concluído: ${accounts.length} contas, ${txCount} transações (12 meses)`,
            accountsFound: accounts.length,
            transactionsFound: txCount,
            duration
        });

    } catch (err) {
        console.error('[Full-Sync] Failed:', err.message);
        return res.status(500).json({
            success: false,
            error: err.message || 'Erro no full sync'
        });
    }
});

// 8. Webhook Worker (Cron Job - optimized)
router.get('/webhook-worker', async (req, res) => {
    if (!firebaseAdmin) return res.json({ success: true, message: 'Firebase not available' });

    try {
        const apiKey = await getApiKey(true);
        const response = await pluggyApi.get('/items', { headers: { 'X-API-KEY': apiKey } });
        const items = response.data.results || [];
        const updated = items.filter(i => i.status === 'UPDATED').length;

        res.json({ success: true, items: items.length, updated, ts: Date.now() });
    } catch (error) {
        res.json({ success: true, error: error.message });
    }
});

// 9. Webhook Receiver - ACTIVE PROCESSING
// Receives events from Pluggy and triggers sync automatically
router.post('/webhook', async (req, res) => {
    // Immediate response to Pluggy (required within 5s)
    res.json({ success: true, received: true });

    const { event: eventType, itemId, data } = req.body || {};

    if (!eventType || !itemId) {
        console.log('[Webhook] Invalid payload - missing event or itemId');
        return;
    }

    console.log(`[Webhook] Received: ${eventType} - Item: ${itemId}`);

    // Only process relevant events
    const syncEvents = [
        'item/updated',      // Item data was refreshed
        'item/created',      // New item connected
        'connector/status_updated' // Connector status changed
    ];

    if (!syncEvents.includes(eventType)) {
        console.log(`[Webhook] Ignoring event type: ${eventType}`);
        return;
    }

    if (!firebaseAdmin) {
        console.log('[Webhook] Firebase Admin not initialized, skipping sync');
        return;
    }

    // Background processing - find userId and sync
    (async () => {
        try {
            const db = firebaseAdmin.firestore();

            // Find which user owns this itemId by searching pluggyItems subcollections
            // We use a collection group query to search across all users
            const pluggyItemsQuery = db.collectionGroup('pluggyItems')
                .where('itemId', '==', itemId)
                .limit(1);

            const snapshot = await pluggyItemsQuery.get();

            if (snapshot.empty) {
                // Fallback: Try to find in accounts collection
                const accountsQuery = db.collectionGroup('accounts')
                    .where('itemId', '==', itemId)
                    .limit(1);

                const accountsSnapshot = await accountsQuery.get();

                if (accountsSnapshot.empty) {
                    console.log(`[Webhook] No user found for item ${itemId}`);
                    return;
                }

                // Extract userId from the path: users/{userId}/accounts/{accountId}
                const accountPath = accountsSnapshot.docs[0].ref.path;
                const userId = accountPath.split('/')[1];

                await processWebhookSync(db, userId, itemId, eventType);
                return;
            }

            // Extract userId from the path: users/{userId}/pluggyItems/{itemId}
            const docPath = snapshot.docs[0].ref.path;
            const userId = docPath.split('/')[1];

            await processWebhookSync(db, userId, itemId, eventType);

        } catch (err) {
            console.error(`[Webhook] Error processing ${eventType}:`, err.message);
        }
    })();
});

// Helper function to process webhook sync
async function processWebhookSync(db, userId, itemId, eventType) {
    console.log(`[Webhook] Processing sync for user ${userId}, item ${itemId}`);

    const syncTimestamp = new Date().toISOString();

    // Create a sync job to track progress
    const jobDoc = await db.collection('users').doc(userId).collection('sync_jobs').add({
        itemId,
        status: 'processing',
        progress: 0,
        type: 'WEBHOOK',
        triggerEvent: eventType,
        createdAt: syncTimestamp
    });

    const accountsRef = db.collection('users').doc(userId).collection('accounts');
    const txCollection = db.collection('users').doc(userId).collection('transactions');
    const ccTxCollection = db.collection('users').doc(userId).collection('creditCardTransactions');

    try {
        const apiKey = await getApiKey();

        // Wait for item to be ready
        const itemStatus = await waitForItemReady(apiKey, itemId, 30000);

        if (!itemStatus.ready && itemStatus.status === 'WAITING_USER_INPUT') {
            await jobDoc.update({
                status: 'failed',
                error: 'O banco requer ação adicional',
                needsReconnect: true,
                updatedAt: new Date().toISOString()
            });
            return;
        }

        if (itemStatus.status === 'LOGIN_ERROR') {
            await jobDoc.update({
                status: 'failed',
                error: 'Erro de login no banco',
                needsReconnect: true,
                updatedAt: new Date().toISOString()
            });
            return;
        }

        // Fetch accounts
        const [accountsResp, existingSnap] = await Promise.all([
            pluggyApi.get(`/accounts?itemId=${itemId}`, { headers: { 'X-API-KEY': apiKey } }),
            accountsRef.get()
        ]);

        const accounts = accountsResp.data.results || [];
        console.log(`[Webhook] Found ${accounts.length} accounts for item ${itemId}`);

        const existingMap = {};
        existingSnap.forEach(doc => {
            const d = doc.data();
            existingMap[doc.id] = {
                connectedAt: d.connectedAt,
                lastSyncedAt: d.lastSyncedAt,
                customName: d.name, // Preservar o apelido customizado do usuário
                originalName: d.originalName // Nome original da API para comparação
            };
        });

        // Save accounts
        const accBatch = db.batch();
        for (const acc of accounts) {
            const isCredit = acc.type === 'CREDIT' || acc.subtype === 'CREDIT_CARD';
            const existing = existingMap[acc.id];

            const rawClosingDay = acc.creditData?.balanceCloseDate ? new Date(acc.creditData.balanceCloseDate).getDate() : null;
            const rawDueDay = acc.creditData?.balanceDueDate ? new Date(acc.creditData.balanceDueDate).getDate() : null;
            const validClosingDay = validateClosingDay(rawClosingDay);
            const validDueDay = rawDueDay ? Math.max(1, Math.min(28, rawDueDay)) : null;

            const creditFields = isCredit && acc.creditData ? {
                creditLimit: acc.creditData.creditLimit || null,
                availableCreditLimit: acc.creditData.availableCreditLimit || null,
                brand: acc.creditData.brand || null,
                balanceCloseDate: acc.creditData.balanceCloseDate || null,
                balanceDueDate: acc.creditData.balanceDueDate || null,
                closingDay: validClosingDay,
                dueDay: validDueDay,
                invoicePeriods: calculateInvoicePeriods(validClosingDay, validDueDay)
            } : {};

            // PRESERVAR APELIDO CUSTOMIZADO:
            const apiName = acc.name || acc.marketingName || 'Conta';
            let nameToSave = apiName;

            if (existing?.customName) {
                // CASO 1: Se temos originalName, comparar com ele
                // CASO 2: Se não temos originalName (conta antiga), comparar diretamente com apiName
                const previousOriginalName = existing.originalName || apiName;
                if (existing.customName !== previousOriginalName) {
                    nameToSave = existing.customName; // Manter o apelido do usuário
                    console.log(`[Webhook] Preservando apelido: "${existing.customName}" (original: "${apiName}")`);
                }
            }

            accBatch.set(accountsRef.doc(acc.id), removeUndefined({
                ...acc,
                name: nameToSave, // Usar nome preservado ou da API
                originalName: apiName, // Sempre salvar o nome original da API para referência
                ...creditFields,
                ...(existing?.connectedAt ? {} : { connectedAt: syncTimestamp }),
                accountNumber: acc.number || null,
                itemId,
                lastSyncedAt: syncTimestamp,
                updatedAt: syncTimestamp
            }), { merge: true });
        }
        await accBatch.commit();

        // Fetch transactions (last 30 days for webhook - incremental)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const fromStr = thirtyDaysAgo.toISOString().split('T')[0];

        const txPromises = accounts.map(async account => {
            const transactions = await fetchAllTransactions(apiKey, account.id, fromStr);
            return { account, transactions };
        });

        const allTxResults = await Promise.all(txPromises);

        // Process and save transactions
        let txCount = 0;
        let opCount = 0;
        let currentBatch = db.batch();
        const batchPromises = [];

        for (const { account, transactions } of allTxResults) {
            const isCredit = account.type === 'CREDIT' || account.subtype === 'CREDIT_CARD';
            const isSavings = account.subtype === 'SAVINGS' || account.subtype === 'SAVINGS_ACCOUNT';
            const targetColl = isCredit ? ccTxCollection : txCollection;

            for (const tx of transactions) {
                let mappedTx;

                if (isCredit) {
                    let invoiceMonthKey = tx.date.slice(0, 7);
                    if (account.creditData?.balanceCloseDate) {
                        const closingDay = new Date(account.creditData.balanceCloseDate).getDate();
                        const txDate = new Date(tx.date);
                        if (txDate.getDate() > closingDay) {
                            txDate.setMonth(txDate.getMonth() + 1);
                        }
                        invoiceMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                    }

                    let totalInstallments = 1;
                    let installmentNumber = 1;
                    if (tx.installments) {
                        if (typeof tx.installments === 'object') {
                            totalInstallments = tx.installments.total || 1;
                            installmentNumber = tx.installments.number || 1;
                        } else if (typeof tx.installments === 'number') {
                            totalInstallments = tx.installments;
                            const descMatch = (tx.description || '').match(/(\d+)\s*\/\s*(\d+)/);
                            if (descMatch) {
                                installmentNumber = parseInt(descMatch[1]) || 1;
                            }
                        }
                    }

                    mappedTx = {
                        cardId: account.id,
                        date: tx.date.split('T')[0],
                        description: enrichTransactionDescription(tx),
                        amount: Math.abs(tx.amount),
                        type: tx.amount > 0 ? 'expense' : 'income',
                        category: tx.category || 'Uncategorized',
                        status: 'completed',
                        totalInstallments,
                        installmentNumber,
                        invoiceMonthKey,
                        pluggyRaw: tx
                    };
                } else {
                    mappedTx = {
                        providerId: tx.id,
                        description: enrichTransactionDescription(tx),
                        amount: Math.abs(tx.amount),
                        type: tx.amount < 0 ? 'expense' : 'income',
                        date: tx.date.split('T')[0],
                        accountId: tx.accountId,
                        category: tx.category || 'Uncategorized',
                        status: 'completed',
                        updatedAt: syncTimestamp,
                        isInvestment: isSavings,
                        pluggyRaw: tx
                    };
                }

                currentBatch.set(targetColl.doc(tx.id), removeUndefined(mappedTx), { merge: true });
                opCount++;
                txCount++;

                if (opCount >= 450) {
                    batchPromises.push(currentBatch.commit());
                    currentBatch = db.batch();
                    opCount = 0;
                }
            }
        }

        if (opCount > 0) batchPromises.push(currentBatch.commit());
        await Promise.all(batchPromises);

        // Fetch bills for credit cards
        const creditAccounts = accounts.filter(a => a.type === 'CREDIT' || a.subtype === 'CREDIT_CARD');

        const billPromises = creditAccounts.map(account =>
            pluggyApi.get(`/bills?accountId=${account.id}`, { headers: { 'X-API-KEY': apiKey } })
                .then(resp => ({ account, bills: resp.data.results || [] }))
                .catch(() => ({ account, bills: [] }))
        );

        const allBillResults = await Promise.all(billPromises);

        const billUpdatePromises = allBillResults
            .filter(({ bills }) => bills.length > 0)
            .map(({ account, bills }) => {
                const sorted = bills.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
                const current = sorted[0];

                return accountsRef.doc(account.id).update({
                    currentBill: {
                        id: current.id,
                        dueDate: current.dueDate,
                        closeDate: current.closeDate || null,
                        status: current.status || 'OPEN',
                        totalAmount: current.totalAmount || null
                    },
                    bills: sorted.slice(0, 6).map(b => ({
                        id: b.id,
                        dueDate: b.dueDate,
                        status: b.status || 'UNKNOWN',
                        totalAmount: b.totalAmount || null
                    })),
                    billsUpdatedAt: syncTimestamp
                });
            });

        await Promise.all(billUpdatePromises);

        // Update job as completed
        await jobDoc.update({
            status: 'completed',
            progress: 100,
            transactionsFound: txCount,
            accountsFound: accounts.length,
            updatedAt: new Date().toISOString(),
            message: `Webhook sync: ${txCount} transações em ${accounts.length} contas`
        });

        // Add notification for user
        await db.collection('users').doc(userId).collection('notifications').add({
            type: 'sync_complete',
            title: 'Sincronização automática',
            message: `${txCount} transações atualizadas via conexão bancária`,
            date: new Date().toISOString(),
            read: false
        });

        console.log(`[Webhook] ✅ Sync completed for user ${userId}: ${txCount} transactions`);

    } catch (err) {
        console.error(`[Webhook] ❌ Sync failed for user ${userId}:`, err.message);
        await jobDoc.update({
            status: 'failed',
            error: err.message,
            updatedAt: new Date().toISOString()
        });
    }
}

// ============================================================
// ENDPOINT: Detect subscriptions from existing transactions
// Analisa transações já salvas no banco para detectar assinaturas
// ============================================================
router.post('/detect-subscriptions', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    if (!firebaseAdmin) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    console.log(`[Detect-Subscriptions] Starting for user ${userId}`);

    const db = firebaseAdmin.firestore();

    try {
        // Fetch all transactions from both collections
        const [ccTxSnap, txSnap] = await Promise.all([
            db.collection('users').doc(userId).collection('creditCardTransactions').get(),
            db.collection('users').doc(userId).collection('transactions').get()
        ]);

        const allTransactions = [];

        ccTxSnap.forEach(doc => {
            const data = doc.data();
            allTransactions.push({
                id: doc.id,
                description: data.description,
                amount: data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount),
                date: data.date
            });
        });

        txSnap.forEach(doc => {
            const data = doc.data();
            allTransactions.push({
                id: doc.id,
                description: data.description,
                amount: data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount),
                date: data.date
            });
        });

        console.log(`[Detect-Subscriptions] Analyzing ${allTransactions.length} transactions`);

        // Debug: Log some sample descriptions with amounts
        const sampleTx = allTransactions.slice(0, 15).map(t => ({ desc: t.description, amt: t.amount }));
        console.log(`[Detect-Subscriptions] Sample transactions:`, JSON.stringify(sampleTx));

        // Check if there's a Spotify transaction
        const spotifyTx = allTransactions.find(t => t.description && t.description.toLowerCase().includes('spotify'));
        if (spotifyTx) {
            console.log(`[Detect-Subscriptions] 🔍 Found Spotify transaction:`, JSON.stringify(spotifyTx));
        }

        const detectedSubscriptions = new Map();
        const allTransactionsFlat = [];

        for (const tx of allTransactions) {
            // Skip if no description
            if (!tx.description) continue;

            // For detection, we look at all transactions (amount sign doesn't matter for subscription detection)
            // We'll use the absolute value for the amount
            allTransactionsFlat.push(tx);

            // MÉTODO 1: Lista de serviços conhecidos
            const detection = detectSubscriptionService(tx.description);
            if (detection.isSubscription) {
                const amount = Math.abs(tx.amount);
                const existingEntry = detectedSubscriptions.get(detection.name);

                if (!existingEntry || amount > existingEntry.amount) {
                    detectedSubscriptions.set(detection.name, {
                        name: detection.name,
                        amount,
                        category: detection.category || 'Lazer',
                        lastTransactionDate: tx.date,
                        source: 'known_service'
                    });
                }
                continue;
            }

            // MÉTODO 2: Palavras-chave genéricas
            const likelyDetection = detectLikelySubscription(tx.description);
            if (likelyDetection.isLikelySubscription) {
                const amount = Math.abs(tx.amount);
                const name = likelyDetection.detectedName;
                const existingEntry = detectedSubscriptions.get(name);

                if (!existingEntry) {
                    detectedSubscriptions.set(name, {
                        name,
                        amount,
                        category: 'Outros',
                        lastTransactionDate: tx.date,
                        source: 'keyword_detection'
                    });
                }
            }
        }

        // MÉTODO 3: Detecção de padrões de recorrência
        const recurringPatterns = detectRecurringPatterns(allTransactionsFlat);
        for (const [name, data] of recurringPatterns) {
            if (!detectedSubscriptions.has(name)) {
                detectedSubscriptions.set(name, {
                    name: data.name,
                    amount: data.amount,
                    category: data.category,
                    source: 'pattern_detection',
                    occurrences: data.occurrences
                });
            }
        }

        // MÉTODO 4: Detecção com IA (Claude)
        try {
            const aiDetected = await detectSubscriptionsWithAI(allTransactionsFlat);
            for (const sub of aiDetected) {
                // Verificar se já foi detectado por outros métodos (priorizamos os métodos determinísticos locais)
                let exists = false;
                for (const existingName of detectedSubscriptions.keys()) {
                    if (existingName.toLowerCase() === sub.name.toLowerCase()) {
                        exists = true;
                        break;
                    }
                }

                if (!exists) {
                    detectedSubscriptions.set(sub.name, {
                        name: sub.name,
                        amount: sub.amount,
                        category: sub.category,
                        source: 'auto_detected', // Usamos auto_detected genérico ou 'ai_detected' se quisermos diferenciar
                        confirmed: false
                    });
                }
            }
        } catch (aiErr) {
            console.error('[Detect-Subscriptions] ⚠️ AI Detection failed:', aiErr);
        }

        // Criar assinaturas detectadas
        let createdCount = 0;
        const detected = [];

        if (detectedSubscriptions.size > 0) {
            console.log(`[Detect-Subscriptions] 🔍 Found ${detectedSubscriptions.size} potential subscriptions`);

            for (const [name, data] of detectedSubscriptions) {
                console.log(`[SUBSCRIPTION] 📌 ${data.source}: "${name}" - R$ ${data.amount.toFixed(2)}`);
                detected.push({ name, amount: data.amount, category: data.category, source: data.source });

                const created = await createSubscriptionIfNotExists(db, userId, data);
                if (created) createdCount++;
            }
        }

        console.log(`[Detect-Subscriptions] ✅ Created ${createdCount} new subscriptions`);

        res.json({
            success: true,
            message: `Detectadas ${detectedSubscriptions.size} assinaturas, ${createdCount} novas criadas.`,
            detected,
            createdCount
        });

    } catch (error) {
        console.error(`[Detect-Subscriptions] ❌ Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ENDPOINT: Update existing subscriptions to add auto_detected fields
// Atualiza assinaturas existentes que não têm os novos campos
// ============================================================
router.post('/update-subscriptions-fields', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    if (!firebaseAdmin) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    console.log(`[Update-Subscriptions] Starting for user ${userId}`);

    const db = firebaseAdmin.firestore();

    try {
        const subsRef = db.collection('users').doc(userId).collection('subscriptions');
        const snapshot = await subsRef.get();

        let updatedCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            console.log(`[Update-Subscriptions] 🔍 "${data.name}" - source: ${data.source}, confirmed: ${data.confirmed}`);

            // Se não tem o campo 'source' OU source é diferente de manual, adiciona os novos campos
            if (!data.source || (data.source === 'auto_detected' && data.confirmed === true)) {
                await subsRef.doc(doc.id).update({
                    source: 'auto_detected',
                    confirmed: false,
                    detectedAt: data.detectedAt || new Date().toISOString()
                });
                updatedCount++;
                console.log(`[Update-Subscriptions] ✅ Updated: "${data.name}"`);
            }
        }

        console.log(`[Update-Subscriptions] ✅ Updated ${updatedCount} subscriptions`);

        res.json({
            success: true,
            message: `${updatedCount} assinaturas atualizadas.`,
            updatedCount
        });

    } catch (error) {
        console.error(`[Update-Subscriptions] ❌ Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;

