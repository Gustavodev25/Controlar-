// Cron Job: Automatic Pluggy Sync at Midnight
// This endpoint is called by Vercel Cron Jobs at 00:00 BRT (03:00 UTC)
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const router = express.Router();

// Firebase Admin initialization
let db = null;
let firebaseInitialized = false;

const initFirebase = async () => {
  if (firebaseInitialized) return db;

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const admin = await import('firebase-admin');
      const { getFirestore } = await import('firebase-admin/firestore');

      if (!admin.default.apps.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.default.initializeApp({
          credential: admin.default.credential.cert(serviceAccount),
          projectId: process.env.VITE_FIREBASE_PROJECT_ID || "financeiro-609e1"
        });
      }

      db = getFirestore();
      firebaseInitialized = true;
      console.log('[Cron Sync] Firebase Admin initialized');
      return db;
    }
  } catch (error) {
    console.error('[Cron Sync] Firebase init error:', error.message);
  }

  return null;
};

// Pluggy Configuration
const clean = (str) => (str || '').replace(/[\r\n\s]/g, '');
const PLUGGY_CLIENT_ID = clean(process.env.PLUGGY_CLIENT_ID);
const PLUGGY_CLIENT_SECRET = clean(process.env.PLUGGY_CLIENT_SECRET);
const PLUGGY_API_KEY_STATIC = clean(process.env.PLUGGY_API_KEY);
const PLUGGY_API_URL = process.env.PLUGGY_API_URL || 'https://api.pluggy.ai';

// Token cache
let cachedApiKey = null;
let cachedApiKeyExpiry = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000;

const getPluggyApiKey = async () => {
  if (PLUGGY_API_KEY_STATIC) return PLUGGY_API_KEY_STATIC;

  if (cachedApiKey && Date.now() < cachedApiKeyExpiry) {
    return cachedApiKey;
  }

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    throw new Error('Pluggy credentials not configured');
  }

  const response = await axios.post(
    `${PLUGGY_API_URL}/auth`,
    { clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET },
    { headers: { 'Content-Type': 'application/json' } }
  );

  cachedApiKey = response.data.apiKey;
  cachedApiKeyExpiry = Date.now() + TOKEN_TTL_MS;
  return cachedApiKey;
};

const pluggyRequest = async (method, endpoint, apiKey, data = null, params = null) => {
  const config = {
    method,
    url: `${PLUGGY_API_URL}${endpoint}`,
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    params
  };
  if (data) config.data = data;

  const response = await axios(config);
  return response.data;
};

const fetchAccountsByItem = async (apiKey, itemId) => {
  const accounts = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await pluggyRequest('GET', '/accounts', apiKey, null, { itemId, page, pageSize: 200 });
    accounts.push(...(response.results || []));
    totalPages = response.totalPages || 1;
    page += 1;
  } while (page <= totalPages);

  return accounts;
};

const fetchTransactionsByAccount = async (apiKey, accountId, from, to) => {
  const transactions = [];
  let page = 1;
  let totalPages = 1;

  do {
    const params = { accountId, page, pageSize: 500 };
    if (from) params.from = from;
    if (to) params.to = to;

    const response = await pluggyRequest('GET', '/transactions', apiKey, null, params);
    transactions.push(...(response.results || []));
    totalPages = response.totalPages || 1;
    page += 1;
  } while (page <= totalPages);

  return transactions;
};

const tryFetchBills = async (apiKey, accountId, from, to, itemId) => {
  const attempts = [
    { endpoint: '/bills', params: { accountId, pageSize: 200 } },
    { endpoint: `/accounts/${accountId}/bills`, params: { pageSize: 200 } }
  ];

  for (const attempt of attempts) {
    try {
      const params = { ...attempt.params, page: 1 };
      if (itemId) params.itemId = itemId;
      if (from) params.from = from;
      if (to) params.to = to;

      const response = await pluggyRequest('GET', attempt.endpoint, apiKey, null, params);
      const results = Array.isArray(response) ? response : (response.results || response.bills || []);
      if (results.length > 0) return results;
    } catch (err) {
      // Continue to next endpoint
    }
  }

  return [];
};

const buildDateRange = (monthsBack = 12, monthsForward = 3) => {
  const today = new Date();
  const fromDate = new Date(Date.UTC(today.getFullYear(), today.getMonth() - monthsBack, 1));
  const toDate = new Date(Date.UTC(today.getFullYear(), today.getMonth() + monthsForward + 1, 0));
  return {
    from: fromDate.toISOString().split('T')[0],
    to: toDate.toISOString().split('T')[0]
  };
};

// Invoice month key calculation
const getInvoiceMonthKey = (dateStr, closingDay) => {
  const [year, month, day] = dateStr.split('-').map(Number);

  // If the day is after or on the closing day, the transaction belongs to the next month's invoice
  if (day >= closingDay) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
};

// Pluggy category translator (simplified)
const translatePluggyCategory = (category) => {
  const map = {
    'FOOD_RESTAURANTS': 'Alimentacao',
    'TRANSFERS': 'Transferencias',
    'ENTERTAINMENT': 'Lazer',
    'TRANSPORTATION': 'Transporte',
    'UTILITIES': 'Contas',
    'SHOPPING': 'Compras',
    'HEALTH': 'Saude',
    'EDUCATION': 'Educacao',
    'TRAVEL': 'Viagem',
    'SERVICES': 'Servicos'
  };
  return map[category] || category || 'Outros';
};

// Main sync function for a single user
const syncUserAccounts = async (db, userId, userAccounts, apiKey) => {
  const { from, to } = buildDateRange(12, 1);
  let totalTransactions = 0;
  const syncedItems = new Set();

  // Get unique itemIds from credit card accounts in AUTO mode
  const creditAccounts = userAccounts.filter(acc => {
    const type = (acc.type || '').toUpperCase();
    const subtype = (acc.subtype || '').toUpperCase();
    return (type.includes('CREDIT') || subtype.includes('CREDIT')) && acc.connectionMode !== 'MANUAL';
  });

  const itemIds = [...new Set(creditAccounts.map(acc => acc.itemId).filter(Boolean))];

  if (itemIds.length === 0) {
    console.log(`[Cron Sync] User ${userId}: No AUTO credit card accounts`);
    return { success: true, transactions: 0 };
  }

  // Clear existing credit card transactions
  const ccTxRef = db.collection('users').doc(userId).collection('creditCardTransactions');
  const existingTxs = await ccTxRef.get();
  const batch = db.batch();
  existingTxs.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  for (const itemId of itemIds) {
    if (syncedItems.has(itemId)) continue;
    syncedItems.add(itemId);

    try {
      const accounts = await fetchAccountsByItem(apiKey, itemId);

      for (const account of accounts) {
        const type = (account.type || '').toUpperCase();
        const subtype = (account.subtype || '').toUpperCase();
        const isCredit = type.includes('CREDIT') || subtype.includes('CREDIT');

        if (!isCredit) continue;

        const transactions = await fetchTransactionsByAccount(apiKey, account.id, from, to);
        const bills = await tryFetchBills(apiKey, account.id, from, to, itemId);

        // Process bills
        const billsData = bills.map(bill => {
          const resolvedDueDate = bill.dueDate || bill.balanceDueDate || bill.balanceCloseDate;
          return {
            id: bill.id,
            dueDate: resolvedDueDate,
            totalAmount: bill.totalAmount,
            balanceCloseDate: bill.balanceCloseDate ?? null,
            state: bill.state ?? null
          };
        });

        // Extract closing and due days
        const closingDay = account.creditData?.balanceCloseDate
          ? parseInt(account.creditData.balanceCloseDate.split('T')[0].split('-')[2], 10)
          : null;
        const dueDay = account.creditData?.balanceDueDate
          ? parseInt(account.creditData.balanceDueDate.split('T')[0].split('-')[2], 10)
          : null;

        // Update connected account
        const accountRef = db.collection('users').doc(userId).collection('connectedAccounts').doc(account.id);
        await accountRef.set({
          id: account.id,
          itemId: account.itemId,
          name: account.marketingName || account.name || 'Cartao de Credito',
          type: account.type,
          subtype: account.subtype,
          institution: account.connector?.name || 'Banco',
          balance: account.balance ?? 0,
          currency: account.currencyCode || 'BRL',
          lastUpdated: new Date().toISOString(),
          connectionMode: 'AUTO',
          creditLimit: account.creditData?.creditLimit ?? null,
          availableCreditLimit: account.creditData?.availableCreditLimit ?? null,
          closingDay: closingDay || undefined,
          dueDay: dueDay || undefined,
          bills: billsData
        }, { merge: true });

        // Process transactions
        const billsMap = new Map();
        billsData.forEach(bill => billsMap.set(bill.id, bill));

        for (const tx of transactions) {
          const meta = tx?.creditCardMetadata || {};
          const purchaseDate = (meta.purchaseDate || tx?.date)?.split('T')[0];
          const postDate = (tx?.date || purchaseDate)?.split('T')[0];
          const anchorDate = postDate || purchaseDate;

          if (!anchorDate) continue;

          const rawAmount = Number(tx?.amount || 0);
          const totalInstallments = meta.totalInstallments;
          const installmentNumber = meta.installmentNumber;

          // Calculate invoice month
          let invoiceMonthKey = null;
          const billId = meta.billId || null;
          const bill = billId ? billsMap.get(billId) : undefined;

          if (bill?.dueDate) {
            invoiceMonthKey = bill.dueDate.slice(0, 7);
          } else if (closingDay) {
            invoiceMonthKey = getInvoiceMonthKey(anchorDate, closingDay);
          } else {
            invoiceMonthKey = anchorDate.slice(0, 7);
          }

          const invoiceDueDate = bill?.dueDate || (invoiceMonthKey && dueDay
            ? `${invoiceMonthKey}-${String(dueDay).padStart(2, '0')}`
            : undefined);

          const amount = Math.abs(totalInstallments && meta.totalAmount
            ? (meta.totalAmount / totalInstallments)
            : rawAmount);

          const txData = {
            date: postDate,
            description: tx?.description || 'Lancamento Cartao',
            amount,
            category: translatePluggyCategory(tx?.category),
            type: rawAmount >= 0 ? 'expense' : 'income',
            status: (tx?.status || '').toUpperCase() === 'PENDING' ? 'pending' : 'completed',
            cardId: account.id,
            cardName: account.name || account.marketingName || 'Cartao',
            installmentNumber: installmentNumber || 0,
            totalInstallments: totalInstallments || 0,
            importSource: 'pluggy',
            providerId: tx?.id,
            providerItemId: account.itemId,
            invoiceMonthKey: invoiceMonthKey || undefined,
            invoiceDueDate: invoiceDueDate || undefined,
            pluggyBillId: billId,
            isProjected: false,
            syncedAt: new Date().toISOString()
          };

          // Add transaction (use providerId as document ID to avoid duplicates)
          const txRef = tx?.id
            ? ccTxRef.doc(tx.id)
            : ccTxRef.doc();
          await txRef.set(txData, { merge: true });
          totalTransactions++;
        }
      }
    } catch (error) {
      console.error(`[Cron Sync] Error syncing item ${itemId} for user ${userId}:`, error.message);
    }
  }

  return { success: true, transactions: totalTransactions };
};

// Add notification to user's notification center
const addNotification = async (db, userId, notification) => {
  try {
    const notifRef = db.collection('users').doc(userId).collection('notifications');
    await notifRef.add({
      type: notification.type || 'system',
      title: notification.title,
      message: notification.message,
      date: new Date().toISOString(),
      read: false,
      archived: false
    });
    console.log(`[Cron Sync] Notification sent to user ${userId}`);
  } catch (error) {
    console.error(`[Cron Sync] Failed to send notification to ${userId}:`, error.message);
  }
};

// Helper: Check item status from Pluggy API
const checkItemStatus = async (apiKey, itemId) => {
  try {
    const item = await pluggyRequest('GET', `/items/${itemId}`, apiKey);
    return {
      status: item.status,
      statusDetail: item.statusDetail,
      lastUpdatedAt: item.lastUpdatedAt || item.updatedAt,
      executionStatus: item.executionStatus,
      consentExpiresAt: item.consentExpiresAt
    };
  } catch (e) {
    console.error(`[Cron Sync] Error checking item ${itemId}:`, e.message);
    return null;
  }
};

// Cron endpoint - RECONCILIATION ONLY (no PATCH /items - Pluggy auto-syncs)
// This is a safety net for when webhooks fail or data gets out of sync
router.get('/', async (req, res) => {
  const startTime = Date.now();
  console.log('[Cron Sync] Starting RECONCILIATION at', new Date().toISOString());
  console.log('[Cron Sync] Mode: Backfill only (no PATCH - Pluggy handles auto-sync)');

  // Verify cron secret (optional security measure)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cron Sync] Unauthorized request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = await initFirebase();
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const apiKey = await getPluggyApiKey();

    // Get all users with connected accounts
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.get();

    let totalUsers = 0;
    let syncedUsers = 0;
    let skippedUsers = 0;
    let usersNeedingAction = 0;
    let totalTransactions = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      // Get connected accounts for this user
      const accountsRef = userDoc.ref.collection('connectedAccounts');
      const accountsSnapshot = await accountsRef.get();

      if (accountsSnapshot.empty) continue;

      const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Check if user has AUTO mode credit cards
      const hasAutoCards = accounts.some(acc => {
        const type = (acc.type || '').toUpperCase();
        const subtype = (acc.subtype || '').toUpperCase();
        return (type.includes('CREDIT') || subtype.includes('CREDIT')) && acc.connectionMode !== 'MANUAL';
      });

      if (!hasAutoCards) continue;

      // SAFETY NET: Only process users who haven't been updated in the last 24 hours
      const syncStatusDoc = await userDoc.ref.collection('sync_status').doc('pluggy').get();
      const syncStatus = syncStatusDoc.exists ? syncStatusDoc.data() : null;

      if (syncStatus?.lastSyncedAt) {
        const lastSyncTime = new Date(syncStatus.lastSyncedAt).getTime();
        const hoursSinceLastSync = (Date.now() - lastSyncTime) / (1000 * 60 * 60);

        if (hoursSinceLastSync < 24) {
          console.log(`[Cron Sync] User ${userId}: Skipped - Last sync was ${hoursSinceLastSync.toFixed(1)}h ago`);
          skippedUsers++;
          continue;
        }
      }

      // Get unique itemIds
      const itemIds = [...new Set(accounts.map(acc => acc.itemId).filter(Boolean))];

      // Check item status from Pluggy (don't PATCH, just check)
      let needsUserAction = false;
      for (const itemId of itemIds) {
        const itemStatus = await checkItemStatus(apiKey, itemId);
        if (!itemStatus) continue;

        // Check if user action is required
        if (itemStatus.status === 'WAITING_USER_INPUT' || itemStatus.status === 'LOGIN_ERROR') {
          needsUserAction = true;
          console.log(`[Cron Sync] User ${userId}: Item ${itemId} needs user action (${itemStatus.status})`);

          // Notify user
          await addNotification(db, userId, {
            type: 'alert',
            title: 'Ação Necessária',
            message: `Sua conexão bancária requer atenção. Acesse Contas Conectadas para atualizar.`
          });

          await userDoc.ref.collection('sync_status').doc('pluggy').set({
            state: 'error',
            message: 'Ação necessária: Atualize suas credenciais bancárias.',
            lastUpdated: new Date().toISOString()
          }, { merge: true });
        }

        // Check consent expiration
        if (itemStatus.consentExpiresAt) {
          const expiresAt = new Date(itemStatus.consentExpiresAt);
          const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

          if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
            console.log(`[Cron Sync] User ${userId}: Consent expires in ${daysUntilExpiry.toFixed(1)} days`);
            await addNotification(db, userId, {
              type: 'alert',
              title: 'Consentimento Expirando',
              message: `Sua autorização bancária expira em ${Math.ceil(daysUntilExpiry)} dias. Renove para manter a sincronização.`
            });
          } else if (daysUntilExpiry <= 0) {
            needsUserAction = true;
            console.log(`[Cron Sync] User ${userId}: Consent expired`);
          }
        }
      }

      if (needsUserAction) {
        usersNeedingAction++;
        continue;
      }

      totalUsers++;
      console.log(`[Cron Sync] User ${userId}: Running backfill reconciliation...`);

      try {
        // Run sync (this is just fetching data, not forcing Pluggy to update)
        const result = await syncUserAccounts(db, userId, accounts, apiKey);
        if (result.success) {
          syncedUsers++;
          totalTransactions += result.transactions;
          console.log(`[Cron Sync] User ${userId}: ${result.transactions} transactions reconciled`);

          // Update sync_status with lastSyncedAt
          await userDoc.ref.collection('sync_status').doc('pluggy').set({
            state: 'success',
            message: 'Reconciliação automática concluída',
            lastUpdated: new Date().toISOString(),
            lastSyncedAt: new Date().toISOString()
          }, { merge: true });

          // Only notify if there were actual changes
          if (result.transactions > 0) {
            await addNotification(db, userId, {
              type: 'system',
              title: 'Dados Sincronizados',
              message: `${result.transactions} transações foram reconciliadas automaticamente.`
            });
          }
        }
      } catch (error) {
        console.error(`[Cron Sync] Failed for user ${userId}:`, error.message);

        await addNotification(db, userId, {
          type: 'alert',
          title: 'Erro na Reconciliação',
          message: 'Houve um problema ao verificar seus dados bancários.'
        });
      }
    }

    const duration = Date.now() - startTime;
    const summary = {
      success: true,
      mode: 'reconciliation',
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      totalUsers,
      syncedUsers,
      skippedUsers,
      usersNeedingAction,
      totalTransactions
    };

    console.log('[Cron Sync] Completed:', summary);
    res.json(summary);

  } catch (error) {
    console.error('[Cron Sync] Fatal error:', error);
    res.status(500).json({
      error: 'Sync failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
});

export default router;
