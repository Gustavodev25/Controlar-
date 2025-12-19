// Pluggy routes: authentication and item management + sync helpers (accounts/transactions/bills).
import express from 'express';
import axios from 'axios';
import path from 'path';
import { createHash } from 'crypto';
import { firebaseAdmin } from './firebaseAdmin.js';
import { loadEnv } from './env.js';

loadEnv();

const router = express.Router();
router.use(express.json({ limit: '10mb' }));
router.use(express.urlencoded({ extended: false, limit: '10mb' }));

const clean = (str) => (str || '').replace(/[\r\n\s]/g, '');

const PLUGGY_CLIENT_ID = clean(process.env.PLUGGY_CLIENT_ID);
const PLUGGY_CLIENT_SECRET = clean(process.env.PLUGGY_CLIENT_SECRET);
const PLUGGY_API_KEY_STATIC = clean(process.env.PLUGGY_API_KEY);
const PLUGGY_API_URL = process.env.PLUGGY_API_URL || 'https://api.pluggy.ai';

// Token cache
let cachedApiKey = null;
let cachedApiKeyExpiry = 0;
let authInProgress = null;
const TOKEN_TTL_MS = 10 * 60 * 1000;

// --- Helpers ---

// Remove undefined values from object (Firestore doesn't accept undefined)
const removeUndefined = (obj) => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(removeUndefined);

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            cleaned[key] = typeof value === 'object' ? removeUndefined(value) : value;
        }
    }
    return cleaned;
};

const stableStringify = (value) => {
    if (value === null) return 'null';
    const type = typeof value;
    if (type !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
};

const getWebhookEventId = (event) => {
    // Prioritize eventId over id because item events often contain 'id' as the itemId, which is not unique per event
    const rawId =
        (typeof event?.eventId === 'string' && event.eventId.trim()) ? event.eventId.trim() :
            (typeof event?.eventId === 'number' && Number.isFinite(event.eventId)) ? String(event.eventId) :
                (typeof event?.id === 'string' && event.id.trim()) ? event.id.trim() :
                    (typeof event?.id === 'number' && Number.isFinite(event.id)) ? String(event.id) :
                        null;

    if (rawId) return rawId;

    const hash = createHash('sha256').update(stableStringify(event || {})).digest('hex');
    return `sha256_${hash}`;
};

const getPluggyApiKey = async () => {
    if (PLUGGY_API_KEY_STATIC) {
        console.log('>>> Using static Pluggy API Key');
        return PLUGGY_API_KEY_STATIC;
    }

    if (cachedApiKey && Date.now() < cachedApiKeyExpiry) {
        console.log('>>> Using cached Pluggy API Key (valid for', Math.round((cachedApiKeyExpiry - Date.now()) / 1000), 'seconds)');
        return cachedApiKey;
    }

    if (authInProgress) {
        console.log('>>> Auth already in progress, waiting...');
        return authInProgress;
    }

    if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
        console.error('>>> CRITICAL: MISSING PLUGGY CREDENTIALS in env');
        console.error('>>> PLUGGY_CLIENT_ID exists:', !!PLUGGY_CLIENT_ID);
        console.error('>>> PLUGGY_CLIENT_SECRET exists:', !!PLUGGY_CLIENT_SECRET);
        throw new Error('Credenciais do Pluggy não configuradas. Verifique PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no .env');
    }

    console.log(`>>> Generating new Pluggy Token...`);
    console.log(`>>> Client ID: ${PLUGGY_CLIENT_ID.substring(0, 8)}...${PLUGGY_CLIENT_ID.substring(PLUGGY_CLIENT_ID.length - 4)}`);
    console.log(`>>> API URL: ${PLUGGY_API_URL}`);

    authInProgress = (async () => {
        try {
            const response = await axios.post(
                `${PLUGGY_API_URL}/auth`,
                { clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000 // 30 second timeout
                }
            );

            if (!response.data?.apiKey) {
                console.error('>>> Pluggy auth response missing apiKey:', response.data);
                throw new Error('Resposta de autenticação do Pluggy inválida');
            }

            cachedApiKey = response.data.apiKey;
            cachedApiKeyExpiry = Date.now() + TOKEN_TTL_MS;
            console.log('>>> Pluggy Token generated successfully! Expires in', TOKEN_TTL_MS / 1000, 'seconds');
            return cachedApiKey;
        } catch (error) {
            const status = error.response?.status;
            const errorData = error.response?.data;

            console.error('>>> Error generating Pluggy Token:');
            console.error('>>>   Status:', status);
            console.error('>>>   Response:', JSON.stringify(errorData, null, 2));
            console.error('>>>   Message:', error.message);

            cachedApiKey = null;
            cachedApiKeyExpiry = 0;

            // Provide user-friendly error messages
            if (status === 401 || status === 403) {
                throw new Error('Credenciais do Pluggy inválidas. Verifique CLIENT_ID e CLIENT_SECRET.');
            } else if (status === 429) {
                throw new Error('Muitas requisições ao Pluggy. Aguarde alguns minutos.');
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                throw new Error('Não foi possível conectar ao servidor do Pluggy. Verifique sua conexão.');
            } else {
                throw new Error(`Erro na autenticação do Pluggy: ${errorData?.message || error.message}`);
            }
        } finally {
            authInProgress = null;
        }
    })();
    return authInProgress;
};

const pluggyRequest = async (method, endpoint, apiKey, data = null, params = null, isRetry = false) => {
    const url = `${PLUGGY_API_URL}${endpoint}`;
    const config = {
        method,
        url,
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
        params
    };
    if (data) config.data = data;

    // Debug URL construction
    if (!isRetry && endpoint === '/items') {
        console.log(`Pluggy Debug [${method}]: ${url} params=${JSON.stringify(params)}`);
    }

    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        const status = error.response?.status;
        console.error(`Pluggy Request Failed [${method} ${endpoint}] Status: ${status} | Retry: ${isRetry}`);

        if (status === 401 && !isRetry) {
            console.warn(`Pluggy 401 at ${endpoint}. Clearing cache and retrying...`);
            cachedApiKey = null;
            try {
                const newApiKey = await getPluggyApiKey();
                return await pluggyRequest(method, endpoint, newApiKey, data, params, true);
            } catch (retryErr) {
                console.error(`Pluggy Retry Failed at ${endpoint}:`, retryErr.response?.data || retryErr.message);
                throw retryErr;
            }
        }

        // Log detailed error for debugging
        if (error.response) {
            console.error('Pluggy Error Response Data:', JSON.stringify(error.response.data, null, 2));
        }

        throw error;
    }
};

const translatePluggyCategory = (category) => {
    if (!category) return 'Outros';
    const map = {
        'Salary': 'Salário', 'Retirement': 'Aposentadoria', 'Loans': 'Empréstimos',
        'Credit card payment': 'Cartão de crédito', 'Bank slip': 'Boleto',
        'Internet': 'Internet', 'Mobile': 'Celular', 'Rent': 'Aluguel',
        'Electricity': 'Luz', 'Water': 'Água', 'Pharmacy': 'Farmácia',
        'Gas stations': 'Combustível', 'Parking': 'Estacionamento',
        'Health insurance': 'Plano de saúde', 'Vehicle insurance': 'Seguro auto',
        'Groceries': 'Supermercado', 'Eating out': 'Restaurante', 'Food delivery': 'Delivery',
        'Shopping': 'Compras', 'Leisure': 'Lazer', 'Entertainment': 'Lazer',
        'Transfer - PIX': 'Transf. Pix', 'Same person transfer - PIX': 'Transf. própria Pix'
    };
    return map[category] || category || 'Outros';
};

const getInvoiceMonthKey = (dateStr, closingDay) => {
    if (!dateStr) return null;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length < 3) return null;

    const [y, m, d] = parts.map(Number);
    let month = m - 1;
    let year = y;

    if (d >= closingDay) {
        month += 1;
        if (month > 11) {
            month = 0;
            year += 1;
        }
    }
    return `${year}-${String(month + 1).padStart(2, '0')}`;
};

const addMonthsUTC = (dateStr, months) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCMonth(dt.getUTCMonth() + months);
    return dt.toISOString().split('T')[0];
};

const generateProjectedInstallments = async (userId, tx, account, billsMap, closingDay, cardDisplayName = null) => {
    if (!userId || !tx || !account) return;
    const meta = tx.creditCardMetadata || {};
    const totalInstallments = meta.totalInstallments;
    const currentInstallment = meta.installmentNumber || 1;
    const purchaseDate = (meta.purchaseDate || tx.date || '').split('T')[0];

    if (!totalInstallments || totalInstallments <= currentInstallment) return;

    // Determine card name - use passed name, or calculate from account data
    const effectiveCardName = cardDisplayName || account.creditData?.brand || account.marketingName || account.name || 'Cartão';

    for (let i = currentInstallment + 1; i <= totalInstallments; i++) {
        const providerId = `${tx.id}_installment_${i}`;
        const projectedDate = purchaseDate ? addMonthsUTC(purchaseDate, i - 1) : null;

        // Calculate projected month key
        let invoiceMonthKey = null;
        if (closingDay && projectedDate) {
            invoiceMonthKey = getInvoiceMonthKey(projectedDate, closingDay);
        } else if (projectedDate) {
            invoiceMonthKey = projectedDate.slice(0, 7);
        }

        const rawAmount = Number(tx.amount || 0);
        const amount = Math.abs(meta.totalAmount ? (meta.totalAmount / totalInstallments) : rawAmount);

        const txData = {
            date: projectedDate || purchaseDate,
            description: tx.description,
            amount,
            category: translatePluggyCategory(tx.category),
            type: rawAmount >= 0 ? 'expense' : 'income',
            status: 'pending', // Future is always pending
            cardId: account.id,
            cardName: effectiveCardName,
            installmentNumber: i,
            totalInstallments,
            importSource: 'pluggy',
            providerId: providerId,
            providerItemId: account.itemId,
            invoiceMonthKey,
            pluggyRaw: { ...tx, creditCardMetadata: { ...meta, installmentNumber: i, billId: null } },
            isProjected: true,
            syncedAt: new Date().toISOString()
        };

        if (txData.date) {
            await upsertTransaction(userId, 'creditCardTransactions', txData, providerId);
        }
    }
};

// --- DB Operations (Server-Side) ---

const updateSyncStatus = async (userId, state, message, details = null) => {
    if (!firebaseAdmin || !userId) return;
    try {
        const now = new Date().toISOString();
        const updateData = {
            state, // 'idle', 'pending', 'in_progress', 'success', 'error'
            message,
            details,
            lastUpdated: now
        };

        // If sync completed successfully, update lastSyncedAt for cooldown calculation
        if (state === 'success') {
            updateData.lastSyncedAt = now;
        }

        await firebaseAdmin.firestore().collection('users').doc(userId)
            .collection('sync_status').doc('pluggy')
            .set(removeUndefined(updateData), { merge: true });
    } catch (e) {
        console.error('Error updating sync status:', e);
    }
};

const addSystemNotification = async (userId, title, message, type = 'system') => {
    if (!firebaseAdmin || !userId) return;
    try {
        await firebaseAdmin.firestore().collection('users').doc(userId)
            .collection('notifications').add({
                type,
                title,
                message,
                date: new Date().toISOString(),
                read: false,
                archived: false
            });
    } catch (e) {
        console.error('Error adding notification:', e);
    }
};

// --- Sync Job & Credit Refund System ---

/**
 * Creates a tracked sync job for monitoring and potential credit refund
 */
const createSyncJob = async (userId, itemId, creditTransactionId) => {
    if (!firebaseAdmin || !userId) return null;
    try {
        const db = firebaseAdmin.firestore();
        const jobRef = db.collection('users').doc(userId)
            .collection('sync_jobs').doc();

        await jobRef.set({
            itemId,
            userId,
            creditTransactionId,
            status: 'pending',
            attempts: 0,
            progress: { step: 'Iniciando...', current: 0, total: 100 },
            message: 'Conexão iniciada',
            lastError: null,
            creditRefunded: false,
            createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`>>> Created sync job ${jobRef.id} for item ${itemId}`);
        return jobRef.id;
    } catch (e) {
        console.error('>>> Error creating sync job:', e.message);
        return null;
    }
};

/**
 * Updates sync job status and progress
 */
const updateSyncJob = async (userId, syncJobId, updates) => {
    if (!firebaseAdmin || !userId || !syncJobId) return;
    try {
        const db = firebaseAdmin.firestore();
        await db.collection('users').doc(userId)
            .collection('sync_jobs').doc(syncJobId)
            .update({
                ...updates,
                updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
            });
    } catch (e) {
        console.error('>>> Error updating sync job:', e.message);
    }
};

/**
 * Refunds a daily credit to the user when sync fails
 */
const refundCredit = async (userId, creditTransactionId, reason) => {
    if (!firebaseAdmin || !userId) return false;

    // Skip refund for admin users (they have unlimited credits)
    if (creditTransactionId === 'admin_unlimited') {
        console.log('>>> Skipping refund for admin user');
        return true;
    }

    const db = firebaseAdmin.firestore();
    const userRef = db.collection('users').doc(userId);

    try {
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) return;

            const userData = userDoc.data();
            const credits = userData.dailyConnectionCredits || { date: '', count: 0 };
            const today = new Date().toLocaleDateString('en-CA');

            // Only refund if it's the same day and count > 0
            if (credits.date === today && credits.count > 0) {
                transaction.update(userRef, {
                    dailyConnectionCredits: {
                        date: today,
                        count: credits.count - 1
                    }
                });
                console.log(`>>> Credit refunded for user ${userId}. Reason: ${reason}. New count: ${credits.count - 1}`);
            } else {
                console.log(`>>> Cannot refund credit for user ${userId}. Date mismatch or count is 0.`);
            }
        });

        return true;
    } catch (e) {
        console.error('>>> Error refunding credit:', e.message);
        return false;
    }
};

/**
 * Processes sync with automatic credit refund on failure
 */
const processSyncWithRefund = async (userId, itemId, syncJobId, creditTransactionId) => {
    try {
        // Update job to processing
        await updateSyncJob(userId, syncJobId, {
            status: 'processing',
            progress: { step: 'Conectando ao banco...', current: 10, total: 100 },
            message: 'Estabelecendo conexão segura'
        });

        const apiKey = await getPluggyApiKey();

        await updateSyncStatus(userId, 'in_progress', 'Conexão segura estabelecida. Buscando dados...');
        await updateSyncJob(userId, syncJobId, {
            progress: { step: 'Buscando contas...', current: 30, total: 100 },
            message: 'Buscando contas e transações'
        });

        // Perform the sync
        const syncResult = await syncItem(apiKey, itemId, userId, { fullSync: true, syncJobId });

        // Mark as completed
        await updateSyncJob(userId, syncJobId, {
            status: 'completed',
            progress: { step: 'Concluído', current: 100, total: 100 },
            message: 'Sincronização concluída com sucesso',
            completedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`>>> Sync completed successfully for item ${itemId}`);

    } catch (error) {
        console.error(`>>> Background Sync Failed for ${itemId}:`, error.message);

        // Refund the credit
        const refunded = await refundCredit(userId, creditTransactionId, error.message);

        // Update sync status with refund info
        const errorMessage = refunded
            ? 'Erro na sincronização. Seu crédito foi reembolsado automaticamente.'
            : 'Erro na sincronização.';

        await updateSyncStatus(userId, 'error', errorMessage);

        // Update job as failed
        await updateSyncJob(userId, syncJobId, {
            status: 'failed',
            lastError: error.message,
            creditRefunded: refunded,
            message: errorMessage,
            failedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
        });

        // Notify user
        await addSystemNotification(
            userId,
            'Sincronização Falhou',
            refunded
                ? 'Houve um erro na sincronização. Seu crédito foi reembolsado automaticamente.'
                : 'Houve um erro na sincronização. Por favor, tente novamente.',
            'alert'
        );
    }
};

const upsertTransaction = async (userId, collectionName, txData, providerId) => {
    if (!firebaseAdmin) return;
    const db = firebaseAdmin.firestore();
    const collectionRef = db.collection('users').doc(userId).collection(collectionName);
    const cleanedData = removeUndefined(txData);

    // Always merge/update to ensure latest status/data
    if (providerId) {
        await collectionRef.doc(String(providerId)).set(cleanedData, { merge: true });
    } else {
        await collectionRef.add(cleanedData);
    }
};

// Batch writer class for efficient Firestore operations
class FirestoreBatchWriter {
    constructor(userId, maxBatchSize = 450) {
        this.userId = userId;
        this.maxBatchSize = maxBatchSize;
        this.operations = [];
        this.commitCount = 0;
    }

    add(collectionName, docId, data) {
        this.operations.push({ collectionName, docId, data: removeUndefined(data) });
    }

    async flush() {
        if (!firebaseAdmin || this.operations.length === 0) return 0;

        const db = firebaseAdmin.firestore();
        let totalProcessed = 0;

        // Process in chunks of maxBatchSize
        for (let i = 0; i < this.operations.length; i += this.maxBatchSize) {
            const chunk = this.operations.slice(i, i + this.maxBatchSize);
            const batch = db.batch();

            for (const op of chunk) {
                const docRef = db.collection('users').doc(this.userId).collection(op.collectionName).doc(String(op.docId));
                batch.set(docRef, op.data, { merge: true });
            }

            try {
                await batch.commit();
                totalProcessed += chunk.length;
                this.commitCount++;
            } catch (err) {
                console.error(`>>> Batch commit failed for chunk ${Math.floor(i / this.maxBatchSize) + 1}:`, err.message);
                // Continue with next chunk instead of failing completely
                // Individual items will be retried on next sync
            }
        }

        this.operations = [];
        return totalProcessed;
    }

    get pendingCount() {
        return this.operations.length;
    }
}

// Helper: Cleanup projected installments that match a real transaction
const cleanupProjectedInstallments = async (userId, txData) => {
    if (!firebaseAdmin || !txData.cardId || !txData.installmentNumber || txData.isProjected) return;

    try {
        const db = firebaseAdmin.firestore();
        const coll = db.collection('users').doc(userId).collection('creditCardTransactions');

        // Query for potentially conflicting projected transactions
        const snapshot = await coll
            .where('cardId', '==', txData.cardId)
            .where('installmentNumber', '==', txData.installmentNumber)
            .where('totalInstallments', '==', txData.totalInstallments)
            .where('isProjected', '==', true)
            .get();

        if (snapshot.empty) return;

        const batch = db.batch();
        let deletedCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            // Match amount (allow small diff)
            const amountDiff = Math.abs((data.amount || 0) - (txData.amount || 0));

            // Match description (normalize)
            // Remove "01/10" pattern if present to match base description
            const normalize = (s) => (s || '').toLowerCase().replace(/\s*\d+\/\d+/, '').trim();
            const desc1 = normalize(data.description);
            const desc2 = normalize(txData.description);
            const descMatch = desc1 === desc2 || desc1.includes(desc2) || desc2.includes(desc1);

            if (amountDiff < 0.1 && descMatch) {
                console.log(`>>> Cleanup: Deleting projected duplicate ${doc.id} for real tx ${txData.description} (${txData.installmentNumber}/${txData.totalInstallments})`);
                batch.delete(doc.ref);
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            await batch.commit();
        }
    } catch (e) {
        console.warn('>>> Error cleaning up projected installments:', e.message);
    }
};

const deleteTransactions = async (userId, providerIds) => {
    if (!firebaseAdmin || !providerIds.length) return;
    const db = firebaseAdmin.firestore();

    const collections = ['transactions', 'creditCardTransactions'];
    const uniqueIds = [...new Set(providerIds.filter(Boolean).map(String))];

    for (const col of collections) {
        const collectionRef = db.collection('users').doc(userId).collection(col);

        // Best-effort delete by document ID (for newer inserts using providerId as docId)
        for (let i = 0; i < uniqueIds.length; i += 450) {
            const batch = db.batch();
            uniqueIds.slice(i, i + 450).forEach(id => batch.delete(collectionRef.doc(id)));
            await batch.commit();
        }

        const chunks = [];
        for (let i = 0; i < uniqueIds.length; i += 10) {
            chunks.push(uniqueIds.slice(i, i + 10));
        }

        for (const chunk of chunks) {
            const snapshot = await collectionRef.where('providerId', 'in', chunk).get();
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    }

    await updateSyncStatus(userId, 'success', 'Dados removidos com sucesso.');
};

/**
 * Sync item transactions from Pluggy
 * @param {string} apiKey - Pluggy API key
 * @param {string} itemId - Pluggy item ID
 * @param {string} userId - Firebase user ID
 * @param {Object} options - Sync options
 * @param {boolean} options.fromWebhook - If true, optimize for incremental sync
 * @param {string} options.accountId - Specific account ID from webhook
 * @param {string} options.transactionsLink - Direct link to fetch new transactions
 * @param {boolean} options.fullSync - Force full 12-month sync (for cron/manual first sync)
 */
const syncItem = async (apiKey, itemId, userId, options = {}) => {
    if (!userId || !firebaseAdmin) {
        console.warn('>>> Sync skipped: Missing userId or Firebase Admin.');
        return;
    }

    const { fromWebhook = false, accountId: webhookAccountId, transactionsLink, fullSync = false, syncJobId } = options;

    // Track errors during sync for partial failure reporting
    const syncErrors = [];

    console.log(`>>> Starting Server-Side Sync for Item ${itemId} (User: ${userId}) | Mode: ${fromWebhook ? 'Webhook' : 'Full'}`);
    await updateSyncStatus(userId, 'in_progress', 'Sincronizando contas e transações...');

    // 0. Fetch Item details to get connector (institution) name and sync dates
    let institutionName = 'Banco';
    let connectorImageUrl = null;
    let itemCreatedAt = null;
    let itemLastUpdatedAt = null;
    try {
        const itemData = await pluggyRequest('GET', `/items/${itemId}`, apiKey);
        institutionName = itemData.connector?.name || 'Banco';
        connectorImageUrl = itemData.connector?.imageUrl || null;
        itemCreatedAt = itemData.createdAt || null;
        itemLastUpdatedAt = itemData.lastUpdatedAt || itemData.updatedAt || null;
        console.log(`>>> Item ${itemId} institution: ${institutionName}, createdAt: ${itemCreatedAt}, lastUpdatedAt: ${itemLastUpdatedAt}`);
    } catch (e) {
        console.warn('>>> Could not fetch item details for institution name:', e.message);
    }

    // 1. Fetch Accounts
    let accounts = [];
    try {
        let page = 1, totalPages = 1;
        do {
            console.log(`>>> Fetching accounts page ${page} for item ${itemId}...`);
            const res = await pluggyRequest('GET', '/accounts', apiKey, null, { itemId, page, pageSize: 200 });
            const results = res.results || [];
            console.log(`>>> Found ${results.length} accounts on page ${page}`);

            // Log each account for debugging
            results.forEach((acc, idx) => {
                console.log(`>>>   Account ${idx + 1}: id=${acc.id}, type=${acc.type}, subtype=${acc.subtype}, name=${acc.marketingName || acc.name}, balance=${acc.balance}`);
            });

            accounts.push(...results);
            totalPages = res.totalPages || 1;
            page++;
        } while (page <= totalPages);

        console.log(`>>> Total accounts fetched: ${accounts.length}`);
    } catch (e) {
        console.error('>>> Error fetching accounts:', e.message);
        console.error('>>> Error details:', e.response?.data || e);
        await updateSyncStatus(userId, 'error', 'Erro ao buscar contas. Verifique suas credenciais.');
        return;
    }

    // If webhook provided specific accountId, filter to only that account
    if (fromWebhook && webhookAccountId) {
        accounts = accounts.filter(a => a.id === webhookAccountId);
        console.log(`>>> Webhook mode: Filtering to account ${webhookAccountId}`);
    }

    // 2. Determine date range for transaction fetch
    // (Consolidated logic inside the loop mainly, but let's notify user)
    await updateSyncStatus(userId, 'in_progress', `Analisando ${accounts.length} contas conectadas...`, { current: 0, total: accounts.length });

    const today = new Date();
    let from, to;
    const toDate = new Date(today);
    toDate.setMonth(toDate.getMonth() + 2);
    toDate.setDate(0);
    to = toDate.toISOString().split('T')[0];

    if (fullSync) {
        // Full sync mode (first connection): Fetch 12 months back
        const fromDate = new Date(today);
        fromDate.setMonth(fromDate.getMonth() - 12);
        fromDate.setDate(1);
        from = fromDate.toISOString().split('T')[0];
        console.log(`>>> Full sync fetch: ${from} to ${to} (12 months - first connection)`);
    } else {
        // Incremental sync: will be optimized per account below
        // Set a safe default of 7 days, but this will be overridden
        const fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 7);
        from = fromDate.toISOString().split('T')[0];
        console.log(`>>> Incremental sync mode: default ${from} to ${to} (will optimize per account)`);
    }

    let newTransactionsCount = 0;

    // Use batch writer for efficient Firestore operations
    const batchWriter = new FirestoreBatchWriter(userId);

    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        const progress = Math.round(((i) / accounts.length) * 100);

        // Notify processing of specific account
        const accName = account.marketingName || account.name || 'Conta';
        await updateSyncStatus(userId, 'in_progress', `Analisando: ${accName}...`, { current: progress, total: 100 });

        const type = (account.type || '').toUpperCase();
        const subtype = (account.subtype || '').toUpperCase();

        // Extended Credit Detection
        const hasCreditData = account.creditData && (account.creditData.creditLimit > 0 || account.creditData.brand);
        const isCredit = type.includes('CREDIT') || subtype.includes('CREDIT') || subtype.includes('CARD') || hasCreditData;

        const isSavings = subtype.includes('SAVINGS') || type.includes('SAVINGS');
        const isChecking = subtype.includes('CHECKING') || type.includes('CHECKING') || type === 'BANK';

        // Log account classification
        console.log(`>>> Processing account ${account.id}: type=${type}, subtype=${subtype}, isCredit=${isCredit}, isSavings=${isSavings}, isChecking=${isChecking}, balance=${account.balance}`);
        if (isCredit) {
            console.log(`>>> Credit card data for ${account.id}: creditLimit=${account.creditData?.creditLimit}, availableLimit=${account.creditData?.availableCreditLimit}, usedLimit=${account.creditData?.usedCreditLimit}, balance=${account.creditData?.balance}, brand=${account.creditData?.brand}`);
            // Log disaggregatedCreditLimits if present
            if (Array.isArray(account.disaggregatedCreditLimits) && account.disaggregatedCreditLimits.length > 0) {
                console.log(`>>> Disaggregated Credit Limits for ${account.id}:`, JSON.stringify(account.disaggregatedCreditLimits, null, 2));
            }
        }

        // Fetch Bills (Credit Card Only) - Moved up to populate account balance correctly
        let billsMap = new Map();
        let currentInvoiceBalance = null;

        if (isCredit) {
            await updateSyncStatus(userId, 'in_progress', `Verificando faturas...`, { current: progress + 2, total: 100 });
            try {
                const res = await pluggyRequest('GET', '/bills', apiKey, null, { accountId: account.id, pageSize: 100 });
                const bills = res.results || [];
                console.log(`>>> Bills fetched for ${account.id}:`, bills.length, 'bills');
                bills.forEach(b => {
                    billsMap.set(b.id, b);
                    console.log(`>>>   Bill: id=${b.id}, dueDate=${b.dueDate}, totalAmount=${b.totalAmount}, amount=${b.amount}, balance=${b.balance}, state=${b.state}, status=${b.status}`);
                    // Debug: log all bill fields
                    if (bills.length <= 3) {
                        console.log(`>>>   Bill full data:`, JSON.stringify(b, null, 2));
                    }
                });

                // Find the current active invoice to show as balance
                // Priority: OPEN (current) -> OVERDUE (past due) -> CLOSED (awaiting payment)
                // Check both 'state' and 'status' fields (Pluggy API may use either)
                const normalizeState = (b) => (b.state || b.status || '').toUpperCase();

                // Sort bills by priority and date
                const sortedBills = [...bills].sort((a, b) => {
                    const stateA = normalizeState(a);
                    const stateB = normalizeState(b);

                    // Priority order: OPEN > OVERDUE > CLOSED > others
                    const priority = { 'OPEN': 0, 'OVERDUE': 1, 'CLOSED': 2 };
                    const prioA = priority[stateA] ?? 99;
                    const prioB = priority[stateB] ?? 99;

                    if (prioA !== prioB) return prioA - prioB;

                    // Same priority, sort by due date (most recent first)
                    return new Date(b.dueDate) - new Date(a.dueDate);
                });

                // Find the best bill: prioritize OPEN, then OVERDUE, then CLOSED
                let activeBill = sortedBills.find(b => {
                    const state = normalizeState(b);
                    return ['OPEN', 'OVERDUE', 'CLOSED'].includes(state);
                });

                // If no bill with expected states, use the most recent one
                if (!activeBill && bills.length > 0) {
                    activeBill = sortedBills[0];
                    console.log(`>>> No active bill found, using most recent: ${activeBill?.dueDate} (${normalizeState(activeBill)})`);
                }

                if (activeBill) {
                    // Try multiple fields for the invoice amount
                    // Pluggy may use different field names depending on the bank
                    const billAmount = activeBill.totalAmount
                        ?? activeBill.amount
                        ?? activeBill.balance
                        ?? activeBill.amountDue
                        ?? activeBill.totalBalance
                        ?? null;

                    // Only use bill amount if it's a valid positive number
                    if (billAmount !== null && billAmount > 0) {
                        currentInvoiceBalance = billAmount;
                    }

                    console.log(`>>> Found active bill for ${account.id}: dueDate=${activeBill.dueDate}, totalAmount=${activeBill.totalAmount}, amount=${activeBill.amount}, balance=${activeBill.balance}, resolved=${currentInvoiceBalance} (${normalizeState(activeBill)})`);

                    // Store bill details for frontend display
                    account._currentBill = {
                        id: activeBill.id,
                        dueDate: activeBill.dueDate,
                        totalAmount: billAmount || activeBill.totalAmount,
                        state: normalizeState(activeBill),
                        paidAmount: activeBill.paidAmount || 0,
                        minimumPayment: activeBill.minimumPaymentAmount
                    };
                } else {
                    console.log(`>>> No bills found for credit card ${account.id}`);
                }

                // Store ALL bills for historical lookup (not just current)
                // This allows the frontend to fetch bills by month
                account._allBills = Array.from(billsMap.values()).map(b => ({
                    id: b.id,
                    dueDate: b.dueDate,
                    totalAmount: b.totalAmount ?? b.amount ?? b.balance ?? 0,
                    state: (b.state || b.status || '').toUpperCase(),
                    minimumPayment: b.minimumPaymentAmount ?? null,
                    paidAmount: b.paidAmount ?? null,
                    balanceCloseDate: b.balanceCloseDate ?? null
                }));
                console.log(`>>> Storing ${account._allBills.length} bills for account ${account.id}`);
            } catch (e) {
                console.warn(`>>> Error fetching bills for ${account.id}:`, e.message);
            }
        }

        // For credit cards without bills, try to use creditData balance
        if (isCredit && currentInvoiceBalance === null) {
            // Try different ways to get the card balance
            let creditBalance = null;

            // Option 1: Direct balance from creditData
            if (account.creditData?.balance !== null && account.creditData?.balance !== undefined) {
                creditBalance = account.creditData.balance;
            }
            // Option 2: Used credit limit
            else if (account.creditData?.usedCreditLimit !== null && account.creditData?.usedCreditLimit !== undefined) {
                creditBalance = account.creditData.usedCreditLimit;
            }
            // Option 3: Calculate from creditLimit - availableCreditLimit
            else if (account.creditData?.creditLimit && account.creditData?.availableCreditLimit !== undefined) {
                creditBalance = account.creditData.creditLimit - account.creditData.availableCreditLimit;
            }
            // Option 4: Account balance
            else if (account.balance !== null && account.balance !== undefined) {
                creditBalance = account.balance;
            }

            if (creditBalance !== null && creditBalance !== 0) {
                currentInvoiceBalance = Math.abs(creditBalance);
                console.log(`>>> Using calculated credit balance for ${account.id}: R$${currentInvoiceBalance}`);
            }
        }

        // Determine friendly account type name
        let accountTypeName = 'Conta';
        if (isCredit) {
            accountTypeName = 'Cartão de Crédito';
        } else if (isSavings) {
            accountTypeName = 'Poupança';
        } else if (isChecking) {
            accountTypeName = 'Conta Corrente';
        }

        // Use the fetched invoice balance if available, otherwise fallback to account.balance
        // If account.balance is 0 and we have an invoice, we definitely want the invoice amount.
        const finalBalance = (currentInvoiceBalance !== null && currentInvoiceBalance !== undefined)
            ? currentInvoiceBalance
            : (account.balance ?? 0);

        // Determine the best display name for the account
        // For credit cards, prioritize brand (Visa, Mastercard, etc.)
        let accountDisplayName = accountTypeName;
        if (isCredit) {
            const brand = account.creditData?.brand;
            const cardName = account.marketingName || account.name;

            // Priority for credit cards:
            // 1. Brand + marketingName (e.g., "Visa Platinum")
            // 2. Just brand (e.g., "Visa")
            // 3. marketingName if it's meaningful (not a number)
            // 4. Fallback to "Cartão de Crédito"
            if (brand && cardName && !/^\d/.test(cardName)) {
                // If cardName already includes brand, use it as-is
                if (cardName.toLowerCase().includes(brand.toLowerCase())) {
                    accountDisplayName = cardName;
                } else {
                    accountDisplayName = `${brand} ${cardName}`;
                }
            } else if (brand) {
                accountDisplayName = brand;
            } else if (cardName && !/^\d/.test(cardName)) {
                // marketingName exists and doesn't start with a number (not an account number)
                accountDisplayName = cardName;
            } else {
                accountDisplayName = 'Cartão de Crédito';
            }
            console.log(`>>> Credit card name resolved: brand=${brand}, marketingName=${account.marketingName}, name=${account.name} -> "${accountDisplayName}"`);
        } else {
            // For bank accounts, use marketingName or name if they're meaningful
            const bankName = account.marketingName || account.name;
            if (bankName && !/^\d{6,}$/.test(bankName) && !/^\d+[-\/]/.test(bankName)) {
                accountDisplayName = bankName;
            }
        }

        const accountData = {
            id: account.id,
            itemId: account.itemId,
            name: accountDisplayName,
            type: account.type,
            subtype: account.subtype,
            accountTypeName, // Friendly name: 'Conta Corrente', 'Poupança', 'Cartão de Crédito'
            isCredit,
            isSavings,
            isChecking,
            balance: finalBalance,
            currency: account.currencyCode || 'BRL',
            lastUpdated: new Date().toISOString(),
            connectionMode: 'AUTO',
            institution: institutionName,
            connectorImageUrl: connectorImageUrl,
            // Credit card specific data with Fallback to Disaggregated Limits
            ...(isCredit ? (() => {
                let creditLimit = account.creditData?.creditLimit || 0;
                let availableCreditLimit = account.creditData?.availableCreditLimit ?? null;
                let usedCreditLimit = account.creditData?.usedCreditLimit ?? null;

                // Log raw credit data for debugging
                console.log(`>>> [Credit Data Raw] Account ${account.id}: creditLimit=${creditLimit}, availableCreditLimit=${availableCreditLimit}, usedCreditLimit=${usedCreditLimit}`);

                // Check disaggregatedCreditLimits - use this as primary source if available
                // This is more reliable for Open Finance connectors
                if (Array.isArray(account.disaggregatedCreditLimits) && account.disaggregatedCreditLimits.length > 0) {
                    // Try to find the TOTAL limit first
                    const totalLimit = account.disaggregatedCreditLimits.find(l => l.creditLineLimitType === 'LIMITE_CREDITO_TOTAL');

                    if (totalLimit) {
                        // Use disaggregated data if it has better values
                        if (!creditLimit || creditLimit === 0 || totalLimit.limitAmount > creditLimit) {
                            creditLimit = totalLimit.limitAmount || 0;
                            availableCreditLimit = totalLimit.availableAmount ?? null;
                            usedCreditLimit = totalLimit.usedAmount ?? null;
                            console.log(`>>> [Credit Data] Using Disaggregated TOTAL for ${account.id}: limit=${creditLimit}, available=${availableCreditLimit}, used=${usedCreditLimit}`);
                        }
                    } else {
                        // If no total type, find the largest limit as heuristic
                        const maxLimit = account.disaggregatedCreditLimits.reduce((max, curr) =>
                            (curr.limitAmount > (max?.limitAmount || 0)) ? curr : max
                            , null);

                        if (maxLimit && (!creditLimit || creditLimit === 0 || maxLimit.limitAmount > creditLimit)) {
                            creditLimit = maxLimit.limitAmount || 0;
                            availableCreditLimit = maxLimit.availableAmount ?? null;
                            usedCreditLimit = maxLimit.usedAmount ?? null;
                            console.log(`>>> [Credit Data] Using Disaggregated MAX for ${account.id}: limit=${creditLimit}, available=${availableCreditLimit}, used=${usedCreditLimit}`);
                        }
                    }
                }

                // Calculate availableCreditLimit if still missing but we have limit and used
                if (availableCreditLimit === null && creditLimit > 0 && usedCreditLimit !== null) {
                    availableCreditLimit = Math.max(0, creditLimit - usedCreditLimit);
                    console.log(`>>> [Credit Data] Calculated availableCreditLimit for ${account.id}: ${availableCreditLimit}`);
                }

                // Calculate usedCreditLimit if still missing but we have limit and available
                if (usedCreditLimit === null && creditLimit > 0 && availableCreditLimit !== null) {
                    usedCreditLimit = Math.max(0, creditLimit - availableCreditLimit);
                    console.log(`>>> [Credit Data] Calculated usedCreditLimit for ${account.id}: ${usedCreditLimit}`);
                }

                // Final logging
                console.log(`>>> [Credit Data Final] Account ${account.id}: creditLimit=${creditLimit}, availableCreditLimit=${availableCreditLimit}, usedCreditLimit=${usedCreditLimit}`);

                return {
                    creditLimit: creditLimit || null,
                    availableCreditLimit: availableCreditLimit,
                    usedCreditLimit: usedCreditLimit,
                    balanceCloseDate: account.creditData?.balanceCloseDate,
                    balanceDueDate: account.creditData?.balanceDueDate,
                    brand: account.creditData?.brand,
                    closingDay: account.creditData?.balanceCloseDate
                        ? parseInt(account.creditData.balanceCloseDate.split('T')[0].split('-')[2], 10)
                        : null
                };
            })() : {}),
            // Current bill info for credit cards (for frontend display)
            ...(isCredit && account._currentBill ? {
                currentBill: {
                    dueDate: account._currentBill.dueDate,
                    totalAmount: account._currentBill.totalAmount,
                    state: account._currentBill.state,
                    paidAmount: account._currentBill.paidAmount,
                    minimumPayment: account._currentBill.minimumPayment
                }
            } : {}),
            // ALL bills for historical lookup (allows frontend to fetch by month)
            ...(isCredit && account._allBills && account._allBills.length > 0 ? {
                bills: account._allBills
            } : {}),
            // Bank account specific data
            ...(account.bankData ? {
                bankNumber: account.bankData.bankNumber,
                branchNumber: account.bankData.branchNumber,
                accountNumber: account.bankData.number,
                transferNumber: account.bankData.transferNumber
            } : {})
        };

        console.log(`>>> Saving account: ${accountData.name} (${accountTypeName}) - Balance: ${accountData.balance}${isCredit ? ` (from bill: ${account._currentBill?.state || 'no bill'})` : ''}`);

        // Correct collection: accounts
        await firebaseAdmin.firestore().collection('users').doc(userId).collection('accounts')
            .doc(account.id).set(removeUndefined(accountData), { merge: true });

        // Determine optimal 'from' date for transactions
        let fromStr = from;
        let dateMsg = fullSync ? "últimos 12 meses" : "novos lançamentos";

        if (!fullSync) {
            try {
                // Use Firestore index: transactions(providerItemId, date, __name__)
                // For credit cards, check creditCardTransactions collection
                const db = firebaseAdmin.firestore();
                const collectionName = isCredit ? 'creditCardTransactions' : 'transactions';

                const lastTxQuery = db.collection('users').doc(userId).collection(collectionName)
                    .where('providerItemId', '==', itemId)
                    .orderBy('date', 'desc')
                    .limit(1);

                const lastTxSnap = await lastTxQuery.get();

                if (!lastTxSnap.empty) {
                    const lastTxDate = lastTxSnap.docs[0].data().date;
                    if (lastTxDate) {
                        fromStr = lastTxDate.split('T')[0];
                        dateMsg = `desde ${new Date(fromStr).toLocaleDateString('pt-BR')}`;
                        console.log(`>>> Incremental Sync: Fetching from ${fromStr} (last transaction date from ${collectionName})`);
                    }
                } else {
                    // No transactions yet for this account - do full sync to get history
                    // This is critical for credit cards that need transaction history
                    const fromDate = new Date();
                    fromDate.setMonth(fromDate.getMonth() - 12);
                    fromDate.setDate(1);
                    fromStr = fromDate.toISOString().split('T')[0];
                    dateMsg = `últimos 12 meses (primeira sync)`;
                    console.log(`>>> First sync for account ${account.id}: Fetching full 12-month history from ${fromStr}`);
                }
            } catch (e) {
                console.warn('>>> Could not query last transaction, using default:', e.message);
                // On error, default to full 12 month sync
                const fromDate = new Date();
                fromDate.setMonth(fromDate.getMonth() - 12);
                fromDate.setDate(1);
                fromStr = fromDate.toISOString().split('T')[0];
                dateMsg = `últimos 12 meses`;
            }
        } else {
            console.log(`>>> Full Sync Enforced: Fetching from ${fromStr}`);
        }

        // Update status: Searching transactions
        await updateSyncStatus(userId, 'in_progress', `Buscando lançamentos (${dateMsg})...`, { current: progress + 5, total: 100 });

        // Fetch Transactions
        let transactions = [];
        try {
            console.log(`>>> Fetching transactions for account ${account.id} from ${fromStr} to ${to}...`);
            let page = 1, totalPages = 1;
            do {
                const res = await pluggyRequest('GET', '/transactions', apiKey, null, { accountId: account.id, from: fromStr, to, page, pageSize: 500 });
                const results = res.results || [];
                console.log(`>>>   Page ${page}: Found ${results.length} transactions`);
                transactions.push(...results);
                totalPages = res.totalPages || 1;
                page++;
            } while (page <= totalPages);
            console.log(`>>> Total transactions for account ${account.id}: ${transactions.length}`);
        } catch (e) {
            console.error(`>>> Error fetching transactions for ${account.id}:`, e.message);
            console.error(`>>> Error details:`, e.response?.data || e);
            // Track error for partial failure reporting
            syncErrors.push({
                accountId: account.id,
                accountName: account.marketingName || account.name || 'Unknown',
                type: 'transaction_fetch',
                error: e.message
            });
            continue;
        }

        if (transactions.length > 0) {
            await updateSyncStatus(userId, 'in_progress', `Processando ${transactions.length} lançamentos...`, { current: progress + 10, total: 100 });
            console.log(`>>> Processing ${transactions.length} transactions for account ${account.id} (isCredit: ${isCredit})...`);
        } else {
            console.log(`>>> No transactions found for account ${account.id}`);
        }

        // Fetch Bills (Credit Card Only) - MOVED UP
        // Logic was moved to line ~486 to populate account balance
        // We keep billsMap for the transaction processing below

        const closingDay = account.creditData?.balanceCloseDate
            ? parseInt(account.creditData.balanceCloseDate.split('T')[0].split('-')[2], 10) : null;

        // Process & Save
        for (const tx of transactions) {
            newTransactionsCount++;
            const rawAmount = Number(tx.amount || 0);
            const date = (tx.date || '').split('T')[0];
            if (!date) continue;

            if (isCredit) {
                const meta = tx.creditCardMetadata || {};
                const bill = meta.billId ? billsMap.get(meta.billId) : null;
                const purchaseDate = (meta.purchaseDate || date).split('T')[0];

                let invoiceMonthKey = null;
                if (bill?.dueDate) {
                    invoiceMonthKey = bill.dueDate.slice(0, 7);
                } else if (closingDay) {
                    invoiceMonthKey = getInvoiceMonthKey(purchaseDate, closingDay);
                } else {
                    invoiceMonthKey = purchaseDate.slice(0, 7);
                }

                const amount = Math.abs(meta.totalInstallments && meta.totalAmount ? (meta.totalAmount / meta.totalInstallments) : rawAmount);

                const txData = {
                    date: purchaseDate,
                    description: tx.description,
                    amount,
                    category: translatePluggyCategory(tx.category),
                    type: rawAmount >= 0 ? 'expense' : 'income',
                    status: tx.status === 'PENDING' ? 'pending' : 'completed',
                    cardId: account.id,
                    cardName: accountDisplayName,
                    installmentNumber: meta.installmentNumber || 0,
                    totalInstallments: meta.totalInstallments || 0,
                    importSource: 'pluggy',
                    providerId: tx.id,
                    providerItemId: account.itemId,
                    invoiceMonthKey: invoiceMonthKey,
                    pluggyRaw: tx,
                    isProjected: false
                };

                // Prevent Duplicates: Remove projected version if this is the real one
                if (txData.installmentNumber > 0) {
                    await cleanupProjectedInstallments(userId, txData);
                }

                // Use batch writer instead of individual upserts
                batchWriter.add('creditCardTransactions', tx.id, txData);

                // Generate Future Installments (these will use regular upsert since they're less frequent)
                if (meta.totalInstallments && meta.totalInstallments > 1) {
                    await generateProjectedInstallments(userId, tx, account, billsMap, closingDay, accountDisplayName);
                }
            } else {
                const amount = Math.abs(rawAmount);
                const txData = {
                    date,
                    description: tx.description,
                    amount,
                    category: translatePluggyCategory(tx.category),
                    type: rawAmount < 0 ? 'expense' : 'income',
                    status: tx.status === 'PENDING' ? 'pending' : 'completed',
                    accountId: account.id,
                    accountType: account.type,
                    importSource: 'pluggy',
                    providerId: tx.id,
                    providerItemId: account.itemId,
                    pluggyRaw: tx
                };

                // Use batch writer instead of individual upserts
                batchWriter.add('transactions', tx.id, txData);
            }
        }
        console.log(`>>> Finished processing transactions for account ${account.id}`);

        // For credit cards without bills, calculate balance from current month transactions
        if (isCredit && currentInvoiceBalance === null && transactions.length > 0) {
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            let calculatedBalance = 0;
            for (const tx of transactions) {
                const txDate = (tx.date || '').split('T')[0];
                const txMonth = txDate.slice(0, 7);
                // Sum transactions from current and previous month (typical billing cycle)
                if (txMonth >= currentMonth || txMonth === `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`) {
                    const amount = Math.abs(Number(tx.amount || 0));
                    calculatedBalance += amount;
                }
            }

            if (calculatedBalance > 0) {
                console.log(`>>> Calculated balance for credit card ${account.id} from transactions: R$${calculatedBalance.toFixed(2)}`);
                // Update the account with calculated balance
                await firebaseAdmin.firestore().collection('users').doc(userId).collection('accounts')
                    .doc(account.id).update({ balance: calculatedBalance });
            }
        }

        // Flush batch after each account to prevent memory buildup
        if (batchWriter.pendingCount >= 200) {
            console.log(`>>> Flushing batch with ${batchWriter.pendingCount} pending operations...`);
            await batchWriter.flush();
        }
    }

    // Final flush of any remaining operations
    if (batchWriter.pendingCount > 0) {
        console.log(`>>> Final batch flush with ${batchWriter.pendingCount} pending operations...`);
        const flushed = await batchWriter.flush();
        console.log(`>>> Flushed ${flushed} transactions in ${batchWriter.commitCount} batch commits`);
    }

    console.log(`>>> Server-Side Sync Completed for ${itemId}. Total transactions processed: ${newTransactionsCount}`);

    // Report success or partial success based on accumulated errors
    if (syncErrors.length > 0) {
        const errorSummary = syncErrors.map(e => `${e.accountName}: ${e.error}`).join('; ');
        console.warn(`>>> Sync completed with ${syncErrors.length} errors: ${errorSummary}`);

        await updateSyncStatus(userId, 'success', `Sincronização concluída com ${syncErrors.length} aviso(s).`, {
            errors: syncErrors,
            partial: true,
            transactionsProcessed: newTransactionsCount
        });

        await addSystemNotification(
            userId,
            'Sincronização Parcial',
            `Seus dados foram atualizados, mas ${syncErrors.length} conta(s) tiveram problemas: ${syncErrors.map(e => e.accountName).join(', ')}.`,
            'warning'
        );
    } else {
        await updateSyncStatus(userId, 'success', 'Sincronização concluída com sucesso!');

        // Send System Notification
        const msg = 'Sincronização concluída. Seus dados estão atualizados.';
        await addSystemNotification(userId, 'Open Finance Atualizado', msg, 'update');
    }
};


// --- Routes ---

router.get('/debug-auth', async (req, res) => {
    console.log('>>> Debug auth endpoint called');

    const debugInfo = {
        timestamp: new Date().toISOString(),
        hasClientId: !!PLUGGY_CLIENT_ID,
        hasClientSecret: !!PLUGGY_CLIENT_SECRET,
        hasStaticApiKey: !!PLUGGY_API_KEY_STATIC,
        clientIdPrefix: PLUGGY_CLIENT_ID ? `${PLUGGY_CLIENT_ID.substring(0, 8)}...${PLUGGY_CLIENT_ID.slice(-4)}` : 'MISSING',
        apiUrl: PLUGGY_API_URL,
        envPath: path.resolve(process.cwd(), '.env'),
        cachedToken: !!cachedApiKey,
        tokenExpiresIn: cachedApiKey ? Math.max(0, Math.round((cachedApiKeyExpiry - Date.now()) / 1000)) : 0,
        firebaseAdminReady: !!firebaseAdmin
    };

    // Test auth if credentials exist
    if (PLUGGY_CLIENT_ID && PLUGGY_CLIENT_SECRET) {
        try {
            const apiKey = await getPluggyApiKey();
            debugInfo.authTest = 'SUCCESS';
            debugInfo.apiKeyPrefix = apiKey ? `${apiKey.substring(0, 10)}...` : 'N/A';
        } catch (e) {
            debugInfo.authTest = 'FAILED';
            debugInfo.authError = e.message;
        }
    } else {
        debugInfo.authTest = 'SKIPPED - Missing credentials';
    }

    console.log('>>> Debug info:', JSON.stringify(debugInfo, null, 2));
    res.json(debugInfo);
});

router.get('/db-items/:userId', async (req, res) => {
    const { userId } = req.params;
    if (!firebaseAdmin) return res.status(500).json({ error: 'Firebase Admin not initialized' });
    try {
        const db = firebaseAdmin.firestore();
        const snap = await db.collection('users').doc(userId).collection('accounts').get();

        const itemsMap = new Map();

        snap.forEach(doc => {
            const data = doc.data();
            if (data.itemId) {
                if (!itemsMap.has(data.itemId)) {
                    itemsMap.set(data.itemId, {
                        id: data.itemId,
                        connector: {
                            name: data.institution || 'Banco',
                            imageUrl: data.connectorImageUrl || null // We might not have this, but that's ok
                        },
                        status: 'CONNECTED (Local)',
                        lastUpdated: data.lastUpdated
                    });
                }
            }
        });

        res.json({ success: true, items: Array.from(itemsMap.values()) });
    } catch (e) {
        res.status(500).json({ error: 'DB Error', details: e.message });
    }
});

// Debug: List all accounts for a user
router.get('/db-accounts/:userId', async (req, res) => {
    const { userId } = req.params;
    if (!firebaseAdmin) return res.status(500).json({ error: 'Firebase Admin not initialized' });
    try {
        const db = firebaseAdmin.firestore();
        const accountsSnap = await db.collection('users').doc(userId).collection('accounts').get();
        const accounts = [];
        accountsSnap.forEach(doc => {
            accounts.push({ id: doc.id, ...doc.data() });
        });

        // Also get credit card transactions count
        const ccTxSnap = await db.collection('users').doc(userId).collection('creditCardTransactions').limit(100).get();
        const bankTxSnap = await db.collection('users').doc(userId).collection('transactions').limit(100).get();

        res.json({
            success: true,
            accounts,
            creditCardTransactionsCount: ccTxSnap.size,
            bankTransactionsCount: bankTxSnap.size
        });
    } catch (e) {
        res.status(500).json({ error: 'DB Error', details: e.message });
    }
});

// Persistent idempotency + queue (Firestore)
const WEBHOOK_JOBS_COLLECTION = 'pluggy_webhook_jobs';
const WEBHOOK_JOB_TTL_MS = 24 * 60 * 60 * 1000; // 24h (configure Firestore TTL on `expiresAt` for auto-cleanup)
const WEBHOOK_JOB_LEASE_MS = 10 * 60 * 1000; // 10 minutes
const WEBHOOK_JOB_MAX_ATTEMPTS = 3; // 3 attempts with exponential backoff
const WEBHOOK_RETRY_DELAYS = [5000, 15000, 45000]; // 5s, 15s, 45s - exponential backoff

const ENABLE_INLINE_WEBHOOK_PROCESSING = String(process.env.PLUGGY_WEBHOOK_INLINE_PROCESSING || '')
    .toLowerCase() === 'true';

// Get retry delay based on attempt number (0-indexed)
const computeWebhookJobBackoffMs = (attempts) => {
    const attemptIndex = Math.max(0, Math.min(Number(attempts || 0), WEBHOOK_RETRY_DELAYS.length - 1));
    return WEBHOOK_RETRY_DELAYS[attemptIndex] || WEBHOOK_RETRY_DELAYS[WEBHOOK_RETRY_DELAYS.length - 1];
};

const enqueueWebhookJob = async (eventId, event) => {
    if (!firebaseAdmin) throw new Error('Firebase Admin not initialized');
    const db = firebaseAdmin.firestore();
    const now = Date.now();

    const jobRef = db.collection(WEBHOOK_JOBS_COLLECTION).doc(eventId);
    const jobData = {
        status: 'queued',
        eventId,
        eventType: event?.event || null,
        itemId: event?.itemId || null,
        clientUserId: event?.clientUserId || null,
        payload: event || null,
        attempts: 0,
        availableAt: firebaseAdmin.firestore.Timestamp.fromMillis(now),
        createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        expiresAt: firebaseAdmin.firestore.Timestamp.fromMillis(now + WEBHOOK_JOB_TTL_MS)
    };

    try {
        await jobRef.create(jobData);
        return { duplicate: false, jobRef };
    } catch (e) {
        const code = e?.code;
        const msg = String(e?.message || '');
        const alreadyExists = code === 6 || code === 'already-exists' || msg.includes('Already exists');
        if (alreadyExists) return { duplicate: true, jobRef };
        throw e;
    }
};

// Helper: Find user by itemId
const findUserByItemId = async (itemId) => {
    if (!firebaseAdmin || !itemId) return null;
    try {
        const db = firebaseAdmin.firestore();
        const accountsSnapshot = await db.collectionGroup('accounts').where('itemId', '==', itemId).limit(1).get();
        if (!accountsSnapshot.empty) {
            return accountsSnapshot.docs[0].ref.parent.parent.id;
        }
    } catch (e) {
        console.error('>>> Error finding user by itemId:', e.message);
    }
    return null;
};

// Helper: Fetch transactions using createdTransactionsLink
const fetchTransactionsFromLink = async (apiKey, link) => {
    if (!link) return [];

    const toEndpoint = (raw) => {
        if (!raw || typeof raw !== 'string') return null;
        const trimmed = raw.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            const u = new URL(trimmed);
            return `${u.pathname}${u.search}`;
        }

        if (trimmed.startsWith('/')) return trimmed;
        return `/${trimmed}`;
    };

    let endpoint = toEndpoint(link);
    if (!endpoint) return [];

    const all = [];
    const seen = new Set();

    for (let i = 0; i < 50; i++) {
        if (!endpoint || seen.has(endpoint)) break;
        seen.add(endpoint);

        try {
            const response = await pluggyRequest('GET', endpoint, apiKey);
            const results = response?.results || [];
            all.push(...results);

            const nextLink =
                (typeof response?.nextPage === 'string' && response.nextPage) ? response.nextPage :
                    (typeof response?.next === 'string' && response.next) ? response.next :
                        (typeof response?.links?.next === 'string' && response.links.next) ? response.links.next :
                            null;

            if (nextLink) {
                endpoint = toEndpoint(nextLink);
                continue;
            }

            const page = Number(response?.page);
            const totalPages = Number(response?.totalPages);

            if (Number.isFinite(page) && Number.isFinite(totalPages) && page < totalPages) {
                const u = new URL(endpoint, PLUGGY_API_URL);
                u.searchParams.set('page', String(page + 1));
                endpoint = `${u.pathname}${u.search}`;
                continue;
            }

            // Fallback: if we got a full page, try the next page
            const u = new URL(endpoint, PLUGGY_API_URL);
            const pageSize = Number(u.searchParams.get('pageSize'));
            const pageParam = Number(u.searchParams.get('page'));
            if (Number.isFinite(pageSize) && pageSize > 0 && results.length === pageSize) {
                const nextPage = Number.isFinite(pageParam) ? pageParam + 1 : 2;
                u.searchParams.set('page', String(nextPage));
                endpoint = `${u.pathname}${u.search}`;
                continue;
            }

            break;
        } catch (e) {
            console.error('>>> Error fetching from transactionsLink:', e.message);
            break;
        }
    }

    return all;
};

// Helper: Fetch transactions by IDs (for transactions/updated event)
const fetchTransactionsByIds = async (apiKey, ids) => {
    const uniqueIds = [...new Set((ids || []).filter(Boolean).map(String))];
    if (uniqueIds.length === 0) return [];

    const all = [];
    for (let i = 0; i < uniqueIds.length; i += 100) {
        const chunk = uniqueIds.slice(i, i + 100);
        try {
            const response = await pluggyRequest('GET', '/transactions', apiKey, null, { ids: chunk.join(',') });
            all.push(...(response.results || []));
        } catch (e) {
            console.error('>>> Error fetching transactions by IDs:', e.message);
        }
    }

    return all;
};

// Helper: Process and save transactions with optimized batch existence check
const processAndSaveTransactions = async (userId, transactions, accountsCache = new Map()) => {
    if (!userId || !firebaseAdmin || transactions.length === 0) return 0;

    const db = firebaseAdmin.firestore();
    const batchSize = 30; // Firestore 'in' query limit
    let savedCount = 0;

    // Group by collection (transactions vs creditCardTransactions) to optimize querying
    const groups = {
        'transactions': [],
        'creditCardTransactions': []
    };

    // 1. Pre-process and categorize
    for (const tx of transactions) {
        const accountId = tx.accountId;

        // Get account info
        let account = accountsCache.get(accountId);
        if (!account) {
            const accountDoc = await db.collection('users').doc(userId).collection('accounts').doc(accountId).get();
            if (accountDoc.exists) {
                account = accountDoc.data();
                accountsCache.set(accountId, account);
            }
        }

        const isCredit = account?.type?.toUpperCase().includes('CREDIT') || account?.subtype?.toUpperCase().includes('CREDIT');
        const targetCollection = isCredit ? 'creditCardTransactions' : 'transactions';

        // Prepare data structure needed for saving
        // We do this early to have the object ready, but we'll refine the fields later
        groups[targetCollection].push({ tx, account, isCredit });
    }

    // 2. Process each collection group
    for (const [collectionName, items] of Object.entries(groups)) {
        if (items.length === 0) continue;

        const collectionRef = db.collection('users').doc(userId).collection(collectionName);
        const allProviderIds = items.map(i => i.tx.id).filter(Boolean);
        const existingIds = new Set();

        // Batch check existence
        for (let i = 0; i < allProviderIds.length; i += batchSize) {
            const chunk = allProviderIds.slice(i, i + batchSize);
            if (chunk.length === 0) continue;

            try {
                // Check by providerId
                const snapshot = await collectionRef.where('providerId', 'in', chunk).select('providerId').get();
                snapshot.docs.forEach(doc => existingIds.add(doc.data().providerId));
            } catch (e) {
                console.error(`Error batch checking transactions in ${collectionName}:`, e);
            }
        }

        // 3. Save ALL items (Upsert to update status/details)
        // const newItems = items.filter(item => !existingIds.has(item.tx.id)); // OLD: Skip existing
        const newItems = items; // NEW: Upsert all

        for (const item of newItems) {
            const { tx, account, isCredit } = item;

            // --- Data Construction (Logic from original upsertTransaction) ---
            const rawAmount = Number(tx.amount || 0);
            const date = (tx.date || '').split('T')[0];
            if (!date) continue;
            const txId = tx.id;

            let txData = {};

            if (isCredit) {
                const meta = tx.creditCardMetadata || {};
                const purchaseDate = (meta.purchaseDate || date).split('T')[0];
                const closingDay = account?.closingDay || null;

                let invoiceMonthKey = purchaseDate.slice(0, 7);
                if (closingDay) {
                    invoiceMonthKey = getInvoiceMonthKey(purchaseDate, closingDay);
                }

                const amount = Math.abs(meta.totalInstallments && meta.totalAmount ? (meta.totalAmount / meta.totalInstallments) : rawAmount);

                // Determine card display name - prioritize brand for credit cards
                const brand = account?.brand || account?.creditData?.brand;
                const cardNameRaw = account?.name || account?.marketingName;
                let cardDisplayName = 'Cartão';
                if (brand && cardNameRaw && !/^\d/.test(cardNameRaw)) {
                    cardDisplayName = cardNameRaw.toLowerCase().includes(brand.toLowerCase()) ? cardNameRaw : `${brand} ${cardNameRaw}`;
                } else if (brand) {
                    cardDisplayName = brand;
                } else if (cardNameRaw && !/^\d/.test(cardNameRaw)) {
                    cardDisplayName = cardNameRaw;
                }

                txData = {
                    date: purchaseDate,
                    description: tx.description,
                    amount,
                    category: translatePluggyCategory(tx.category),
                    type: rawAmount >= 0 ? 'expense' : 'income',
                    status: tx.status === 'PENDING' ? 'pending' : 'completed',
                    cardId: account.id,
                    cardName: cardDisplayName,
                    installmentNumber: meta.installmentNumber || 0,
                    totalInstallments: meta.totalInstallments || 0,
                    importSource: 'pluggy',
                    providerId: txId,
                    providerItemId: tx.itemId,
                    invoiceMonthKey,
                    pluggyRaw: tx,
                    isProjected: false,
                    syncedAt: new Date().toISOString()
                };
            } else {
                const amount = Math.abs(rawAmount);
                txData = {
                    date,
                    description: tx.description,
                    amount,
                    category: translatePluggyCategory(tx.category),
                    type: rawAmount < 0 ? 'expense' : 'income',
                    status: tx.status === 'PENDING' ? 'pending' : 'completed',
                    accountId: account.id,
                    accountType: account?.type,
                    importSource: 'pluggy',
                    providerId: txId,
                    providerItemId: tx.itemId,
                    pluggyRaw: tx,
                    syncedAt: new Date().toISOString()
                };
            }

            // Direct Save (We already checked existence)
            // Use txId as document ID for better idempotency
            await collectionRef.doc(String(txId)).set(removeUndefined(txData), { merge: true });
            savedCount++;
        }
    }

    return savedCount;
};

const handleQueuedWebhookEvent = async (event) => {
    const { event: eventType, itemId, clientUserId, data } = event || {};

    // Find user
    let userId = clientUserId;
    if (!userId && itemId) {
        userId = await findUserByItemId(itemId);
    }

    if (!userId) {
        console.error(`>>> Could not find user for webhook event. itemId: ${itemId}`);
        return { skipped: true, reason: 'user_not_found', itemId, eventType };
    }

    const apiKey = await getPluggyApiKey();

    switch (eventType) {
        case 'transactions/created': {
            const link = data?.createdTransactionsLink;
            if (link) {
                await updateSyncStatus(userId, 'in_progress', 'Processando novas transacoes...');
                const transactions = await fetchTransactionsFromLink(apiKey, link);
                const count = await processAndSaveTransactions(userId, transactions);
                await updateSyncStatus(userId, 'success', `${count} transacoes sincronizadas.`);
                return { success: true, userId, eventType, transactions: count };
            }

            // Fallback (rare): incremental sync on the affected account
            await updateSyncStatus(userId, 'in_progress', 'Processando transacoes...');
            await syncItem(apiKey, itemId, userId, { fromWebhook: true, accountId: data?.accountId });
            return { success: true, userId, eventType, fallback: 'syncItem' };
        }

        case 'transactions/updated': {
            const ids = data?.ids || [];
            if (ids.length > 0) {
                await updateSyncStatus(userId, 'in_progress', 'Atualizando transacoes...');
                const transactions = await fetchTransactionsByIds(apiKey, ids);
                const count = await processAndSaveTransactions(userId, transactions);
                await updateSyncStatus(userId, 'success', `${count} transacoes atualizadas.`);
                return { success: true, userId, eventType, transactions: count };
            }
            return { success: true, userId, eventType, transactions: 0 };
        }

        case 'transactions/deleted': {
            const ids = data?.ids || [];
            if (ids.length > 0) {
                await updateSyncStatus(userId, 'in_progress', 'Removendo transacoes...');
                await deleteTransactions(userId, ids);
                return { success: true, userId, eventType, deleted: ids.length };
            }
            return { success: true, userId, eventType, deleted: 0 };
        }

        case 'item/created':
        case 'item/updated': {
            if (!itemId) return { success: true, userId, eventType, ignored: true };

            const itemData = await pluggyRequest('GET', `/items/${itemId}`, apiKey);
            const status = String(itemData?.status || '').toUpperCase();

            if (status === 'WAITING_USER_INPUT') {
                await updateSyncStatus(userId, 'error', 'Acao necessaria: verifique suas credenciais bancarias.');
                await addSystemNotification(userId, 'Acao Necessaria', 'Seu banco requer confirmacao (MFA). Atualize em Contas Conectadas.', 'alert');
                return { success: true, userId, eventType, itemStatus: status };
            }

            if (status === 'LOGIN_ERROR') {
                await updateSyncStatus(userId, 'error', 'Erro de login no banco. Atualize suas credenciais.');
                await addSystemNotification(userId, 'Erro de Login', 'Nao foi possivel conectar ao seu banco. Verifique suas credenciais.', 'alert');
                return { success: true, userId, eventType, itemStatus: status };
            }

            if (status === 'OUTDATED') {
                await updateSyncStatus(userId, 'pending', 'Dados desatualizados. Aguardando sincronizacao...');
                return { success: true, userId, eventType, itemStatus: status };
            }

            return { success: true, userId, eventType, itemStatus: status };
        }

        case 'item/error': {
            await updateSyncStatus(userId, 'error', 'Erro na conexao com o banco.');
            await addSystemNotification(userId, 'Erro Open Finance', 'Houve um problema ao conectar com seu banco.', 'alert');
            return { success: true, userId, eventType };
        }

        case 'item/deleted':
        default:
            // Transaction events are handled explicitly above.
            return { success: true, userId, eventType, ignored: true };
    }
};

// Webhook - Respond 200 immediately, process async (Pluggy requires <5s response)
router.post('/webhook', async (req, res) => {
    const event = req.body;
    const eventId = getWebhookEventId(event);

    console.log(`>>> PLUGGY WEBHOOK RECEIVED [${eventId}]:`, JSON.stringify(event, null, 2));

    let jobRef = null;
    try {
        const { duplicate, jobRef: ref } = await enqueueWebhookJob(eventId, event);
        if (duplicate) {
            console.log(`>>> Webhook ${eventId} already enqueued/processed, skipping.`);
            return res.status(200).json({ received: true, eventId, duplicate: true });
        }
        jobRef = ref;
    } catch (e) {
        console.error('>>> Failed to enqueue webhook job:', e.message);
        return res.status(500).json({ error: 'Failed to enqueue webhook job', eventId, details: e.message });
    }

    // Respond quickly (Pluggy requirement: must respond in <5 seconds)
    res.status(200).json({ received: true, eventId, queued: true });

    if (ENABLE_INLINE_WEBHOOK_PROCESSING) {
        // Inline processing with automatic retry (5s, 15s, 45s backoff)
        processWebhookWithRetry(event, jobRef, 0);
    }
});

/**
 * Process webhook with automatic retry using exponential backoff (5s, 15s, 45s)
 * @param {Object} event - The webhook event
 * @param {Object} jobRef - Firestore job reference
 * @param {number} attempt - Current attempt number (0-indexed)
 */
const processWebhookWithRetry = async (event, jobRef, attempt) => {
    const { event: eventType, itemId, clientUserId, data } = event;
    const eventId = getWebhookEventId(event);

    console.log(`>>> Webhook processing attempt ${attempt + 1}/${WEBHOOK_JOB_MAX_ATTEMPTS} for ${eventId}`);

    try {
        // Update job status to processing
        if (jobRef) {
            await jobRef.set({
                status: 'processing',
                attempt: attempt + 1,
                leasedUntil: firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_LEASE_MS),
                startedAt: attempt === 0 ? firebaseAdmin.firestore.FieldValue.serverTimestamp() : undefined,
                updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        // Find user
        let userId = clientUserId;
        if (!userId && itemId) {
            console.warn(`>>> Webhook missing clientUserId for item ${itemId}. Looking up...`);
            userId = await findUserByItemId(itemId);
        }

        if (!userId) {
            throw new Error(`Could not find user for webhook event. itemId: ${itemId}`);
        }

        const apiKey = await getPluggyApiKey();

        // Handle different event types according to Pluggy docs
        switch (eventType) {
            case 'item/created':
            case 'item/updated': {
                const itemData = await pluggyRequest('GET', `/items/${itemId}`, apiKey);
                console.log(`>>> Item ${itemId} status: ${itemData.status} (${itemData.statusDetail || 'N/A'})`);

                if (itemData.status === 'WAITING_USER_INPUT') {
                    await updateSyncStatus(userId, 'error', 'Ação necessária: Verifique suas credenciais bancárias.');
                    await addSystemNotification(userId, 'Ação Necessária', 'Seu banco requer confirmação. Acesse Contas Conectadas para atualizar.', 'alert');
                    break;
                }

                if (itemData.status === 'LOGIN_ERROR') {
                    await updateSyncStatus(userId, 'error', 'Erro de login no banco. Atualize suas credenciais.');
                    await addSystemNotification(userId, 'Erro de Login', 'Não foi possível conectar ao seu banco. Verifique suas credenciais.', 'alert');
                    break;
                }

                if (itemData.status === 'OUTDATED') {
                    await updateSyncStatus(userId, 'pending', 'Dados desatualizados. Aguardando sincronização...');
                    break;
                }

                if (itemData.status === 'UPDATED') {
                    await updateSyncStatus(userId, 'in_progress', 'Processando atualização...');
                    await syncItem(apiKey, itemId, userId, { fromWebhook: true });
                }
                break;
            }

            case 'transactions/created': {
                const link = data?.createdTransactionsLink;
                if (link) {
                    await updateSyncStatus(userId, 'in_progress', 'Processando novas transações...');
                    const transactions = await fetchTransactionsFromLink(apiKey, link);
                    const count = await processAndSaveTransactions(userId, transactions);
                    await updateSyncStatus(userId, 'success', `${count} transações sincronizadas.`);
                    console.log(`>>> Processed ${count} new transactions for user ${userId}`);
                } else {
                    await updateSyncStatus(userId, 'in_progress', 'Processando transações...');
                    await syncItem(apiKey, itemId, userId, { fromWebhook: true, accountId: data?.accountId });
                }
                break;
            }

            case 'transactions/updated': {
                const ids = data?.ids || [];
                if (ids.length > 0) {
                    await updateSyncStatus(userId, 'in_progress', 'Atualizando transações...');
                    const transactions = await fetchTransactionsByIds(apiKey, ids);
                    const count = await processAndSaveTransactions(userId, transactions);
                    await updateSyncStatus(userId, 'success', `${count} transações atualizadas.`);
                    console.log(`>>> Updated ${count} transactions for user ${userId}`);
                }
                break;
            }

            case 'transactions/deleted': {
                const ids = data?.ids || [];
                if (ids.length > 0) {
                    await updateSyncStatus(userId, 'in_progress', 'Removendo transações...');
                    await deleteTransactions(userId, ids);
                    console.log(`>>> Deleted ${ids.length} transactions for user ${userId}`);
                }
                break;
            }

            case 'item/error': {
                await updateSyncStatus(userId, 'error', 'Erro na conexão com o banco.');
                await addSystemNotification(userId, 'Erro Open Finance', 'Houve um problema ao conectar com seu banco.', 'alert');
                break;
            }

            case 'item/deleted': {
                console.log(`>>> Item ${itemId} deleted for user ${userId}`);
                break;
            }

            default:
                console.log(`>>> Unknown webhook event type: ${eventType}`);
        }

        // Mark job as done
        if (jobRef) {
            await jobRef.set({
                status: 'done',
                completedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
                expiresAt: firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_TTL_MS),
                updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        console.log(`>>> Webhook ${eventId} processed successfully on attempt ${attempt + 1}`);

    } catch (error) {
        console.error(`>>> Webhook Processing Error (attempt ${attempt + 1}):`, error.message);

        const nextAttempt = attempt + 1;

        if (nextAttempt < WEBHOOK_JOB_MAX_ATTEMPTS) {
            // Schedule retry with exponential backoff
            const retryDelay = computeWebhookJobBackoffMs(attempt);
            console.log(`>>> Scheduling webhook retry in ${retryDelay}ms (attempt ${nextAttempt + 1}/${WEBHOOK_JOB_MAX_ATTEMPTS})`);

            if (jobRef) {
                await jobRef.set({
                    status: 'retrying',
                    attempt: nextAttempt,
                    lastError: error.message,
                    nextRetryAt: firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + retryDelay),
                    updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            // Schedule next retry
            setTimeout(() => {
                processWebhookWithRetry(event, jobRef, nextAttempt);
            }, retryDelay);

        } else {
            // Max retries exceeded - mark as failed and notify user
            console.error(`>>> Webhook ${eventId} failed after ${WEBHOOK_JOB_MAX_ATTEMPTS} attempts`);

            if (jobRef) {
                await jobRef.set({
                    status: 'failed',
                    attempts: nextAttempt,
                    lastError: error.message,
                    failedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_TTL_MS),
                    updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            // Try to notify user of failure
            const userId = clientUserId || (itemId ? await findUserByItemId(itemId).catch(() => null) : null);
            if (userId) {
                await updateSyncStatus(userId, 'error', 'Falha na sincronização automática. Tente manualmente.');
                await addSystemNotification(
                    userId,
                    'Sincronização Falhou',
                    'A sincronização automática falhou após várias tentativas. Por favor, tente sincronizar manualmente.',
                    'alert'
                );
            }
        }
    }
};

// Worker - Process queued webhook jobs (trigger this via Vercel Cron)
router.get('/webhook-worker', async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!firebaseAdmin) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    const limitParam = Number.parseInt(String(req.query.limit || '10'), 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 25) : 10;

    const db = firebaseAdmin.firestore();
    const nowMs = Date.now();
    const nowTs = firebaseAdmin.firestore.Timestamp.fromMillis(nowMs);

    let jobsSnapshot;
    try {
        jobsSnapshot = await db.collection(WEBHOOK_JOBS_COLLECTION)
            .where('availableAt', '<=', nowTs)
            .orderBy('availableAt')
            .limit(limit)
            .get();
    } catch (e) {
        console.error('>>> Failed to query webhook jobs:', e.message);
        return res.status(500).json({ error: 'Failed to query webhook jobs', details: e.message });
    }

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    const results = [];

    for (const doc of jobsSnapshot.docs) {
        const jobRef = doc.ref;

        const claim = await db.runTransaction(async (tx) => {
            const snap = await tx.get(jobRef);
            if (!snap.exists) return null;

            const job = snap.data() || {};
            const status = job.status || 'queued';
            const attempts = Number(job.attempts || 0);
            const availableAtMs = job.availableAt?.toMillis?.();

            // Another worker claimed it already
            if (availableAtMs && availableAtMs > Date.now()) return null;

            if (status === 'done' || status === 'failed') return null;

            if (attempts >= WEBHOOK_JOB_MAX_ATTEMPTS) {
                const expiresAt = firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_TTL_MS);
                tx.update(jobRef, {
                    status: 'failed',
                    failedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
                    availableAt: expiresAt,
                    expiresAt,
                    updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
                });
                return null;
            }

            const nextAttempts = attempts + 1;
            const leaseUntil = firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_LEASE_MS);

            tx.update(jobRef, {
                status: 'processing',
                attempts: nextAttempts,
                leasedUntil: leaseUntil,
                startedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
                availableAt: leaseUntil,
                updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
            });

            return { eventId: job.eventId || doc.id, payload: job.payload, attempts: nextAttempts };
        });

        if (!claim?.payload) {
            skipped++;
            continue;
        }

        try {
            const output = await handleQueuedWebhookEvent(claim.payload);
            processed++;

            const expiresAt = firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_TTL_MS);
            await jobRef.set({
                status: 'done',
                result: output || null,
                completedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
                availableAt: expiresAt,
                expiresAt,
                updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            results.push({ eventId: claim.eventId, status: 'done', output });
        } catch (e) {
            failed++;

            const attempts = claim.attempts || 1;
            const isTerminal = attempts >= WEBHOOK_JOB_MAX_ATTEMPTS;
            const delayMs = isTerminal ? WEBHOOK_JOB_TTL_MS : computeWebhookJobBackoffMs(attempts);
            const availableAt = firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + delayMs);
            const expiresAt = firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_TTL_MS);

            await jobRef.set({
                status: isTerminal ? 'failed' : 'queued',
                lastError: e.message,
                lastErrorAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
                ...(isTerminal ? { failedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp() } : {}),
                availableAt,
                expiresAt,
                updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            results.push({ eventId: claim.eventId, status: isTerminal ? 'failed' : 'queued', error: e.message });
        }
    }

    return res.json({
        ok: true,
        now: new Date().toISOString(),
        fetched: jobsSnapshot.size,
        processed,
        skipped,
        failed,
        results
    });
});

// Helper: Poll item status until completion or timeout, then sync
const pollAndSync = async (apiKey, itemId, userId) => {
    const POLL_INTERVAL_MS = 3000;
    const MAX_ATTEMPTS = 40; // ~2 minutes timeout

    console.log(`>>> Starting Polling for Item ${itemId} (User: ${userId})`);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        try {
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

            const item = await pluggyRequest('GET', `/items/${itemId}`, apiKey);
            const status = item.status;

            console.log(`>>> Poll #${i + 1} Item ${itemId}: ${status}`);

            if (status === 'UPDATED') {
                await updateSyncStatus(userId, 'in_progress', 'Banco atualizado. Buscando transações...');
                // Run the sync
                await syncItem(apiKey, itemId, userId, { fromWebhook: false, fullSync: false }); // Incremental-ish sync
                return;
            }

            if (status === 'LOGIN_ERROR') {
                await updateSyncStatus(userId, 'error', 'Erro: Credenciais bancárias inválidas.');
                return;
            }

            if (status === 'WAITING_USER_INPUT') {
                await updateSyncStatus(userId, 'error', 'Erro: Ação necessária no banco (MFA).');
                return;
            }

            // If still UPDATING, continue loop
        } catch (e) {
            console.error(`>>> Polling error for ${itemId}:`, e.message);
        }
    }

    // Timeout
    await updateSyncStatus(userId, 'error', 'Tempo limite excedido na atualização do banco.');
};

/**
 * Poll and Sync with automatic credit refund on failure
 * Used by /trigger-sync endpoint
 */
const pollAndSyncWithRefund = async (apiKey, itemId, userId, syncJobId, creditTransactionId) => {
    const POLL_INTERVAL_MS = 3000;
    const MAX_ATTEMPTS = 40; // ~2 minutes timeout

    console.log(`>>> Starting Polling with Refund for Item ${itemId} (User: ${userId})`);

    await updateSyncJob(userId, syncJobId, {
        status: 'processing',
        progress: { step: 'Aguardando banco...', current: 20, total: 100 },
        message: 'Aguardando resposta do banco'
    });

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        try {
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

            const item = await pluggyRequest('GET', `/items/${itemId}`, apiKey);
            const status = item.status;

            console.log(`>>> Poll #${i + 1} Item ${itemId}: ${status}`);

            // Update progress
            const progress = Math.min(20 + Math.floor((i / MAX_ATTEMPTS) * 50), 70);
            await updateSyncJob(userId, syncJobId, {
                progress: { step: `Aguardando banco... (${i + 1}/${MAX_ATTEMPTS})`, current: progress, total: 100 }
            });

            if (status === 'UPDATED') {
                await updateSyncStatus(userId, 'in_progress', 'Banco atualizado. Buscando transações...');
                await updateSyncJob(userId, syncJobId, {
                    progress: { step: 'Sincronizando transações...', current: 75, total: 100 },
                    message: 'Banco atualizado, sincronizando dados'
                });

                // Run the sync
                await syncItem(apiKey, itemId, userId, { fromWebhook: false, fullSync: false, syncJobId });

                // Mark as completed
                await updateSyncJob(userId, syncJobId, {
                    status: 'completed',
                    progress: { step: 'Concluído', current: 100, total: 100 },
                    message: 'Sincronização concluída com sucesso',
                    completedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
                });
                return;
            }

            if (status === 'LOGIN_ERROR') {
                const refunded = await refundCredit(userId, creditTransactionId, 'LOGIN_ERROR');
                await updateSyncStatus(userId, 'error', refunded
                    ? 'Erro de login. Crédito reembolsado.'
                    : 'Erro: Credenciais bancárias inválidas.');
                await updateSyncJob(userId, syncJobId, {
                    status: 'failed',
                    lastError: 'LOGIN_ERROR',
                    creditRefunded: refunded,
                    message: 'Erro de login no banco',
                    failedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
                });
                return;
            }

            if (status === 'WAITING_USER_INPUT') {
                const refunded = await refundCredit(userId, creditTransactionId, 'WAITING_USER_INPUT');
                await updateSyncStatus(userId, 'error', refunded
                    ? 'Ação necessária no banco (MFA). Crédito reembolsado.'
                    : 'Erro: Ação necessária no banco (MFA).');
                await updateSyncJob(userId, syncJobId, {
                    status: 'failed',
                    lastError: 'WAITING_USER_INPUT',
                    creditRefunded: refunded,
                    message: 'Requer autenticação adicional',
                    failedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
                });
                return;
            }

            // If still UPDATING, continue loop
        } catch (e) {
            console.error(`>>> Polling error for ${itemId}:`, e.message);
        }
    }

    // Timeout - refund credit
    const refunded = await refundCredit(userId, creditTransactionId, 'TIMEOUT');
    await updateSyncStatus(userId, 'error', refunded
        ? 'Tempo limite excedido. Crédito reembolsado.'
        : 'Tempo limite excedido na atualização do banco.');
    await updateSyncJob(userId, syncJobId, {
        status: 'failed',
        lastError: 'TIMEOUT',
        creditRefunded: refunded,
        message: 'Tempo limite excedido',
        failedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
    });
    await addSystemNotification(userId, 'Sincronização Expirou',
        refunded
            ? 'O banco demorou muito para responder. Seu crédito foi reembolsado.'
            : 'O banco demorou muito para responder. Tente novamente mais tarde.',
        'alert');
};

// Helper: Check and Consume Credit (Transactional)
// Returns creditTransactionId for potential refund on failure
const consumeDailyCredit = async (transaction, userRef, userDoc, userId) => {
    const userData = userDoc.data();

    // Check if user is admin (check both root and profile level)
    const isAdmin = userData.isAdmin === true || userData.profile?.isAdmin === true;

    // Admins have unlimited connection credits
    if (isAdmin) {
        console.log('>>> Admin user detected - unlimited credits');
        return { newCount: 0, remaining: Infinity, creditTransactionId: 'admin_unlimited' };
    }

    // Determine User Plan (mimic frontend/database.ts logic)
    const subscription = userData.subscription || userData.profile?.subscription;
    const userPlan = subscription?.plan || 'starter';

    // Define Limits
    // Starter: 0 credits (cannot sync/connect)
    // Pro/Others: 3 credits
    const MAX_CREDITS = (userPlan === 'starter') ? 0 : 3;

    // Check Daily Credits
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const credits = userData.dailyConnectionCredits || { date: '', count: 0 };

    let currentUsage = 0;
    let newCredits;

    if (credits.date !== today) {
        // Reset for new day
        currentUsage = 0;
        newCredits = { date: today, count: 1 };
    } else {
        currentUsage = credits.count;
        newCredits = { ...credits, count: currentUsage + 1 };
    }

    if (userPlan === 'starter') {
        throw new Error('Plano Gratuito não permite conexões automáticas. Faça upgrade para sincronizar.');
    }

    if (currentUsage >= MAX_CREDITS) {
        throw new Error(`Limite diário de ${MAX_CREDITS} sincronizações atingido. Tente novamente amanhã.`);
    }

    // Generate unique credit transaction ID for potential refund
    const creditTransactionId = `credit_${userId}_${Date.now()}`;

    // Update User Doc with new credit count
    // NOTE: This field is stored at root level as per database.ts
    transaction.set(userRef, { dailyConnectionCredits: newCredits }, { merge: true });

    return { newCount: newCredits.count, remaining: MAX_CREDITS - newCredits.count, creditTransactionId };
};

// Trigger Sync (Manual) - Secure & Async with Credit Refund
router.post('/trigger-sync', async (req, res) => {
    const { itemId, userId } = req.body;
    if (!itemId || !userId) return res.status(400).json({ error: 'itemId and userId required' });

    const db = firebaseAdmin.firestore();
    const userRef = db.collection('users').doc(userId);
    let creditTransactionId = null;
    let syncJobId = null;

    try {
        // 1. Atomic Credit Deduction with transaction ID for potential refund
        const creditResult = await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error('User not found');
            return await consumeDailyCredit(transaction, userRef, userDoc, userId);
        });
        creditTransactionId = creditResult.creditTransactionId;

        // 2. Create sync job for tracking
        syncJobId = await createSyncJob(userId, itemId, creditTransactionId);

        // 3. Initiate Background Sync
        await updateSyncStatus(userId, 'pending', 'Solicitando atualização ao banco...');

        const apiKey = await getPluggyApiKey();

        // Trigger Pluggy update
        await pluggyRequest('PATCH', `/items/${itemId}`, apiKey, {});

        // 4. Respond immediately with syncJobId for tracking
        res.json({
            success: true,
            message: 'Processo de sincronização iniciado.',
            syncJobId
        });

        // 5. Start polling/handling in background with refund on failure
        pollAndSyncWithRefund(apiKey, itemId, userId, syncJobId, creditTransactionId).catch(err => {
            console.error(`Background polling failed for ${itemId}:`, err);
        });

    } catch (e) {
        console.error('Trigger Sync Error:', e.message);
        const status = e.message.includes('Limite') || e.message.includes('Plano') ? 403 : 500;
        res.status(status).json({ error: e.message || 'Falha ao iniciar sincronização.' });
    }
});

// Modern Sync (Secure & Async) with Credit Refund on Failure
router.post('/sync', async (req, res) => {
    const { itemId, userId } = req.body;

    console.log(`>>> Secure Sync called: itemId=${itemId}, userId=${userId}`);

    if (!userId) {
        return res.status(400).json({ error: 'UserId é obrigatório para sincronização.' });
    }

    if (!itemId) {
        return res.status(400).json({ error: 'ItemId é obrigatório para sincronização.' });
    }

    const db = firebaseAdmin.firestore();
    const userRef = db.collection('users').doc(userId);
    let creditTransactionId = null;
    let syncJobId = null;

    try {
        // 1. Atomic Transaction: Deduct Credit & get transaction ID for potential refund
        const creditResult = await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error('Usuário não encontrado.');
            return await consumeDailyCredit(transaction, userRef, userDoc, userId);
        });
        creditTransactionId = creditResult.creditTransactionId;

        console.log(`>>> Credit deducted for User ${userId}. Transaction ID: ${creditTransactionId}`);

        // 2. Create tracked sync job
        syncJobId = await createSyncJob(userId, itemId, creditTransactionId);

        // 3. Immediate Response to Frontend with syncJobId for tracking
        res.json({
            success: true,
            message: 'Processando conexão...',
            syncJobId,
            accounts: [],
            summary: { total: 0, checking: 0, savings: 0, credit: 0 }
        });

        // 4. Background Processing with automatic refund on failure
        processSyncWithRefund(userId, itemId, syncJobId, creditTransactionId);

    } catch (e) {
        console.error('>>> Sync Transaction Failed:', e.message);

        let userMessage = e.message;
        const status = e.message.includes('Limite') || e.message.includes('Plano') ? 403 : 500;

        res.status(status).json({ error: userMessage });
    }
});

router.post('/create-token', async (req, res) => {
    const { userId } = req.body;
    console.log(`>>> Creating connect token for user: ${userId || 'anonymous'}`);

    try {
        const apiKey = await getPluggyApiKey();
        console.log('>>> API Key obtained, creating connect token...');

        const webhookUrl = process.env.PLUGGY_WEBHOOK_URL || 'https://financeiro-ai-pro.vercel.app/api/pluggy/webhook';
        console.log(`>>> Webhook URL: ${webhookUrl}`);

        const connectTokenResponse = await pluggyRequest('POST', '/connect_token', apiKey, {
            clientUserId: userId || 'anonymous',
            options: {
                avoidDuplicates: true,
                webhookUrl
            }
        });

        if (!connectTokenResponse?.accessToken) {
            console.error('>>> Connect token response missing accessToken:', connectTokenResponse);
            throw new Error('Resposta do Pluggy sem accessToken');
        }

        console.log('>>> Connect token created successfully!');
        res.json({ success: true, accessToken: connectTokenResponse.accessToken });
    } catch (error) {
        console.error('>>> Error creating connect token:', error.message);
        console.error('>>> Error details:', error.response?.data || error);

        const status = error.response?.status;
        let userMessage = 'Erro ao criar token de conexão.';

        if (status === 401 || status === 403) {
            userMessage = 'Credenciais do Pluggy inválidas. Contate o suporte.';
        } else if (status === 429) {
            userMessage = 'Limite de requisições atingido. Aguarde alguns minutos.';
        } else if (error.message) {
            userMessage = error.message;
        }

        res.status(status || 500).json({ error: userMessage, details: error.message });
    }
});

router.get('/items', async (req, res) => {
    const { userId } = req.query;
    try {
        const apiKey = await getPluggyApiKey();

        // Strategy 1: Try to fetch from Pluggy Remote API first (Source of Truth)
        let items = [];
        // This allows finding "orphaned" items that exist in Pluggy but not in our DB
        let fetchedFromRemote = false;
        try {
            if (userId) {
                const resData = await pluggyRequest('GET', '/items', apiKey, null, { clientUserId: userId });
                if (resData && Array.isArray(resData.results)) {
                    items = resData.results;
                    fetchedFromRemote = true;
                }
            }
        } catch (remoteErr) {
            console.warn('GET /items remote fetch failed (likely 401/403 or network), falling back to local DB strategy:', remoteErr.message);
        }

        // Strategy 2: Fallback to Local DB itemIds if Remote failed
        if (!fetchedFromRemote && firebaseAdmin && userId) {
            try {
                const db = firebaseAdmin.firestore();
                const accSnap = await db.collection('users').doc(String(userId))
                    .collection('accounts').select('itemId').get();

                const itemIds = new Set();
                accSnap.forEach(d => {
                    const itemId = d.get('itemId');
                    if (itemId) itemIds.add(String(itemId));
                });

                for (const itemId of itemIds) {
                    try {
                        const item = await pluggyRequest('GET', `/items/${itemId}`, apiKey);
                        if (item) items.push(item);
                    } catch (e) {
                        console.warn(`Could not fetch item ${itemId}:`, e.response?.data || e.message);
                    }
                }
            } catch (e) {
                console.warn('Could not list items from DB:', e.message);
            }
        }

        // Fallback 3: If still empty and no admin (shouldn't happen here but keeping structure)
        if (!fetchedFromRemote && !firebaseAdmin) {
            const resData = await pluggyRequest('GET', '/items', apiKey, null, { clientUserId: userId });
            items = resData.results || [];
        }

        res.json({ success: true, items });
    } catch (e) {
        const status = e.response?.status;
        res.status(status || 500).json({ error: 'Error fetching items', details: e.response?.data || e.message });
    }
});

// Get items status with lastUpdatedAt for sync timers
router.get('/items-status', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
        const apiKey = await getPluggyApiKey();

        // Prefer listing items via local DB itemIds + GET /items/{id} (some tenants return 401 on GET /items)
        let items = [];
        if (firebaseAdmin) {
            try {
                const db = firebaseAdmin.firestore();
                const accSnap = await db.collection('users').doc(String(userId))
                    .collection('accounts').select('itemId').get();

                const itemIds = new Set();
                accSnap.forEach(d => {
                    const itemId = d.get('itemId');
                    if (itemId) itemIds.add(String(itemId));
                });

                for (const itemId of itemIds) {
                    try {
                        const item = await pluggyRequest('GET', `/items/${itemId}`, apiKey);
                        if (item) items.push(item);
                    } catch (e) {
                        console.warn(`Could not fetch item ${itemId}:`, e.response?.data || e.message);
                    }
                }
            } catch (e) {
                console.warn('Could not list items from DB:', e.message);
            }
        }

        // Fallback only if we don't have DB access (Firebase Admin not configured)
        if (!firebaseAdmin) {
            const resData = await pluggyRequest('GET', '/items', apiKey, null, { clientUserId: userId });
            items = resData.results || [];
        }

        // Map items to include only relevant sync status info
        const itemsStatus = items.map(item => ({
            id: item.id,
            connectorName: item.connector?.name || 'Banco',
            connectorImageUrl: item.connector?.imageUrl || null,
            status: item.status,
            statusDetail: item.statusDetail,
            lastUpdatedAt: item.lastUpdatedAt || item.updatedAt || null,
            createdAt: item.createdAt,
            executionStatus: item.executionStatus
        }));

        // Also fetch sync_status from our DB for additional context
        let dbSyncStatus = null;
        if (firebaseAdmin) {
            try {
                const doc = await firebaseAdmin.firestore()
                    .collection('users').doc(userId)
                    .collection('sync_status').doc('pluggy').get();
                if (doc.exists) {
                    dbSyncStatus = doc.data();
                }
            } catch (e) {
                console.warn('Could not fetch sync_status from DB:', e.message);
            }
        }

        res.json({
            success: true,
            items: itemsStatus,
            syncStatus: dbSyncStatus,
            serverTime: new Date().toISOString()
        });
    } catch (e) {
        console.error('Error fetching items status:', e.message);
        const status = e.response?.status;
        res.status(status || 500).json({ error: 'Error fetching items status', details: e.response?.data || e.message });
    }
});

router.delete('/item/:itemId', async (req, res) => {
    const { itemId } = req.params;
    try {
        const apiKey = await getPluggyApiKey();
        await pluggyRequest('DELETE', `/items/${itemId}`, apiKey);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error deleting item' });
    }
});

// Cleanup Duplicates Route (Manual Trigger)
router.post('/cleanup-duplicates', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    if (!firebaseAdmin) return res.status(500).json({ error: 'Firebase not initialized' });
    const db = firebaseAdmin.firestore();

    try {
        let deletedCount = 0;
        let processedCount = 0;

        // 1. Cleanup Credit Card Transactions
        // Strategy: Group by (cardId + amount + date) OR (providerId)
        // Priority: Real > Projected
        const ccRef = db.collection('users').doc(userId).collection('creditCardTransactions');
        const ccSnap = await ccRef.get();
        const ccDocs = ccSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const ccMap = new Map(); // Key -> [docs]

        for (const doc of ccDocs) {
            processedCount++;
            // Create a unique key for "sameness"
            // Use strict providerId if available (but watch out for installments being different IDs)
            // Or use fuzzy key: cardId_amount_date_description

            // Cleanup Type A: Exact same providerId (shouldn't happen with set/merge but good to check)
            if (doc.providerId && !doc.isProjected) {
                const key = `PID:${doc.providerId}`;
                if (!ccMap.has(key)) ccMap.set(key, []);
                ccMap.get(key).push(doc);
            }

            // Cleanup Type B: Projected vs Real
            // Key: cardId_installmentNumber_totalInstallments
            if (doc.installmentNumber && doc.totalInstallments) {
                const key = `INST:${doc.cardId}_${doc.installmentNumber}_${doc.totalInstallments}`;
                if (!ccMap.has(key)) ccMap.set(key, []);
                ccMap.get(key).push(doc);
            }
        }

        const batch = db.batch();
        let batchCount = 0;

        for (const [key, docs] of ccMap.entries()) {
            if (docs.length > 1) {
                // We have potential duplicates
                // Sort: Real (isProjected: false) comes first
                docs.sort((a, b) => (a.isProjected === b.isProjected) ? 0 : a.isProjected ? 1 : -1);

                // If we have a Real transaction, keep it and delete ALL Projected ones that match
                const keeper = docs[0];

                // If the first is Projected, and we have multiple, just keep one? 
                // No, only delete if we have mixed types or strict duplicates.

                if (!keeper.isProjected) {
                    for (let i = 1; i < docs.length; i++) {
                        const candidate = docs[i];
                        // Verify it's effectively the same transaction
                        // (Amount fuzzy check)
                        const amountDiff = Math.abs((keeper.amount || 0) - (candidate.amount || 0));
                        if (amountDiff < 0.1) {
                            // Delete candidate
                            batch.delete(ccRef.doc(candidate.id));
                            deletedCount++;
                            batchCount++;
                        }
                    }
                } else {
                    // All are projected. Keep latest syncedAt?
                    // Dedupe strict duplicates
                }
            }
        }

        // 2. Simple ProviderID Deduplication for standard transactions
        const txRef = db.collection('users').doc(userId).collection('transactions');
        const txSnap = await txRef.get();
        const txMap = new Map();

        txSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.providerId) {
                if (!txMap.has(data.providerId)) txMap.set(data.providerId, []);
                txMap.get(data.providerId).push(doc);
            }
        });

        for (const [pid, docs] of txMap.entries()) {
            if (docs.length > 1) {
                // Keep the one with most recent connection/import? Or just random.
                // Keep first, delete others.
                for (let i = 1; i < docs.length; i++) {
                    batch.delete(docs[i].ref);
                    deletedCount++;
                    batchCount++;
                }
            }
        }

        if (batchCount > 0) await batch.commit();

        res.json({ success: true, deleted: deletedCount, processed: processedCount });

    } catch (e) {
        console.error('Cleanup Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Cancel All Syncs (Admin Only)
router.post('/cancel-all-syncs', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId é obrigatório' });
    }

    try {
        const db = firebaseAdmin.firestore();

        // Reset sync status to idle
        await db.collection('users').doc(userId)
            .collection('sync_status').doc('pluggy')
            .set({
                state: 'idle',
                message: 'Sincronização cancelada pelo administrador.',
                lastUpdated: new Date().toISOString()
            }, { merge: true });

        console.log(`>>> Admin cancelled all syncs for user ${userId}`);
        res.json({ success: true, message: 'Todas as sincronizações foram canceladas.' });

    } catch (e) {
        console.error('Cancel Sync Error:', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
