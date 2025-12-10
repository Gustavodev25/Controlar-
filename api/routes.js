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

// Klavi Configuration
const KLAVI_API_URL = 'https://api.klavi.com.br/v1';
// We define this but will use specific endpoint bases in routes
const KLAVI_ACCESS_KEY = process.env.KLAVI_ACCESS_KEY;
const KLAVI_SECRET_KEY = process.env.KLAVI_SECRET_KEY;
const KLAVI_WEBHOOK_URL = process.env.KLAVI_WEBHOOK_URL;

// In-memory storage for Klavi webhook data (keyed by linkId)
// In production, this should be Redis or a database
const klaviDataStore = new Map();

// Helper: Extract linkId from webhook payload
const extractLinkId = (payload) => {
  // Klavi sends linkId in different places depending on the event type
  return payload.linkId || payload.link_id || payload.data?.linkId || null;
};

// Helper: Calculate monthly invoice from transactions
const calculateMonthlyInvoice = (transactions, month, year) => {
  if (!transactions || !Array.isArray(transactions)) return 0;

  return transactions
    .filter(tx => {
      const txDate = new Date(tx.transactionDate || tx.date);
      return txDate.getMonth() + 1 === month && txDate.getFullYear() === year;
    })
    .reduce((sum, tx) => {
      const amount = parseFloat(tx.transactionAmount?.amount || tx.amount || '0');
      return sum + Math.abs(amount);
    }, 0);
};

// Helper: Extract bills history from closed statements
const extractBillsHistory = (closedStatements) => {
  if (!closedStatements || !Array.isArray(closedStatements)) return [];

  return closedStatements.map(statement => ({
    id: statement.billId || `bill_${statement.billingDate}`,
    dueDate: statement.dueDate,
    totalAmount: parseFloat(statement.billTotalAmount?.amount || '0'),
    balanceCloseDate: statement.billingDate,
    minimumPayment: parseFloat(statement.minimumPaymentAmount?.amount || '0'),
    isPaid: statement.isPaid || false,
  })).filter(bill => bill.totalAmount > 0);
};

// Helper: Normalize Klavi credit cards to ConnectedAccount format
const normalizeCreditCards = (creditCards, linkId) => {
  if (!creditCards || !Array.isArray(creditCards)) return [];

  // First pass: collect all limits and balances to calculate proportions
  let totalKnownLimit = 0;
  let totalBalance = 0;
  const cardsData = [];

  creditCards.forEach((card, index) => {
    const openStatement = card.openStatement || {};
    const closedStatements = card.closedStatements || [];
    const limits = card.limits || {};

    // Calculate current balance from open statement
    const billTotal = parseFloat(openStatement.billTotalAmount?.amount || '0');

    // Calculate invoice from transactions if billTotal is 0
    let currentInvoice = billTotal;
    if (currentInvoice === 0 && openStatement.transactionDetails) {
      currentInvoice = openStatement.transactionDetails.reduce((sum, tx) => {
        const amount = parseFloat(tx.transactionAmount?.amount || tx.amount || '0');
        return sum + Math.abs(amount);
      }, 0);
    }

    // Get limit info
    const creditLimit = parseFloat(limits.limitAmount?.amount || '0');
    const availableLimit = parseFloat(limits.availableAmount?.amount || '0');

    // Track totals for proportional distribution
    if (creditLimit > 0) {
      totalKnownLimit += creditLimit;
    }
    totalBalance += Math.abs(currentInvoice);

    cardsData.push({
      card,
      index,
      openStatement,
      closedStatements,
      currentInvoice,
      creditLimit,
      availableLimit,
    });
  });

  // Second pass: normalize with proportional limits for cards without data
  return cardsData.map(({ card, index, openStatement, closedStatements, currentInvoice, creditLimit, availableLimit }) => {
    // Calculate final limits (proportional if missing)
    let finalCreditLimit = creditLimit;
    let finalAvailableLimit = availableLimit;

    // If this card has no limit data, calculate proportionally
    if (creditLimit === 0 && totalKnownLimit > 0 && totalBalance > 0) {
      const cardProportion = Math.abs(currentInvoice) / totalBalance;
      finalCreditLimit = totalKnownLimit * cardProportion;
      finalAvailableLimit = Math.max(0, finalCreditLimit - Math.abs(currentInvoice));
      console.log(`>>> Credit Card ${card.name}: No limit data, using proportional: ${finalCreditLimit.toFixed(2)} (${(cardProportion * 100).toFixed(1)}%)`);
    }

    // Extract bills history from closed statements
    const bills = extractBillsHistory(closedStatements);

    // Add current open statement as a bill if it has transactions
    if (openStatement.billingDate && currentInvoice > 0) {
      bills.unshift({
        id: `bill_current_${openStatement.billingDate}`,
        dueDate: openStatement.dueDate,
        totalAmount: currentInvoice,
        balanceCloseDate: openStatement.billingDate,
        minimumPayment: parseFloat(openStatement.minimumPaymentAmount?.amount || '0'),
        isPaid: false,
        isCurrent: true,
      });
    }

    // Create stable ID based on card properties (not linkId which changes each connection)
    const cardName = card.name || card.creditCardNetwork || `card_${index}`;
    const stableId = `klavi_cc_${card.companyCnpj || 'unknown'}_${cardName.replace(/\s+/g, '_').toLowerCase()}`;

    console.log(`>>> Credit Card ${cardName}: Invoice R$ ${currentInvoice.toFixed(2)}, Limit R$ ${finalCreditLimit.toFixed(2)}, Bills: ${bills.length}`);

    return {
      id: stableId,
      name: card.name || `Cartão ${card.creditCardNetwork || 'Crédito'}`,
      type: 'CREDIT_CARD',
      subtype: card.productType || 'CREDIT',
      balance: -currentInvoice, // Negative because it's debt
      currency: 'BRL',
      institution: card.brandName || card.bacenName || 'Instituição',
      itemId: linkId,
      providerId: 'klavi',
      creditLimit: finalCreditLimit,
      availableCreditLimit: finalAvailableLimit,
      balanceDueDate: openStatement.dueDate || null,
      balanceCloseDate: openStatement.billingDate || null,
      // Store bills history for monthly view
      bills: bills,
      // Store payment methods info
      paymentMethods: card.paymentMethods || [],
      // Store raw transactions for further processing
      lastUpdated: new Date().toISOString(),
    };
  });
};


// Helper: Normalize Klavi checking/savings accounts to ConnectedAccount format
const normalizeAccounts = (accounts, linkId, defaultType = null) => {
  if (!accounts || !Array.isArray(accounts)) return [];

  return accounts.map((acc, index) => {
    // Debug: Log the account structure to find the correct balance field
    console.log(`>>> Account ${index} structure:`, JSON.stringify(acc, null, 2).substring(0, 500));

    // Try multiple possible balance locations (Open Finance has various structures)
    let balance = 0;

    // Try direct balance fields
    if (acc.availableAmount?.amount) {
      balance = parseFloat(acc.availableAmount.amount);
    } else if (acc.balance?.amount) {
      balance = parseFloat(acc.balance.amount);
    } else if (acc.automaticallyInvestedAmount?.amount) {
      balance = parseFloat(acc.automaticallyInvestedAmount.amount);
    } else if (acc.currentBalance?.amount) {
      balance = parseFloat(acc.currentBalance.amount);
    } else if (acc.blockedAmount?.amount !== undefined) {
      // Sometimes balance is in blockedAmount or availableAmount
      balance = parseFloat(acc.availableAmount?.amount || '0');
    }

    // Try nested balances structure (Open Finance pattern)
    if (balance === 0 && acc.balances) {
      // balances can be an array with different types (AVAILABLE, CURRENT, etc.)
      if (Array.isArray(acc.balances)) {
        const availableBalance = acc.balances.find(b =>
          b.type === 'AVAILABLE' || b.type === 'DISPONIVEL' || b.type === 'availableAmount'
        );
        const currentBalance = acc.balances.find(b =>
          b.type === 'CURRENT' || b.type === 'BLOQUEADO' || b.type === 'automaticallyInvestedAmount'
        );

        if (availableBalance?.amount?.amount) {
          balance = parseFloat(availableBalance.amount.amount);
        } else if (availableBalance?.amount) {
          balance = parseFloat(availableBalance.amount);
        } else if (currentBalance?.amount?.amount) {
          balance = parseFloat(currentBalance.amount.amount);
        } else if (currentBalance?.amount) {
          balance = parseFloat(currentBalance.amount);
        }
      } else if (acc.balances.availableAmount?.amount) {
        balance = parseFloat(acc.balances.availableAmount.amount);
      }
    }

    // Try amount field directly
    if (balance === 0 && acc.amount) {
      balance = parseFloat(typeof acc.amount === 'object' ? acc.amount.amount : acc.amount) || 0;
    }

    console.log(`>>> Account ${index} extracted balance: ${balance}`);

    // Create stable ID based on account properties (not linkId which changes)
    const accountNumber = acc.accountNumber || acc.number || `acc_${index}`;
    const branch = acc.branchCode || acc.agency || 'nobranch';
    const stableId = `klavi_acc_${acc.companyCnpj || 'unknown'}_${branch}_${accountNumber}`;

    // Determine account type with broader checks
    const rawType = (acc.accountType || acc.type || '').toUpperCase();
    const rawSubtype = (acc.accountSubType || acc.subtype || '').toUpperCase();
    
    let isSavings = false;
    
    if (defaultType === 'SAVINGS') {
        isSavings = true;
    } else {
        isSavings = 
          rawType === 'CONTA_POUPANCA' || 
          rawType === 'SAVINGS' || 
          rawType === 'SAVINGS_ACCOUNT' ||
          rawSubtype.includes('POUPANCA') ||
          rawSubtype.includes('SAVINGS');
    }

    return {
      id: stableId,
      name: acc.accountName || acc.name || `Conta ${isSavings ? 'Poupança' : (acc.accountType || acc.type || 'Corrente')}`,
      type: isSavings ? 'SAVINGS' : 'CHECKING',
      subtype: acc.accountSubType || acc.subtype || acc.compeCode || '',
      balance: balance,
      currency: acc.currency || 'BRL',
      institution: acc.brandName || acc.bacenName || acc.brandCode || 'Instituição',
      itemId: linkId,
      providerId: 'klavi',
      accountNumber: acc.accountNumber || acc.number || '',
      branchCode: acc.branchCode || acc.agency || '',
    };
  });
};


// Helper: Normalize Klavi transactions to Transaction format
const normalizeTransactions = (creditCards, accounts, linkId) => {
  const transactions = [];

  // Extract transactions from credit cards
  if (creditCards && Array.isArray(creditCards)) {
    creditCards.forEach((card, cardIndex) => {
      // Replicate stable ID logic from normalizeCreditCards
      const cardName = card.name || card.creditCardNetwork || `card_${cardIndex}`;
      const accountId = `klavi_cc_${card.companyCnpj || 'unknown'}_${cardName.replace(/\s+/g, '_').toLowerCase()}`;

      // Open statement transactions
      const openTxs = card.openStatement?.transactionDetails || [];
      openTxs.forEach(tx => {
        transactions.push(normalizeTransaction(tx, accountId, linkId, 'credit_card'));
      });

      // Closed statements transactions (last 3 months)
      const closedStatements = (card.closedStatements || []).slice(0, 3);
      closedStatements.forEach(stmt => {
        const closedTxs = stmt.transactionDetails || [];
        closedTxs.forEach(tx => {
          transactions.push(normalizeTransaction(tx, accountId, linkId, 'credit_card'));
        });
      });
    });
  }

  // Extract transactions from checking/savings accounts
  if (accounts && Array.isArray(accounts)) {
    accounts.forEach((acc, accIndex) => {
      // Replicate stable ID logic from normalizeAccounts
      const accountNumber = acc.accountNumber || acc.number || `acc_${accIndex}`;
      const branch = acc.branchCode || acc.agency || 'nobranch';
      const accountId = `klavi_acc_${acc.companyCnpj || 'unknown'}_${branch}_${accountNumber}`;

      const accTxs = acc.transactions || acc.transactionDetails || [];
      accTxs.forEach(tx => {
        transactions.push(normalizeTransaction(tx, accountId, linkId, 'account'));
      });
    });
  }

  return transactions;
};

// Helper: Normalize a single transaction
const normalizeTransaction = (tx, accountId, linkId, sourceType = 'account') => {
  // Debug: Log raw transaction for checking accounts to investigate missing expenses
  if (sourceType === 'account') {
     console.log(`>>> RAW TX CHECK: ID=${tx.transactionId || 'N/A'} Desc="${tx.transactionName || tx.description}" Val=${tx.amount?.amount || tx.value} Type=${tx.type} CD=${tx.creditDebitType}`);
  }

  // Try multiple possible amount locations (Klavi/Open Finance has various structures)
  let amount = 0;

  // Try brazilianAmount first (most common for transactions)
  if (tx.brazilianAmount?.amount) {
    amount = parseFloat(tx.brazilianAmount.amount);
  }
  // Try transactionAmount (used in some transaction types)
  else if (tx.transactionAmount?.amount) {
    amount = parseFloat(tx.transactionAmount.amount);
  }
  // Try nested amount object
  else if (tx.amount?.amount) {
    amount = parseFloat(tx.amount.amount);
  }
  // Try direct amount field
  else if (typeof tx.amount === 'number') {
    amount = tx.amount;
  }
  else if (typeof tx.amount === 'string') {
    amount = parseFloat(tx.amount);
  }
  // Try value field (alternative naming)
  else if (tx.value?.amount) {
    amount = parseFloat(tx.value.amount);
  }
  else if (typeof tx.value === 'number') {
    amount = tx.value;
  }
  else if (typeof tx.value === 'string') {
    amount = parseFloat(tx.value);
  }

  // Log transactions with zero amount for debugging
  if (amount === 0) {
    console.log(`>>> WARNING: Zero amount transaction: "${tx.transactionName || tx.description}"`,
      JSON.stringify({
        brazilianAmount: tx.brazilianAmount,
        transactionAmount: tx.transactionAmount,
        amount: tx.amount,
        value: tx.value,
        keys: Object.keys(tx).join(', ')
      }).substring(0, 300));
  }

  // Detect if transaction is a debit (expense) - check multiple possible indicators
  const creditDebitType = (tx.creditDebitType || '').toUpperCase();
  const txType = (tx.type || '').toUpperCase();
  const description = (tx.transactionName || tx.description || '').toUpperCase();

  // Check creditDebitType variations
  const isDebitByType = creditDebitType.includes('DEBITO') || creditDebitType.includes('DEBIT') || creditDebitType === 'D';

  // Check tx.type variations
  const isDebitByTxType = txType.includes('DEBIT') || txType.includes('DEBITO') || txType === 'D' || txType === 'SAIDA' || txType === 'PAYMENT';

  // Check description for common expense patterns
  const isDebitByDescription =
    description.includes('ENVIADO') ||
    description.includes('ENVIADA') ||
    description.includes('PAG ') ||
    description.includes('PAGAMENTO') ||
    description.includes('DEBITO') ||
    description.includes('DÉBITO') ||
    description.includes('EMPRESTIMO') ||
    description.includes('EMPRÉSTIMO') ||
    description.includes('TRANSFERENCIA ENVIADA') ||
    description.includes('TRANSFERÊNCIA ENVIADA') ||
    description.includes('SAQUE') ||
    description.includes('COMPRA') ||
    description.includes('TARIFA');

  // Final decision: is this a debit?
  const isDebit = isDebitByType || isDebitByTxType || isDebitByDescription || amount < 0;

  // Debug log for expense detection
  if (isDebit) {
    console.log(`>>> EXPENSE detected: "${tx.transactionName || tx.description}" - Amount: ${amount}, creditDebitType: ${tx.creditDebitType}, type: ${tx.type}`);
  }

  return {
    id: tx.transactionId || `klavi_tx_${linkId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: tx.transactionName || tx.description || 'Transação',
    amount: isDebit ? -Math.abs(amount) : Math.abs(amount),
    date: tx.transactionDate || tx.date || new Date().toISOString().split('T')[0],
    category: tx.category || 'Outros',
    subcategory: tx.subcategory || '',
    type: isDebit ? 'expense' : 'income',
    status: 'completed',
    accountId: accountId,
    providerId: 'klavi',
    // Source type: 'credit_card' or 'account'
    sourceType: sourceType,
    // Tag for UI display
    tags: sourceType === 'credit_card' ? ['Cartão de Crédito'] : [],
    // Additional metadata
    transactionType: tx.transactionType || '',
    paymentType: tx.paymentType || '',
    identificationNumber: tx.identificationNumber || '',
    // Mark imported transactions
    importSource: 'klavi',
  };
};


// Klavi Endpoints



// Store the current linkId for reference
let currentKlaviLinkId = null;

// 1. Create Link (Generate the widget URL)
router.post('/klavi/create-link', async (req, res) => {
  try {
    // DON'T clear store - keep previous data for reliability
    // The sync function aggregates all data anyway
    console.log(">>> Creating new Klavi link (preserving existing webhook data)");
    console.log(`>>> Current store has ${klaviDataStore.size} entries`);

    dotenv.config();
    // User explicitly requested these keys for SANDBOX
    const ACCESS_KEY = process.env.KLAVI_ACCESS_KEY || "121DEABF-DDD2-4ABB-8185-5348082FCA9D";
    const SECRET_KEY = process.env.KLAVI_SECRET_KEY || "0ED8D6F1-9730-4D1F-BB39-1992186DEF6F";

    // Explicitly requested SANDBOX URL
    const KLAVI_BASE = 'https://api-sandbox.klavi.ai/data/v1';

    const REDIRECT_BASE = process.env.REDIRECT_BASE || 'https://schematically-oscitant-herbert.ngrok-free.dev';
    const webhookUrl = process.env.KLAVI_WEBHOOK_URL || `${REDIRECT_BASE}/api/klavi/webhook`;

    console.log(">>> Starting Klavi Flow (REAL SANDBOX)...");
    console.log("    Target:", `${KLAVI_BASE}/auth`);


    // STEP 1: Authenticate (Get Access Token)
    console.log("1. Authenticating with Klavi...");
    const authResponse = await axios.post(`${KLAVI_BASE}/auth`, {
      accessKey: ACCESS_KEY.trim(),
      secretKey: SECRET_KEY.trim()
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const accessToken = authResponse.data.accessToken;
    console.log("   > Auth Successful. Token received.");

    // STEP 2: Create Link
    console.log("2. Creating Link...");
    // Docs say: redirectURL, productsCallbackURL (not webhookURL)
    const linkPayload = {
      redirectURL: REDIRECT_BASE,
      productsCallbackURL: {
        all: webhookUrl
      }
    };

    const linkResponse = await axios.post(`${KLAVI_BASE}/links`, linkPayload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log("   > Link Response:", JSON.stringify(linkResponse.data, null, 2));

    // Docs say response has: linkURL, linkId, linkToken
    const linkUrl = linkResponse.data.linkURL;
    const linkId = linkResponse.data.linkId;

    // Store the linkId for webhook association
    if (linkId) {
      currentKlaviLinkId = linkId;
      console.log(`   > Stored linkId for webhook: ${linkId}`);
    }

    if (linkUrl) {
      res.json({ success: true, url: linkUrl, linkId: linkId });
    } else {
      console.error("   > Error: linkURL not found in response", linkResponse.data);
      res.status(500).json({ error: "linkURL not found in Klavi response", data: linkResponse.data });
    }

  } catch (error) {
    console.error('!!! Klavi Integration Error !!!');
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
      res.status(error.response.status).json({
        error: 'Klavi API Error',
        details: error.response.data
      });
    } else {
      console.error("Message:", error.message);
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  }
});

// 2. Sync Data (Fetch Accounts & Transactions from stored webhook data)
router.post('/klavi/sync', async (req, res) => {
  const { itemId, accessToken: clientToken, startDate, endDate } = req.body;

  // itemId from frontend is the link_id
  console.log(`>>> Syncing data for Link ID: ${itemId}`);

  // Helper function to check for data in store with deduplication
  const checkForData = () => {
    const creditCardsMap = new Map(); // Key: companyCnpj + name
    const checkingAccountsMap = new Map(); // Key: number + branchCode
    const savingsAccountsMap = new Map();

    for (const [key, value] of klaviDataStore.entries()) {
      // Deduplicate credit cards by companyCnpj + name
      if (value.creditCards && value.creditCards.length > 0) {
        for (const card of value.creditCards) {
          const uniqueKey = `${card.companyCnpj}_${card.name || card.creditCardNetwork}`;
          // Only keep the first occurrence (or update with newer data)
          if (!creditCardsMap.has(uniqueKey)) {
            creditCardsMap.set(uniqueKey, card);
          }
        }
      }

      // Deduplicate checking accounts by number + branchCode
      if (value.checkingAccounts && value.checkingAccounts.length > 0) {
        for (const acc of value.checkingAccounts) {
          const uniqueKey = `${acc.number}_${acc.branchCode}`;
          if (!checkingAccountsMap.has(uniqueKey)) {
            checkingAccountsMap.set(uniqueKey, acc);
          }
        }
      }

      // Deduplicate savings accounts
      if (value.savingsAccounts && value.savingsAccounts.length > 0) {
        for (const acc of value.savingsAccounts) {
          const uniqueKey = `${acc.number}_${acc.branchCode}`;
          if (!savingsAccountsMap.has(uniqueKey)) {
            savingsAccountsMap.set(uniqueKey, acc);
          }
        }
      }
    }

    const allCreditCards = Array.from(creditCardsMap.values());
    const allCheckingAccounts = Array.from(checkingAccountsMap.values());
    const allSavingsAccounts = Array.from(savingsAccountsMap.values());

    const hasData = allCreditCards.length > 0 || allCheckingAccounts.length > 0 || allSavingsAccounts.length > 0;
    return { hasData, allCreditCards, allCheckingAccounts, allSavingsAccounts };
  };


  // Sleep helper
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    console.log(`>>> Current store has ${klaviDataStore.size} entries`);

    // Polling: Wait for data to arrive (max 15 seconds total)
    let dataResult = checkForData();
    let attempts = 0;
    const maxAttempts = 30; // 30 * 500ms = 15 seconds

    // Phase 1: Wait until we get ANY data
    while (!dataResult.hasData && attempts < maxAttempts) {
      console.log(`>>> Waiting for webhook data... attempt ${attempts + 1}/${maxAttempts}`);
      await sleep(500);
      dataResult = checkForData();
      attempts++;
    }

    // Phase 2: Once we have data, wait a bit more for additional webhooks
    // Klavi sends different data types in separate webhooks
    if (dataResult.hasData) {
      console.log(`>>> Initial data found! Waiting 5 more seconds for additional webhooks...`);
      let lastCount = dataResult.allCreditCards.length + dataResult.allCheckingAccounts.length + dataResult.allSavingsAccounts.length;

      // Wait up to 5 more seconds, checking if more data arrives
      for (let i = 0; i < 10; i++) {
        await sleep(500);
        const newResult = checkForData();
        const newCount = newResult.allCreditCards.length + newResult.allCheckingAccounts.length + newResult.allSavingsAccounts.length;

        if (newCount > lastCount) {
          console.log(`>>> More data arrived! Total items: ${newCount} (was ${lastCount})`);
          lastCount = newCount;
          dataResult = newResult;
        }
      }
    }

    if (dataResult.hasData) {
      const { allCreditCards, allCheckingAccounts, allSavingsAccounts } = dataResult;

      console.log(`>>> Final data after waiting:`);
      console.log(`>>> Credit Cards: ${allCreditCards.length}`);
      console.log(`>>> Checking Accounts: ${allCheckingAccounts.length}`);
      console.log(`>>> Savings Accounts: ${allSavingsAccounts.length}`);

      // Normalize the data
      const creditCardAccounts = normalizeCreditCards(allCreditCards, itemId);
      const checkingAccounts = normalizeAccounts(allCheckingAccounts, itemId, 'CHECKING');
      const savingsAccounts = normalizeAccounts(allSavingsAccounts, itemId, 'SAVINGS');

      const allAccounts = [
        ...creditCardAccounts,
        ...checkingAccounts,
        ...savingsAccounts
      ];

      const allTransactions = normalizeTransactions(
        allCreditCards,
        [...allCheckingAccounts, ...allSavingsAccounts],
        itemId
      );

      // Separate transactions by source type
      const creditCardTransactions = allTransactions.filter(tx => tx.sourceType === 'credit_card');
      const accountTransactions = allTransactions.filter(tx => tx.sourceType === 'account');

      console.log(`>>> Normalized ${allAccounts.length} accounts`);
      console.log(`>>> Credit Card Transactions: ${creditCardTransactions.length}`);
      console.log(`>>> Account Transactions: ${accountTransactions.length}`);

      return res.json({
        accounts: allAccounts,
        transactions: accountTransactions, // Regular transactions go to normal Lançamentos
        creditCardTransactions: creditCardTransactions, // Credit card transactions go to Cartão de Crédito view
        source: 'webhook_data'
      });
    }



    // No stored data found - try to trigger report generation
    console.log(`>>> No stored data found, triggering report generation...`);

    const KLAVI_BASE = 'https://api-sandbox.klavi.ai/data/v1';
    const ACCESS_KEY = process.env.KLAVI_ACCESS_KEY || "121DEABF-DDD2-4ABB-8185-5348082FCA9D";
    const SECRET_KEY = process.env.KLAVI_SECRET_KEY || "0ED8D6F1-9730-4D1F-BB39-1992186DEF6F";

    console.log("   > Authenticating...");
    const authResponse = await axios.post(`${KLAVI_BASE}/auth`, {
      accessKey: ACCESS_KEY.trim(),
      secretKey: SECRET_KEY.trim()
    }, { headers: { 'Content-Type': 'application/json' } });

    const token = authResponse.data.accessToken;
    const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

    // Trigger Report Generation (this is async - data will come via webhook)
    console.log("   > Triggering Report Generation (Async)...");
    try {
      await axios.post(`${KLAVI_BASE}/personal/institution-data`, {
        linkId: itemId,
        taxId: "58427193807",
        products: ["pf_checking_account", "pf_credit_card", "pf_investment"],
      }, { headers });
      console.log("   > Report generation triggered successfully.");
    } catch (err) {
      console.error("   > Trigger Warning:", err.response?.data || err.message);
    }

    // Return empty with a message - data will come via webhook
    res.json({
      accounts: [],
      transactions: [],
      source: 'pending',
      message: 'Dados ainda não disponíveis. Por favor, aguarde o processamento do banco e tente novamente em alguns segundos.'
    });

  } catch (error) {
    console.error('Klavi Sync Error Details:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to sync data', details: error.response?.data });
  }
});


// 3. Webhook - Receive and store Klavi data
router.post('/klavi/webhook', (req, res) => {
  const event = req.body;
  console.log('>>> KLAVI WEBHOOK RECEIVED');

  try {
    // Try to extract linkId from various places in the payload
    let linkId = extractLinkId(event);

    // If no linkId found at root, check if it's nested in data
    if (!linkId && event.data) {
      linkId = extractLinkId(event.data);
    }

    // Try to get linkId from links array (common in Open Finance responses)
    if (!linkId && event.links && Array.isArray(event.links) && event.links.length > 0) {
      linkId = event.links[0].linkId || event.links[0].link_id;
    }

    // Use the stored linkId from create-link if we still don't have one
    if (!linkId && currentKlaviLinkId) {
      linkId = currentKlaviLinkId;
      console.log(`>>> Using stored linkId from create-link: ${linkId}`);
    }

    // Fallback: use companyCnpj as stable identifier
    if (!linkId && (event.creditCards || event.checkingAccounts || event.savingsAccounts)) {
      const firstItem = event.creditCards?.[0] || event.checkingAccounts?.[0] || event.savingsAccounts?.[0];
      if (firstItem?.companyCnpj) {
        linkId = `cnpj_${firstItem.companyCnpj}`;
      }
    }

    if (!linkId) {
      console.log('>>> Warning: No linkId found, using timestamp key');
      linkId = `unknown_${Date.now()}`;
    }

    console.log(`>>> Processing webhook data for linkId: ${linkId}`);

    // Get existing data for this linkId (to MERGE, not overwrite)
    const existingData = klaviDataStore.get(linkId) || {
      creditCards: [],
      checkingAccounts: [],
      savingsAccounts: [],
      investments: [],
    };

    // Extract new data from this webhook
    const newCreditCards = event.creditCards || event.data?.creditCards || [];
    const newCheckingAccounts = event.checkingAccounts || event.data?.checkingAccounts || [];
    const newSavingsAccounts = event.savingsAccounts || event.data?.savingsAccounts || [];
    const newInvestments = event.investments || event.data?.investments || [];

    // Helper to deduplicate and merge by key
    const mergeByKey = (existing, newItems, keyFn) => {
      const map = new Map();
      
      // Initialize with existing items
      existing.forEach(item => {
         const key = keyFn(item);
         if (key) map.set(key, item);
      });

      // Merge new items
      newItems.forEach(newItem => {
        const key = keyFn(newItem);
        if (!key) return;

        const existingItem = map.get(key);
        if (existingItem) {
           // Merge logic: New data overrides old data, BUT...
           const merged = { ...existingItem, ...newItem };
           
           // Preserve transactions if new item doesn't have them (or has empty list while old had data)
           const hasNewTxs = (newItem.transactions && newItem.transactions.length > 0) || (newItem.transactionDetails && newItem.transactionDetails.length > 0);
           const hasOldTxs = (existingItem.transactions && existingItem.transactions.length > 0) || (existingItem.transactionDetails && existingItem.transactionDetails.length > 0);
           
           if (!hasNewTxs && hasOldTxs) {
              // console.log(`>>> Preserving transactions for ${key} (New update missing txs)`);
              if (existingItem.transactions) merged.transactions = existingItem.transactions;
              if (existingItem.transactionDetails) merged.transactionDetails = existingItem.transactionDetails;
           }
           
           // Also preserve openStatement/closedStatements for credit cards
           if (!newItem.openStatement && existingItem.openStatement) {
              merged.openStatement = existingItem.openStatement;
           }
           if ((!newItem.closedStatements || newItem.closedStatements.length === 0) && existingItem.closedStatements && existingItem.closedStatements.length > 0) {
              merged.closedStatements = existingItem.closedStatements;
           }

           map.set(key, merged);
        } else {
           map.set(key, newItem);
        }
      });
      
      return Array.from(map.values());
    };

    // Merge and deduplicate data
    const mergedData = {
      receivedAt: new Date().toISOString(),
      rawPayload: event,
      creditCards: mergeByKey(
        existingData.creditCards,
        newCreditCards,
        (c) => `${c.companyCnpj}_${c.name || c.creditCardNetwork}`
      ),
      checkingAccounts: mergeByKey(
        existingData.checkingAccounts,
        newCheckingAccounts,
        (a) => `${a.companyCnpj}_${a.number}_${a.branchCode}`
      ),
      savingsAccounts: mergeByKey(
        existingData.savingsAccounts,
        newSavingsAccounts,
        (a) => `${a.companyCnpj}_${a.number}_${a.branchCode}`
      ),
      investments: mergeByKey(
        existingData.investments,
        newInvestments,
        (i) => `${i.companyCnpj}_${i.name || i.id}`
      ),
    };

    klaviDataStore.set(linkId, mergedData);
    console.log(`>>> MERGED webhook data for linkId: ${linkId}`);
    console.log(`>>> Credit Cards total: ${mergedData.creditCards.length} (new: ${newCreditCards.length})`);
    console.log(`>>> Checking Accounts total: ${mergedData.checkingAccounts.length} (new: ${newCheckingAccounts.length})`);
    console.log(`>>> Savings Accounts total: ${mergedData.savingsAccounts.length} (new: ${newSavingsAccounts.length})`);
    console.log(`>>> Current store size: ${klaviDataStore.size} entries`);

    // Debug: Log the structure of the raw payload to understand where data is
    const payloadKeys = Object.keys(event);
    console.log(`>>> Payload root keys: ${payloadKeys.join(', ')}`);
    if (event.data) {
      console.log(`>>> Payload data keys: ${Object.keys(event.data).join(', ')}`);
    }


    // Also store with any alternative keys that might be used
    if (event.consent_id) {
      klaviDataStore.set(event.consent_id, mergedData);
      console.log(`>>> Also stored with consent_id: ${event.consent_id}`);
    }

    // Also store with currentKlaviLinkId if different from extracted linkId
    if (currentKlaviLinkId && currentKlaviLinkId !== linkId) {
      klaviDataStore.set(currentKlaviLinkId, mergedData);
      console.log(`>>> Also stored with currentKlaviLinkId: ${currentKlaviLinkId}`);
    }

  } catch (err) {
    console.error('>>> Error processing webhook:', err.message);
  }

  res.status(200).send('OK');
});

// Debug endpoint to see stored data (remove in production)
router.get('/klavi/debug/:linkId', (req, res) => {
  const { linkId } = req.params;
  const data = klaviDataStore.get(linkId);

  if (data) {
    res.json({
      found: true,
      linkId,
      receivedAt: data.receivedAt,
      creditCardsCount: data.creditCards?.length || 0,
      checkingAccountsCount: data.checkingAccounts?.length || 0,
      // Expose full checking accounts for debugging
      checkingAccounts: data.checkingAccounts,
      // Expose checking account transactions for debugging
      checkingAccountTransactions: (data.checkingAccounts || []).flatMap(acc => 
        (acc.transactions || acc.transactionDetails || []).slice(0, 50)
      ),
      // Show raw data for debugging
      rawPayloadKeys: Object.keys(data.rawPayload || {}),
    });
  } else {
    res.json({
      found: false,
      linkId,
      availableKeys: Array.from(klaviDataStore.keys())
    });
  }
});

// Debug endpoint to see ALL stored data
router.get('/klavi/debug-all', (req, res) => {
  const allData = [];
  for (const [key, value] of klaviDataStore.entries()) {
    allData.push({
      key,
      receivedAt: value.receivedAt,
      creditCardsCount: value.creditCards?.length || 0,
      checkingAccountsCount: value.checkingAccounts?.length || 0,
      savingsAccountsCount: value.savingsAccounts?.length || 0,
      rawPayloadKeys: Object.keys(value.rawPayload || {}),
      // Show first credit card structure if available
      firstCreditCard: value.creditCards?.[0] ? Object.keys(value.creditCards[0]) : null,
      firstCheckingAccount: value.checkingAccounts?.[0] ? Object.keys(value.checkingAccounts[0]) : null,
    });
  }
  res.json({
    totalEntries: klaviDataStore.size,
    entries: allData
  });
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
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
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
    // Send to recipients
    // For bulk, using BCC is often better, or loop.
    // Here we will loop to simulate individual "To" fields which is more personal,
    // but in high volume production, use a bulk service.
    
    // NOTE: If using Gmail free tier, there are strict limits (e.g. 500/day).
    
    const sendPromises = recipients.map(email => {
       return smtpTransporter.sendMail({
          from: process.env.SMTP_FROM || `"Controlar+" <${process.env.SMTP_USER}>`,
          to: email,
          subject: subject,
          html: htmlTemplate,
          text: body // Fallback plain text
       });
    });

    // Wait for all (or handle errors individually to not fail batch)
    const results = await Promise.allSettled(sendPromises);
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected');
    const failCount = failures.length;

    console.log(`>>> Email Campaign Sent: ${successCount} success, ${failCount} failed.`);
    
    if (failCount > 0) {
        console.error(">>> First failure reason:", failures[0].reason);
    }

    // Determine status code
    if (successCount === 0 && failCount > 0) {
        // Total failure
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

export default router;