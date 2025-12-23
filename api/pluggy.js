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

        // Debug: Log credential presence (NOT the actual values)
        console.log('[Auth Debug] CLIENT_ID present:', !!CLIENT_ID, 'length:', CLIENT_ID?.length || 0);
        console.log('[Auth Debug] CLIENT_SECRET present:', !!CLIENT_SECRET, 'length:', CLIENT_SECRET?.length || 0);

        if (!CLIENT_ID || !CLIENT_SECRET) {
            throw new Error('Pluggy credentials not configured - check PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET env vars');
        }
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
        if (error.response?.status === 401) {
            console.error('[/items] 401 Unauthorized - Credentials valid but access denied. Check Pluggy Dashboard permissions.');
            // Return empty list to avoid crashing frontend, but signal error
            return res.status(401).json({ error: 'Unauthorized to list items', items: [] });
        }
        console.error('List Items Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to list items.' });
    }
});

// 3. Trigger Sync (Update Item) - Now includes full data sync
router.post('/trigger-sync', withPluggyAuth, async (req, res) => {
    const { itemId, userId } = req.body;

    if (!firebaseAdmin) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    // Create Job Doc first to track progress
    const jobsRef = firebaseAdmin.firestore().collection('users').doc(userId).collection('sync_jobs');
    let jobDoc;

    try {
        jobDoc = await jobsRef.add({
            itemId,
            status: 'processing',
            progress: 0,
            type: 'MANUAL',
            createdAt: new Date().toISOString()
        });
    } catch (e) {
        console.error('Failed to create sync job:', e);
        return res.status(500).json({ error: 'Failed to create sync job' });
    }

    // Respond immediately so frontend knows sync started
    res.json({ success: true, message: 'Sync triggered', syncJobId: jobDoc.id });

    // Background Processing - fetch and save data
    (async () => {
        const apiKey = req.pluggyApiKey;

        try {
            // First, trigger Pluggy to refresh the item data
            try {
                await axios.patch(`${BASE_URL}/items/${itemId}`, {
                    webhookUrl: process.env.PLUGGY_WEBHOOK_URL
                }, {
                    headers: { 'X-API-KEY': apiKey }
                });
                console.log(`[Trigger-Sync] Pluggy item ${itemId} refresh triggered`);
            } catch (patchErr) {
                // If item not found, mark job as failed and exit
                if (patchErr.response?.status === 404) {
                    await jobDoc.update({
                        status: 'failed',
                        error: 'Item not found in Pluggy',
                        needsReconnect: true
                    });
                    return;
                }
                // For other errors, log but continue with sync
                console.warn('[Trigger-Sync] Patch failed but continuing:', patchErr.message);
            }

            await jobDoc.update({ progress: 10, step: 'Fetching accounts...' });

            // 1. Get Accounts
            const accountsResp = await axios.get(`${BASE_URL}/accounts?itemId=${itemId}`, {
                headers: { 'X-API-KEY': apiKey }
            });
            const accounts = accountsResp.data.results;
            console.log(`[Trigger-Sync] Found ${accounts.length} accounts for item ${itemId}`);

            // PRE-FETCH: Get existing accounts to determine last sync date (Incremental Sync)
            const existingAccountsMap = {};
            try {
                const existingSnap = await firebaseAdmin.firestore().collection('users').doc(userId).collection('accounts').get();
                existingSnap.forEach(doc => {
                    const data = doc.data();
                    existingAccountsMap[doc.id] = {
                        lastSyncedAt: data.lastSyncedAt || data.updatedAt,
                        connectedAt: data.connectedAt,
                        isFirstSync: !data.connectedAt
                    };
                });
            } catch (e) {
                console.error('[Trigger-Sync] Failed to fetch existing accounts dates:', e);
            }

            // Save Accounts
            const batch = firebaseAdmin.firestore().batch();
            const accountsRef = firebaseAdmin.firestore().collection('users').doc(userId).collection('accounts');
            const syncTimestamp = new Date().toISOString();

            for (const acc of accounts) {
                const accRef = accountsRef.doc(acc.id);
                const existingInfo = existingAccountsMap[acc.id];
                const isFirstSync = !existingInfo || existingInfo.isFirstSync;

                const isCredit = acc.type === 'CREDIT' || acc.subtype === 'CREDIT_CARD';
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

                const connectionFields = isFirstSync ? { connectedAt: syncTimestamp } : {};

                batch.set(accRef, {
                    ...acc,
                    ...creditFields,
                    ...connectionFields,
                    accountNumber: acc.number || null, // Map Pluggy's 'number' to 'accountNumber'
                    itemId: itemId,
                    lastSyncedAt: syncTimestamp,
                    updatedAt: syncTimestamp
                }, { merge: true });
            }
            await batch.commit();

            await jobDoc.update({ progress: 30, step: 'Fetching transactions...' });

            // 2. Get Transactions (Incremental) - PER ACCOUNT
            const defaultFromDate = new Date();
            defaultFromDate.setDate(defaultFromDate.getDate() - 90);
            const defaultFromDateStr = defaultFromDate.toISOString().split('T')[0];

            let txCount = 0;
            const txCollection = firebaseAdmin.firestore().collection('users').doc(userId).collection('transactions');
            const ccTxCollection = firebaseAdmin.firestore().collection('users').doc(userId).collection('creditCardTransactions');

            let opCount = 0;
            let currentBatch = firebaseAdmin.firestore().batch();

            for (const account of accounts) {
                try {
                    // Determine 'from' date for this account (Incremental Sync)
                    let fromStr = defaultFromDateStr;
                    let lastSyncTimestamp = null;
                    const syncInfo = existingAccountsMap[account.id];

                    if (syncInfo && syncInfo.lastSyncedAt) {
                        try {
                            const lastDate = new Date(syncInfo.lastSyncedAt);
                            if (!isNaN(lastDate.getTime())) {
                                fromStr = lastDate.toISOString().split('T')[0];
                                lastSyncTimestamp = lastDate.getTime();
                                console.log(`[Trigger-Sync] Incremental: Account ${account.name} last synced ${syncInfo.lastSyncedAt}. Fetching from ${fromStr}`);
                            }
                        } catch (err) {
                            console.warn('[Trigger-Sync] Invalid lastSync date:', syncInfo.lastSyncedAt);
                        }
                    } else {
                        console.log(`[Trigger-Sync] Full: Account ${account.name} (first sync). Fetching from ${fromStr}`);
                    }

                    const txResp = await axios.get(`${BASE_URL}/transactions?accountId=${account.id}&from=${fromStr}`, {
                        headers: { 'X-API-KEY': apiKey }
                    });
                    let transactions = txResp.data.results;

                    // Filter out transactions that were already synced (by timestamp)
                    if (lastSyncTimestamp && transactions.length > 0) {
                        const originalCount = transactions.length;
                        transactions = transactions.filter(tx => {
                            const txDate = new Date(tx.date);
                            return txDate.getTime() >= lastSyncTimestamp;
                        });
                        const filtered = originalCount - transactions.length;
                        if (filtered > 0) {
                            console.log(`[Trigger-Sync] Filtered ${filtered} already-synced transactions (kept ${transactions.length})`);
                        }
                    }

                    // Determine Target Collection
                    const isCredit = account.type === 'CREDIT' || account.subtype === 'CREDIT_CARD';
                    const isSavings = account.subtype === 'SAVINGS' || account.subtype === 'SAVINGS_ACCOUNT';
                    let targetColl = isCredit ? ccTxCollection : txCollection;

                    for (const tx of transactions) {
                        const txRef = targetColl.doc(tx.id);
                        let mappedTx = {};

                        if (isCredit) {
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
                                updatedAt: new Date().toISOString(),
                                isInvestment: isSavings,
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
                    console.error(`[Trigger-Sync] Failed to fetch transactions for account ${account.id}:`, accErr.message);
                }
            }

            if (opCount > 0) await currentBatch.commit();

            await jobDoc.update({ progress: 70, step: 'Fetching credit card bills...' });

            // 3. Get Credit Card Bills
            let billCount = 0;
            for (const account of accounts) {
                const isCredit = account.type === 'CREDIT' || account.subtype === 'CREDIT_CARD';
                if (!isCredit) continue;

                try {
                    const billsResp = await axios.get(`${BASE_URL}/bills?accountId=${account.id}`, {
                        headers: { 'X-API-KEY': apiKey }
                    });
                    const bills = billsResp.data.results || [];

                    if (bills.length > 0) {
                        const sortedBills = bills.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
                        const currentBill = sortedBills[0];
                        const previousBill = sortedBills[1] || null;

                        const accountRef = firebaseAdmin.firestore()
                            .collection('users').doc(userId)
                            .collection('accounts').doc(account.id);

                        await accountRef.update({
                            currentBill: {
                                id: currentBill.id,
                                dueDate: currentBill.dueDate,
                                totalAmount: currentBill.totalAmount || null,
                                minimumPaymentAmount: currentBill.minimumPaymentAmount || null,
                                status: currentBill.status || 'OPEN',
                                closeDate: currentBill.closeDate || null
                            },
                            previousBill: previousBill ? {
                                id: previousBill.id,
                                dueDate: previousBill.dueDate,
                                totalAmount: previousBill.totalAmount || null
                            } : null,
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
                        console.log(`[Trigger-Sync] Updated account ${account.id} with bill data`);
                    }
                } catch (billErr) {
                    console.error(`[Trigger-Sync] Failed to fetch bills for account ${account.id}:`, billErr.message);
                }
            }

            // Mark job as completed
            await jobDoc.update({
                status: 'completed',
                progress: 100,
                updatedAt: new Date().toISOString(),
                message: `Synced ${txCount} transactions, ${billCount} card bills`
            });

            console.log(`[Trigger-Sync] Completed! ${txCount} transactions, ${billCount} bills`);

        } catch (err) {
            console.error('[Trigger-Sync] Background sync failed:', err);
            await jobDoc.update({
                status: 'failed',
                error: err.message,
                updatedAt: new Date().toISOString()
            });
        }
    })();
});


// 4. Manual Sync (Fetch & Save) - The Core Logic
router.post('/sync', withPluggyAuth, async (req, res) => {
    const { itemId, userId } = req.body;

    if (!firebaseAdmin) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    // Increment daily connection credits for the user
    const userRef = firebaseAdmin.firestore().doc(`users/${userId}`);
    try {
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

        await firebaseAdmin.firestore().runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                console.warn(`[Sync] User ${userId} not found for credit increment`);
                return;
            }

            const userData = userDoc.data();
            const credits = userData.dailyConnectionCredits || { date: '', count: 0 };

            let newCredits;
            if (credits.date !== today) {
                // Reset for new day
                newCredits = { date: today, count: 1 };
            } else {
                // Increment for today
                newCredits = { ...credits, count: credits.count + 1 };
            }

            transaction.update(userRef, { dailyConnectionCredits: newCredits });
            console.log(`[Sync] User ${userId} credits updated: ${newCredits.count} used today`);
        });
    } catch (creditErr) {
        console.error('[Sync] Failed to increment credits:', creditErr.message);
        // Continue with sync even if credit increment fails
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
            // Now we store both the full date string and the connectedAt timestamp
            const existingAccountsMap = {};
            try {
                const existingSnap = await firebaseAdmin.firestore().collection('users').doc(userId).collection('accounts').get();
                existingSnap.forEach(doc => {
                    const data = doc.data();
                    // Store complete sync info for incremental sync
                    existingAccountsMap[doc.id] = {
                        lastSyncedAt: data.lastSyncedAt || data.updatedAt, // Full ISO timestamp
                        connectedAt: data.connectedAt,  // First connection timestamp
                        isFirstSync: !data.connectedAt  // True if account never synced before
                    };
                });
            } catch (e) {
                console.error('[Sync] Failed to fetch existing accounts dates:', e);
            }

            // Save Accounts
            const batch = firebaseAdmin.firestore().batch();
            const accountsRef = firebaseAdmin.firestore().collection('users').doc(userId).collection('accounts');
            const syncTimestamp = new Date().toISOString(); // Use same timestamp for all accounts in this sync

            for (const acc of accounts) {
                const accRef = accountsRef.doc(acc.id);
                const existingInfo = existingAccountsMap[acc.id];
                const isFirstSync = !existingInfo || existingInfo.isFirstSync;

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

                // Only set connectedAt on first sync (preserves original connection time)
                const connectionFields = isFirstSync ? {
                    connectedAt: syncTimestamp
                } : {};

                batch.set(accRef, {
                    ...acc,
                    ...creditFields,
                    ...connectionFields,
                    accountNumber: acc.number || null, // Map Pluggy's 'number' to 'accountNumber'
                    itemId: itemId,
                    lastSyncedAt: syncTimestamp, // Always update on every sync
                    updatedAt: syncTimestamp
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
                    let lastSyncTimestamp = null; // Full timestamp for filtering
                    const syncInfo = existingAccountsMap[account.id];

                    if (syncInfo && syncInfo.lastSyncedAt) {
                        try {
                            const lastDate = new Date(syncInfo.lastSyncedAt);
                            if (!isNaN(lastDate.getTime())) {
                                // Use the date part of the last sync for API request
                                // Pluggy 'from' is inclusive, so this covers the overlapping day.
                                fromStr = lastDate.toISOString().split('T')[0];
                                // Store full timestamp for filtering transactions by hour
                                lastSyncTimestamp = lastDate.getTime();
                                console.log(`[Sync] Incremental: Account ${account.name} last synced ${syncInfo.lastSyncedAt}. Fetching from ${fromStr}`);
                            }
                        } catch (err) {
                            console.warn('[Sync] Invalid lastSync date:', syncInfo.lastSyncedAt);
                        }
                    } else {
                        console.log(`[Sync] Full: Account ${account.name} (first sync). Fetching from ${fromStr}`);
                    }

                    console.log(`Fetching transactions for account ${account.id} (${account.name}) from ${fromStr}...`);
                    const txResp = await axios.get(`${BASE_URL}/transactions?accountId=${account.id}&from=${fromStr}`, {
                        headers: { 'X-API-KEY': apiKey }
                    });
                    let transactions = txResp.data.results;

                    // Filter out transactions that were already synced (by timestamp)
                    // This handles the case where user connected at 10:00 AM - only get transactions from 10:00 onwards
                    if (lastSyncTimestamp && transactions.length > 0) {
                        const originalCount = transactions.length;
                        transactions = transactions.filter(tx => {
                            const txDate = new Date(tx.date);
                            // Keep transactions that are newer than the last sync timestamp
                            // Include transactions from the same day but after the sync time
                            return txDate.getTime() >= lastSyncTimestamp;
                        });
                        const filtered = originalCount - transactions.length;
                        if (filtered > 0) {
                            console.log(`[Sync] Filtered ${filtered} already-synced transactions (kept ${transactions.length})`);
                        }
                    }

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
                            // In Pluggy: POSITIVE amount = expense (you spent money)
                            //            NEGATIVE amount = income/refund (money returned)
                            mappedTx = {
                                cardId: account.id,
                                date: tx.date.split('T')[0],
                                description: tx.description,
                                amount: Math.abs(tx.amount),
                                type: tx.amount > 0 ? 'expense' : 'income',
                                category: tx.category || 'Uncategorized',
                                status: 'completed',
                                installmnets: tx.installments || 1,
                                installmentNumber: 1,
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
router.get('/items-status', async (req, res) => {
    // Set no-cache headers to prevent stale responses
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');

    const fetchItems = async (apiKey) => {
        const response = await axios.get(`${BASE_URL}/items`, {
            headers: { 'X-API-KEY': apiKey }
        });
        return response.data.results || [];
    };

    try {
        console.log('Fetching items status from Pluggy...');

        // First try with cached key
        let apiKey = await getApiKey(false);
        let results;

        try {
            results = await fetchItems(apiKey);
        } catch (firstError) {
            // If 401, retry with fresh key
            if (firstError.response?.status === 401) {
                console.log('[items-status] 401 with cached key, refreshing...');
                apiKey = await getApiKey(true);
                results = await fetchItems(apiKey);
            } else {
                throw firstError;
            }
        }

        console.log('Items fetched:', results?.length);

        const items = results.map(i => ({
            id: i.id,
            status: i.status,
            lastUpdatedAt: i.lastUpdatedAt,
            connectorName: i.connector?.name
        }));

        res.json({ success: true, items });
    } catch (error) {
        console.error('Failed to fetch items status:', error.message);

        // Handle 401 gracefully - likely means API credentials issue
        if (error.response?.status === 401) {
            console.log('401 on /items even with fresh key - check credentials');
            return res.json({ success: true, items: [], message: 'Authentication issue' });
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

// 8. Webhook Worker (Cron Job Endpoint)
// This endpoint is called by Vercel cron every minute to process pending sync jobs
router.get('/webhook-worker', async (req, res) => {
    try {
        console.log('[Webhook Worker] Cron job triggered at:', new Date().toISOString());

        if (!firebaseAdmin) {
            console.log('[Webhook Worker] Firebase Admin not initialized');
            return res.json({ success: true, message: 'Firebase Admin not available' });
        }

        // Force refresh API Key (cache doesn't persist in serverless)
        const apiKey = await getApiKey(true);
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

            res.json({
                success: true,
                message: 'Webhook worker executed',
                itemsCount: items.length,
                updatedCount: updatedItems.length,
                timestamp: new Date().toISOString()
            });
        } catch (pluggyError) {
            const status = pluggyError.response?.status;
            const errData = pluggyError.response?.data;
            console.error('[Webhook Worker] Pluggy API error:', pluggyError.message);
            console.error('[Webhook Worker] Status:', status, 'Data:', JSON.stringify(errData));

            // If 401, it means credentials are invalid
            if (status === 401) {
                console.error('[Webhook Worker] 401 Unauthorized - Check PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET in Vercel env vars');
            }

            res.json({
                success: true,
                message: 'Webhook worker ran but Pluggy API unavailable',
                error: pluggyError.message,
                status: status
            });
        }
    } catch (error) {
        console.error('[Webhook Worker] Error:', error.message);
        res.status(500).json({ error: 'Webhook worker failed', message: error.message });
    }
});

// 9. Webhook Receiver (Pluggy sends events here)
// This endpoint receives webhook notifications from Pluggy
router.post('/webhook', async (req, res) => {
    try {
        const event = req.body;
        console.log('[Pluggy Webhook] Received event:', JSON.stringify(event, null, 2));

        // Acknowledge receipt immediately
        res.json({ success: true, received: true });

        // Process the webhook in the background
        if (event && event.event) {
            const { event: eventType, itemId, data } = event;
            console.log(`[Pluggy Webhook] Event type: ${eventType}, Item: ${itemId}`);

            // Handle different event types
            switch (eventType) {
                case 'item/updated':
                case 'item/created':
                    console.log(`[Pluggy Webhook] Item ${itemId} was ${eventType === 'item/created' ? 'created' : 'updated'}`);
                    // Could trigger a sync here if needed
                    break;
                case 'item/error':
                    console.log(`[Pluggy Webhook] Item ${itemId} had an error:`, data);
                    break;
                case 'connector/status_updated':
                    console.log(`[Pluggy Webhook] Connector status updated:`, data);
                    break;
                default:
                    console.log(`[Pluggy Webhook] Unknown event type: ${eventType}`);
            }
        }
    } catch (error) {
        console.error('[Pluggy Webhook] Error processing webhook:', error.message);
        // Still return 200 to acknowledge receipt
        res.json({ success: true, error: error.message });
    }
});

export default router;
