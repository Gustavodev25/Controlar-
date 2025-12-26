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

        try {
            // Trigger Pluggy refresh (don't wait for result)
            pluggyApi.patch(`/items/${itemId}`, { webhookUrl: process.env.PLUGGY_WEBHOOK_URL }, {
                headers: { 'X-API-KEY': apiKey }
            }).catch(err => {
                if (err.response?.status === 404) {
                    jobDoc.update({ status: 'failed', error: 'Item not found', needsReconnect: true });
                }
            });

            await jobDoc.update({ progress: 10, step: 'Buscando contas...' });

            // STEP 1: Fetch accounts and existing data IN PARALLEL
            const [accountsResp, existingSnap] = await Promise.all([
                pluggyApi.get(`/accounts?itemId=${itemId}`, { headers: { 'X-API-KEY': apiKey } }),
                accountsRef.get()
            ]);

            const accounts = accountsResp.data.results || [];
            const existingMap = {};
            existingSnap.forEach(doc => {
                const d = doc.data();
                existingMap[doc.id] = { connectedAt: d.connectedAt };
            });

            // STEP 2: Save accounts (quick batch)
            const accBatch = db.batch();
            for (const acc of accounts) {
                const isCredit = acc.type === 'CREDIT' || acc.subtype === 'CREDIT_CARD';
                const existing = existingMap[acc.id];

                const creditFields = isCredit && acc.creditData ? {
                    creditLimit: acc.creditData.creditLimit || null,
                    availableCreditLimit: acc.creditData.availableCreditLimit || null,
                    brand: acc.creditData.brand || null,
                    balanceCloseDate: acc.creditData.balanceCloseDate || null,
                    balanceDueDate: acc.creditData.balanceDueDate || null,
                    closingDay: acc.creditData.balanceCloseDate ? new Date(acc.creditData.balanceCloseDate).getDate() : null,
                    dueDay: acc.creditData.balanceDueDate ? new Date(acc.creditData.balanceDueDate).getDate() : null
                } : {};

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

            await jobDoc.update({ progress: 30, step: 'Buscando transações...' });

            // STEP 3: Fetch ALL transactions IN PARALLEL
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 60);
            const fromStr = fromDate.toISOString().split('T')[0];

            const txPromises = accounts.map(account =>
                pluggyApi.get(`/transactions?accountId=${account.id}&from=${fromStr}`, {
                    headers: { 'X-API-KEY': apiKey }
                }).then(resp => ({ account, transactions: resp.data.results || [] }))
                  .catch(() => ({ account, transactions: [] }))
            );

            const allTxResults = await Promise.all(txPromises);
            await jobDoc.update({ progress: 50, step: 'Salvando transações...' });

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

                        mappedTx = {
                            cardId: account.id,
                            date: tx.date.split('T')[0],
                            description: tx.description,
                            amount: Math.abs(tx.amount),
                            type: tx.amount > 0 ? 'expense' : 'income',
                            category: tx.category || 'Uncategorized',
                            status: 'completed',
                            installments: tx.installments || 1,
                            installmentNumber: 1,
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

            await jobDoc.update({ progress: 70, step: 'Buscando faturas...' });

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

                    return accountsRef.doc(account.id).update({
                        currentBill: {
                            id: current.id,
                            dueDate: current.dueDate,
                            totalAmount: current.totalAmount || null,
                            minimumPaymentAmount: current.minimumPaymentAmount || null,
                            status: current.status || 'OPEN',
                            closeDate: current.closeDate || null
                        },
                        previousBill: previous ? {
                            id: previous.id,
                            dueDate: previous.dueDate,
                            totalAmount: previous.totalAmount || null
                        } : null,
                        bills: sorted.slice(0, 6).map(b => ({
                            id: b.id,
                            dueDate: b.dueDate,
                            totalAmount: b.totalAmount || null,
                            minimumPaymentAmount: b.minimumPaymentAmount || null,
                            status: b.status || 'UNKNOWN'
                        })),
                        billsUpdatedAt: syncTimestamp
                    });
                });

            await Promise.all(billUpdatePromises);

            const duration = Date.now() - startTime;
            await jobDoc.update({
                status: 'completed',
                progress: 100,
                updatedAt: syncTimestamp,
                message: `${txCount} transações em ${(duration/1000).toFixed(1)}s`,
                duration
            });

            console.log(`[Trigger-Sync] Done in ${duration}ms: ${txCount} tx`);

        } catch (err) {
            console.error('[Trigger-Sync] Failed:', err.message);
            await jobDoc.update({ status: 'failed', error: err.message, updatedAt: new Date().toISOString() });
        }
    })();
});


// 4. Manual Sync (Fetch & Save) - OPTIMIZED FOR VERCEL PRO
// Ultra-fast parallel processing for all accounts
router.post('/sync', withPluggyAuth, async (req, res) => {
    const { itemId, userId } = req.body;
    const startTime = Date.now();

    if (!firebaseAdmin) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    const db = firebaseAdmin.firestore();
    const userRef = db.doc(`users/${userId}`);

    // Increment credits in background (don't wait)
    const today = new Date().toLocaleDateString('en-CA');
    db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) return;
        const credits = userDoc.data().dailyConnectionCredits || { date: '', count: 0 };
        const newCredits = credits.date !== today
            ? { date: today, count: 1 }
            : { ...credits, count: credits.count + 1 };
        transaction.update(userRef, { dailyConnectionCredits: newCredits });
    }).catch(() => {}); // Silent fail for credits

    // Create Job Doc and respond immediately
    const jobDoc = await db.collection('users').doc(userId).collection('sync_jobs').add({
        itemId,
        status: 'processing',
        progress: 0,
        createdAt: new Date().toISOString()
    });

    res.json({ success: true, syncJobId: jobDoc.id });

    // OPTIMIZED Background Processing with parallel fetches
    (async () => {
        const apiKey = req.pluggyApiKey;
        const syncTimestamp = new Date().toISOString();
        const accountsRef = db.collection('users').doc(userId).collection('accounts');
        const txCollection = db.collection('users').doc(userId).collection('transactions');
        const ccTxCollection = db.collection('users').doc(userId).collection('creditCardTransactions');

        try {
            // STEP 1: Fetch accounts and existing data IN PARALLEL
            const [accountsResp, existingSnap] = await Promise.all([
                pluggyApi.get(`/accounts?itemId=${itemId}`, { headers: { 'X-API-KEY': apiKey } }),
                accountsRef.get()
            ]);

            const accounts = accountsResp.data.results || [];
            const existingMap = {};
            existingSnap.forEach(doc => {
                const d = doc.data();
                existingMap[doc.id] = { lastSyncedAt: d.lastSyncedAt, connectedAt: d.connectedAt };
            });

            await jobDoc.update({ progress: 15, step: 'Buscando transações...' });

            // STEP 2: Save accounts (quick batch)
            const accBatch = db.batch();
            for (const acc of accounts) {
                const isCredit = acc.type === 'CREDIT' || acc.subtype === 'CREDIT_CARD';
                const existing = existingMap[acc.id];

                const creditFields = isCredit && acc.creditData ? {
                    creditLimit: acc.creditData.creditLimit || null,
                    availableCreditLimit: acc.creditData.availableCreditLimit || null,
                    brand: acc.creditData.brand || null,
                    balanceCloseDate: acc.creditData.balanceCloseDate || null,
                    balanceDueDate: acc.creditData.balanceDueDate || null,
                    closingDay: acc.creditData.balanceCloseDate ? new Date(acc.creditData.balanceCloseDate).getDate() : null,
                    dueDay: acc.creditData.balanceDueDate ? new Date(acc.creditData.balanceDueDate).getDate() : null
                } : {};

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

            // STEP 3: Fetch ALL transactions IN PARALLEL (this is the big speed boost!)
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 60); // 60 days lookback
            const fromStr = fromDate.toISOString().split('T')[0];

            const txPromises = accounts.map(account =>
                pluggyApi.get(`/transactions?accountId=${account.id}&from=${fromStr}`, {
                    headers: { 'X-API-KEY': apiKey }
                }).then(resp => ({ account, transactions: resp.data.results || [] }))
                  .catch(() => ({ account, transactions: [] })) // Silent fail per account
            );

            const allTxResults = await Promise.all(txPromises);
            await jobDoc.update({ progress: 50, step: 'Salvando transações...' });

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

                        mappedTx = {
                            cardId: account.id,
                            date: tx.date.split('T')[0],
                            description: tx.description,
                            amount: Math.abs(tx.amount),
                            type: tx.amount > 0 ? 'expense' : 'income',
                            category: tx.category || 'Uncategorized',
                            status: 'completed',
                            installments: tx.installments || 1,
                            installmentNumber: 1,
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

            await jobDoc.update({ progress: 80, step: 'Buscando faturas...' });

            // STEP 5: Fetch ALL credit card bills IN PARALLEL
            const creditAccounts = accounts.filter(a => a.type === 'CREDIT' || a.subtype === 'CREDIT_CARD');

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

                    return accountsRef.doc(account.id).update({
                        currentBill: {
                            id: current.id,
                            dueDate: current.dueDate,
                            totalAmount: current.totalAmount || null,
                            minimumPaymentAmount: current.minimumPaymentAmount || null,
                            status: current.status || 'OPEN',
                            closeDate: current.closeDate || null
                        },
                        previousBill: previous ? {
                            id: previous.id,
                            dueDate: previous.dueDate,
                            totalAmount: previous.totalAmount || null
                        } : null,
                        bills: sorted.slice(0, 6).map(b => ({
                            id: b.id,
                            dueDate: b.dueDate,
                            totalAmount: b.totalAmount || null,
                            minimumPaymentAmount: b.minimumPaymentAmount || null,
                            status: b.status || 'UNKNOWN'
                        })),
                        billsUpdatedAt: syncTimestamp
                    });
                });

            await Promise.all(billUpdatePromises);

            const duration = Date.now() - startTime;
            await jobDoc.update({
                status: 'completed',
                progress: 100,
                message: `${txCount} transações em ${(duration/1000).toFixed(1)}s`,
                duration
            });

            console.log(`[Sync] Completed in ${duration}ms: ${txCount} transactions`);

        } catch (err) {
            console.error('[Sync] Failed:', err.message);
            await jobDoc.update({ status: 'failed', error: err.message });
        }
    })();
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
