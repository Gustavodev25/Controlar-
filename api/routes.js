import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import twilio from 'twilio';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import geminiHandler from './gemini.js';
import path from 'path';

// Explicitly load .env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const router = express.Router();

router.use(cors());
router.use(express.urlencoded({ extended: false, limit: '50mb' }));
router.use(express.json({ limit: '50mb' }));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const fromNumber = process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+14155238886';

const PLUGGY_API_URL = 'https://api.pluggy.ai';
const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID || 'd93b0176-0cd8-4563-b9c1-bcb9c6e510bd';
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET || '2b45852a-9638-4677-8232-6b2da7c54967';

const normalizePluggyAccounts = (accounts, itemId, institutionName) => {
  if (!accounts || !Array.isArray(accounts)) {
    console.log('[PLUGGY] normalizePluggyAccounts: No accounts to normalize');
    return [];
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('[PLUGGY] NORMALIZING ACCOUNTS');
  console.log(`${'='.repeat(60)}`);
  console.log(`[PLUGGY] Total raw accounts received: ${accounts.length}`);

  return accounts.map((acc, index) => {
    console.log(`\n[PLUGGY] --- Account ${index + 1}/${accounts.length} ---`);
    console.log(`[PLUGGY] Raw Account Data:`);
    console.log(`  - ID: ${acc.id}`);
    console.log(`  - Name: ${acc.name}`);
    console.log(`  - Type: "${acc.type}" (raw)`);
    console.log(`  - Subtype: "${acc.subtype}" (raw)`);
    console.log(`  - Balance: ${acc.balance}`);
    console.log(`  - Number: ${acc.number}`);
    console.log(`  - Currency: ${acc.currencyCode}`);
    console.log(`  - Has bankData: ${!!acc.bankData}`);
    console.log(`  - Has creditData: ${!!acc.creditData}`);

    if (acc.bankData) {
      console.log(`  - bankData.transferNumber: ${acc.bankData.transferNumber}`);
      console.log(`  - bankData.closingBalance: ${acc.bankData.closingBalance}`);
    }
    if (acc.creditData) {
      console.log(`  - creditData.creditLimit: ${acc.creditData.creditLimit}`);
      console.log(`  - creditData.availableCreditLimit: ${acc.creditData.availableCreditLimit}`);
    }

    // Determine internal type based on Pluggy's type/subtype
    // Pluggy API: type = "BANK" | "CREDIT" | "PAYMENT_ACCOUNT"
    // Pluggy API: subtype = "CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT" | "CREDIT_CARD"
    let normalizedType = 'CHECKING'; // Default
    const rawType = (acc.type || '').toUpperCase();
    const rawSubtype = (acc.subtype || '').toUpperCase();

    // Credit Card detection (highest priority)
    if (rawType === 'CREDIT' || rawSubtype === 'CREDIT_CARD' || rawSubtype.includes('CREDIT')) {
      normalizedType = 'CREDIT_CARD';
    }
    // Savings Account detection
    else if (rawSubtype === 'SAVINGS_ACCOUNT' || rawSubtype.includes('SAVINGS') || rawSubtype.includes('POUPANCA') || rawSubtype.includes('POUPANÇA')) {
      normalizedType = 'SAVINGS';
    }
    // Investment detection
    else if (rawType === 'INVESTMENT' || rawSubtype.includes('INVEST')) {
      normalizedType = 'INVESTMENT';
    }
    // Loan detection
    else if (rawType === 'LOAN' || rawSubtype.includes('LOAN') || rawSubtype.includes('EMPRESTIMO') || rawSubtype.includes('EMPRÉSTIMO')) {
      normalizedType = 'LOAN';
    }
    // Bank accounts (Checking is default for BANK type)
    else if (rawType === 'BANK' || rawType === 'PAYMENT_ACCOUNT' || rawSubtype === 'CHECKING_ACCOUNT' || rawSubtype.includes('CHECKING') || rawSubtype.includes('CORRENTE')) {
      normalizedType = 'CHECKING';
    }

    console.log(`  => Normalized Type: "${normalizedType}"`);

    const normalized = {
      id: acc.id,
      name: acc.name || `Conta ${acc.number || 'Sem número'}`,
      type: normalizedType,
      subtype: acc.subtype || rawType, // Keep original subtype for reference
      balance: typeof acc.balance === 'number' ? acc.balance : 0,
      currency: acc.currencyCode || 'BRL',
      institution: institutionName || 'Instituição',
      itemId: itemId,
      providerId: 'pluggy',
      accountNumber: acc.number,
      branchCode: acc.agency,
      // Credit card specifics
      creditLimit: acc.creditData?.creditLimit || null,
      availableCreditLimit: acc.creditData?.availableCreditLimit || null,
      balanceCloseDate: acc.creditData?.balanceCloseDate || null,
      balanceDueDate: acc.creditData?.balanceDueDate || null,
      // Bank specifics
      transferNumber: acc.bankData?.transferNumber || null,
      closingBalance: acc.bankData?.closingBalance || null,
      // Metadata
      lastSyncedAt: new Date().toISOString(),
      bills: [],
    };

    return normalized;
  });
};

// Helper: Normalize Pluggy Transactions
const normalizePluggyTransactions = (transactions, accountId = null) => {
  if (!transactions || !Array.isArray(transactions)) {
    console.log('[PLUGGY] normalizePluggyTransactions: No transactions to normalize');
    return [];
  }

  console.log(`\n[PLUGGY] Normalizing ${transactions.length} transactions...`);

  return transactions.map((tx, index) => {
    // Log first 3 transactions for debugging
    if (index < 3) {
      console.log(`[PLUGGY] Transaction ${index + 1}: ${tx.description?.substring(0, 40)}... | Amount: ${tx.amount} | Type: ${tx.type}`);
    }

    // Determine if it is an expense
    // Pluggy can send negative amounts OR positive amounts with type="DEBIT"
    const rawType = (tx.type || '').toUpperCase();
    const isExpense = rawType === 'DEBIT' || tx.amount < 0;

    // Normalize Amount: Negative for expense, Positive for income
    const finalAmount = isExpense ? -Math.abs(tx.amount) : Math.abs(tx.amount);

    return {
      id: tx.id,
      description: tx.description || 'Sem descrição',
      amount: finalAmount,
      date: tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0],
      category: tx.category || 'Outros',
      subcategory: tx.categoryId || '',
      type: isExpense ? 'expense' : 'income',
      status: tx.status || 'completed',
      accountId: tx.accountId || accountId, // Use tx.accountId first, fallback to passed accountId
      providerId: 'pluggy',
      importSource: 'pluggy',
      // Additional metadata from Pluggy
      merchant: tx.merchant?.name || null,
      merchantCategory: tx.merchant?.category || null,
      paymentMethod: tx.paymentData?.paymentMethod || null,
    };
  });
};

// Pluggy Endpoints

// 1. Create Connect Token
router.post('/pluggy/create-token', async (req, res) => {
  const { userId, itemId } = req.body;

  console.log('\n[PLUGGY TOKEN] Creating connect token...');
  console.log(`[PLUGGY TOKEN] User ID: ${userId}`);
  console.log(`[PLUGGY TOKEN] Item ID (for update): ${itemId || 'none'}`);

  try {
    const authResponse = await axios.post(`${PLUGGY_API_URL}/auth`, {
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET
    });

    const apiKey = authResponse.data.apiKey;

    // IMPORTANTE: Solicitar EXPLICITAMENTE todos os produtos
    // Isso garante que o fluxo de consentimento do Open Finance
    // irá pedir autorização para conta corrente, cartões, etc.
    const payload = {
      clientUserId: userId,
      // Solicitar TODOS os produtos explicitamente para garantir
      // que o usuário seja perguntado sobre cada um no consentimento
      products: [
        'ACCOUNTS',           // Conta corrente e poupança
        'CREDIT_CARDS',       // Cartões de crédito
        'TRANSACTIONS',       // Histórico de transações
        'IDENTITY',           // Dados pessoais
        'INVESTMENTS',        // Investimentos
        'INVESTMENTS_TRANSACTIONS', // Transações de investimentos
        'PAYMENT_DATA',       // Dados de pagamento
        'LOANS'               // Empréstimos
      ]
    };

    if (itemId) {
      payload.itemId = itemId;
    }

    console.log(`[PLUGGY TOKEN] Requesting products: ${payload.products.join(', ')}`);

    const tokenResponse = await axios.post(`${PLUGGY_API_URL}/connect_token`, payload, {
      headers: { 'X-API-KEY': apiKey }
    });

    console.log(`[PLUGGY TOKEN] ✓ Token created successfully (Update Mode: ${!!itemId})`);
    res.json({ accessToken: tokenResponse.data.accessToken });

  } catch (error) {
    console.error('[PLUGGY TOKEN] ✗ Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate with Pluggy' });
  }
});

// 2. Sync Data - REFACTORED with comprehensive logging
router.post('/pluggy/sync', async (req, res) => {
  const { itemId } = req.body;

  console.log(`\n${'#'.repeat(70)}`);
  console.log(`[PLUGGY SYNC] Starting sync for itemId: ${itemId}`);
  console.log(`[PLUGGY SYNC] Timestamp: ${new Date().toISOString()}`);
  console.log(`${'#'.repeat(70)}\n`);

  if (!itemId) {
    console.log('[PLUGGY SYNC] ERROR: itemId is required');
    return res.status(400).json({ error: 'itemId is required' });
  }

  try {
    // ========================================
    // STEP 1: Authenticate with Pluggy API
    // ========================================
    console.log('[PLUGGY SYNC] Step 1: Authenticating with Pluggy...');
    const authResponse = await axios.post(`${PLUGGY_API_URL}/auth`, {
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET
    });
    const apiKey = authResponse.data.apiKey;
    const headers = { 'X-API-KEY': apiKey };
    console.log('[PLUGGY SYNC] Authentication successful!');

    // ========================================
    // STEP 2: Fetch Item Details (Institution)
    // ========================================
    console.log('\n[PLUGGY SYNC] Step 2: Fetching item details...');
    let institutionName = 'Instituição';
    let itemStatus = 'UNKNOWN';
    let itemProducts = [];

    try {
      let itemResponse = await axios.get(`${PLUGGY_API_URL}/items/${itemId}`, { headers });
      let item = itemResponse.data;

      console.log('[PLUGGY SYNC] Item raw data:');
      console.log(`  - ID: ${item.id}`);
      console.log(`  - Status: ${item.status}`);
      console.log(`  - Connector ID: ${item.connector?.id}`);
      console.log(`  - Connector Name: ${item.connector?.name}`);
      console.log(`  - Products: ${JSON.stringify(item.products || item.connector?.products)}`);
      console.log(`  - Created: ${item.createdAt}`);
      console.log(`  - Updated: ${item.updatedAt}`);

      // Smart Wait: If updating, poll until finished or timeout (max 45s)
      let attempts = 0;
      while (item.status === 'UPDATING' && attempts < 15) {
        console.log(`[PLUGGY SYNC] Item is UPDATING. Waiting 3s... (${attempts + 1}/15)`);
        await new Promise(r => setTimeout(r, 3000));

        itemResponse = await axios.get(`${PLUGGY_API_URL}/items/${itemId}`, { headers });
        item = itemResponse.data;
        attempts++;
      }

      if (item.connector?.name) {
        institutionName = item.connector.name;
      }
      itemStatus = item.status;
      itemProducts = item.products || item.connector?.products || [];

      console.log(`[PLUGGY SYNC] Final Item Status: ${itemStatus}`);
      console.log(`[PLUGGY SYNC] Institution: ${institutionName}`);
      console.log(`[PLUGGY SYNC] Products available: ${JSON.stringify(itemProducts)}`);

      if (itemStatus === 'UPDATING') {
        console.log('[PLUGGY SYNC] WARNING: Item still updating after 45s wait!');
      }
    } catch (err) {
      console.error(`[PLUGGY SYNC] Failed to fetch item details: ${err.message}`);
    }

    // ========================================
    // STEP 3: Check Consents (Debug)
    // ========================================
    console.log('\n[PLUGGY SYNC] Step 3: Checking consents...');
    try {
      const consentsResponse = await axios.get(`${PLUGGY_API_URL}/consents?itemId=${itemId}`, { headers });
      const consents = consentsResponse.data.results || [];
      console.log(`[PLUGGY SYNC] Found ${consents.length} consent(s)`);

      consents.forEach((consent, i) => {
        console.log(`[PLUGGY SYNC] Consent ${i + 1}:`);
        console.log(`  - ID: ${consent.id}`);
        console.log(`  - Status: ${consent.status}`);
        console.log(`  - Products: ${JSON.stringify(consent.products)}`);
        console.log(`  - Permissions: ${JSON.stringify(consent.permissions)}`);
        console.log(`  - Expiration: ${consent.expiresAt}`);
      });
    } catch (consentErr) {
      console.log(`[PLUGGY SYNC] Could not fetch consents: ${consentErr.message}`);
    }

    // ========================================
    // STEP 4: Fetch ALL Accounts (No Type Filter)
    // ========================================
    console.log('\n[PLUGGY SYNC] Step 4: Fetching accounts...');

    // First, get ALL accounts without type filter
    const accountsResponse = await axios.get(`${PLUGGY_API_URL}/accounts`, {
      headers,
      params: { itemId }
    });

    const rawAccounts = accountsResponse.data.results || [];
    console.log(`[PLUGGY SYNC] Total accounts found: ${rawAccounts.length}`);

    // Log raw account data for debugging
    console.log('\n[PLUGGY SYNC] RAW ACCOUNTS DATA:');
    rawAccounts.forEach((acc, i) => {
      console.log(`  ${i + 1}. ${acc.name}`);
      console.log(`     - ID: ${acc.id}`);
      console.log(`     - Type: "${acc.type}"`);
      console.log(`     - Subtype: "${acc.subtype}"`);
      console.log(`     - Balance: ${acc.balance}`);
      console.log(`     - Currency: ${acc.currencyCode}`);
      console.log(`     - Has bankData: ${!!acc.bankData}`);
      console.log(`     - Has creditData: ${!!acc.creditData}`);
    });

    // Also try fetching by type separately for comparison
    console.log('\n[PLUGGY SYNC] Fetching accounts by type for comparison...');

    // BANK type accounts
    try {
      const bankResponse = await axios.get(`${PLUGGY_API_URL}/accounts`, {
        headers,
        params: { itemId, type: 'BANK' }
      });
      console.log(`[PLUGGY SYNC] BANK type accounts: ${bankResponse.data.results?.length || 0}`);
      bankResponse.data.results?.forEach(acc => {
        console.log(`  - ${acc.name} (${acc.subtype}) Balance: ${acc.balance}`);
      });
    } catch (e) {
      console.log(`[PLUGGY SYNC] Could not fetch BANK accounts: ${e.message}`);
    }

    // CREDIT type accounts
    try {
      const creditResponse = await axios.get(`${PLUGGY_API_URL}/accounts`, {
        headers,
        params: { itemId, type: 'CREDIT' }
      });
      console.log(`[PLUGGY SYNC] CREDIT type accounts: ${creditResponse.data.results?.length || 0}`);
      creditResponse.data.results?.forEach(acc => {
        console.log(`  - ${acc.name} (${acc.subtype}) Balance: ${acc.balance}`);
      });
    } catch (e) {
      console.log(`[PLUGGY SYNC] Could not fetch CREDIT accounts: ${e.message}`);
    }

    // Normalize accounts
    const normalizedAccounts = normalizePluggyAccounts(rawAccounts, itemId, institutionName);

    // Summary
    const accountSummary = {
      total: normalizedAccounts.length,
      checking: normalizedAccounts.filter(a => a.type === 'CHECKING').length,
      savings: normalizedAccounts.filter(a => a.type === 'SAVINGS').length,
      creditCard: normalizedAccounts.filter(a => a.type === 'CREDIT_CARD').length,
      investment: normalizedAccounts.filter(a => a.type === 'INVESTMENT').length,
      loan: normalizedAccounts.filter(a => a.type === 'LOAN').length,
    };
    console.log('\n[PLUGGY SYNC] ACCOUNT SUMMARY:');
    console.log(`  - Total: ${accountSummary.total}`);
    console.log(`  - Checking: ${accountSummary.checking}`);
    console.log(`  - Savings: ${accountSummary.savings}`);
    console.log(`  - Credit Card: ${accountSummary.creditCard}`);
    console.log(`  - Investment: ${accountSummary.investment}`);
    console.log(`  - Loan: ${accountSummary.loan}`);

    // ========================================
    // STEP 5: Fetch Transactions for ALL Accounts
    // ========================================
    console.log('\n[PLUGGY SYNC] Step 5: Fetching transactions...');

    let allTransactions = [];
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    for (const acc of normalizedAccounts) {
      console.log(`\n[PLUGGY SYNC] --- Fetching transactions for: ${acc.name} (${acc.type}) ---`);
      console.log(`[PLUGGY SYNC] Account ID: ${acc.id}`);

      // Determine date range based on account type
      const isBankAccount = acc.type === 'CHECKING' || acc.type === 'SAVINGS';
      const toDate = new Date();
      const toString = toDate.toISOString().split('T')[0];

      const fromDate = new Date();
      // Bank accounts: 90 days, Credit cards: 365 days (1 year)
      const daysBack = isBankAccount ? 90 : 365;
      fromDate.setDate(fromDate.getDate() - daysBack);
      const fromString = fromDate.toISOString().split('T')[0];

      console.log(`[PLUGGY SYNC] Date range: ${fromString} to ${toString} (${daysBack} days)`);

      let accountTxs = [];
      let page = 1;
      let totalPages = 1;
      const pageSize = 500; // Fetch more per page

      try {
        // ATTEMPT 1: Fetch with date filter
        console.log(`[PLUGGY SYNC] Attempt 1: Fetching with date filter...`);

        do {
          const txResponse = await axios.get(`${PLUGGY_API_URL}/transactions`, {
            headers,
            params: {
              accountId: acc.id,
              from: fromString,
              to: toString,
              page,
              pageSize
            }
          });

          const results = txResponse.data.results || [];
          accountTxs = [...accountTxs, ...results];
          totalPages = txResponse.data.totalPages || 1;

          console.log(`[PLUGGY SYNC] Page ${page}/${totalPages}: ${results.length} transactions (Total so far: ${accountTxs.length})`);

          page++;

          // Safety break
          if (page > 50) {
            console.log('[PLUGGY SYNC] Breaking at page 50 for safety');
            break;
          }

          await sleep(100);
        } while (page <= totalPages);

        // ATTEMPT 2: If no transactions found for bank accounts, try without date filter
        if (isBankAccount && accountTxs.length === 0) {
          console.log(`[PLUGGY SYNC] Attempt 2: No transactions with date filter. Trying without date filter...`);

          try {
            const txResponseNoDate = await axios.get(`${PLUGGY_API_URL}/transactions`, {
              headers,
              params: {
                accountId: acc.id,
                pageSize: 500
              }
            });

            console.log(`[PLUGGY SYNC] Response without date: Total=${txResponseNoDate.data.total}, Results=${txResponseNoDate.data.results?.length}`);

            if (txResponseNoDate.data.results?.length > 0) {
              accountTxs = txResponseNoDate.data.results;
              console.log(`[PLUGGY SYNC] SUCCESS: Found ${accountTxs.length} transactions without date filter!`);
            }
          } catch (noDateErr) {
            console.error(`[PLUGGY SYNC] Error fetching without date filter: ${noDateErr.message}`);
          }
        }

        // Log results
        console.log(`[PLUGGY SYNC] RESULT: ${accountTxs.length} transactions for ${acc.name}`);

        if (accountTxs.length > 0) {
          // Log sample transactions
          console.log(`[PLUGGY SYNC] Sample transactions:`);
          accountTxs.slice(0, 3).forEach((tx, i) => {
            console.log(`  ${i + 1}. ${tx.description?.substring(0, 50)} | ${tx.amount} | ${tx.date} | Type: ${tx.type}`);
          });
        } else if (isBankAccount) {
          console.log(`[PLUGGY SYNC] WARNING: No transactions found for bank account "${acc.name}".`);
          console.log(`[PLUGGY SYNC] This could be due to:`);
          console.log(`  1. No recent transactions in the account`);
          console.log(`  2. Open Finance consent doesn't include transaction history`);
          console.log(`  3. Bank API limitation`);
        }

        // Normalize and add to collection
        const normalizedTxs = normalizePluggyTransactions(accountTxs, acc.id);
        allTransactions = [...allTransactions, ...normalizedTxs];

        // Small delay between accounts
        await sleep(300);

      } catch (err) {
        console.error(`[PLUGGY SYNC] ERROR fetching transactions for ${acc.id}:`);
        console.error(`  Message: ${err.message}`);
        if (err.response?.data) {
          console.error(`  API Error: ${JSON.stringify(err.response.data)}`);
        }
      }
    }

    // ========================================
    // STEP 6: Separate transactions by account type
    // ========================================
    console.log('\n[PLUGGY SYNC] Step 6: Separating transactions by type...');

    const creditCardTransactions = allTransactions.filter(tx => {
      const acc = normalizedAccounts.find(a => a.id === tx.accountId);
      return acc && acc.type === 'CREDIT_CARD';
    });

    const accountTransactions = allTransactions.filter(tx => {
      const acc = normalizedAccounts.find(a => a.id === tx.accountId);
      return acc && acc.type !== 'CREDIT_CARD';
    });

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log(`\n${'='.repeat(70)}`);
    console.log('[PLUGGY SYNC] SYNC COMPLETE - SUMMARY');
    console.log(`${'='.repeat(70)}`);
    console.log(`Institution: ${institutionName}`);
    console.log(`Total Accounts: ${normalizedAccounts.length}`);
    console.log(`  - Bank/Savings: ${accountSummary.checking + accountSummary.savings}`);
    console.log(`  - Credit Cards: ${accountSummary.creditCard}`);
    console.log(`Total Transactions: ${allTransactions.length}`);
    console.log(`  - From Bank Accounts: ${accountTransactions.length}`);
    console.log(`  - From Credit Cards: ${creditCardTransactions.length}`);
    console.log(`${'='.repeat(70)}\n`);

    // Return response
    res.json({
      accounts: normalizedAccounts,
      transactions: accountTransactions,
      creditCardTransactions: creditCardTransactions,
      source: 'pluggy_api',
      // Debug info
      debug: {
        institution: institutionName,
        itemStatus: itemStatus,
        products: itemProducts,
        accountSummary,
        transactionSummary: {
          total: allTransactions.length,
          bank: accountTransactions.length,
          creditCard: creditCardTransactions.length
        }
      }
    });

  } catch (error) {
    console.error('\n[PLUGGY SYNC] FATAL ERROR:');
    console.error(`  Message: ${error.message}`);
    if (error.response?.data) {
      console.error(`  API Response: ${JSON.stringify(error.response.data)}`);
    }
    console.error(`  Stack: ${error.stack}`);

    res.status(500).json({
      error: 'Failed to sync Pluggy data',
      details: error.response?.data || error.message
    });
  }
});

// 2.5. Debug: Check what Nubank connector actually supports
router.get('/pluggy/debug/nubank-connector', async (req, res) => {
  console.log('\n[PLUGGY DEBUG] Checking Nubank connector capabilities...');

  try {
    const authResponse = await axios.post(`${PLUGGY_API_URL}/auth`, {
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET
    });
    const apiKey = authResponse.data.apiKey;
    const headers = { 'X-API-KEY': apiKey };

    // Get all Open Finance connectors
    const connectorsResponse = await axios.get(`${PLUGGY_API_URL}/connectors`, {
      headers,
      params: { isOpenFinance: true }
    });

    const allConnectors = connectorsResponse.data.results || [];

    // Find Nubank connector
    const nubankConnector = allConnectors.find(c =>
      c.name?.toLowerCase().includes('nubank') ||
      c.institutionName?.toLowerCase().includes('nubank')
    );

    if (nubankConnector) {
      console.log('[PLUGGY DEBUG] Nubank Connector Found:');
      console.log(JSON.stringify(nubankConnector, null, 2));

      res.json({
        found: true,
        connector: {
          id: nubankConnector.id,
          name: nubankConnector.name,
          institutionName: nubankConnector.institutionName,
          type: nubankConnector.type,
          country: nubankConnector.country,
          isOpenFinance: nubankConnector.isOpenFinance,
          products: nubankConnector.products,
          credentials: nubankConnector.credentials,
          imageUrl: nubankConnector.imageUrl,
          primaryColor: nubankConnector.primaryColor,
          health: nubankConnector.health,
          // Important: Check if ACCOUNTS product is supported
          supportsAccounts: nubankConnector.products?.includes('ACCOUNTS'),
          supportsCreditCards: nubankConnector.products?.includes('CREDIT_CARDS'),
          supportsTransactions: nubankConnector.products?.includes('TRANSACTIONS'),
        },
        message: nubankConnector.products?.includes('ACCOUNTS')
          ? 'Nubank SHOULD support bank accounts (ACCOUNTS product available)'
          : 'WARNING: Nubank may NOT support bank accounts (ACCOUNTS product NOT in list)'
      });
    } else {
      console.log('[PLUGGY DEBUG] Nubank connector NOT found!');
      res.json({
        found: false,
        message: 'Nubank connector not found in Open Finance list',
        availableConnectors: allConnectors.map(c => c.name).slice(0, 20)
      });
    }

  } catch (error) {
    console.error('[PLUGGY DEBUG] Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// 3. Pluggy Webhook
router.post('/pluggy/webhook', async (req, res) => {
  const event = req.body;
  console.log('>>> PLUGGY WEBHOOK RECEIVED:', event.event);
  console.log('>>> Item ID:', event.itemId);

  // Here you can handle specific events like 'ITEM_UPDATED', 'TRANSACTIONS_DELETED'
  // For now, we just log it to ensure connectivity

  res.status(200).json({ received: true });
});

// 4. Debug: List Nubank connectors and their products
router.get('/pluggy/debug/connectors', async (req, res) => {
  try {
    const authResponse = await axios.post(`${PLUGGY_API_URL}/auth`, {
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET
    });
    const apiKey = authResponse.data.apiKey;
    const headers = { 'X-API-KEY': apiKey };

    // Get all Open Finance connectors
    const connectorsResponse = await axios.get(`${PLUGGY_API_URL}/connectors?isOpenFinance=true`, { headers });
    const allConnectors = connectorsResponse.data.results || [];

    // Filter Nubank connectors
    const nubankConnectors = allConnectors.filter(c =>
      c.name?.toLowerCase().includes('nubank') ||
      c.institutionName?.toLowerCase().includes('nubank')
    );

    console.log(`>>> Found ${nubankConnectors.length} Nubank connectors:`);
    nubankConnectors.forEach(c => {
      console.log(`    > ID: ${c.id} | Name: ${c.name} | Products: ${JSON.stringify(c.products)}`);
    });

    res.json({
      total: allConnectors.length,
      nubankConnectors: nubankConnectors.map(c => ({
        id: c.id,
        name: c.name,
        institutionName: c.institutionName,
        products: c.products,
        type: c.type,
        isOpenFinance: c.isOpenFinance
      }))
    });

  } catch (error) {
    console.error('Connectors Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch connectors' });
  }
});

// 5. Debug: Get item details
router.get('/pluggy/debug/item/:itemId', async (req, res) => {
  const { itemId } = req.params;
  try {
    const authResponse = await axios.post(`${PLUGGY_API_URL}/auth`, {
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET
    });
    const apiKey = authResponse.data.apiKey;
    const headers = { 'X-API-KEY': apiKey };

    const itemResponse = await axios.get(`${PLUGGY_API_URL}/items/${itemId}`, { headers });
    const item = itemResponse.data;

    // Get accounts for this item
    const accountsResponse = await axios.get(`${PLUGGY_API_URL}/accounts?itemId=${itemId}`, { headers });
    const accounts = accountsResponse.data.results;

    // Get consents
    let consents = [];
    try {
      const consentsResponse = await axios.get(`${PLUGGY_API_URL}/consents?itemId=${itemId}`, { headers });
      consents = consentsResponse.data.results || [];
    } catch (e) {
      console.log('Could not fetch consents');
    }

    res.json({
      item: {
        id: item.id,
        status: item.status,
        connector: item.connector,
        products: item.products,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      },
      accounts: accounts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        balance: a.balance
      })),
      consents: consents.map(c => ({
        id: c.id,
        products: c.products,
        permissions: c.permissions,
        status: c.status
      }))
    });

  } catch (error) {
    console.error('Item Debug Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch item details' });
  }
});


// Initialize Twilio client if credentials are present
let client;
try {
  if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
  }
} catch (e) {
  console.error("Twilio init error:", e);
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL_NAME = "gemini-1.5-flash";

async function generateResponse(text) {
  if (!ai) return "Erro: API do Gemini nao configurada.";

  const todayStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const prompt = `
Hoje e: ${todayStr}.
Voce e o "Coinzinha", um assistente financeiro pessoal divertido, amigavel e inteligente.

O usuario enviou via WhatsApp: "${text}"

Objetivo:
1. Se for uma transacao (ex: "gastei 10 padaria"), responda confirmando com o valor e categoria de forma amigavel (nao precisa salvar).
2. Se for conversa, responda de forma curta e amigavel.
3. Use emojis.

Responda em portugues, texto curto.
`;

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt
    });
    return result.response.text() || result.text;
  } catch (e) {
    console.error("Gemini Error:", e);
    return "Opa, tive um problema aqui. Pode repetir?";
  }
}

// WhatsApp webhook
router.post('/whatsapp', async (req, res) => {
  const { Body, From } = req.body;
  console.log(`Mensagem de ${From}: ${Body}`);

  if (Body?.toLowerCase().includes('join')) {
    const welcomeMsg = "Conectado ao Coinzinha! Pode falar comigo. Ex: 'Gastei 50 reais no mercado'.";

    if (client) {
      await client.messages.create({
        from: fromNumber,
        to: From,
        body: welcomeMsg
      });
    }

    res.set('Content-Type', 'text/xml');
    return res.send('<Response></Response>');
  }

  if (!client) {
    console.error("Twilio client not ready.");
    return res.status(500).send("Twilio not configured");
  }

  try {
    const replyText = await generateResponse(Body);
    console.log(`Gemini Reply: ${replyText}`);

    await client.messages.create({
      from: fromNumber,
      to: From,
      body: replyText
    });
  } catch (e) {
    console.error("Error processing message:", e);
  }

  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');
});

// Gemini proxy endpoint
router.post('/gemini', geminiHandler);

// Email Sending Endpoint (Nodemailer)
import nodemailer from 'nodemailer';

// Remove spaces from password if present (common when copying from Google)
const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

const smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: smtpPass,
  },
  // Disable debug logs
  logger: false,
  debug: false,
};

const smtpTransporter = nodemailer.createTransport(smtpConfig);

// Verify connection configuration
smtpTransporter.verify(function (error, success) {
  if (error) {
    console.error('>>> SMTP Connection Error:', error);
  }
});

router.post('/admin/send-email', async (req, res) => {
  const { recipients, subject, title, body, buttonText, buttonLink, headerAlign, titleAlign, bodyAlign } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Nenhum destinatário selecionado.' });
  }

  // HTML Template - Pixel Perfect Match with AdminEmailMessage.tsx
  // Theme: Dark Mode (Custom Colors)
  // Header/Footer: #363735
  // Content: #262624
  // Text: White (#ffffff) & Gray-300 (#d1d5db)

  // Alignment Defaults
  const hAlign = headerAlign || 'center';
  const tAlign = titleAlign || 'center';
  const bAlign = bodyAlign || 'left';

  const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        /* Reset for email clients */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table,td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #111827; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #d1d5db;">
      
      <!-- Outer Page Background (Dark) -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #111827; padding: 40px 0;">
        <tr>
          <td align="center">
            
            <!-- Main Card Container -->
            <!-- Width: 600px, rounded-lg (8px), border-gray-700 (#374151) -->
            <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #262624; border: 1px solid #374151; border-radius: 8px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border-collapse: separate; mso-border-radius-alt: 8px;">
              
              <!-- Header -->
              <!-- bg-[#363735], p-6 (24px), border-b-gray-700 -->
              <tr>
                <td align="${hAlign === 'justify' ? 'center' : hAlign}" style="padding: 24px; background-color: #363735; border-bottom: 1px solid #374151; text-align: ${hAlign === 'justify' ? 'center' : hAlign};">
                  <!-- Logo Text Replication -->
                  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.025em; line-height: 1; display: inline-block;">
                    Controlar<span style="color: #d97757;">+</span>
                  </div>
                </td>
              </tr>

              <!-- Content -->
              <!-- bg-[#262624], p-8 (32px) -->
              <tr>
                <td style="padding: 32px; background-color: #262624;">
                  
                  <!-- Title -->
                  <!-- text-2xl (24px), font-bold, text-white, mb-6 (24px) -->
                  <h1 style="margin: 0 0 24px 0; color: #ffffff; font-size: 24px; font-weight: bold; line-height: 1.25; text-align: ${tAlign};">
                    ${title || 'Novidades do Controlar+'}
                  </h1>
                  
                  <!-- Body -->
                  <!-- text-gray-300 (#d1d5db), leading-relaxed (1.625) -->
                  <div style="color: #d1d5db; font-size: 16px; line-height: 1.625; white-space: pre-wrap; text-align: ${bAlign};">
                    ${(body || '').replace(/\n/g, '<br/>')}
                  </div>

                  <!-- CTA Button -->
                  <!-- mt-8 (32px), center -->
                  <div style="margin-top: 32px; text-align: center;">
                    <!-- bg-[#d97757], text-white, font-bold, py-3 (12px) px-8 (32px), rounded-full -->
                    <a href="${buttonLink}" target="_blank" style="display: inline-block; background-color: #d97757; color: #ffffff; font-weight: bold; padding: 12px 32px; border-radius: 9999px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(217, 119, 87, 0.2);">
                      ${buttonText || 'Ver Agora'}
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <!-- bg-[#363735], p-6 (24px), border-t-gray-700 -->
              <tr>
                <td align="center" style="padding: 24px; background-color: #363735; border-top: 1px solid #374151; color: #6b7280; font-size: 12px;">
                  <p style="margin: 0;">© ${new Date().getFullYear()} Controlar+. Todos os direitos reservados.</p>
                  <p style="margin: 8px 0 0 0;">
                    <a href="#" style="color: #9ca3af; text-decoration: underline;">Descadastrar</a> • 
                    <a href="#" style="color: #9ca3af; text-decoration: underline; margin-left: 8px;">Política de Privacidade</a>
                  </p>
                </td>
              </tr>

            </table>
            <!-- End Card -->

          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const sendPromises = recipients.map(email => {
      return smtpTransporter.sendMail({
        from: process.env.SMTP_FROM || `"Controlar+" <${process.env.SMTP_USER}>`,
        to: email,
        subject: subject,
        html: htmlTemplate,
        text: body 
      });
    });

    const results = await Promise.allSettled(sendPromises);

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected');
    const failCount = failures.length;

    console.log(`>>> Email Campaign Sent: ${successCount} success, ${failCount} failed.`);

    if (failCount > 0) {
      console.error(">>> First failure reason:", failures[0].reason);
    }

    if (successCount === 0 && failCount > 0) {
      const firstError = failures[0].reason;
      return res.status(500).json({
        error: 'Falha ao enviar todos os emails.',
        details: firstError?.message || 'Erro desconhecido no SMTP.'
      });
    }

    res.json({
      success: true,
      sent: successCount,
      failed: failCount,
      message: `Enviado para ${successCount} usuários.`
    });

  } catch (error) {
    console.error('Email Send Error:', error);
    res.status(500).json({ error: 'Falha ao processar envio.', details: error.message });
  }
});

// ========================================
// ASAAS PAYMENT INTEGRATION
// ========================================

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = 'https://sandbox.asaas.com/api/v3';

// Helper: Make Asaas API request
const asaasRequest = async (method, endpoint, data = null) => {
  const config = {
    method,
    url: `${ASAAS_API_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
  };

  if (data) {
    config.data = data;
  }

  console.log(`>>> ASAAS ${method.toUpperCase()} ${endpoint}`);

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('>>> ASAAS Error:', error.response?.data || error.message);
    throw error;
  }
};

// 1. Create or Update Customer in Asaas
router.post('/asaas/customer', async (req, res) => {
  const { name, email, cpfCnpj, phone, postalCode, addressNumber } = req.body;

  if (!name || !email || !cpfCnpj) {
    return res.status(400).json({ error: 'Nome, email e CPF/CNPJ são obrigatórios.' });
  }

  try {
    const searchResult = await asaasRequest('GET', `/customers?cpfCnpj=${cpfCnpj.replace(/\D/g, '')}`);

    let customer;

    if (searchResult.data && searchResult.data.length > 0) {
      customer = searchResult.data[0];
      console.log(`>>> Found existing customer: ${customer.id}`);

      const updateData = {
        name,
        email,
        phone: phone?.replace(/\D/g, '') || undefined,
        postalCode: postalCode?.replace(/\D/g, '') || undefined,
        addressNumber: addressNumber || undefined,
      };

      customer = await asaasRequest('PUT', `/customers/${customer.id}`, updateData);
    } else {
      const customerData = {
        name,
        email,
        cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, '') : undefined,
        phone: phone?.replace(/\D/g, '') || undefined,
        postalCode: postalCode?.replace(/\D/g, '') || undefined,
        addressNumber: addressNumber || undefined,
        notificationDisabled: false,
      };

      customer = await asaasRequest('POST', '/customers', customerData);
      console.log(`>>> Created new customer: ${customer.id}`);
    }

    res.json({ success: true, customer });
  } catch (error) {
    console.error('>>> Customer creation error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao criar cliente.',
      details: error.response?.data?.errors?.[0]?.description || error.message
    });
  }
});

// 2. Create Subscription with Credit Card
router.post('/asaas/subscription', async (req, res) => {
  const {
    customerId,
    planId,
    billingCycle,
    value,
    creditCard,
    creditCardHolderInfo,
    installmentCount,
    couponId
  } = req.body;

  if (!customerId || !value || !creditCard || !creditCardHolderInfo) {
    return res.status(400).json({ error: 'Dados incompletos para criar assinatura.' });
  }

  try {
    const cycle = billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY';
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1); 
    const dueDateStr = nextDueDate.toISOString().split('T')[0];

    if (billingCycle === 'annual' && installmentCount && installmentCount > 1) {
      const paymentData = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: value,
        dueDate: dueDateStr,
        description: `Plano ${planId} - Anual (${installmentCount}x)`,
        installmentCount: installmentCount,
        installmentValue: Math.round((value / installmentCount) * 100) / 100,
        creditCard: {
          holderName: creditCard.holderName,
          number: creditCard.number.replace(/\s/g, ''),
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv,
        },
        creditCardHolderInfo: {
          name: creditCardHolderInfo.name,
          email: creditCardHolderInfo.email,
          cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
          postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
          addressNumber: creditCardHolderInfo.addressNumber,
          phone: creditCardHolderInfo.phone?.replace(/\D/g, '') || undefined,
        },
        remoteIp: req.ip,
        externalReference: `${planId}_annual_${Date.now()}`,
      };

      console.log('>>> Creating installment payment:', JSON.stringify(paymentData, null, 2));

      const payment = await asaasRequest('POST', '/payments', paymentData);

      console.log('>>> Payment created:', payment.id, payment.status);

      if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
        return res.json({
          success: true,
          payment,
          status: 'CONFIRMED',
          message: 'Pagamento confirmado com sucesso!'
        });
      } else if (payment.status === 'PENDING') {
        return res.json({
          success: true,
          payment,
          status: 'PENDING',
          message: 'Pagamento em processamento. Aguarde a confirmação.'
        });
      } else {
        return res.status(400).json({
          success: false,
          payment,
          status: payment.status,
          error: 'Pagamento não foi aprovado. Verifique os dados do cartão.'
        });
      }
    } else {
      const subscriptionData = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: value,
        nextDueDate: dueDateStr,
        cycle: cycle,
        description: `Plano ${planId} - ${cycle === 'YEARLY' ? 'Anual' : 'Mensal'}`,
        creditCard: {
          holderName: creditCard.holderName,
          number: creditCard.number.replace(/\s/g, ''),
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv,
        },
        creditCardHolderInfo: {
          name: creditCardHolderInfo.name,
          email: creditCardHolderInfo.email,
          cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
          postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
          addressNumber: creditCardHolderInfo.addressNumber,
          phone: creditCardHolderInfo.phone?.replace(/\D/g, '') || undefined,
        },
        remoteIp: req.ip,
        externalReference: `${planId}_${cycle.toLowerCase()}_${Date.now()}`,
      };

      console.log('>>> Creating subscription:', JSON.stringify(subscriptionData, null, 2));

      const subscription = await asaasRequest('POST', '/subscriptions', subscriptionData);

      console.log('>>> Subscription created:', subscription.id, subscription.status);

      const payments = await asaasRequest('GET', `/payments?subscription=${subscription.id}`);
      const firstPayment = payments.data?.[0];

      if (firstPayment && (firstPayment.status === 'CONFIRMED' || firstPayment.status === 'RECEIVED')) {
        return res.json({
          success: true,
          subscription,
          payment: firstPayment,
          status: 'CONFIRMED',
          message: 'Assinatura criada e pagamento confirmado!'
        });
      } else if (subscription.status === 'ACTIVE' || firstPayment?.status === 'PENDING') {
        return res.json({
          success: true,
          subscription,
          payment: firstPayment,
          status: 'PENDING',
          message: 'Assinatura criada. Pagamento em processamento.'
        });
      } else {
        return res.status(400).json({
          success: false,
          subscription,
          status: subscription.status,
          error: 'Não foi possível processar o pagamento. Verifique os dados do cartão.'
        });
      }
    }
  } catch (error) {
    console.error('>>> Subscription error:', error.response?.data || error.message);

    const asaasErrors = error.response?.data?.errors;
    let errorMessage = 'Erro ao processar pagamento.';

    if (asaasErrors && asaasErrors.length > 0) {
      errorMessage = asaasErrors.map(e => e.description).join('. ');
    }

    res.status(500).json({
      error: errorMessage,
      details: error.response?.data
    });
  }
});

// 3. Webhook to receive payment confirmations
router.post('/asaas/webhook', async (req, res) => {
  const event = req.body;

  console.log('>>> ASAAS WEBHOOK RECEIVED:', event.event);
  console.log('>>> Payment ID:', event.payment?.id);
  console.log('>>> Status:', event.payment?.status);

  try {
    switch (event.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        console.log(`>>> Payment confirmed: ${event.payment?.id}`);
        break;

      case 'PAYMENT_OVERDUE':
        console.log(`>>> Payment overdue: ${event.payment?.id}`);
        break;

      case 'PAYMENT_REFUNDED':
        console.log(`>>> Payment refunded: ${event.payment?.id}`);
        break;

      case 'SUBSCRIPTION_CREATED':
        console.log(`>>> Subscription created: ${event.subscription?.id}`);
        break;

      case 'SUBSCRIPTION_RENEWED':
        console.log(`>>> Subscription renewed: ${event.subscription?.id}`);
        break;

      case 'SUBSCRIPTION_CANCELED':
        console.log(`>>> Subscription canceled: ${event.subscription?.id}`);
        break;

      default:
        console.log(`>>> Unknown event: ${event.event}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('>>> Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// 4. Cancel Subscription
router.delete('/asaas/subscription/:subscriptionId', async (req, res) => {
  const { subscriptionId } = req.params;

  try {
    const result = await asaasRequest('DELETE', `/subscriptions/${subscriptionId}`);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao cancelar assinatura.',
      details: error.response?.data
    });
  }
});

// 5. Get Payment Status
router.get('/asaas/payment/:paymentId', async (req, res) => {
  const { paymentId } = req.params;

  try {
    const payment = await asaasRequest('GET', `/payments/${paymentId}`);
    res.json({ success: true, payment });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao buscar pagamento.',
      details: error.response?.data
    });
  }
});

export default router;