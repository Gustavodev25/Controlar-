/**
 * Pluggy Sync Test Script
 *
 * Este script testa a sincronização com a API do Pluggy diretamente.
 * Use para debugar problemas de conexão e verificar os dados retornados.
 *
 * Uso:
 *   node test_pluggy_sync.js <itemId>
 *
 * Exemplo:
 *   node test_pluggy_sync.js abc123-def456
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PLUGGY_API_URL = 'https://api.pluggy.ai';
const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID || 'd93b0176-0cd8-4563-b9c1-bcb9c6e510bd';
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET || '2b45852a-9638-4677-8232-6b2da7c54967';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function testPluggySync(itemId) {
  console.log('\n' + '='.repeat(70));
  console.log('PLUGGY SYNC TEST');
  console.log('='.repeat(70));
  console.log(`Item ID: ${itemId}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(70) + '\n');

  try {
    // Step 1: Authenticate
    console.log('[STEP 1] Authenticating with Pluggy...');
    const authResponse = await axios.post(`${PLUGGY_API_URL}/auth`, {
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET
    });
    const apiKey = authResponse.data.apiKey;
    const headers = { 'X-API-KEY': apiKey };
    console.log('✓ Authentication successful\n');

    // Step 2: Get Item Details
    console.log('[STEP 2] Fetching item details...');
    const itemResponse = await axios.get(`${PLUGGY_API_URL}/items/${itemId}`, { headers });
    const item = itemResponse.data;

    console.log('\nITEM DETAILS:');
    console.log(JSON.stringify({
      id: item.id,
      status: item.status,
      connector: {
        id: item.connector?.id,
        name: item.connector?.name,
        type: item.connector?.type,
        products: item.connector?.products
      },
      products: item.products,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }, null, 2));

    // Step 3: Get Consents
    console.log('\n[STEP 3] Fetching consents...');
    try {
      const consentsResponse = await axios.get(`${PLUGGY_API_URL}/consents?itemId=${itemId}`, { headers });
      const consents = consentsResponse.data.results || [];
      console.log(`Found ${consents.length} consent(s)`);
      consents.forEach((c, i) => {
        console.log(`\nConsent ${i + 1}:`);
        console.log(JSON.stringify({
          id: c.id,
          status: c.status,
          products: c.products,
          permissions: c.permissions,
          expiresAt: c.expiresAt
        }, null, 2));
      });
    } catch (e) {
      console.log('Could not fetch consents:', e.message);
    }

    // Step 4: Get ALL Accounts
    console.log('\n[STEP 4] Fetching ALL accounts...');
    const accountsResponse = await axios.get(`${PLUGGY_API_URL}/accounts`, {
      headers,
      params: { itemId }
    });
    const accounts = accountsResponse.data.results || [];

    console.log(`\nTotal accounts found: ${accounts.length}`);
    console.log('\nDETAILED ACCOUNT DATA:');

    accounts.forEach((acc, i) => {
      console.log(`\n--- Account ${i + 1}/${accounts.length} ---`);
      console.log(JSON.stringify({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        subtype: acc.subtype,
        balance: acc.balance,
        currencyCode: acc.currencyCode,
        number: acc.number,
        hasBankData: !!acc.bankData,
        hasCreditData: !!acc.creditData,
        bankData: acc.bankData || null,
        creditData: acc.creditData || null
      }, null, 2));
    });

    // Step 5: Fetch accounts by TYPE
    console.log('\n[STEP 5] Fetching accounts by type...');

    // BANK type
    try {
      const bankResponse = await axios.get(`${PLUGGY_API_URL}/accounts`, {
        headers,
        params: { itemId, type: 'BANK' }
      });
      console.log(`\nBANK type accounts: ${bankResponse.data.results?.length || 0}`);
      (bankResponse.data.results || []).forEach(acc => {
        console.log(`  - ${acc.name} | Subtype: ${acc.subtype} | Balance: ${acc.balance}`);
      });
    } catch (e) {
      console.log('Error fetching BANK accounts:', e.message);
    }

    // CREDIT type
    try {
      const creditResponse = await axios.get(`${PLUGGY_API_URL}/accounts`, {
        headers,
        params: { itemId, type: 'CREDIT' }
      });
      console.log(`\nCREDIT type accounts: ${creditResponse.data.results?.length || 0}`);
      (creditResponse.data.results || []).forEach(acc => {
        console.log(`  - ${acc.name} | Subtype: ${acc.subtype} | Balance: ${acc.balance}`);
      });
    } catch (e) {
      console.log('Error fetching CREDIT accounts:', e.message);
    }

    // Step 6: Fetch transactions for each account
    console.log('\n[STEP 6] Fetching transactions for each account...');

    for (const acc of accounts) {
      console.log(`\n--- Transactions for: ${acc.name} (${acc.type}/${acc.subtype}) ---`);
      console.log(`Account ID: ${acc.id}`);

      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 90);

      const toString = toDate.toISOString().split('T')[0];
      const fromString = fromDate.toISOString().split('T')[0];

      // Attempt 1: With date filter
      console.log(`\nAttempt 1: With date filter (${fromString} to ${toString})`);
      try {
        const txResponse = await axios.get(`${PLUGGY_API_URL}/transactions`, {
          headers,
          params: {
            accountId: acc.id,
            from: fromString,
            to: toString,
            pageSize: 100
          }
        });

        const txs = txResponse.data.results || [];
        console.log(`Found ${txs.length} transactions (Total: ${txResponse.data.total})`);

        if (txs.length > 0) {
          console.log('\nSample transactions:');
          txs.slice(0, 5).forEach((tx, i) => {
            console.log(`  ${i + 1}. ${tx.description?.substring(0, 40)}... | ${tx.amount} | ${tx.date} | ${tx.type}`);
          });
        }
      } catch (e) {
        console.log('Error:', e.response?.data || e.message);
      }

      // Attempt 2: Without date filter
      console.log(`\nAttempt 2: Without date filter`);
      try {
        const txResponseNoDate = await axios.get(`${PLUGGY_API_URL}/transactions`, {
          headers,
          params: {
            accountId: acc.id,
            pageSize: 100
          }
        });

        const txs = txResponseNoDate.data.results || [];
        console.log(`Found ${txs.length} transactions (Total: ${txResponseNoDate.data.total})`);

        if (txs.length > 0 && txs.length !== (await axios.get(`${PLUGGY_API_URL}/transactions`, {
          headers,
          params: { accountId: acc.id, from: fromString, to: toString, pageSize: 100 }
        }).catch(() => ({ data: { results: [] } }))).data.results.length) {
          console.log('\nSample transactions:');
          txs.slice(0, 5).forEach((tx, i) => {
            console.log(`  ${i + 1}. ${tx.description?.substring(0, 40)}... | ${tx.amount} | ${tx.date} | ${tx.type}`);
          });
        }
      } catch (e) {
        console.log('Error:', e.response?.data || e.message);
      }

      await sleep(500);
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('TEST COMPLETE - SUMMARY');
    console.log('='.repeat(70));
    console.log(`Institution: ${item.connector?.name}`);
    console.log(`Total Accounts: ${accounts.length}`);

    const bankAccounts = accounts.filter(a => a.type === 'BANK');
    const creditAccounts = accounts.filter(a => a.type === 'CREDIT');
    const checkingAccounts = accounts.filter(a => a.subtype === 'CHECKING_ACCOUNT');
    const savingsAccounts = accounts.filter(a => a.subtype === 'SAVINGS_ACCOUNT');

    console.log(`\nBy Type:`);
    console.log(`  - BANK: ${bankAccounts.length}`);
    console.log(`  - CREDIT: ${creditAccounts.length}`);
    console.log(`\nBy Subtype:`);
    console.log(`  - CHECKING_ACCOUNT: ${checkingAccounts.length}`);
    console.log(`  - SAVINGS_ACCOUNT: ${savingsAccounts.length}`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error:', error.response?.data || error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Get itemId from command line
const itemId = process.argv[2];

if (!itemId) {
  console.log('\n❌ Error: Please provide an itemId');
  console.log('\nUsage: node test_pluggy_sync.js <itemId>');
  console.log('Example: node test_pluggy_sync.js abc123-def456\n');
  process.exit(1);
}

testPluggySync(itemId);
