import express from 'express';
import axios from 'axios';
import { firebaseAdmin } from './firebaseAdmin.js';
import { loadEnv } from './env.js';
import { v4 as uuidv4 } from 'uuid';

loadEnv();

const router = express.Router();

const CLIENT_ID = process.env.PLUGGY_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET?.trim();
const BASE_URL = 'https://api.pluggy.ai';

// Vercel Pro timeout config (max 60s, use 55s for safety)
const VERCEL_TIMEOUT = 55000;
const AXIOS_TIMEOUT = 15000; // 15s per request max

// Create optimized axios instance
const pluggyApi = axios.create({
    baseURL: BASE_URL,
    timeout: AXIOS_TIMEOUT,
    headers: { 'Content-Type': 'application/json' }
});

// Minimal startup log
console.log('Pluggy: Ready', { hasCredentials: !!(CLIENT_ID && CLIENT_SECRET) });

// ============================================================
// HELPER: Validar e normalizar closingDay (1-28)
// ============================================================
const validateClosingDay = (day) => {
    if (!day || typeof day !== 'number') return 10; // Default
    // Limitar a 1-28 para evitar problemas com meses curtos (fevereiro)
    return Math.max(1, Math.min(28, day));
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

    // Helper para formatar data como ISO string (apenas data)
    const toDateStr = (d) => d.toISOString().split('T')[0];

    // Helper para criar monthKey (YYYY-MM)
    const toMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // Calcular fechamento da fatura ATUAL (próximo fechamento a partir de hoje)
    let currentClosingDate;
    if (today.getDate() <= closingDay) {
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

    // Log de debug detalhado
    console.log('[InvoicePeriods] Calculado:', {
        closingDay,
        dueDay: safeDueDay,
        today: toDateStr(today),
        lastInvoice: {
            start: toDateStr(lastInvoiceStart),
            end: toDateStr(lastClosingDate),
            due: toDateStr(lastDueDate),
            monthKey: toMonthKey(lastClosingDate)
        },
        currentInvoice: {
            start: toDateStr(currentInvoiceStart),
            end: toDateStr(currentClosingDate),
            due: toDateStr(currentDueDate),
            monthKey: toMonthKey(currentClosingDate)
        },
        nextInvoice: {
            start: toDateStr(nextInvoiceStart),
            end: toDateStr(nextClosingDate),
            due: toDateStr(nextDueDate),
            monthKey: toMonthKey(nextClosingDate)
        }
    });

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

    console.log('[InvoiceMonthKey]', {
        txDate,
        closingDay: validClosingDay,
        dayOfTx: new Date(txDate).getDate(),
        result: monthKey
    });

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
        const response = await pluggyApi.post('/connect_token', {
            webhookUrl: process.env.PLUGGY_WEBHOOK_URL,
            clientUserId: req.body.userId
        }, { headers: { 'X-API-KEY': req.pluggyApiKey } });

        res.json({ accessToken: response.data.accessToken });
    } catch (error) {
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

// 3. Trigger Sync (Update Item) - OPTIMIZED FOR VERCEL PRO
// Ultra-fast parallel processing
router.post('/trigger-sync', withPluggyAuth, async (req, res) => {
    const { itemId, userId } = req.body;
    const startTime = Date.now();

    console.log('[SYNC-START] Iniciando sincronização:', { itemId, userId, timestamp: new Date().toISOString() });

    if (!firebaseAdmin) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    const db = firebaseAdmin.firestore();
    const jobDoc = await db.collection('users').doc(userId).collection('sync_jobs').add({
        itemId,
        status: 'processing',
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

            // STEP 0: Capture item state BEFORE triggering sync
            let itemBeforeSync = null;
            try {
                const beforeResp = await pluggyApi.get(`/items/${itemId}`, {
                    headers: { 'X-API-KEY': apiKey }
                });
                itemBeforeSync = beforeResp.data;
                console.log(`[Trigger-Sync] Item ANTES do PATCH:`, {
                    id: itemBeforeSync.id,
                    status: itemBeforeSync.status,
                    lastUpdatedAt: itemBeforeSync.lastUpdatedAt,
                    executionStatus: itemBeforeSync.executionStatus,
                    connector: itemBeforeSync.connector?.name || 'unknown'
                });
            } catch (err) {
                console.log('[Trigger-Sync] Could not fetch item before sync:', err.message);
            }

            try {
                // Body vazio força sincronização real com o banco (não apenas atualiza webhook)
                // Ref: https://docs.pluggy.ai/reference/items-update
                console.log(`[Trigger-Sync] Enviando PATCH para /items/${itemId}...`);
                const patchResp = await pluggyApi.patch(`/items/${itemId}`, {}, {
                    headers: { 'X-API-KEY': apiKey }
                });
                console.log(`[Trigger-Sync] PATCH response status:`, patchResp.status, patchResp.data?.status);
            } catch (err) {
                if (err.response?.status === 404) {
                    await jobDoc.update({ status: 'failed', error: 'Item not found', needsReconnect: true });
                    return;
                }
                // Other errors - continue anyway, item might still be valid
                console.log('[Trigger-Sync] Patch warning:', err.message, err.response?.data);
            }

            // CRITICAL: Wait for Pluggy to finish fetching data from bank
            // Pass the old lastUpdatedAt so we can verify a NEW sync happened
            // Use 90s timeout for slower banks like C6
            await updateProgress(10, 'Aguardando dados do banco...');
            const itemStatus = await waitForItemReady(apiKey, itemId, 90000, itemBeforeSync?.lastUpdatedAt);
            console.log(`[Trigger-Sync] Item ready check:`, {
                status: itemStatus.status,
                executionStatus: itemStatus.item?.executionStatus,
                lastUpdatedAtBefore: itemBeforeSync?.lastUpdatedAt,
                lastUpdatedAtAfter: itemStatus.item?.lastUpdatedAt,
                didUpdate: itemStatus.item?.lastUpdatedAt !== itemBeforeSync?.lastUpdatedAt,
                connector: itemStatus.item?.connector?.name
            });

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

            // Debug: Log balances recebidos do Pluggy
            console.log('[Trigger-Sync] Accounts with balances:', accounts.map(a => ({
                id: a.id, name: a.name, balance: a.balance, type: a.type
            })));

            const existingMap = {};
            existingSnap.forEach(doc => {
                const d = doc.data();
                existingMap[doc.id] = {
                    connectedAt: d.connectedAt,
                    lastSyncedAt: d.lastSyncedAt // Track last sync for incremental fetching
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

                console.log(`[Trigger-Sync] Account ${acc.id} (${acc.name}):`, {
                    isCredit,
                    rawClosingDay,
                    validClosingDay,
                    rawDueDay,
                    validDueDay
                });

                accBatch.set(accountsRef.doc(acc.id), {
                    ...acc,
                    ...creditFields,
                    ...(existing?.connectedAt ? {} : { connectedAt: syncTimestamp }),
                    accountNumber: acc.number || null,
                    itemId,
                    lastSyncedAt: syncTimestamp,
                    updatedAt: syncTimestamp
                }, { merge: true });
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
            if (forceExtendedFetch) {
                console.log(`[Trigger-Sync] ⚠️ Forcing extended fetch (30 days) due to status: ${itemStatus.status}`);
            }

            const txPromises = accounts.map(async account => {
                const existing = existingMap[account.id];
                let fromStr = defaultFromStr;
                let syncMode = 'first';
                const connectorName = account.connector?.name || itemStatus.item?.connector?.name || 'unknown';

                // If we detected a problematic sync, force at least 30 days to be safe
                if (forceExtendedFetch) {
                    fromStr = thirtyDaysAgoStr;
                    syncMode = 'force-extended';
                    console.log(`[Sync] Conta ${account.id} (${account.name}) [${connectorName}]: sync problemático detectado, buscando desde ${fromStr} (30 dias)`);
                } else if (existing?.lastSyncedAt) {
                    // If account was synced before, only fetch transactions since last sync
                    const lastSync = new Date(existing.lastSyncedAt);
                    const hoursSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

                    // If last sync was very recent (<6 hours), fetch at least 7 days
                    // This helps catch transactions that might have been delayed
                    if (hoursSinceLastSync < 6) {
                        fromStr = oneWeekAgoStr;
                        syncMode = 'incremental-extended';
                        console.log(`[Sync] Conta ${account.id} (${account.name}) [${connectorName}]: sync recente (${hoursSinceLastSync.toFixed(1)}h atrás), buscando desde ${fromStr} (7 dias)`);
                    } else {
                        // Subtract 1 day as safety margin for timezone/timing issues
                        lastSync.setDate(lastSync.getDate() - 1);
                        fromStr = lastSync.toISOString().split('T')[0];
                        syncMode = 'incremental';
                        console.log(`[Sync] Conta ${account.id} (${account.name}) [${connectorName}]: sync incremental desde ${fromStr}`);
                    }
                } else {
                    console.log(`[Sync] Conta ${account.id} (${account.name}) [${connectorName}]: primeiro sync, buscando desde ${fromStr} (12 meses)`);
                }

                // Use pagination to fetch ALL transactions
                const transactions = await fetchAllTransactions(apiKey, account.id, fromStr);
                return { account, transactions, fromDate: fromStr, syncMode, connectorName };
            });

            const allTxResults = await Promise.all(txPromises);

            // Log incremental fetch results
            let totalNewTx = 0;
            allTxResults.forEach(({ account, transactions, fromDate, syncMode, connectorName }) => {
                totalNewTx += transactions.length;
                console.log(`[Trigger-Sync] Account ${account.id} (${account.name}) [${connectorName}]:`, {
                    syncMode,
                    fromDate,
                    transactionsFound: transactions.length,
                    accountType: account.type
                });
            });

            if (totalNewTx === 0) {
                console.log(`[Trigger-Sync] ⚠️ Nenhuma transação nova encontrada! Verifique se o banco retornou dados.`);
            }
            console.log(`[Trigger-Sync] Total new transactions to save: ${totalNewTx}`);

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

                        mappedTx = {
                            cardId: account.id,
                            date: tx.date.split('T')[0],
                            description: tx.description,
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
                            description: tx.description,
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
                    const current = sorted[0];
                    const previous = sorted[1] || null;

                    // Extract finance charges from current bill
                    // Pluggy types: IOF, LATE_PAYMENT_FEE, LATE_PAYMENT_INTEREST, LATE_PAYMENT_REMUNERATIVE_INTEREST, OTHER
                    console.log(`[Bills] FATURA COMPLETA (JSON) para account ${account.id}:`, JSON.stringify(current, null, 2));
                    const financeCharges = current.financeCharges || [];
                    console.log(`[Bills] Finance charges for account ${account.id}:`, JSON.stringify(financeCharges));

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
                    let nextClosingDate;
                    if (today.getDate() <= closingDay) {
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
                            periodStart: new Date(lastClosingDate.getTime() + 24 * 60 * 60 * 1000).toISOString(), // dia após último fechamento
                            periodEnd: nextClosingDate.toISOString(), // próximo fechamento
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
            console.error('[Trigger-Sync] Failed:', err.message);
            await jobDoc.update({ status: 'failed', error: err.message, updatedAt: new Date().toISOString() });
        }
    })();
});


// Helper: Wait for Pluggy item to be ready (UPDATED or LOGIN_ERROR)
// Now also verifies that lastUpdatedAt changed (to ensure a real sync happened)
// UPDATED: Better handling for C6 Bank and other banks with slower sync
const waitForItemReady = async (apiKey, itemId, maxWaitMs = 90000, oldLastUpdatedAt = null) => {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds between polls (more stable for slow banks like C6)
    const readyStatuses = ['UPDATED', 'LOGIN_ERROR', 'OUTDATED'];
    // executionStatus values that indicate sync is still in progress
    const inProgressExecutionStatuses = [
        'COLLECTING_ACCOUNTS',
        'COLLECTING_CREDIT_CARDS',
        'COLLECTING_TRANSACTIONS',
        'COLLECTING_IDENTITY',
        'COLLECTING_INVESTMENTS',
        'CREATING',
        'CREATED',
        'ANALYZING',
        'MERGING'
    ];

    console.log(`[Sync] Waiting for item ${itemId} to be ready. Old lastUpdatedAt: ${oldLastUpdatedAt}, maxWait: ${maxWaitMs}ms`);

    let lastLoggedExecutionStatus = null;

    while (Date.now() - startTime < maxWaitMs) {
        try {
            const response = await pluggyApi.get(`/items/${itemId}`, {
                headers: { 'X-API-KEY': apiKey }
            });

            const item = response.data;
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const connectorName = item.connector?.name || 'unknown';

            // Log detailed status (but only when execution status changes to reduce noise)
            if (item.executionStatus !== lastLoggedExecutionStatus) {
                console.log(`[Sync] Item ${itemId} (${connectorName}) poll (${elapsed}s):`, {
                    status: item.status,
                    executionStatus: item.executionStatus,
                    lastUpdatedAt: item.lastUpdatedAt,
                    connector: connectorName,
                    statusDetail: item.statusDetail || null
                });
                lastLoggedExecutionStatus = item.executionStatus;
            }

            // Check for terminal error states first
            if (item.status === 'LOGIN_ERROR' || item.status === 'WAITING_USER_INPUT') {
                console.log(`[Sync] ❌ Item ${itemId} (${connectorName}) has error state: ${item.status}`);
                return { ready: false, status: item.status, error: 'Login failed or needs user input', item };
            }

            // CRITICAL FIX: Check executionStatus FIRST
            // Some banks (like C6) may return status=UPDATING but executionStatus still in progress
            if (item.status === 'UPDATING' || inProgressExecutionStatuses.includes(item.executionStatus)) {
                // Still syncing - continue waiting
                console.log(`[Sync] ⏳ Item ${itemId} (${connectorName}) still syncing: status=${item.status}, executionStatus=${item.executionStatus}`);
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                continue;
            }

            // Check if status is ready
            if (readyStatuses.includes(item.status)) {
                // Extra check: ensure executionStatus is also in a terminal state
                const terminalExecutionStatuses = ['SUCCESS', 'PARTIAL_SUCCESS', 'ERROR', null, undefined];
                if (!terminalExecutionStatuses.includes(item.executionStatus) && item.executionStatus) {
                    console.log(`[Sync] ⏳ Item ${itemId} (${connectorName}) status is ${item.status} but executionStatus is still ${item.executionStatus}. Waiting...`);
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                    continue;
                }

                // If we have an old timestamp, verify it actually changed
                if (oldLastUpdatedAt && item.lastUpdatedAt === oldLastUpdatedAt) {
                    // Same timestamp - Pluggy might not have actually fetched new data
                    // Keep waiting a bit more (up to max time)
                    console.log(`[Sync] Status is ${item.status} but lastUpdatedAt hasn't changed yet. Waiting...`);
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                    continue;
                }

                // Either we don't have old timestamp, or it changed - we're good!
                console.log(`[Sync] ✅ Item ${itemId} (${connectorName}) is ready!`, {
                    status: item.status,
                    executionStatus: item.executionStatus,
                    timestampChanged: item.lastUpdatedAt !== oldLastUpdatedAt,
                    newLastUpdatedAt: item.lastUpdatedAt
                });
                return { ready: true, status: item.status, item };
            }

            // Still updating, wait and poll again
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        } catch (err) {
            console.error(`[Sync] Error polling item status:`, err.message);
            // If we can't check status, try to proceed anyway
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

        console.log(`[Sync] ⏰ Timeout waiting for item ${itemId} (${connectorName}). Final state:`, {
            status: finalItem.status,
            executionStatus: finalItem.executionStatus,
            lastUpdatedAt: finalItem.lastUpdatedAt,
            oldLastUpdatedAt,
            changed: finalItem.lastUpdatedAt !== oldLastUpdatedAt
        });

        // If item is still UPDATING after timeout, it's a problem
        if (finalItem.status === 'UPDATING') {
            console.log(`[Sync] ⚠️ Item ${itemId} (${connectorName}) is STILL UPDATING after ${maxWaitMs / 1000}s! Bank may be slow or experiencing issues.`);
            return {
                ready: true,
                status: 'SLOW_BANK',
                item: finalItem,
                warning: `${connectorName} is taking too long to sync. Data may be incomplete.`
            };
        }

        // If timestamp never changed after timeout, something is wrong
        if (oldLastUpdatedAt && finalItem.lastUpdatedAt === oldLastUpdatedAt && finalItem.status === 'UPDATED') {
            console.log(`[Sync] ⚠️ Item ${itemId} (${connectorName}) lastUpdatedAt never changed! The bank might not have returned new data.`);
            return { ready: true, status: 'STALE', item: finalItem, warning: 'Timestamp did not change - bank may not have returned new data' };
        }

        return { ready: true, status: finalItem.status || 'TIMEOUT', item: finalItem };
    } catch (err) {
        console.log(`[Sync] Timeout and final check failed for item ${itemId}, proceeding anyway`);
        return { ready: true, status: 'TIMEOUT', item: null };
    }
};

// Helper: Fetch ALL transactions with pagination (Pluggy limits 500 per page)
const fetchAllTransactions = async (apiKey, accountId, fromDate) => {
    const allTransactions = [];
    let page = 1;
    const pageSize = 500;

    while (true) {
        try {
            const url = `/transactions?accountId=${accountId}&from=${fromDate}&pageSize=${pageSize}&page=${page}`;
            console.log(`[Sync] Fetching: ${url}`);

            const response = await pluggyApi.get(url, { headers: { 'X-API-KEY': apiKey } });

            const results = response.data.results || [];
            allTransactions.push(...results);

            console.log(`[Sync] Account ${accountId} page ${page}: ${results.length} transactions`);

            // Log detalhado se não houver transações
            if (page === 1 && results.length === 0) {
                console.log(`[Sync] ⚠️ AVISO: Conta ${accountId} retornou 0 transações.`);
                console.log(`[Sync] URL chamada: /transactions?accountId=${accountId}&from=${fromDate}&pageSize=${pageSize}&page=${page}`);
                console.log(`[Sync] Response data:`, JSON.stringify(response.data, null, 2));
            }

            // If returned less than pageSize, no more pages
            if (results.length < pageSize) break;

            page++;
            // Safety limit: max 20 pages = 10,000 transactions
            if (page > 20) {
                console.log(`[Sync] Account ${accountId}: reached page limit (20)`);
                break;
            }
        } catch (err) {
            console.error(`[Sync] Error fetching transactions page ${page}:`, err.message);
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
        // STEP 0: Wait for Pluggy item to be ready
        console.log(`[Sync] Waiting for item ${itemId} to be ready...`);
        const itemStatus = await waitForItemReady(apiKey, itemId);
        console.log(`[Sync] Item ready check: ${itemStatus.status}`);

        if (!itemStatus.ready && itemStatus.status === 'WAITING_USER_INPUT') {
            return res.json({
                success: false,
                error: 'O banco requer ação adicional. Tente reconectar.',
                needsReconnect: true
            });
        }

        // STEP 1: Fetch accounts
        console.log(`[Sync] Fetching accounts...`);
        const [accountsResp, existingSnap] = await Promise.all([
            pluggyApi.get(`/accounts?itemId=${itemId}`, { headers: { 'X-API-KEY': apiKey } }),
            accountsRef.get()
        ]);

        const accounts = accountsResp.data.results || [];
        console.log(`[Sync] Found ${accounts.length} accounts`);

        // If no accounts found, return early but mark as success
        if (accounts.length === 0) {
            console.log('[Sync] No accounts found - item may still be updating');
            return res.json({
                success: true,
                message: '0 contas encontradas. O banco pode estar processando ainda.',
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

            console.log(`[Sync] Account ${acc.id} (${acc.name}):`, {
                isCredit,
                rawClosingDay,
                validClosingDay,
                rawDueDay,
                validDueDay
            });

            accBatch.set(accountsRef.doc(acc.id), {
                ...acc,
                ...creditFields,
                ...(existing?.connectedAt ? {} : { connectedAt: syncTimestamp }),
                accountNumber: acc.number || null,
                itemId,
                connector: itemStatus.item?.connector || null, // Save connector details provided by waitForItemReady
                lastSyncedAt: syncTimestamp,
                updatedAt: syncTimestamp
            }, { merge: true });
        }
        await accBatch.commit();
        console.log(`[Sync] Accounts saved`);

        // STEP 3: Fetch transactions IN PARALLEL with PAGINATION (INCREMENTAL - only new transactions)
        // For each account, use lastSyncedAt as "from" date to avoid re-fetching old transactions
        const defaultFromDate = new Date();
        defaultFromDate.setFullYear(defaultFromDate.getFullYear() - 1); // 12 meses para contas novas
        const defaultFromStr = defaultFromDate.toISOString().split('T')[0];

        console.log(`[Sync] Fetching transactions (incremental mode with pagination)...`);
        const txPromises = accounts.map(async account => {
            const existing = existingMap[account.id];
            let fromStr = defaultFromStr;

            // If account was synced before, only fetch transactions since last sync
            if (existing?.lastSyncedAt) {
                const lastSync = new Date(existing.lastSyncedAt);
                // Subtract 1 day as safety margin for timezone/timing issues
                lastSync.setDate(lastSync.getDate() - 1);
                fromStr = lastSync.toISOString().split('T')[0];
                console.log(`[Sync] Account ${account.id}: fetching from ${fromStr} (last sync: ${existing.lastSyncedAt})`);
            } else {
                console.log(`[Sync] Account ${account.id}: first sync, fetching from ${fromStr} (12 meses)`);
            }

            // Use pagination to fetch ALL transactions
            const transactions = await fetchAllTransactions(apiKey, account.id, fromStr);
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
                        description: tx.description,
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
                    // Regular/Savings Transaction
                    mappedTx = {
                        providerId: tx.id,
                        description: tx.description,
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

        // Commit all batches in parallel
        await Promise.all(batchPromises);
        console.log(`[Sync] Saved ${txCount} transactions`);

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
                    let nextClosingDate;
                    if (today.getDate() <= closingDay) {
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
                        description: tx.description,
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
                        description: tx.description,
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

// 9. Webhook Receiver (instant response)
router.post('/webhook', async (req, res) => {
    res.json({ success: true, received: true }); // Immediate response

    const { event: eventType, itemId } = req.body || {};
    if (eventType) console.log(`[Webhook] ${eventType} - ${itemId}`);
});

export default router;
