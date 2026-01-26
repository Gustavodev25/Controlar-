import 'dotenv/config';
import axios from 'axios';
import admin from 'firebase-admin';

const CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const BASE_URL = 'https://api.pluggy.ai';

async function main() {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('Missing Pluggy credentials in .env');
        return;
    }

    // 0. Init Firebase
    if (!admin.apps.length) {
        try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('Firebase Initialized.');
        } catch (e) {
            console.error('Failed to init Firebase:', e.message);
            return;
        }
    }

    try {
        // 1. Authenticate Pluggy
        console.log('Authenticating Pluggy...');
        const authRes = await axios.post(`${BASE_URL}/auth`, {
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET
        });
        const apiKey = authRes.data.apiKey;
        console.log('Authenticated.');

        // 2. Find Item IDs from Firestore
        console.log('Scanning Firestore for items...');
        const db = admin.firestore();
        const usersSnap = await db.collection('users').get();

        const itemIds = new Set();

        for (const userDoc of usersSnap.docs) {
            const accountsSnap = await db.collection('users').doc(userDoc.id).collection('accounts').get();
            accountsSnap.forEach(doc => {
                const data = doc.data();
                if (data.itemId) itemIds.add(data.itemId);
            });
        }

        console.log(`Found ${itemIds.size} unique Item IDs in Firestore.`);

        // 3. Check Transactions for each Item
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const fromDate = oneMonthAgo.toISOString().split('T')[0];

        for (const itemId of itemIds) {
            console.log(`\nChecking Item: ${itemId}`);
            try {
                // List Accounts for Item
                const accRes = await axios.get(`${BASE_URL}/accounts?itemId=${itemId}`, {
                    headers: { 'X-API-KEY': apiKey }
                });
                const accounts = accRes.data.results || [];
                console.log(`  Found ${accounts.length} accounts.`);

                for (const acc of accounts) {
                    console.log(`    Checking account ${acc.name} (${acc.id})...`);

                    // Only check Credit Cards or Checking
                    try {
                        const txRes = await axios.get(`${BASE_URL}/transactions?accountId=${acc.id}&from=${fromDate}&pageSize=500`, {
                            headers: { 'X-API-KEY': apiKey }
                        });
                        const transactions = txRes.data.results || [];

                        const matches = transactions.filter(t =>
                            (t.description || '').toUpperCase().includes('TKT360')
                        );

                        if (matches.length > 0) {
                            console.log(`\n!!! FOUND ${matches.length} MATCHES IN ACCOUNT ${acc.name} !!!`);
                            matches.forEach((m, i) => {
                                console.log(`\nMatch #${i + 1}:`);
                                console.log(`ID: ${m.id}`);
                                console.log(`Date: ${m.date}`);
                                console.log(`Description: ${m.description}`);
                                console.log(`Amount: ${m.amount} (Type of value: ${typeof m.amount})`);
                                console.log(`Type: ${m.type}`); // CRITICAL
                                console.log(`Status: ${m.status}`);
                                console.log(`Category: ${m.category}`);
                                console.log(`PaymentData:`, m.paymentData);
                                console.log(`Raw:`, JSON.stringify(m, null, 2));
                            });
                        }
                    } catch (err) {
                        console.error(`    Error fetching tx:`, err.message);
                    }
                }
            } catch (err) {
                console.error(`  Error processing item ${itemId}:`, err.message);
            }
        }

    } catch (error) {
        console.error('Script error:', error.response?.data || error.message);
    }
}

main();
