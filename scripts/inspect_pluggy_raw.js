/**
 * Script para ver a estrutura COMPLETA do paymentData
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

async function inspectPaymentData() {
    console.log('\n========================================');
    console.log('🔍 INSPECIONANDO ESTRUTURA COMPLETA DO PLUGGYRAW');
    console.log('========================================\n');

    const usersSnapshot = await db.collection('users').get();
    let samples = 0;

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        const txSnapshot = await db
            .collection('users')
            .doc(userId)
            .collection('transactions')
            .orderBy('date', 'desc')
            .limit(50)
            .get();

        for (const txDoc of txSnapshot.docs) {
            const txData = txDoc.data();
            const descLower = (txData.description || '').toLowerCase();

            // Apenas PIX genéricos
            if (descLower.includes('pix') && txData.pluggyRaw) {
                samples++;

                if (samples <= 5) {
                    console.log(`\n${'='.repeat(50)}`);
                    console.log(`📝 AMOSTRA #${samples}`);
                    console.log(`${'='.repeat(50)}`);
                    console.log(`Descrição salva: "${txData.description}"`);
                    console.log(`Data: ${txData.date}`);
                    console.log(`\n--- pluggyRaw COMPLETO ---`);

                    const raw = txData.pluggyRaw;
                    console.log(`description: "${raw.description}"`);
                    console.log(`descriptionRaw: "${raw.descriptionRaw || 'NULL'}"`);
                    console.log(`type: "${raw.type}"`);
                    console.log(`amount: ${raw.amount}`);
                    console.log(`category: "${raw.category}"`);
                    console.log(`operationType: "${raw.operationType || 'NULL'}"`);

                    console.log(`\n--- paymentData ---`);
                    if (raw.paymentData) {
                        console.log(JSON.stringify(raw.paymentData, null, 2));
                    } else {
                        console.log('NULL');
                    }

                    console.log(`\n--- merchant ---`);
                    if (raw.merchant) {
                        console.log(JSON.stringify(raw.merchant, null, 2));
                    } else {
                        console.log('NULL');
                    }
                }
            }
        }

        if (samples >= 5) break;
    }

    console.log('\n========================================\n');
    process.exit(0);
}

inspectPaymentData().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
