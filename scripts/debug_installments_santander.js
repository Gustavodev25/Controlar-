/**
 * Script para debugar dados de parcelamento entre Santander e Nubank
 * 
 * Objetivo: Verificar se o Santander está enviando os campos installmentNumber
 * e totalInstallments no creditCardMetadata
 */

import 'dotenv/config';
import axios from 'axios';
import admin from 'firebase-admin';

const CLIENT_ID = process.env.PLUGGY_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET?.trim();
const BASE_URL = 'https://api.pluggy.ai';

async function main() {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('❌ Missing Pluggy credentials in .env');
        return;
    }

    // Init Firebase
    if (!admin.apps.length) {
        try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Initialized.');
        } catch (e) {
            console.error('❌ Failed to init Firebase:', e.message);
            return;
        }
    }

    try {
        // 1. Authenticate Pluggy
        console.log('🔐 Authenticating Pluggy...');
        const authRes = await axios.post(`${BASE_URL}/auth`, {
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET
        });
        const apiKey = authRes.data.apiKey;
        console.log('✅ Authenticated.');

        // 2. Find Item IDs from Firestore
        console.log('📂 Scanning Firestore for accounts...');
        const db = admin.firestore();
        const usersSnap = await db.collection('users').get();

        const itemAccounts = []; // { itemId, accountId, institution, accountName }

        for (const userDoc of usersSnap.docs) {
            const accountsSnap = await db.collection('users').doc(userDoc.id).collection('accounts').get();
            accountsSnap.forEach(doc => {
                const data = doc.data();
                if (data.itemId && data.type?.toUpperCase().includes('CREDIT')) {
                    itemAccounts.push({
                        itemId: data.itemId,
                        accountId: doc.id,
                        institution: (data.institution || data.name || 'Unknown').toLowerCase(),
                        accountName: data.name || data.marketingName || 'Credit Card'
                    });
                }
            });
        }

        console.log(`📊 Found ${itemAccounts.length} credit card accounts.\n`);

        // 3. Group by Institution
        const santanderAccounts = itemAccounts.filter(a =>
            a.institution.includes('santander')
        );
        const nubankAccounts = itemAccounts.filter(a =>
            a.institution.includes('nubank') || a.institution.includes('nu ')
        );

        console.log(`🏦 Santander accounts: ${santanderAccounts.length}`);
        console.log(`💜 Nubank accounts: ${nubankAccounts.length}\n`);

        // 4. Analyze recent transactions from each
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const fromDate = threeMonthsAgo.toISOString().split('T')[0];

        const analyzeAccount = async (account, label) => {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🔍 Analyzing ${label}: ${account.accountName}`);
            console.log(`   Institution: ${account.institution}`);
            console.log(`   Account ID: ${account.accountId}`);
            console.log('='.repeat(60));

            try {
                const txRes = await axios.get(`${BASE_URL}/transactions`, {
                    params: {
                        accountId: account.accountId,
                        from: fromDate,
                        pageSize: 100
                    },
                    headers: { 'X-API-KEY': apiKey }
                });

                const transactions = txRes.data.results || [];
                console.log(`📜 Total transactions: ${transactions.length}`);

                // Separate installments from regular
                const withInstallmentMeta = [];
                const withInstallmentDesc = [];
                const regular = [];

                transactions.forEach(tx => {
                    const meta = tx.creditCardMetadata || {};
                    const hasMetaInstallment = meta.totalInstallments && meta.totalInstallments > 1;
                    const descMatch = (tx.description || '').match(/(\d+)\s*\/\s*(\d+)/);

                    if (hasMetaInstallment) {
                        withInstallmentMeta.push(tx);
                    } else if (descMatch && parseInt(descMatch[2]) > 1) {
                        withInstallmentDesc.push(tx);
                    } else {
                        regular.push(tx);
                    }
                });

                console.log(`\n📊 Summary:`);
                console.log(`   With installment METADATA: ${withInstallmentMeta.length}`);
                console.log(`   With installment in DESCRIPTION only: ${withInstallmentDesc.length}`);
                console.log(`   Regular (single purchase): ${regular.length}`);

                // Show samples of each category
                if (withInstallmentMeta.length > 0) {
                    console.log(`\n💳 SAMPLE - Installments via METADATA (detected correctly):`);
                    withInstallmentMeta.slice(0, 3).forEach((tx, i) => {
                        const meta = tx.creditCardMetadata || {};
                        console.log(`   [${i + 1}] "${tx.description}"`);
                        console.log(`       Date: ${tx.date?.split('T')[0]}`);
                        console.log(`       Amount: R$ ${tx.amount?.toFixed(2)}`);
                        console.log(`       installmentNumber: ${meta.installmentNumber}`);
                        console.log(`       totalInstallments: ${meta.totalInstallments}`);
                        console.log(`       totalAmount: ${meta.totalAmount}`);
                    });
                }

                if (withInstallmentDesc.length > 0) {
                    console.log(`\n⚠️ SAMPLE - Installments ONLY in DESCRIPTION (missing metadata):`);
                    withInstallmentDesc.slice(0, 5).forEach((tx, i) => {
                        const meta = tx.creditCardMetadata || {};
                        console.log(`   [${i + 1}] "${tx.description}"`);
                        console.log(`       Date: ${tx.date?.split('T')[0]}`);
                        console.log(`       Amount: R$ ${tx.amount?.toFixed(2)}`);
                        console.log(`       creditCardMetadata: ${JSON.stringify(meta)}`);
                    });
                }

                return {
                    institution: account.institution,
                    accountName: account.accountName,
                    total: transactions.length,
                    withInstallmentMeta: withInstallmentMeta.length,
                    withInstallmentDesc: withInstallmentDesc.length,
                    regular: regular.length,
                    metaSamples: withInstallmentMeta.slice(0, 2).map(tx => ({
                        desc: tx.description,
                        meta: tx.creditCardMetadata
                    })),
                    descOnlySamples: withInstallmentDesc.slice(0, 5).map(tx => ({
                        desc: tx.description,
                        meta: tx.creditCardMetadata,
                        fullTx: tx
                    }))
                };

            } catch (err) {
                console.error(`   ❌ Error: ${err.message}`);
                return null;
            }
        };

        // Analyze both
        const results = [];

        for (const acc of santanderAccounts.slice(0, 2)) {
            const result = await analyzeAccount(acc, 'SANTANDER');
            if (result) results.push(result);
        }

        for (const acc of nubankAccounts.slice(0, 2)) {
            const result = await analyzeAccount(acc, 'NUBANK');
            if (result) results.push(result);
        }

        // Final Summary
        console.log(`\n${'='.repeat(60)}`);
        console.log('📋 FINAL COMPARISON');
        console.log('='.repeat(60));

        results.forEach(r => {
            const metaRate = r.total > 0 ? ((r.withInstallmentMeta / r.total) * 100).toFixed(1) : 0;
            const descOnlyRate = r.total > 0 ? ((r.withInstallmentDesc / r.total) * 100).toFixed(1) : 0;

            console.log(`\n${r.institution.toUpperCase()} - ${r.accountName}:`);
            console.log(`   Total transactions: ${r.total}`);
            console.log(`   ✅ With metadata installments: ${r.withInstallmentMeta} (${metaRate}%)`);
            console.log(`   ⚠️  Description-only installments: ${r.withInstallmentDesc} (${descOnlyRate}%)`);

            if (r.descOnlySamples.length > 0) {
                console.log(`   📝 Samples with missing metadata:`);
                r.descOnlySamples.slice(0, 3).forEach(s => {
                    console.log(`      - "${s.desc}"`);
                });
            }
        });

        // Check if Santander has the issue
        const santanderResults = results.filter(r => r.institution.includes('santander'));
        const nubankResults = results.filter(r => r.institution.includes('nubank'));

        console.log(`\n${'='.repeat(60)}`);
        console.log('🔍 DIAGNOSIS');
        console.log('='.repeat(60));

        const santanderDescOnly = santanderResults.reduce((sum, r) => sum + r.withInstallmentDesc, 0);
        const nubankDescOnly = nubankResults.reduce((sum, r) => sum + r.withInstallmentDesc, 0);

        if (santanderDescOnly > 0 && nubankDescOnly === 0) {
            console.log(`\n❗ CONFIRMED: Santander is NOT sending installment metadata!`);
            console.log(`   Santander has ${santanderDescOnly} transactions with installments in description only.`);
            console.log(`   Nubank has ${nubankDescOnly} (all have proper metadata).`);
            console.log(`\n💡 SOLUTION: The system should use the description pattern X/Y`);
            console.log(`   as a fallback when creditCardMetadata is missing.`);
        } else if (santanderDescOnly === 0) {
            console.log(`\n✅ Santander appears to be sending metadata correctly.`);
            console.log(`   Check if the issue is in how the data is processed or stored.`);
        } else {
            console.log(`\n🔄 Both banks have some transactions without proper metadata.`);
            console.log(`   This may be a Pluggy API limitation for some transactions.`);
        }

    } catch (error) {
        console.error('❌ Script error:', error.response?.data || error.message);
    }

    process.exit(0);
}

main();
