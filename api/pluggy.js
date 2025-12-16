// Pluggy routes: authentication and item management + sync helpers (accounts/transactions/bills).
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { firebaseAdmin } from './firebaseAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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

  console.log(`Generating new Pluggy Token... ID starts with: ${PLUGGY_CLIENT_ID.substring(0,4)}`);

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
        await firebaseAdmin.firestore().collection('users').doc(userId)
            .collection('sync_status').doc('pluggy')
            .set({
                state, // 'pending', 'in_progress', 'success', 'error'
                message,
                details,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
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
        const docId = snapshot.docs[0].id;
        await collectionRef.doc(docId).set(txData, { merge: true });
    } else {
        await collectionRef.add(txData);
    }
};

const deleteTransactions = async (userId, providerIds) => {
    if (!firebaseAdmin || !providerIds.length) return;
    const db = firebaseAdmin.firestore();
    
    const collections = ['transactions', 'creditCardTransactions'];
    
    for (const col of collections) {
        const collectionRef = db.collection('users').doc(userId).collection(col);
        const chunks = [];
        for (let i = 0; i < providerIds.length; i += 10) {
            chunks.push(providerIds.slice(i, i + 10));
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

const syncItem = async (apiKey, itemId, userId) => {
    if (!userId || !firebaseAdmin) {
        console.warn('>>> Sync skipped: Missing userId or Firebase Admin.');
        return;
    }

    console.log(`>>> Starting Server-Side Sync for Item ${itemId} (User: ${userId})`);
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

    // 2. Fetch Transactions & Save
    const today = new Date();
    const fromDate = new Date(today); fromDate.setMonth(fromDate.getMonth() - 12); fromDate.setDate(1);
    const toDate = new Date(today); toDate.setMonth(toDate.getMonth() + 2); toDate.setDate(0);
    const from = fromDate.toISOString().split('T')[0];
    const to = toDate.toISOString().split('T')[0];

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

// Webhook
router.post('/webhook', async (req, res) => {
    const event = req.body;
    console.log('>>> PLUGGY WEBHOOK RECEIVED:', JSON.stringify(event, null, 2)); // Log full event
    res.status(200).json({ received: true });

    try {
        const { event: eventType, itemId, clientUserId, data } = event;
        const apiKey = await getPluggyApiKey();

        let userIdToSync = clientUserId;

        // Fallback: If clientUserId is missing, find user by itemId in DB
        if (!userIdToSync && itemId && firebaseAdmin) {
            console.warn(`>>> Webhook missing clientUserId for item ${itemId}. Attempting DB lookup...`);
            const db = firebaseAdmin.firestore();
            const usersRef = db.collection('users');
            // This is expensive (scan), but necessary if Pluggy doesn't send ID. 
            // Better strategy: query a collection group or maintain an index 'items' -> 'userId'.
            // For now, let's try to find it in the 'connectedAccounts' subcollection group query if possible, 
            // or just rely on the fact that we might have stored it.
            
            // Actually, querying every user is bad. 
            // Let's assume for this specific test the user is the one we are working with or log the failure.
            // A collection group query on 'accounts' where itemId == itemId is the proper way.
            const accountsSnapshot = await db.collectionGroup('accounts').where('itemId', '==', itemId).limit(1).get();
            
            if (!accountsSnapshot.empty) {
                const doc = accountsSnapshot.docs[0];
                // doc.ref.parent.parent.id gives the userId (users/{userId}/accounts/{accountId})
                userIdToSync = doc.ref.parent.parent.id;
                console.log(`>>> Found user ${userIdToSync} for item ${itemId} via DB lookup.`);
            } else {
                console.error(`>>> Could not find user for item ${itemId} in DB.`);
            }
        }

        if (eventType === 'item/updated' || eventType === 'transactions/created' || eventType === 'transactions/updated') {
             if (userIdToSync && itemId) {
                 // Update status to let user know we are working
                 await updateSyncStatus(userIdToSync, 'in_progress', 'Processando atualização automática...');
                 await syncItem(apiKey, itemId, userIdToSync);
             } else {
                 console.warn('>>> Skipping sync: Missing userId or itemId', { userIdToSync, itemId });
             }
        } else if (eventType === 'transactions/deleted') {
            if (userIdToSync && data && data.ids) {
                await updateSyncStatus(userIdToSync, 'in_progress', 'Removendo transações deletadas...');
                await deleteTransactions(userIdToSync, data.ids);
            }
        }
    } catch (e) {
        console.error('>>> Webhook Processing Error:', e.message);
    }
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
        const from = new Date(today.setMonth(today.getMonth()-12)).toISOString().split('T')[0];
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
                 } catch (e) {}
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
        const resData = await pluggyRequest('GET', '/items', apiKey, null, { clientUserId: userId });
        res.json({ success: true, items: resData.results || [] });
    } catch (e) {
        res.status(500).json({ error: 'Error fetching items', details: e.message });
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
