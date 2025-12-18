
import { firebaseAdmin } from '../api/firebaseAdmin.js';
import { loadEnv } from '../api/env.js';
import axios from 'axios';

// Load environment variables
loadEnv({ rootDir: process.cwd() });

const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const PLUGGY_API_URL = process.env.PLUGGY_API_URL || 'https://api.pluggy.ai';

const removeUndefined = (obj) => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(removeUndefined);

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            cleaned[key] = typeof value === 'object' ? removeUndefined(value) : value;
        }
    }
    return cleaned;
};

const getPluggyApiKey = async () => {
    try {
        console.log('>>> Authenticating with Pluggy...');
        const response = await axios.post(
            `${PLUGGY_API_URL}/auth`,
            { clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET },
            { headers: { 'Content-Type': 'application/json' } }
        );
        return response.data.apiKey;
    } catch (error) {
        console.error('>>> Pluggy Auth Failed:', error.response?.data || error.message);
        throw error;
    }
};

const pluggyRequest = async (method, endpoint, apiKey, params = null) => {
    try {
        const response = await axios({
            method,
            url: `${PLUGGY_API_URL}${endpoint}`,
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
            params
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const main = async () => {
    // Wait a bit for firebaseAdmin to initialize (it's top-level await in the module)
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (!firebaseAdmin) {
        console.error('Firebase Admin not initialized.');
        process.exit(1);
    }

    const apiKey = await getPluggyApiKey();
    console.log(`>>> Pluggy API Key acquired.`);

    const db = firebaseAdmin.firestore();
    const usersSnap = await db.collection('users').get();

    console.log(`>>> Found ${usersSnap.size} users.`);

    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        console.log(`>>> Processing user: ${userId}`);

        // Fetch ALL accounts to be safe
        const accountsSnap = await db.collection('users').doc(userId).collection('accounts').get();

        if (accountsSnap.empty) {
            console.log(`    No accounts found.`);
            continue;
        }

        let creditCount = 0;

        for (const accountDoc of accountsSnap.docs) {
            const account = accountDoc.data();
            const accountId = account.id;

            // Robust check for credit card
            const type = (account.type || '').toUpperCase();
            const subtype = (account.subtype || '').toUpperCase();
            const isCredit = account.isCredit === true ||
                type.includes('CREDIT') ||
                subtype.includes('CREDIT') ||
                subtype.includes('CARD');

            if (!isCredit) continue;

            creditCount++;
            console.log(`    Checking account: ${account.name} (ID: ${accountId})`);

            try {
                // Fetch bills
                const billsRes = await pluggyRequest('GET', '/bills', apiKey, { accountId, pageSize: 100 });
                const bills = billsRes.results || [];

                // Find active bill (Open, Closed or Overdue)
                const activeBill = bills
                    .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
                    .find(b => ['OPEN', 'OVERDUE', 'CLOSED'].includes(b.status));

                let newBalance = account.balance;
                let balanceUpdated = false;

                if (activeBill) {
                    newBalance = activeBill.totalAmount;
                    console.log(`    -> Found active bill! Due: ${activeBill.dueDate}, Amount: ${activeBill.totalAmount} (${activeBill.status})`);
                    balanceUpdated = true;
                } else {
                    console.log(`    -> No active bill found. Keeping current balance: ${account.balance}`);
                    if (bills.length > 0) {
                        console.log(`       (Found ${bills.length} other bills: ${bills.map(b => b.status).join(', ')})`);
                    }
                }

                if (balanceUpdated) {
                    await db.collection('users').doc(userId).collection('accounts').doc(accountId).update({
                        balance: newBalance,
                        isCredit: true, // Ensure this flag is set for future
                        lastUpdated: new Date().toISOString()
                    });
                    console.log(`    -> Updated balance in Firestore.`);
                } else if (account.isCredit !== true) {
                    // Update isCredit flag if it was missing
                    await db.collection('users').doc(userId).collection('accounts').doc(accountId).update({
                        isCredit: true
                    });
                    console.log(`    -> Updated isCredit flag only.`);
                }

            } catch (err) {
                console.error(`    -> Error updating account ${accountId}:`, err.response?.data || err.message);
            }
        }

        if (creditCount === 0) {
            console.log(`    No credit accounts found (checked ${accountsSnap.size} total accounts).`);
        }
    }

    console.log('>>> Done.');
    process.exit(0);
};

main();
