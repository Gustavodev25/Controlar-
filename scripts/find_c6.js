/**
 * Script simples para encontrar contas C6 no Firebase
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || "financeiro-609e1"
    });
}

const db = admin.firestore();

async function findC6() {
    console.log('\n🔍 BUSCANDO C6 BANK...\n');

    const usersSnapshot = await db.collection('users').get();
    let c6AccountsFound = [];
    let c6TransactionsFound = [];

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const userName = userData.email || userData.name || userId.slice(0, 10);

        // Check accounts
        const accountsSnapshot = await db.collection('users').doc(userId).collection('accounts').get();

        for (const accDoc of accountsSnapshot.docs) {
            const accData = accDoc.data();
            const accStr = JSON.stringify(accData).toLowerCase();

            if (accStr.includes('c6')) {
                c6AccountsFound.push({
                    userId: userId.slice(0, 10),
                    userName,
                    accountId: accDoc.id,
                    name: accData.name,
                    type: accData.type,
                    connectorInfo: accData.connector?.name || accData.connectorName || 'N/A'
                });
            }
        }

        // Check transactions for C6 mention
        const txSnapshot = await db.collection('users').doc(userId).collection('transactions').limit(20).get();

        for (const txDoc of txSnapshot.docs) {
            const txData = txDoc.data();
            const desc = (txData.description || '').toLowerCase();

            // Check for common C6 patterns
            if (desc.includes('c6') || desc.includes('pix recebido') || desc.includes('transf enviada pix')) {
                const hasPaymentData = !!txData.pluggyRaw?.paymentData;
                c6TransactionsFound.push({
                    userId: userId.slice(0, 10),
                    userName,
                    accountId: txData.accountId?.slice(0, 10),
                    description: txData.description?.slice(0, 50),
                    hasPaymentData
                });

                if (c6TransactionsFound.length >= 10) break; // Limit samples
            }
        }

        if (c6TransactionsFound.length >= 10) break;
    }

    console.log('=== CONTAS C6 ENCONTRADAS ===');
    console.log(`Total: ${c6AccountsFound.length}`);
    c6AccountsFound.forEach((acc, i) => {
        console.log(`\n${i + 1}. ${acc.userName}`);
        console.log(`   Account: ${acc.accountId.slice(0, 15)}...`);
        console.log(`   Name: ${acc.name}`);
        console.log(`   Connector: ${acc.connectorInfo}`);
    });

    console.log('\n\n=== TRANSAÇÕES TIPO PIX/C6 ENCONTRADAS ===');
    console.log(`Total: ${c6TransactionsFound.length}`);
    c6TransactionsFound.forEach((tx, i) => {
        console.log(`\n${i + 1}. ${tx.userName}`);
        console.log(`   Account: ${tx.accountId}...`);
        console.log(`   Desc: ${tx.description}`);
        console.log(`   Has paymentData: ${tx.hasPaymentData ? '✅ YES' : '❌ NO'}`);
    });

    console.log('\n');
    process.exit(0);
}

findC6().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
