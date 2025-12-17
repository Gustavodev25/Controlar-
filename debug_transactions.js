import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Pluggy Credentials
const PLUGGY_API_URL = process.env.PLUGGY_API_URL || 'https://api.pluggy.ai';
const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;

async function debugTransactions() {
  console.log('--- STARTING PLUGGY DEBUG ---');
  
  try {
    // 1. Authenticate
    console.log('1. Authenticating...');
    const authResponse = await axios.post(`${PLUGGY_API_URL}/auth`, {
      clientId: PLUGGY_CLIENT_ID.trim(),
      clientSecret: PLUGGY_CLIENT_SECRET.trim()
    });
    
    const apiKey = authResponse.data.apiKey;
    if (!apiKey) throw new Error('No API Key received');
    
    console.log(`   > Auth OK. Key: ${apiKey.substring(0, 10)}...`);
    
    const headers = { 'X-API-KEY': apiKey };

    // 2. List Items
    console.log('2. Listing Items...');
    const itemsResponse = await axios.get(`${PLUGGY_API_URL}/items?clientUserId=kx7nssUhM5eZXk1fm2es4VJfV4p1`, { headers });
    const items = itemsResponse.data.results;
    console.log(`   > Found ${items.length} items.`);

    if (items.length === 0) {
        console.log('   ! No items found. Please connect an account first.');
        return;
    }

    // 3. For each item, list accounts and transactions
    for (const item of items) {
        console.log(`
[ITEM] ID: ${item.id} | Institution: ${item.connector?.name}`);
        
        const accountsResponse = await axios.get(`${PLUGGY_API_URL}/accounts`, { 
            headers,
            params: { itemId: item.id } 
        });
        const accounts = accountsResponse.data.results;
        console.log(`   > Accounts found: ${accounts.length}`);

        for (const acc of accounts) {
            console.log(`   
   [ACCOUNT] ID: ${acc.id} | Name: ${acc.name} | Type: ${acc.type} | Subtype: ${acc.subtype}`);
            
            // Fetch Transactions
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 90);
            const fromString = fromDate.toISOString().split('T')[0];

            try {
                const txResponse = await axios.get(`${PLUGGY_API_URL}/transactions`, { 
                    headers,
                    params: {
                        accountId: acc.id,
                        from: fromString,
                        pageSize: 10
                    }
                });
                
                const txs = txResponse.data.results;
                console.log(`      > Transactions fetched (last 90 days): ${txResponse.data.total}`);
                console.log(`      > First 3 raw transactions:`);
                txs.slice(0, 3).forEach(tx => {
                    console.log(`         - [${tx.date}] ${tx.description} | Amt: ${tx.amount} | Type: ${tx.type} | Cat: ${tx.category}`);
                });

            } catch (err) {
                console.log(`      ! Error fetching transactions: ${err.message}`);
                if (err.response) console.log(JSON.stringify(err.response.data));
            }
        }
    }

  } catch (error) {
    console.error('!!! FATAL ERROR !!!', error.message);
    if (error.response) console.error(JSON.stringify(error.response.data, null, 2));
  }
}

debugTransactions();
