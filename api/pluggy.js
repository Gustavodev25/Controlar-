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

    // 0. Fetch Item details to get connector (institution) name
    let institutionName = 'Banco';
    let connectorImageUrl = null;
    try {
        const itemData = await pluggyRequest('GET', `/items/${itemId}`, apiKey);
        institutionName = itemData.connector?.name || 'Banco';
        connectorImageUrl = itemData.connector?.imageUrl || null;
        console.log(`>>> Item ${itemId} institution: ${institutionName}`);
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

    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        const progress = Math.round(((i) / accounts.length) * 100);

        // Notify processing of specific account
        const accName = account.marketingName || account.name || 'Conta';
        await updateSyncStatus(userId, 'in_progress', `Analisando: ${accName}...`, { current: progress, total: 100 });

        const type = (account.type || '').toUpperCase();
        const subtype = (account.subtype || '').toUpperCase();
        const isCredit = type.includes('CREDIT') || subtype.includes('CREDIT_CARD');
        const isSavings = subtype.includes('SAVINGS') || type.includes('SAVINGS');
        const isChecking = subtype.includes('CHECKING') || type.includes('CHECKING') || type === 'BANK';

        // Log account classification
        console.log(`>>> Processing account ${account.id}: type=${type}, subtype=${subtype}, isCredit=${isCredit}, isSavings=${isSavings}, isChecking=${isChecking}`);

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
                    console.log(`>>>   Bill: id=${b.id}, dueDate=${b.dueDate}, totalAmount=${b.totalAmount}, state=${b.state}, status=${b.status}`);
                });

                // Find the current active invoice (Open, Closed or Overdue) to show as balance
                // Sort by due date descending to get the latest relevant one
                // Check both 'state' and 'status' fields (Pluggy API may use either)
                // Also normalize to uppercase for comparison
                const activeBill = bills
                    .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
                    .find(b => {
                        const state = (b.state || b.status || '').toUpperCase();
                        return ['OPEN', 'OVERDUE', 'CLOSED'].includes(state);
                    });

                if (activeBill) {
                    // Use totalAmount (total invoice value) or balance (remaining to pay)
                    // Usually for 'current spending', totalAmount of the OPEN bill is the current consumption.
                    currentInvoiceBalance = activeBill.totalAmount ?? activeBill.balance ?? 0;
                    console.log(`>>> Found active bill for ${account.id}: ${activeBill.dueDate} - R$${currentInvoiceBalance} (${activeBill.state || activeBill.status})`);
                } else if (bills.length > 0) {
                    // Fallback: If no active bill with expected states, use the most recent bill
                    const mostRecentBill = bills.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))[0];
                    if (mostRecentBill) {
                        currentInvoiceBalance = mostRecentBill.totalAmount ?? mostRecentBill.balance ?? 0;
                        console.log(`>>> Using most recent bill for ${account.id}: ${mostRecentBill.dueDate} - R$${currentInvoiceBalance} (${mostRecentBill.state || mostRecentBill.status})`);
                    }
                }
            } catch (e) {
                console.warn(`>>> Error fetching bills for ${account.id}:`, e.message);
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
            // Credit card specific data
            ...(isCredit && account.creditData ? {
                creditLimit: account.creditData.creditLimit,
                availableCreditLimit: account.creditData.availableCreditLimit,
                balanceCloseDate: account.creditData.balanceCloseDate,
                balanceDueDate: account.creditData.balanceDueDate,
                brand: account.creditData.brand,
                closingDay: account.creditData.balanceCloseDate
                    ? parseInt(account.creditData.balanceCloseDate.split('T')[0].split('-')[2], 10)
                    : null
            } : {}),
            // Bank account specific data
            ...(account.bankData ? {
                bankNumber: account.bankData.bankNumber,
                branchNumber: account.bankData.branchNumber,
                accountNumber: account.bankData.number,
                transferNumber: account.bankData.transferNumber
            } : {})
        };

        console.log(`>>> Saving account: ${accountData.name} (${accountTypeName}) - Balance: ${accountData.balance}`);

        // Correct collection: accounts
        await firebaseAdmin.firestore().collection('users').doc(userId).collection('accounts')
            .doc(account.id).set(removeUndefined(accountData), { merge: true });

        // Determine optimal 'from' date for transactions
        let fromStr = from; // Default to the range calculated above (7 days or 12 months)
        let dateMsg = fullSync ? "últimos 12 meses" : "últimos 7 dias";

        if (!fullSync) {
            try {
                // Find latest transaction for this item to avoid re-reading everything
                const txQuery = firebaseAdmin.firestore().collection('users').doc(userId).collection('transactions')
                    .where('providerItemId', '==', itemId)
                    .orderBy('date', 'desc')
                    .limit(1);

                const txSnap = await txQuery.get();
                if (!txSnap.empty) {
                    const lastTxDate = txSnap.docs[0].data().date;
                    if (lastTxDate) {
                        const lastDate = new Date(lastTxDate);
                        // Smart Sync: Only fetch from 2 days before the last transaction
                        lastDate.setDate(lastDate.getDate() - 2);
                        fromStr = lastDate.toISOString().split('T')[0];
                        dateMsg = `após ${new Date(fromStr).toLocaleDateString('pt-BR')}`;
                        console.log(`>>> Incremental Sync: Fetching from ${fromStr}`);
                    }
                }
            } catch (e) {
                console.warn('>>> Could not optimize sync date, using default:', e.message);
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

                await upsertTransaction(userId, 'creditCardTransactions', txData, tx.id);
                console.log(`>>>   Saved credit card tx: ${tx.id} - ${tx.description} - R$${amount}`);

                // Generate Future Installments
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

                await upsertTransaction(userId, 'transactions', txData, tx.id);
                console.log(`>>>   Saved bank tx: ${tx.id} - ${tx.description} - R$${amount}`);
            }
        }
        console.log(`>>> Finished processing transactions for account ${account.id}`);
    }

    console.log(`>>> Server-Side Sync Completed for ${itemId}. Total transactions processed: ${newTransactionsCount}`);
    await updateSyncStatus(userId, 'success', 'Sincronização concluída com sucesso!');

    // Send System Notification
    // Simplified message as requested by user
    const msg = 'Sincronização concluída. Seus dados estão atualizados.';

    await addSystemNotification(userId, 'Open Finance Atualizado', msg, 'update');
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

// Trigger Sync (Manual) - Now with background polling fallback
router.post('/trigger-sync', async (req, res) => {
    const { itemId, userId } = req.body;
    if (!itemId) return res.status(400).json({ error: 'itemId required' });

    // Update status immediately so UI reacts
    if (userId) {
        await updateSyncStatus(userId, 'pending', 'Solicitando atualização ao banco...');
    }

    try {
        const apiKey = await getPluggyApiKey();

        // 1. Tell Pluggy to update
        await pluggyRequest('PATCH', `/items/${itemId}`, apiKey, {});

        // 2. Start background polling (Fire and Forget)
        // We don't await this, so the UI gets a response fast, but the server keeps working.
        pollAndSync(apiKey, itemId, userId).catch(err => {
            console.error(`Background polling failed for ${itemId}:`, err);
        });

        res.json({ success: true, message: 'Sync process started.' });
    } catch (e) {
        if (userId) {
            await updateSyncStatus(userId, 'error', 'Falha ao solicitar atualização.');
        }
        res.status(500).json({ error: 'Failed to trigger sync', details: e.message });
    }
});

// Modern Sync (Replaces 'Legacy' with robust server-side sync)
router.post('/sync', async (req, res) => {
    const { itemId, userId } = req.body;

    console.log(`>>> Sync endpoint called: itemId=${itemId}, userId=${userId}`);

    if (!userId) {
        return res.status(400).json({ error: 'UserId é obrigatório para sincronização.' });
    }

    if (!itemId) {
        return res.status(400).json({ error: 'ItemId é obrigatório para sincronização.' });
    }

    try {
        const apiKey = await getPluggyApiKey();
        console.log('>>> API Key obtained for sync');

        // 1. Perform Server-Side Sync (Robust, saves to Firestore)
        // Force fullSync to ensure we get 12 months of history as requested
        await syncItem(apiKey, itemId, userId, { fullSync: true });

        // 2. Fetch the synced accounts from DB to return to frontend
        // This maintains compatibility with BankConnectModal which expects a list of accounts
        const db = firebaseAdmin.firestore();
        const accountsSnap = await db.collection('users').doc(userId).collection('accounts')
            .where('itemId', '==', itemId).get();

        const accounts = [];
        let checkingCount = 0, savingsCount = 0, creditCount = 0;

        accountsSnap.forEach(doc => {
            const data = doc.data();

            // Count by type
            if (data.isCredit) creditCount++;
            else if (data.isSavings) savingsCount++;
            else if (data.isChecking) checkingCount++;

            accounts.push({
                account: {
                    id: data.id,
                    itemId: data.itemId,
                    name: data.name,
                    marketingName: data.name,
                    type: data.type,
                    subtype: data.subtype,
                    accountTypeName: data.accountTypeName, // 'Conta Corrente', 'Poupança', 'Cartão de Crédito'
                    isCredit: data.isCredit,
                    isSavings: data.isSavings,
                    isChecking: data.isChecking,
                    balance: data.balance,
                    currencyCode: data.currency,
                    creditData: {
                        brand: data.brand,
                        creditLimit: data.creditLimit,
                        availableCreditLimit: data.availableCreditLimit,
                        balanceCloseDate: data.balanceCloseDate,
                        balanceDueDate: data.balanceDueDate
                    },
                    bankData: {
                        bankNumber: data.bankNumber,
                        branchNumber: data.branchNumber,
                        accountNumber: data.accountNumber,
                        transferNumber: data.transferNumber
                    },
                    connector: {
                        name: data.institution,
                        imageUrl: data.connectorImageUrl
                    }
                },
                transactions: [], // We don't return 1000s of txs to frontend anymore, it's in DB.
                bills: []
            });
        });

        console.log(`>>> Sync complete! Accounts: ${accounts.length} (Corrente: ${checkingCount}, Poupança: ${savingsCount}, Cartão: ${creditCount})`);

        res.json({
            success: true,
            accounts,
            summary: {
                total: accounts.length,
                checking: checkingCount,
                savings: savingsCount,
                credit: creditCount
            }
        });

    } catch (e) {
        console.error('>>> Sync failed:', e.message);
        console.error('>>> Sync error details:', e.response?.data || e);

        let userMessage = 'Falha na sincronização.';
        if (e.message.includes('Credenciais')) {
            userMessage = e.message;
        } else if (e.message.includes('conexão') || e.message.includes('connect')) {
            userMessage = 'Erro de conexão com o Pluggy. Tente novamente.';
        }

        res.status(500).json({ error: userMessage, details: e.message });
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

export default router;
