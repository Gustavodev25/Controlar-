
import { firebaseAdmin } from '../api/firebaseAdmin.js';
import { loadEnv } from '../api/env.js';

loadEnv();

async function debug() {
    console.log("Initializing Firebase...");
    const db = firebaseAdmin.firestore();

    const targetUser = 'uHulehuyfoaiupWyoq1VFtVr9qf2';
    console.log(`\nDebugging transactions for user: ${targetUser}`);

    // Keywords from user complaint
    const keywords = ['pizzaria', 'forno', 'ed mais', 'mercado', 'steam', 'pichau'];

    const ccRef = db.collection('users').doc(targetUser).collection('creditCardTransactions');
    const snapshot = await ccRef.get();

    const found = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        const desc = (data.description || '').toLowerCase();

        if (keywords.some(k => desc.includes(k))) {
            found.push({
                id: doc.id,
                description: data.description,
                date: data.date,
                amount: data.amount,
                type: data.type,
                invoiceMonthKey: data.invoiceMonthKey,
                manualInvoiceMonth: data.manualInvoiceMonth,
                category: data.category
            });
        }
    });

    found.sort((a, b) => b.date.localeCompare(a.date));

    console.log("\n--- RELEVANT TRANSACTIONS (Dec 2025 - Jan 2026) ---");
    found
        .filter(tx => tx.date >= '2025-11-01' && tx.date <= '2026-02-28')
        .forEach(tx => {
            console.log(`[${tx.date}] ${tx.description} | R$ ${tx.amount} | Key: ${tx.invoiceMonthKey} | Manual: ${tx.manualInvoiceMonth || 'N/A'}`);
        });
}

debug().catch(console.error);
