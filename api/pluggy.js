// Pluggy routes: authentication and item management + sync helpers (accounts/transactions/bills).
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const router = express.Router();
router.use(express.json({ limit: '10mb' }));
router.use(express.urlencoded({ extended: false, limit: '10mb' }));

const PLUGGY_CLIENT_ID = (process.env.PLUGGY_CLIENT_ID || '').trim();
const PLUGGY_CLIENT_SECRET = (process.env.PLUGGY_CLIENT_SECRET || '').trim();
const PLUGGY_API_KEY_STATIC = (process.env.PLUGGY_API_KEY || '').trim();

// Use api.pluggy.ai as default; sandbox.pluggy.ai is deprecated/returns 405
const PLUGGY_API_URL = process.env.PLUGGY_API_URL || 'https://api.pluggy.ai';

console.log('>>> Pluggy Config:', {
  URL: PLUGGY_API_URL,
  HasClientId: !!PLUGGY_CLIENT_ID,
  ClientIdPrefix: PLUGGY_CLIENT_ID ? PLUGGY_CLIENT_ID.substring(0, 4) + '...' : 'NONE',
  SecretLength: PLUGGY_CLIENT_SECRET ? PLUGGY_CLIENT_SECRET.length : 0,
  EnvVar: process.env.PLUGGY_API_URL
});

// Token cache to avoid multiple auth requests
let cachedApiKey = null;
let cachedApiKeyExpiry = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes (Pluggy tokens last ~30 min)

// Retrieve Pluggy API key (auth only) with caching
const getPluggyApiKey = async () => {
  // Allow injecting a fixed API KEY (useful for debugging to bypass auth issues)
  if (PLUGGY_API_KEY_STATIC) return PLUGGY_API_KEY_STATIC;

  // Return cached token if still valid
  if (cachedApiKey && Date.now() < cachedApiKeyExpiry) {
    return cachedApiKey;
  }

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    console.error('>>> Pluggy Missing Credentials: ID or Secret is empty.');
    throw new Error('Pluggy credentials not configured (PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET).');
  }

  try {
    console.log(`>>> Pluggy: Requesting new API key with ID: ${PLUGGY_CLIENT_ID.substring(0, 5)}...`);
    const response = await axios.post(`${PLUGGY_API_URL}/auth`, {
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET
    });

    console.log('>>> Pluggy Auth Response keys:', Object.keys(response.data));

    // Pluggy returns apiKey in the response
    cachedApiKey = response.data.apiKey;
    cachedApiKeyExpiry = Date.now() + TOKEN_TTL_MS;
    console.log('>>> Pluggy: API key obtained and cached, length:', cachedApiKey?.length);

    return cachedApiKey;
  } catch (error) {
    console.error('>>> Pluggy Auth Error:', error.response?.data || error.message);
    // Clear cache on auth error
    cachedApiKey = null;
    cachedApiKeyExpiry = 0;
    throw error;
  }
};

// Generic Pluggy request helper
const pluggyRequest = async (method, endpoint, apiKey, data = null, params = null, isRetry = false) => {
  const config = {
    method,
    url: `${PLUGGY_API_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    params
  };

  if (data) config.data = data;

  console.log(`>>> Pluggy Request${isRetry ? ' (RETRY)' : ''}: ${method} ${endpoint} (apiKey prefix: ${apiKey ? apiKey.substring(0, 5) : 'NONE'})`);

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    // If 401 and not already retrying, try to refresh token and retry
    if (error.response?.status === 401 && !isRetry) {
      console.warn('>>> Pluggy 401 Unauthorized. Refreshing token and retrying...');
      
      // Clear cache explicitly
      cachedApiKey = null;
      cachedApiKeyExpiry = 0;

      try {
        const newApiKey = await getPluggyApiKey();
        return await pluggyRequest(method, endpoint, newApiKey, data, params, true);
      } catch (retryError) {
        console.error('>>> Pluggy Retry Failed:', retryError.message);
        throw retryError; // Throw the retry error (likely auth failure)
      }
    }

    console.error('>>> Pluggy Request Error:', error.response?.data || error.message);
    throw error;
  }
};

const getPluggyItems = async (apiKey, userId = null) => {
  const endpoint = userId
    ? `/items?clientUserId=${encodeURIComponent(userId)}&pageSize=200`
    : '/items';

  const response = await pluggyRequest('GET', endpoint, apiKey);
  const results = response.results || [];
  if (userId) return results.filter((item) => item.clientUserId === userId);
  return results;
};

const mapPluggyItem = (item) => ({
  id: item.id,
  clientUserId: item.clientUserId,
  connector: item.connector ? { name: item.connector.name, imageUrl: item.connector.imageUrl } : null,
  status: item.status,
  executionStatus: item.executionStatus,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

// Helpers for Pluggy data retrieval (accounts, transactions, bills)
const fetchAccountsByItem = async (apiKey, itemId) => {
  const accounts = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await pluggyRequest(
      'GET',
      '/accounts',
      apiKey,
      null,
      { itemId, page, pageSize: 200 }
    );

    accounts.push(...(response.results || []));
    totalPages = response.totalPages || 1;
    page += 1;
  } while (page <= totalPages);

  return accounts;
};

const fetchTransactionsByAccount = async (apiKey, accountId, from = null, to = null) => {
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

const tryFetchBills = async (apiKey, accountId, from = null, to = null, itemId = null) => {
  const attempts = [
    { endpoint: '/bills', params: { accountId, pageSize: 200 } },
    { endpoint: `/accounts/${accountId}/bills`, params: { pageSize: 200 } },
    { endpoint: `/accounts/${accountId}/credit-card-bills`, params: { pageSize: 200 } },
    { endpoint: '/credit_card_bills', params: { accountId, pageSize: 200 } },
    { endpoint: '/credit-card-bills', params: { accountId, pageSize: 200 } },
    { endpoint: '/creditCardBills', params: { accountId, pageSize: 200 } }
  ];

  const normalizeResults = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.results)) return response.results;
    if (Array.isArray(response.bills)) return response.bills;
    return [];
  };

  const computeTotalPages = (response, pageSize) => {
    if (!response) return 1;
    if (Number.isFinite(response.totalPages)) return response.totalPages;
    if (Number.isFinite(response.total) && pageSize) {
      return Math.max(1, Math.ceil(response.total / pageSize));
    }
    return 1;
  };

  const fetchFromAttempt = async (attempt, includeDateFilters) => {
    let page = 1;
    let totalPages = 1;
    const collected = [];

    do {
      const params = { ...attempt.params, page };
      if (!params.pageSize) params.pageSize = 200;
      if (itemId) params.itemId = itemId;
      if (includeDateFilters) {
        if (from) params.from = from;
        if (to) params.to = to;
      }

      const response = await pluggyRequest('GET', attempt.endpoint, apiKey, null, params);
      const results = normalizeResults(response);
      if (results.length) collected.push(...results);

      totalPages = computeTotalPages(response, params.pageSize);
      page += 1;
    } while (page <= totalPages);

    return collected;
  };

  const bills = [];

  for (const attempt of attempts) {
    try {
      // Pass 1: respect date filters
      let collected = await fetchFromAttempt(attempt, true);

      // Pass 2: if nothing came with date filters, try without them (some FIs ignore from/to)
      if (collected.length === 0) {
        collected = await fetchFromAttempt(attempt, false);
      }

      if (collected.length > 0) {
        bills.push(...collected);
        break; // We got data, stop trying fallbacks
      }
    } catch (err) {
      // Ignore and try next fallback
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      console.warn(`>>> Pluggy bills endpoint failed (${attempt.endpoint}):`, status, message);
    }
  }

  return bills;
};

const buildDateRange = (monthsBack = 12, monthsForward = 3) => {
  const today = new Date();

  const fromDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  fromDate.setUTCMonth(fromDate.getUTCMonth() - Math.abs(monthsBack));

  const toDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  toDate.setUTCMonth(toDate.getUTCMonth() + Math.abs(monthsForward) + 1);
  toDate.setUTCDate(0); // last day of the previous month

  const toIso = (d) => d.toISOString().split('T')[0];

  return { from: toIso(fromDate), to: toIso(toDate) };
};

// ---- Bills normalization + summary helpers ----
const monthKeyFromBill = (bill) => {
  const d =
    bill?.closeDate ||
    bill?.closingDate ||
    bill?.statementDate ||
    bill?.invoiceDate ||
    bill?.dueDate ||
    null;

  return typeof d === 'string' && d.length >= 7 ? d.slice(0, 7) : null;
};

const safeNumber = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeBill = (bill) => {
  if (!bill || typeof bill !== 'object') return bill;
  return {
    ...bill,
    id: bill.id,
    dueDate: bill.dueDate || bill.invoiceDueDate || bill.nextDueDate || null,
    closeDate: bill.closeDate || bill.closingDate || bill.statementDate || null,
    totalAmount: safeNumber(bill.totalAmount ?? bill.amount ?? bill.total ?? bill.totalValue),
    minimumPayment: safeNumber(bill.minimumPayment ?? bill.minimumAmount),
    monthKey: monthKeyFromBill(bill),
  };
};

const buildBillTotalsByMonthKey = (bills) => {
  const map = {};
  for (const b of bills) {
    const bill = normalizeBill(b);
    if (!bill?.monthKey) continue;
    if (bill.totalAmount === null) continue;

    // Se vierem múltiplas bills no mesmo mês, fica com o maior total
    if (map[bill.monthKey] === undefined) map[bill.monthKey] = bill.totalAmount;
    else map[bill.monthKey] = Math.max(map[bill.monthKey], bill.totalAmount);
  }
  return map;
};

const pickCurrentBill = (bills) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr);
  const norm = bills.map(normalizeBill).filter(b => b?.dueDate);

  // Ordena por vencimento ascendente
  norm.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  // Primeira que ainda não venceu; senão, a mais recente
  const upcoming = norm.find(b => new Date(b.dueDate) >= today);
  return upcoming || (norm.length ? norm[norm.length - 1] : null);
};

// =======================
// NOVO: addMonth + infer latest monthKey (JS)
// =======================
const addMonth = (ym, plus) => {
  const [y, m] = String(ym).split('-').map(Number);
  const d = new Date(Date.UTC(y, (m - 1) + plus, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
};

// Como no frontend: pega o mês mais “alto” (YYYY-MM) disponível nas bills normalizadas
const inferLatestBillMonthKey = (bills) => {
  const keys = (bills || [])
    .map(b => normalizeBill(b)?.monthKey)
    .filter(Boolean)
    .sort(); // YYYY-MM ordena corretamente como string
  return keys.length ? keys[keys.length - 1] : null;
};

// Create Connect token (authentication only)
router.post('/create-token', async (req, res) => {
  const { userId } = req.body;

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Pluggy credentials not configured.' });
  }

  try {
    const apiKey = await getPluggyApiKey();

    let existingItems = [];
    if (userId) {
      try {
        const userItems = await getPluggyItems(apiKey, userId);
        existingItems = userItems.map(mapPluggyItem);
      } catch (err) {
        console.error('>>> Pluggy existing items lookup failed:', err.response?.data || err.message);
      }
    }

    const connectTokenResponse = await pluggyRequest('POST', '/connect_token', apiKey, {
      clientUserId: userId || 'anonymous',
      options: { avoidDuplicates: true }
    });

    res.json({
      success: true,
      accessToken: connectTokenResponse.accessToken,
      existingItems
    });
  } catch (error) {
    console.error('>>> Create Token Error:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const details = error.response?.data?.message || error.message;

    if (status === 401) {
      return res.status(401).json({
        error: 'Pluggy nao autorizou a requisicao. Verifique CLIENT_ID/SECRET.',
        details
      });
    }

    res.status(500).json({
      error: 'Erro ao criar token de conexao.',
      details
    });
  }
});

// Item listing
router.get('/items', async (req, res) => {
  try {
    const { userId } = req.query;
    const apiKey = await getPluggyApiKey();
    const itemsRaw = await getPluggyItems(apiKey, userId);
    const items = itemsRaw.map(mapPluggyItem);

    res.json({ success: true, items });
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message;

    if (status === 401 || status === 403) {
      return res.status(status).json({
        error: 'Pluggy nao autorizou a requisicao. Verifique CLIENT_ID/SECRET.',
        details: message
      });
    }

    res.status(500).json({ error: 'Erro ao listar items.', details: message });
  }
});

router.get('/item/:itemId', async (req, res) => {
  const { itemId } = req.params;

  try {
    const apiKey = await getPluggyApiKey();
    const item = await pluggyRequest('GET', `/items/${itemId}`, apiKey);

    res.json({
      success: true,
      item: {
        id: item.id,
        status: item.status,
        executionStatus: item.executionStatus,
        connector: item.connector?.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao buscar item.',
      details: error.response?.data?.message || error.message
    });
  }
});

router.delete('/item/:itemId', async (req, res) => {
  const { itemId } = req.params;

  try {
    const apiKey = await getPluggyApiKey();
    await pluggyRequest('DELETE', `/items/${itemId}`, apiKey);
    res.json({ success: true, message: 'Conexao removida com sucesso.' });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao remover conexao.',
      details: error.response?.data?.message || error.message
    });
  }
});

router.delete('/items/all', async (_req, res) => {
  try {
    const apiKey = await getPluggyApiKey();
    const response = await pluggyRequest('GET', '/items', apiKey);
    const items = response.results || [];

    for (const item of items) {
      try {
        await pluggyRequest('DELETE', `/items/${item.id}`, apiKey);
      } catch (err) {
        console.error(`>>> Failed to delete item ${item.id}:`, err.message);
      }
    }

    res.json({ success: true, message: `${items.length} conexoes removidas.` });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao remover conexoes.',
      details: error.response?.data?.message || error.message
    });
  }
});

// List accounts for an item
router.get('/accounts', async (req, res) => {
  const { itemId } = req.query;
  if (!itemId) return res.status(400).json({ error: 'itemId obrigatório' });

  try {
    const apiKey = await getPluggyApiKey();
    const accounts = await fetchAccountsByItem(apiKey, itemId);
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('>>> Pluggy Accounts Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao buscar contas.',
      details: error.response?.data?.message || error.message
    });
  }
});

// Fetch transactions for a given account (paginated automatically)
router.get('/accounts/:accountId/transactions', async (req, res) => {
  const { accountId } = req.params;
  const { from, to } = req.query;

  if (!accountId) return res.status(400).json({ error: 'accountId obrigatório' });

  try {
    const apiKey = await getPluggyApiKey();
    const transactions = await fetchTransactionsByAccount(apiKey, accountId, from, to);
    res.json({ success: true, accountId, from, to, total: transactions.length, transactions });
  } catch (error) {
    console.error('>>> Pluggy Transactions Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao buscar transacoes.',
      details: error.response?.data?.message || error.message
    });
  }
});

// Full sync: accounts + transactions (+ bills for credit cards)
router.post('/sync', async (req, res) => {
  const { itemId, monthsBack = 12, monthsForward = 3 } = req.body;

  if (!itemId) {
    return res.status(400).json({ error: 'itemId obrigatorio para sincronizacao.' });
  }

  try {
    const apiKey = await getPluggyApiKey();
    const { from, to } = buildDateRange(monthsBack, monthsForward);

    const accounts = await fetchAccountsByItem(apiKey, itemId);
    const results = [];

    for (const account of accounts) {
      try {
        const transactions = await fetchTransactionsByAccount(apiKey, account.id, from, to);
        const isCredit =
          (account.type || '').toUpperCase().includes('CREDIT') ||
          (account.subtype || '').toUpperCase().includes('CREDIT');

        const bills = isCredit ? await tryFetchBills(apiKey, account.id, from, to, account.itemId) : [];

        results.push({ account, transactions, bills });
      } catch (err) {
        console.error(`>>> Failed to sync account ${account.id}:`, err.response?.data || err.message);
        results.push({
          account,
          transactions: [],
          bills: [],
          error: err.response?.data?.message || err.message
        });
      }
    }

    res.json({
      success: true,
      itemId,
      from,
      to,
      accounts: results
    });
  } catch (error) {
    console.error('>>> Pluggy Sync Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao sincronizar dados do Pluggy.',
      details: error.response?.data?.message || error.message
    });
  }
});

// Fetch bills for a credit card account (now includes suggestedCurrentMonthKey/Next)
router.get('/accounts/:accountId/bills', async (req, res) => {
  const { accountId } = req.params;
  const { from, to, monthsBack = 12, monthsForward = 6, itemId = null } = req.query;

  if (!accountId) return res.status(400).json({ error: 'accountId obrigatório' });

  try {
    const apiKey = await getPluggyApiKey();

    // Use provided dates or build default range
    let dateFrom = from;
    let dateTo = to;

    if (!dateFrom || !dateTo) {
      const range = buildDateRange(
        parseInt(monthsBack, 10) || 12,
        parseInt(monthsForward, 10) || 6
      );
      dateFrom = range.from;
      dateTo = range.to;
    }

    const billsRaw = await tryFetchBills(apiKey, accountId, dateFrom, dateTo, itemId || null);

    // Sort bills by dueDate descending (newest first)
    billsRaw.sort((a, b) => {
      const dateA = new Date(a.dueDate || 0);
      const dateB = new Date(b.dueDate || 0);
      return dateB - dateA;
    });

    const bills = billsRaw.map(normalizeBill);
    const currentBill = pickCurrentBill(bills);
    const billTotalsByMonthKey = buildBillTotalsByMonthKey(bills);

    // ======= AQUI entra a lógica equivalente ao seu snippet =======
    const inferred = inferLatestBillMonthKey(bills);
    const fallbackNow = (() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    })();

    const suggestedCurrentMonthKey = inferred || fallbackNow;
    const suggestedNextMonthKey = addMonth(suggestedCurrentMonthKey, 1);
    // ============================================================

    res.json({
      success: true,
      accountId,
      from: dateFrom,
      to: dateTo,
      total: bills.length,
      currentBill,
      billTotalsByMonthKey,
      suggestedCurrentMonthKey,
      suggestedNextMonthKey,
      bills
    });
  } catch (error) {
    console.error('>>> Pluggy Bills Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao buscar faturas.',
      details: error.response?.data?.message || error.message
    });
  }
});

// Refresh bills for all credit card accounts of an item
router.post('/item/:itemId/refresh-bills', async (req, res) => {
  const { itemId } = req.params;
  const { monthsBack = 12, monthsForward = 6 } = req.body;

  if (!itemId) return res.status(400).json({ error: 'itemId obrigatório' });

  try {
    const apiKey = await getPluggyApiKey();
    const { from, to } = buildDateRange(monthsBack, monthsForward);

    const accounts = await fetchAccountsByItem(apiKey, itemId);
    const creditAccounts = accounts.filter(acc => {
      const type = (acc.type || '').toUpperCase();
      const subtype = (acc.subtype || '').toUpperCase();
      return type.includes('CREDIT') || subtype.includes('CREDIT');
    });

    const results = [];

    for (const account of creditAccounts) {
      try {
        const bills = await tryFetchBills(apiKey, account.id, from, to, itemId);

        // Sort bills by dueDate
        bills.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));

        results.push({
          accountId: account.id,
          accountName: account.name || account.marketingName || 'Cartão',
          bills,
          billsCount: bills.length
        });
      } catch (err) {
        console.error(`>>> Failed to fetch bills for account ${account.id}:`, err.message);
        results.push({
          accountId: account.id,
          accountName: account.name || account.marketingName || 'Cartão',
          bills: [],
          billsCount: 0,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      itemId,
      from,
      to,
      creditAccountsCount: creditAccounts.length,
      accounts: results
    });
  } catch (error) {
    console.error('>>> Pluggy Refresh Bills Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao atualizar faturas.',
      details: error.response?.data?.message || error.message
    });
  }
});

// Webhook endpoint for Pluggy notifications
router.post('/webhook', async (req, res) => {
  const event = req.body;

  console.log('>>> PLUGGY WEBHOOK RECEIVED:', JSON.stringify(event, null, 2));

  try {
    const { event: eventType, id, itemId, clientUserId } = event;

    switch (eventType) {
      case 'item/created':
        console.log(`>>> Pluggy: Item created - ${itemId} for user ${clientUserId}`);
        break;

      case 'item/updated':
        console.log(`>>> Pluggy: Item updated - ${itemId}, status: ${event.status}`);
        break;

      case 'item/error':
        console.log(`>>> Pluggy: Item error - ${itemId}, error: ${event.error?.message || 'Unknown'}`);
        break;

      case 'item/login_succeeded':
        console.log(`>>> Pluggy: Login succeeded - ${itemId}`);
        break;

      case 'item/deleted':
        console.log(`>>> Pluggy: Item deleted - ${itemId}`);
        break;

      case 'connector/status_updated':
        console.log(`>>> Pluggy: Connector status updated - ${event.connectorId}`);
        break;

      default:
        console.log(`>>> Pluggy: Unknown event type - ${eventType}`);
    }

    // Always respond 200 to acknowledge receipt
    res.status(200).json({ received: true, event: eventType });
  } catch (error) {
    console.error('>>> Pluggy Webhook Error:', error);
    // Still respond 200 to prevent Pluggy from retrying
    res.status(200).json({ received: true, error: error.message });
  }
});

export default router;