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
    if (PLUGGY_API_KEY_STATIC) return PLUGGY_API_KEY_STATIC;
    if (cachedApiKey && Date.now() < cachedApiKeyExpiry) {
        // console.log('Using cached Pluggy API Key'); 
        return cachedApiKey;
    }
    if (authInProgress) return authInProgress;

    if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
        console.error('MISSING PLUGGY CREDENTIALS in env');
        throw new Error('Pluggy credentials not configured.');
    }

    console.log(`Generating new Pluggy Token... ID starts with: ${PLUGGY_CLIENT_ID.substring(0, 4)}`);

    authInProgress = (async () => {
        try {
            const response = await axios.post(
                `${PLUGGY_API_URL}/auth`,
                { clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET },
                { headers: { 'Content-Type': 'application/json' } }
            );
            cachedApiKey = response.data.apiKey;
            cachedApiKeyExpiry = Date.now() + TOKEN_TTL_MS;
            console.log('Pluggy Token generated successfully.');
            return cachedApiKey;
        } catch (error) {
            console.error('Error generating Pluggy Token:', error.response?.data || error.message);
            cachedApiKey = null;
            throw error;
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
            .set(updateData, { merge: true });
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

const upsertTransaction = async (userId, collectionName, txData, providerId) => {
    if (!firebaseAdmin) return;
    const db = firebaseAdmin.firestore();
    const collectionRef = db.collection('users').doc(userId).collection(collectionName);

    const snapshot = await collectionRef.where('providerId', '==', providerId).limit(1).get();

    if (!snapshot.empty) {
        // User requested to ONLY save new transactions. 
        // If it exists, we skip updating to preserve any manual edits (categories, etc).
        return;
    } else {
        if (providerId) {
            await collectionRef.doc(String(providerId)).set(txData, { merge: true });
        } else {
            await collectionRef.add(txData);
        }
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

    const { fromWebhook = false, accountId: webhookAccountId, transactionsLink, fullSync = false } = options;

    console.log(`>>> Starting Server-Side Sync for Item ${itemId} (User: ${userId}) | Mode: ${fromWebhook ? 'Webhook' : 'Full'}`);
    await updateSyncStatus(userId, 'in_progress', 'Sincronizando contas e transações...');

    // 1. Fetch Accounts
    let accounts = [];
    try {
        let page = 1, totalPages = 1;
        do {
            const res = await pluggyRequest('GET', '/accounts', apiKey, null, { itemId, page, pageSize: 200 });
            accounts.push(...(res.results || []));
            totalPages = res.totalPages || 1;
            page++;
        } while (page <= totalPages);
    } catch (e) {
        console.error('>>> Error fetching accounts:', e.message);
        await updateSyncStatus(userId, 'error', 'Erro ao buscar contas.');
        return;
    }

    // If webhook provided specific accountId, filter to only that account
    if (fromWebhook && webhookAccountId) {
        accounts = accounts.filter(a => a.id === webhookAccountId);
        console.log(`>>> Webhook mode: Filtering to account ${webhookAccountId}`);
    }

    // 2. Determine date range for transaction fetch
    const today = new Date();
    let from, to;

    if (fromWebhook && !fullSync) {
        // Webhook mode: Fetch only last 7 days (new transactions only)
        // The upsert logic will handle deduplication by providerId
        const fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 7);
        from = fromDate.toISOString().split('T')[0];
        to = today.toISOString().split('T')[0];
        console.log(`>>> Webhook optimized fetch: ${from} to ${to} (7 days)`);
    } else {
        // Full sync mode: Fetch 12 months back + 2 months forward
        const fromDate = new Date(today);
        fromDate.setMonth(fromDate.getMonth() - 12);
        fromDate.setDate(1);
        const toDate = new Date(today);
        toDate.setMonth(toDate.getMonth() + 2);
        toDate.setDate(0);
        from = fromDate.toISOString().split('T')[0];
        to = toDate.toISOString().split('T')[0];
        console.log(`>>> Full sync fetch: ${from} to ${to} (12 months)`);
    }

    let newTransactionsCount = 0;

    for (const account of accounts) {
        const type = (account.type || '').toUpperCase();
        const subtype = (account.subtype || '').toUpperCase();
        const isCredit = type.includes('CREDIT') || subtype.includes('CREDIT');

        const accountData = {
            id: account.id,
            itemId: account.itemId,
            name: account.marketingName || account.name || 'Conta',
            type: account.type,
            subtype: account.subtype,
            balance: account.balance ?? 0,
            currency: account.currencyCode || 'BRL',
            lastUpdated: new Date().toISOString(),
            connectionMode: 'AUTO',
        };

        // Correct collection: accounts
        await firebaseAdmin.firestore().collection('users').doc(userId).collection('accounts')
            .doc(account.id).set(accountData, { merge: true });

        // Fetch Transactions
        let transactions = [];
        try {
            let page = 1, totalPages = 1;
            do {
                const res = await pluggyRequest('GET', '/transactions', apiKey, null, { accountId: account.id, from, to, page, pageSize: 500 });
                transactions.push(...(res.results || []));
                totalPages = res.totalPages || 1;
                page++;
            } while (page <= totalPages);
        } catch (e) {
            console.error(`>>> Error fetching transactions for ${account.id}:`, e.message);
            continue;
        }

        // Fetch Bills (Credit Card Only)
        let billsMap = new Map();
        if (isCredit) {
            try {
                const res = await pluggyRequest('GET', '/bills', apiKey, null, { accountId: account.id, pageSize: 100 });
                (res.results || []).forEach(b => billsMap.set(b.id, b));
            } catch (e) { /* ignore */ }
        }

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
                    cardName: account.marketingName || account.name || 'Cartão',
                    installmentNumber: meta.installmentNumber || 0,
                    totalInstallments: meta.totalInstallments || 0,
                    importSource: 'pluggy',
                    providerId: tx.id,
                    providerItemId: account.itemId,
                    invoiceMonthKey: invoiceMonthKey,
                    pluggyRaw: tx,
                    isProjected: false
                };

                await upsertTransaction(userId, 'creditCardTransactions', txData, tx.id);
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

                await upsertTransaction(userId, 'transactions', txData, tx.id);
            }
        }
    }

    console.log(`>>> Server-Side Sync Completed for ${itemId}`);
    await updateSyncStatus(userId, 'success', 'Sincronização concluída com sucesso!');

    // Send System Notification
    const msg = newTransactionsCount > 0
        ? `Seus dados bancários foram atualizados. ${newTransactionsCount} lançamentos processados.`
        : 'Sincronização concluída. Seus dados estão atualizados.';

    await addSystemNotification(userId, 'Open Finance Atualizado', msg, 'update');
};


// --- Routes ---

router.get('/debug-auth', (req, res) => {
    res.json({
        hasClientId: !!PLUGGY_CLIENT_ID,
        clientIdPrefix: PLUGGY_CLIENT_ID ? PLUGGY_CLIENT_ID.substring(0, 5) + '...' : 'MISSING',
        envPath: path.resolve(process.cwd(), '.env'),
    });
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

// Persistent idempotency + queue (Firestore)
const WEBHOOK_JOBS_COLLECTION = 'pluggy_webhook_jobs';
const WEBHOOK_JOB_TTL_MS = 24 * 60 * 60 * 1000; // 24h (configure Firestore TTL on `expiresAt` for auto-cleanup)
const WEBHOOK_JOB_LEASE_MS = 10 * 60 * 1000; // 10 minutes
const WEBHOOK_JOB_MAX_ATTEMPTS = 8;
const WEBHOOK_JOB_BACKOFF_BASE_MS = 30 * 1000;
const WEBHOOK_JOB_BACKOFF_MAX_MS = 10 * 60 * 1000;

const ENABLE_INLINE_WEBHOOK_PROCESSING = String(process.env.PLUGGY_WEBHOOK_INLINE_PROCESSING || '')
    .toLowerCase() === 'true';

const computeWebhookJobBackoffMs = (attempts) => {
    const exp = Math.max(Number(attempts || 1) - 1, 0);
    return Math.min(WEBHOOK_JOB_BACKOFF_MAX_MS, WEBHOOK_JOB_BACKOFF_BASE_MS * (2 ** exp));
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

        // 3. Save ONLY new items
        const newItems = items.filter(item => !existingIds.has(item.tx.id));

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

                txData = {
                    date: purchaseDate,
                    description: tx.description,
                    amount,
                    category: translatePluggyCategory(tx.category),
                    type: rawAmount >= 0 ? 'expense' : 'income',
                    status: tx.status === 'PENDING' ? 'pending' : 'completed',
                    cardId: account.id,
                    cardName: account?.name || 'Cartão',
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
            await collectionRef.doc(String(txId)).set(txData, { merge: true });
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
        // Best-effort inline processing (local/dev only). Production should use /webhook-worker.
        setImmediate(async () => {
            try {
                if (jobRef) {
                    await jobRef.set({
                        status: 'processing',
                        leasedUntil: firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_LEASE_MS),
                        availableAt: firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_LEASE_MS),
                        startedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
                const { event: eventType, itemId, clientUserId, data } = event;

                // Find user
                let userId = clientUserId;
                if (!userId && itemId) {
                    console.warn(`>>> Webhook missing clientUserId for item ${itemId}. Looking up...`);
                    userId = await findUserByItemId(itemId);
                }

                if (!userId) {
                    console.error(`>>> Could not find user for webhook event. itemId: ${itemId}`);
                    return;
                }

                const apiKey = await getPluggyApiKey();

                // Handle different event types according to Pluggy docs
                switch (eventType) {
                    case 'item/created':
                    case 'item/updated': {
                        // For item events, first fetch the updated item status
                        const itemData = await pluggyRequest('GET', `/items/${itemId}`, apiKey);
                        console.log(`>>> Item ${itemId} status: ${itemData.status} (${itemData.statusDetail || 'N/A'})`);

                        // Check if user action is required
                        if (itemData.status === 'WAITING_USER_INPUT') {
                            await updateSyncStatus(userId, 'error', 'Ação necessária: Verifique suas credenciais bancárias.');
                            await addSystemNotification(userId, 'Ação Necessária', 'Seu banco requer confirmação. Acesse Contas Conectadas para atualizar.', 'alert');
                            return;
                        }

                        if (itemData.status === 'LOGIN_ERROR') {
                            await updateSyncStatus(userId, 'error', 'Erro de login no banco. Atualize suas credenciais.');
                            await addSystemNotification(userId, 'Erro de Login', 'Não foi possível conectar ao seu banco. Verifique suas credenciais.', 'alert');
                            return;
                        }

                        if (itemData.status === 'OUTDATED') {
                            await updateSyncStatus(userId, 'pending', 'Dados desatualizados. Aguardando sincronização...');
                            return;
                        }

                        // If status is UPDATED, sync transactions
                        if (itemData.status === 'UPDATED') {
                            await updateSyncStatus(userId, 'in_progress', 'Processando atualização...');
                            await syncItem(apiKey, itemId, userId, { fromWebhook: true });
                        }
                        break;
                    }

                    case 'transactions/created': {
                        // Use createdTransactionsLink to fetch new transactions
                        const link = data?.createdTransactionsLink;
                        if (link) {
                            await updateSyncStatus(userId, 'in_progress', 'Processando novas transações...');
                            const transactions = await fetchTransactionsFromLink(apiKey, link);
                            const count = await processAndSaveTransactions(userId, transactions);
                            await updateSyncStatus(userId, 'success', `${count} transações sincronizadas.`);
                            console.log(`>>> Processed ${count} new transactions for user ${userId}`);
                        } else {
                            // Fallback: use optimized syncItem
                            await updateSyncStatus(userId, 'in_progress', 'Processando transações...');
                            await syncItem(apiKey, itemId, userId, {
                                fromWebhook: true,
                                accountId: data?.accountId
                            });
                        }
                        break;
                    }

                    case 'transactions/updated': {
                        // Fetch updated transactions by IDs
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
                        // Optionally clean up local data
                        break;
                    }

                    default:
                        console.log(`>>> Unknown webhook event type: ${eventType}`);
                }

                if (jobRef) {
                    await jobRef.set({
                        status: 'done',
                        completedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
                        availableAt: firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_TTL_MS),
                        expiresAt: firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_TTL_MS),
                        updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
            } catch (e) {
                console.error('>>> Webhook Processing Error:', e.message);
                if (jobRef) {
                    await jobRef.set({
                        status: 'error',
                        error: e.message,
                        availableAt: firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_BACKOFF_BASE_MS),
                        expiresAt: firebaseAdmin.firestore.Timestamp.fromMillis(Date.now() + WEBHOOK_JOB_TTL_MS),
                        updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
            }
        });
    }
});

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

// Trigger Sync (Manual)
router.post('/trigger-sync', async (req, res) => {
    const { itemId, userId } = req.body; // Accept userId from body
    if (!itemId) return res.status(400).json({ error: 'itemId required' });

    // Update status immediately so UI reacts
    if (userId) {
        await updateSyncStatus(userId, 'pending', 'Solicitando atualização ao banco...');
    }

    try {
        const apiKey = await getPluggyApiKey();
        await pluggyRequest('PATCH', `/items/${itemId}`, apiKey, {});
        res.json({ success: true, message: 'Sync triggered.' });
    } catch (e) {
        if (userId) {
            await updateSyncStatus(userId, 'error', 'Falha ao solicitar atualização.');
        }
        res.status(500).json({ error: 'Failed to trigger sync', details: e.message });
    }
});

// Legacy Sync (Kept for frontend compatibility for now)
router.post('/sync', async (req, res) => {
    // ... Legacy implementation maintained for fallback ...
    const { itemId } = req.body;
    try {
        const apiKey = await getPluggyApiKey();
        const accounts = [];
        let page = 1;
        do {
            const r = await pluggyRequest('GET', '/accounts', apiKey, null, { itemId, page, pageSize: 200 });
            accounts.push(...(r.results || []));
            page++;
        } while (page <= (1));

        const results = [];
        const today = new Date();
        const from = new Date(today.setMonth(today.getMonth() - 12)).toISOString().split('T')[0];
        const to = new Date().toISOString().split('T')[0];

        for (const account of accounts) {
            const txsRes = await pluggyRequest('GET', '/transactions', apiKey, null, { accountId: account.id, from, to, pageSize: 500 });
            const transactions = txsRes.results || [];
            let bills = [];
            const isCredit = (account.type || '').toUpperCase().includes('CREDIT');
            if (isCredit) {
                try {
                    const bRes = await pluggyRequest('GET', '/bills', apiKey, null, { accountId: account.id });
                    bills = bRes.results || [];
                } catch (e) { }
            }
            results.push({ account, transactions, bills });
        }
        res.json({ success: true, accounts: results });
    } catch (e) {
        res.status(500).json({ error: 'Sync failed', details: e.message });
    }
});

router.post('/create-token', async (req, res) => {
    const { userId } = req.body;
    try {
        const apiKey = await getPluggyApiKey();
        const connectTokenResponse = await pluggyRequest('POST', '/connect_token', apiKey, {
            clientUserId: userId || 'anonymous',
            options: { avoidDuplicates: true, webhookUrl: 'https://financeiro-ai-pro.vercel.app/api/pluggy/webhook' }
        });
        res.json({ success: true, accessToken: connectTokenResponse.accessToken });
    } catch (error) {
        res.status(500).json({ error: 'Error creating token', details: error.message });
    }
});

router.get('/items', async (req, res) => {
    const { userId } = req.query;
    try {
        const apiKey = await getPluggyApiKey();

        // Prefer listing items via local DB itemIds + GET /items/{id} (some tenants return 401 on GET /items)
        let items = [];
        if (firebaseAdmin && userId) {
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

export default router;
