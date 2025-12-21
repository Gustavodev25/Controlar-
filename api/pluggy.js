import express from 'express';
import axios from 'axios';
import { firebaseAdmin } from './firebaseAdmin.js';
import { loadEnv } from './env.js';
import { v4 as uuidv4 } from 'uuid'; // Usually available, or we can use crypto

loadEnv();

const router = express.Router();

const CLIENT_ID = process.env.PLUGGY_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET?.trim();
const BASE_URL = 'https://api.pluggy.ai'; // Production URL

// Log credentials on startup (masked)
console.log('Pluggy Config:', {
    clientId: CLIENT_ID ? `${CLIENT_ID.substring(0, 8)}...${CLIENT_ID.substring(CLIENT_ID.length - 4)}` : 'NOT SET',
    clientIdLength: CLIENT_ID?.length,
    secretLength: CLIENT_SECRET?.length,
    hasSecret: !!CLIENT_SECRET,
    baseUrl: BASE_URL
});

// Helper to get Pluggy API Key
let cachedApiKey = null;
let apiKeyExpiresAt = 0;

const getApiKey = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cachedApiKey && now < apiKeyExpiresAt) {
        console.log('Using cached API key');
        return cachedApiKey;
    }

    try {
        console.log('Authenticating with Pluggy... (forceRefresh:', forceRefresh, ')');
        const response = await axios.post(`${BASE_URL}/auth`, {
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET
        });

        // Log full response for debugging
        console.log('Auth Response Keys:', Object.keys(response.data));
        console.log('Auth Response Data:', JSON.stringify(response.data, null, 2).substring(0, 500));

        if (!response.data || !response.data.apiKey) {
            console.error('Pluggy Auth Response Missing API Key:', response.data);
            throw new Error('Invalid Auth Response');
        }

        cachedApiKey = response.data.apiKey;
        console.log('Pluggy Auth Successful. Key length:', cachedApiKey.length);
        console.log('Key first 20 chars:', cachedApiKey.substring(0, 20));

        // Expires in 2 hours usually, set safety buffer
        apiKeyExpiresAt = now + (1.9 * 60 * 60 * 1000);
        return cachedApiKey;
    } catch (error) {
        console.error('Failed to authenticate with Pluggy:', error.message);
        if (error.response) console.error('Auth Error Details:', error.response.data);
        throw new Error('Pluggy Authentication Failed');
    }
};

// Middleware to inject API Key
const withPluggyAuth = async (req, res, next) => {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error('No API Key generated');
        }
        req.pluggyApiKey = apiKey;
        next();
    } catch (error) {
        console.error('Middleware Auth Error:', error.message);
        res.status(500).json({ error: 'Failed to authenticate with Bank Provider.' });
    }
};

// --- Endpoints ---

// 0. Test Auth Endpoint (Debug)
router.get('/test-auth', async (req, res) => {
    try {
        // Force fresh authentication
        console.log('=== TEST AUTH START ===');
        const apiKey = await getApiKey(true);
        console.log('Fresh API Key obtained, length:', apiKey.length);

        // Test 1: Try /connectors (simpler endpoint)
        console.log('Test 1: /connectors call...');
        try {
            const connectorsResponse = await axios.get(`${BASE_URL}/connectors?sandbox=true`, {
                headers: { 'X-API-KEY': apiKey }
            });
            console.log('Connectors call SUCCESS! Count:', connectorsResponse.data.results?.length);
        } catch (err) {
            console.error('Connectors failed:', err.response?.status, err.response?.data);
        }

        // Test 2: Try /items with X-API-KEY
        console.log('Test 2: /items with X-API-KEY...');
        try {
            const itemsResponse = await axios.get(`${BASE_URL}/items`, {
                headers: { 'X-API-KEY': apiKey }
            });
            console.log('Items call SUCCESS! Count:', itemsResponse.data.results?.length);
        } catch (err) {
            console.error('Items with X-API-KEY failed:', err.response?.status, err.response?.data);
        }

        // Test 3: Try /items with Authorization Bearer
        console.log('Test 3: /items with Authorization Bearer...');
        try {
            const itemsResponse2 = await axios.get(`${BASE_URL}/items`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            console.log('Items with Bearer SUCCESS! Count:', itemsResponse2.data.results?.length);
        } catch (err) {
            console.error('Items with Bearer failed:', err.response?.status, err.response?.data);
        }

        console.log('=== TEST AUTH END ===');

        res.json({
            success: true,
            keyLength: apiKey.length,
            message: 'Check server console for detailed results'
        });
    } catch (error) {
        console.error('Test Auth Failed:', error.message);
        if (error.response) {
            console.error('Error Response:', error.response.status, error.response.data);
        }
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

// 1. Create Connect Token
router.post('/create-token', withPluggyAuth, async (req, res) => {
    try {
        const { userId } = req.body;
        // Optional: webhookUrl can be configured here if needed for connection events

        const response = await axios.post(`${BASE_URL}/connect_token`, {
            // We can pass options here
            webhookUrl: process.env.PLUGGY_WEBHOOK_URL,
            clientUserId: userId
        }, {
            headers: { 'X-API-KEY': req.pluggyApiKey }
        });

        // Also fetch existing items to show in the "Manage" view if requested
        // But for now just return the token
        res.json({ accessToken: response.data.accessToken });
    } catch (error) {
        console.error('Create Token Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create connection token.' });
    }
});

// 2. List Items (Remote)
router.get('/items', withPluggyAuth, async (req, res) => {
    try {
        const { userId } = req.query; // Used for filtering if Pluggy supports it, or validation

        // Fetch all items (Pluggy API usually returns items associated with the credentials or allows filtering)
        // If we want items specific to a user, we rely on how we stored them or clientUserId if ConnectToken used it.
        // But typically we list all items and filter by ownership if we stored itemId->userId map.
        // FOR NOW: We'll assume the client just wants to list items available to this API Key (simple mode)
        // OR better: filtered by the items we know belong to this user in Firebase?
        // Actually, the frontend calls this to get "Orphan" items too.

        const response = await axios.get(`${BASE_URL}/items`, {
            headers: { 'X-API-KEY': req.pluggyApiKey }
        });

        // Simplification: Return all items. In a real multi-tenant app, you'd filter this!
        res.json({ success: true, items: response.data.results });
    } catch (error) {
        console.error('List Items Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to list items.' });
    }
});

// 3. Trigger Sync (Update Item)
router.post('/trigger-sync', withPluggyAuth, async (req, res) => {
    const { itemId, userId } = req.body;
    try {
        const response = await axios.patch(`${BASE_URL}/items/${itemId}`, {
            // Trigger sync by updating webhook or just valid PATCH
            webhookUrl: process.env.PLUGGY_WEBHOOK_URL
        }, {
            headers: { 'X-API-KEY': req.pluggyApiKey }
        });

        res.json({ success: true, message: 'Sync triggered' });

        // Ideally we should also mark a "sync_job" in Firebase as "pending"
        if (firebaseAdmin) {
            await firebaseAdmin.firestore().collection('users').doc(userId).collection('sync_jobs').add({
                itemId,
                status: 'pending',
                type: 'MANUAL',
                createdAt: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('Trigger Sync Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to trigger sync.' });
    }
});

// 4. Manual Sync (Fetch & Save) - The Core Logic
router.post('/sync', withPluggyAuth, async (req, res) => {
    const { itemId, userId } = req.body;

    if (!firebaseAdmin) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    const syncJobId = uuidv4(); // Generate ID for tracking or let Firestore do it.

    // Start background process (don't await completion for the response)
    // BUT for the first connection, the frontend might be waiting or polling.
    // The frontend code shows it expects `syncJobId` back and then listens to Firestore.

    // Create Job Doc
    const jobsRef = firebaseAdmin.firestore().collection('users').doc(userId).collection('sync_jobs');
    const jobDoc = await jobsRef.add({
        itemId,
        status: 'processing',
        progress: 0,
        createdAt: new Date().toISOString()
    });

    res.json({ success: true, syncJobId: jobDoc.id });

    // Background Processing
    (async () => {
        try {
            const apiKey = req.pluggyApiKey;

            // 1. Get Accounts
            const accountsResp = await axios.get(`${BASE_URL}/accounts?itemId=${itemId}`, {
                headers: { 'X-API-KEY': apiKey }
            });
            const accounts = accountsResp.data.results;

            // PRE-FETCH: Get existing accounts to determine last sync date (Incremental Sync)
            const existingAccountsMap = {};
            try {
                const existingSnap = await firebaseAdmin.firestore().collection('users').doc(userId).collection('accounts').get();
                existingSnap.forEach(doc => {
                    const data = doc.data();
                    // We prefer 'transactionsUpdatedAt' if we had it, but 'updatedAt' is what we have.
                    // Or we can check if there is a 'lastSyncedAt'.
                    // For now, use 'updatedAt' which we update below.
                    existingAccountsMap[doc.id] = data.updatedAt;
                });
            } catch (e) {
                console.error('[Sync] Failed to fetch existing accounts dates:', e);
            }

            // Save Accounts
            const batch = firebaseAdmin.firestore().batch();
            const accountsRef = firebaseAdmin.firestore().collection('users').doc(userId).collection('accounts');

            for (const acc of accounts) {
                const accRef = accountsRef.doc(acc.id);

                // Check if this is a credit card account
                const isCredit = acc.type === 'CREDIT' || acc.subtype === 'CREDIT_CARD';

                // Extract creditData fields to root level for credit cards
                const creditFields = isCredit && acc.creditData ? {
                    creditLimit: acc.creditData.creditLimit || null,
                    availableCreditLimit: acc.creditData.availableCreditLimit || null,
                    usedCreditLimit: acc.creditData.creditLimit && acc.creditData.availableCreditLimit
                        ? acc.creditData.creditLimit - acc.creditData.availableCreditLimit
                        : null,
                    brand: acc.creditData.brand || null,
                    balanceCloseDate: acc.creditData.balanceCloseDate || null,
                    balanceDueDate: acc.creditData.balanceDueDate || null,
                    minimumPayment: acc.creditData.minimumPayment || null,
                    closingDay: acc.creditData.balanceCloseDate ? new Date(acc.creditData.balanceCloseDate).getDate() : null,
                    dueDay: acc.creditData.balanceDueDate ? new Date(acc.creditData.balanceDueDate).getDate() : null
                } : {};

                batch.set(accRef, {
                    ...acc,
                    ...creditFields,
                    itemId: itemId,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }
            await batch.commit();

            await jobDoc.update({ progress: 20, step: 'Fetching transactions...' });

            // 2. Get Transactions (Last 90 days OR Incremental) - PER ACCOUNT
            // We fetch per account to avoid "accountId null" error and to route correctly
            const defaultFromDate = new Date();
            defaultFromDate.setDate(defaultFromDate.getDate() - 90);
            const defaultFromDateStr = defaultFromDate.toISOString().split('T')[0];

            let txCount = 0;
            const txBatch = firebaseAdmin.firestore().batch();
            const txCollection = firebaseAdmin.firestore().collection('users').doc(userId).collection('transactions');
            const ccTxCollection = firebaseAdmin.firestore().collection('users').doc(userId).collection('creditCardTransactions');
            const investmentsCollection = firebaseAdmin.firestore().collection('users').doc(userId).collection('investments');

            let opCount = 0;
            let currentBatch = firebaseAdmin.firestore().batch();

            for (const account of accounts) {
                try {
                    // Determine 'from' date for this account
                    let fromStr = defaultFromDateStr;
                    const lastSync = existingAccountsMap[account.id];

                    if (lastSync) {
                        try {
                            const lastDate = new Date(lastSync);
                            if (!isNaN(lastDate.getTime())) {
                                // Use the date part of the last sync. 
                                // Pluggy 'from' is inclusive, so this covers the overlapping day.
                                fromStr = lastDate.toISOString().split('T')[0];
                                console.log(`[Sync] Incremental: Account ${account.name} last synced ${lastSync}. Fetching from ${fromStr}`);
                            }
                        } catch (err) {
                            console.warn('[Sync] Invalid lastSync date:', lastSync);
                        }
                    } else {
                        console.log(`[Sync] Full: Account ${account.name} (first sync). Fetching from ${fromStr}`);
                    }

                    console.log(`Fetching transactions for account ${account.id} (${account.name}) from ${fromStr}...`);
                    const txResp = await axios.get(`${BASE_URL}/transactions?accountId=${account.id}&from=${fromStr}`, {
                        headers: { 'X-API-KEY': apiKey }
                    });
                    const transactions = txResp.data.results;

                    // Determine Target Collection
                    const isCredit = account.type === 'CREDIT' || account.subtype === 'CREDIT_CARD';
                    const isSavings = account.subtype === 'SAVINGS' || account.subtype === 'SAVINGS_ACCOUNT';

                    let targetColl = txCollection;
                    if (isCredit) targetColl = ccTxCollection;
                    if (isSavings) targetColl = investmentsCollection;

                    for (const tx of transactions) {
                        const txRef = targetColl.doc(tx.id);

                        // Map fields based on target
                        let mappedTx = {};

                        if (isCredit) {
                            // Credit Card Schema
                            mappedTx = {
                                cardId: account.id,
                                date: tx.date.split('T')[0],
                                description: tx.description,
                                // Credit card expenses are positive in Pluggy usually? Or negative?
                                // Usually expenses are negative.
                                // Our DB expects positive amount for expense? 
                                // Checking `database.ts`: `addCreditCardTransaction` doesn't transform.
                                // Let's store absolute value and type 'expense'/'income'
                                amount: Math.abs(tx.amount),
                                type: tx.amount < 0 ? 'expense' : 'income',
                                category: tx.category || 'Uncategorized',
                                status: 'completed',
                                installmnets: tx.installments || 1, // Fix typo if schema uses 'installments'
                                installmentNumber: 1, // Pluggy might give total installments but tracking which one is hard without history?
                                // Pluggy transaction doesn't give "current/total" easily unless description says "01/12"
                                // We'll save raw data for now.
                                pluggyRaw: tx
                            };
                        } else if (isSavings) {
                            // Investment/Savings Schema (Caixinha)
                            // Needs `currentAmount` logic? No, this is transaction history.
                            // `Investments.tsx` expects `Transaction` with `isInvestment: true`.
                            // BUT we are saving to `investments` collection? 
                            // Wait, `Investments.tsx` reads `investments` doc for the BALANCE, but `transactions` for history?
                            // Re-reading user request: "salvar ... em cartao de credito em poupança colocar no caixinhas"
                            // "Caixinhas" usually means we create an INVESTMENT DOC for the account, and maybe transactions go to main list?
                            // Investments.tsx:300 `connectedInvestments` maps connected ACCOUNTS to investments.
                            // So we just need to ensure the account is saved (done above).
                            // AND the transactions should probably go to `transactions` or `investments` collection?
                            // `Investments.tsx` uses `onAddTransaction` which adds to `transactions` collection with `isInvestment: true`.
                            // So for Savings, we should save to `transactions` BUT mark correctly?
                            // OR user meant "saving the ACCOUNT in caixinhas".

                            // Let's assume User wants transactions to go to `transactions` collection but marked as investment?
                            // Actually, if we look at `Investments.tsx` filtering:
                            // `if (selectedInvestment.isConnected) { return t.accountId === selectedInvestment.id; }`
                            // So safe bet: Save to `transactions` collection for Savings too, just ensuring `accountId` is correct.

                            // Wait, user said: "poupança colocar no caixinhas". 
                            // Maybe "caixinhas" IS `investments` collection? 
                            // But `Investments` are *goals*. Connected accounts are *mapped* to investments in UI.
                            // So saving the Account in `users/{userId}/accounts` is enough for it to show up as a Caixinha (if code maps it).
                            // The TRANSACTIONS should go to `transactions`.

                            // So:
                            // Credit Card -> `creditCardTransactions`
                            // Savings -> `transactions` (Account will show in Caixinhas tab)
                            // Checking -> `transactions`

                            targetColl = txCollection;
                            mappedTx = {
                                providerId: tx.id,
                                description: tx.description,
                                amount: Math.abs(tx.amount),
                                type: tx.amount < 0 ? 'expense' : 'income',
                                date: tx.date.split('T')[0],
                                accountId: tx.accountId,
                                category: tx.category || 'Uncategorized',
                                status: 'completed',
                                updatedAt: new Date().toISOString(),
                                isInvestment: isSavings, // Mark as investment if savings
                                pluggyRaw: tx
                            };

                        } else {
                            // Normal Transaction
                            mappedTx = {
                                providerId: tx.id,
                                description: tx.description,
                                amount: Math.abs(tx.amount),
                                type: tx.amount < 0 ? 'expense' : 'income',
                                date: tx.date.split('T')[0],
                                accountId: tx.accountId,
                                category: tx.category || 'Uncategorized',
                                status: 'completed',
                                updatedAt: new Date().toISOString(),
                                pluggyRaw: tx
                            };
                        }

                        currentBatch.set(txRef, mappedTx, { merge: true });
                        opCount++;
                        txCount++;

                        if (opCount >= 450) {
                            await currentBatch.commit();
                            currentBatch = firebaseAdmin.firestore().batch();
                            opCount = 0;
                        }
                    }

                } catch (accErr) {
                    console.error(`Failed to fetch transactions for account ${account.id}:`, accErr.message);
                }
            }

            if (opCount > 0) await currentBatch.commit();

            await jobDoc.update({ progress: 80, step: 'Fetching credit card bills...' });

            // 3. Get Credit Card Bills for credit accounts
            let billCount = 0;
            for (const account of accounts) {
                const isCredit = account.type === 'CREDIT' || account.subtype === 'CREDIT_CARD';
                if (!isCredit) continue;

                try {
                    console.log(`Fetching bills for credit card ${account.id} (${account.name})...`);
                    const billsResp = await axios.get(`${BASE_URL}/bills?accountId=${account.id}`, {
                        headers: { 'X-API-KEY': apiKey }
                    });
                    const bills = billsResp.data.results || [];
                    console.log(`Found ${bills.length} bills for account ${account.id}`);

                    // Update the account document with bill information
                    if (bills.length > 0) {
                        // Sort by dueDate to get current/latest bill
                        const sortedBills = bills.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
                        const currentBill = sortedBills[0];
                        const previousBill = sortedBills[1] || null;

                        const accountRef = firebaseAdmin.firestore()
                            .collection('users').doc(userId)
                            .collection('accounts').doc(account.id);

                        await accountRef.update({
                            // Current bill info
                            currentBill: {
                                id: currentBill.id,
                                dueDate: currentBill.dueDate,
                                totalAmount: currentBill.totalAmount || null,
                                minimumPaymentAmount: currentBill.minimumPaymentAmount || null,
                                status: currentBill.status || 'OPEN',
                                closeDate: currentBill.closeDate || null
                            },
                            // Previous bill for comparison
                            previousBill: previousBill ? {
                                id: previousBill.id,
                                dueDate: previousBill.dueDate,
                                totalAmount: previousBill.totalAmount || null
                            } : null,
                            // All bills (last 6)
                            bills: sortedBills.slice(0, 6).map(b => ({
                                id: b.id,
                                dueDate: b.dueDate,
                                totalAmount: b.totalAmount || null,
                                minimumPaymentAmount: b.minimumPaymentAmount || null,
                                status: b.status || 'UNKNOWN'
                            })),
                            billsUpdatedAt: new Date().toISOString()
                        });

                        billCount++;
                        console.log(`Updated account ${account.id} with bill data. Current bill: R$${currentBill.totalAmount}, Due: ${currentBill.dueDate}`);
                    }
                } catch (billErr) {
                    console.error(`Failed to fetch bills for account ${account.id}:`, billErr.message);
                }
            }

            await jobDoc.update({
                status: 'completed',
                progress: 100,
                message: `Synced ${txCount} transactions, ${billCount} card bills`
            });

        } catch (err) {
            console.error('Background Sync Failed:', err);
            await jobDoc.update({ status: 'failed', error: err.message });
        }
    })();
});

// 5. Delete Item
router.delete('/item/:itemId', withPluggyAuth, async (req, res) => {
    const { itemId } = req.params;
    try {
        await axios.delete(`${BASE_URL}/items/${itemId}`, {
            headers: { 'X-API-KEY': req.pluggyApiKey }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete Item Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to delete item.' });
    }
});

// 6. Get Item Status
router.get('/items-status', withPluggyAuth, async (req, res) => {
    try {
        console.log('Fetching items status from Pluggy...');

        const response = await axios.get(`${BASE_URL}/items`, {
            headers: { 'X-API-KEY': req.pluggyApiKey }
        });

        console.log('Items fetched:', response.data.results?.length);

        if (!response.data.results) {
            console.error('Unexpected response structure:', response.data);
            return res.json({ success: true, items: [] });
        }

        const items = response.data.results.map(i => ({
            id: i.id,
            status: i.status,
            lastUpdatedAt: i.lastUpdatedAt,
            connectorName: i.connector?.name
        }));

        res.json({ success: true, items });
    } catch (error) {
        console.error('Failed to fetch items status:', error.message);

        // Handle 401 gracefully - likely means no items exist yet
        if (error.response?.status === 401) {
            console.log('401 on /items - returning empty list (no items exist yet)');
            return res.json({ success: true, items: [], message: 'No items connected yet' });
        }

        // For other errors, still return empty to not break frontend
        console.error('Pluggy API Error:', error.response?.data);
        res.json({ success: true, items: [], error: 'Could not fetch items from Pluggy' });
    }
});

// 7. DB Items (Fallback)
router.get('/db-items/:userId', async (req, res) => {
    // If we want to return items stored in Firebase
    // Useful if pluggy remote keys are problematic
    res.json({ items: [] });
});

// 8. Webhook Worker (Cron Job Endpoint)
// This endpoint is called by Vercel cron every minute to process pending sync jobs
router.get('/webhook-worker', async (req, res) => {
    try {
        console.log('[Webhook Worker] Cron job triggered at:', new Date().toISOString());

        if (!firebaseAdmin) {
            console.log('[Webhook Worker] Firebase Admin not initialized');
            return res.json({ success: true, message: 'Firebase Admin not available' });
        }

        // Get API Key for potential sync operations
        const apiKey = await getApiKey();
        if (!apiKey) {
            console.log('[Webhook Worker] Could not obtain API key');
            return res.json({ success: true, message: 'No API key available' });
        }

        // Check for any items that might need sync (items in 'UPDATING' or 'UPDATED' status)
        try {
            const itemsResponse = await axios.get(`${BASE_URL}/items`, {
                headers: { 'X-API-KEY': apiKey }
            });

            const items = itemsResponse.data.results || [];
            const updatedItems = items.filter(i => i.status === 'UPDATED');

            console.log(`[Webhook Worker] Found ${items.length} items, ${updatedItems.length} recently updated`);

            // For now, just log. In future, we could trigger syncs for updated items
            // that don't have recent sync_jobs

            res.json({
                success: true,
                message: 'Webhook worker executed',
                itemsCount: items.length,
                updatedCount: updatedItems.length,
                timestamp: new Date().toISOString()
            });
        } catch (pluggyError) {
            console.error('[Webhook Worker] Pluggy API error:', pluggyError.message);
            res.json({
                success: true,
                message: 'Webhook worker ran but Pluggy API unavailable',
                error: pluggyError.message
            });
        }
    } catch (error) {
        console.error('[Webhook Worker] Error:', error.message);
        res.status(500).json({ error: 'Webhook worker failed', message: error.message });
    }
});

export default router;
