import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import twilio from 'twilio';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import geminiHandler from './gemini.js';

dotenv.config();

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

// Helper: Normalize Klavi credit cards to ConnectedAccount format
const normalizeCreditCards = (creditCards, linkId) => {
  if (!creditCards || !Array.isArray(creditCards)) return [];

  return creditCards.map((card, index) => {
    const openStatement = card.openStatement || {};
    const limits = card.limits || {};

    // Calculate current balance from open statement
    const billTotal = parseFloat(openStatement.billTotalAmount?.amount || '0');

    // Get limit info
    const creditLimit = parseFloat(limits.limitAmount?.amount || '0');
    const availableLimit = parseFloat(limits.availableAmount?.amount || '0');

    // Create stable ID based on card properties (not linkId which changes each connection)
    const cardName = card.name || card.creditCardNetwork || `card_${index}`;
    const stableId = `klavi_cc_${card.companyCnpj || 'unknown'}_${cardName.replace(/\s+/g, '_').toLowerCase()}`;

    return {
      id: stableId,
      name: card.name || `Cartão ${card.creditCardNetwork || 'Crédito'}`,
      type: 'CREDIT_CARD',
      subtype: card.productType || 'CREDIT',
      balance: -billTotal, // Negative because it's debt
      currency: 'BRL',
      institution: card.brandName || card.bacenName || 'Instituição',
      itemId: linkId,
      providerId: 'klavi',
      creditLimit: creditLimit,
      availableCreditLimit: availableLimit,
      balanceDueDate: openStatement.dueDate || null,
      balanceCloseDate: openStatement.billingDate || null,
      // Store payment methods info
      paymentMethods: card.paymentMethods || [],
    };
  });
};


// Helper: Normalize Klavi checking/savings accounts to ConnectedAccount format
const normalizeAccounts = (accounts, linkId) => {
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

    return {
      id: stableId,
      name: acc.accountName || acc.name || `Conta ${acc.accountType || acc.type || 'Corrente'}`,
      type: (acc.accountType === 'CONTA_POUPANCA' || acc.type === 'SAVINGS') ? 'SAVINGS' : 'CHECKING',
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
      const accountId = `klavi_cc_${linkId}_${cardIndex}`;

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
      const accountId = `klavi_acc_${linkId}_${accIndex}`;
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
  const amount = parseFloat(tx.brazilianAmount?.amount || tx.amount?.amount || tx.amount || '0');
  const isDebit = tx.creditDebitType === 'DEBITO' || tx.type === 'DEBIT' || amount < 0;

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
  };
};


// Klavi Endpoints



// 1. Create Link (Generate the widget URL)
router.post('/klavi/create-link', async (req, res) => {
  try {
    // Clear old webhook data to start fresh
    klaviDataStore.clear();
    console.log(">>> Cleared webhook data store for new connection");

    dotenv.config();
    // User explicitly requested these keys for SANDBOX
    const ACCESS_KEY = process.env.KLAVI_ACCESS_KEY || "121DEABF-DDD2-4ABB-8185-5348082FCA9D";
    const SECRET_KEY = process.env.KLAVI_SECRET_KEY || "0ED8D6F1-9730-4D1F-BB39-1992186DEF6F";

    // Explicitly requested SANDBOX URL
    const KLAVI_BASE = 'https://api-sandbox.klavi.ai/data/v1';

    const REDIRECT_BASE = 'https://toney-nonreversing-cedrick.ngrok-free.dev';
    const webhookUrl = `${REDIRECT_BASE}/api/klavi/webhook`;

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

    if (linkUrl) {
      res.json({ success: true, url: linkUrl });
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

    // Polling: Wait for data to arrive (max 10 seconds, checking every 500ms)
    let dataResult = checkForData();
    let attempts = 0;
    const maxAttempts = 20; // 20 * 500ms = 10 seconds

    while (!dataResult.hasData && attempts < maxAttempts) {
      console.log(`>>> Waiting for webhook data... attempt ${attempts + 1}/${maxAttempts}`);
      await sleep(500);
      dataResult = checkForData();
      attempts++;
    }

    if (dataResult.hasData) {
      const { allCreditCards, allCheckingAccounts, allSavingsAccounts } = dataResult;

      console.log(`>>> Data found after ${attempts} attempts!`);
      console.log(`>>> Total aggregated data:`);
      console.log(`>>> Credit Cards: ${allCreditCards.length}`);
      console.log(`>>> Checking Accounts: ${allCheckingAccounts.length}`);
      console.log(`>>> Savings Accounts: ${allSavingsAccounts.length}`);

      // Normalize the data
      const creditCardAccounts = normalizeCreditCards(allCreditCards, itemId);
      const checkingAccounts = normalizeAccounts(allCheckingAccounts, itemId);
      const savingsAccounts = normalizeAccounts(allSavingsAccounts, itemId);

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

    // Some Klavi callbacks have the data directly at root level with credit cards
    // In that case, we need to extract from URL params or use a fallback
    if (!linkId && event.creditCards) {
      // Generate a temporary ID based on the first card info
      const firstCard = event.creditCards[0];
      linkId = `temp_${firstCard?.companyCnpj || Date.now()}`;
    }

    if (!linkId) {
      console.log('>>> Warning: No linkId found in webhook payload, storing with timestamp key');
      linkId = `unknown_${Date.now()}`;
    }

    console.log(`>>> Processing webhook data for linkId: ${linkId}`);

    // Store the raw data
    const storedData = {
      receivedAt: new Date().toISOString(),
      rawPayload: event,
      creditCards: event.creditCards || event.data?.creditCards || [],
      checkingAccounts: event.checkingAccounts || event.data?.checkingAccounts || [],
      savingsAccounts: event.savingsAccounts || event.data?.savingsAccounts || [],
      investments: event.investments || event.data?.investments || [],
    };

    klaviDataStore.set(linkId, storedData);
    console.log(`>>> Stored webhook data for linkId: ${linkId}`);
    console.log(`>>> Credit Cards found: ${storedData.creditCards.length}`);
    console.log(`>>> Checking Accounts found: ${storedData.checkingAccounts.length}`);
    console.log(`>>> Current store size: ${klaviDataStore.size} entries`);

    // Debug: Log the structure of the raw payload to understand where data is
    const payloadKeys = Object.keys(event);
    console.log(`>>> Payload root keys: ${payloadKeys.join(', ')}`);
    if (event.data) {
      console.log(`>>> Payload data keys: ${Object.keys(event.data).join(', ')}`);
    }


    // Also store with any alternative keys that might be used
    if (event.consent_id) {
      klaviDataStore.set(event.consent_id, storedData);
      console.log(`>>> Also stored with consent_id: ${event.consent_id}`);
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

export default router;