/**
 * Script para encontrar transações COM nomes para entender o padrão
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

async function findTransactionsWithNames() {
    console.log('\n========================================');
    console.log('🔍 BUSCANDO TRANSAÇÕES COM NOMES DISPONÍVEIS');
    console.log('========================================\n');

    const usersSnapshot = await db.collection('users').get();

    let samplesWithNames = 0;
    let samplesWithoutNames = 0;
    let totalChecked = 0;

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        const txSnapshot = await db
            .collection('users')
            .doc(userId)
            .collection('transactions')
            .limit(200)
            .get();

        for (const txDoc of txSnapshot.docs) {
            const txData = txDoc.data();
            const raw = txData.pluggyRaw;

            if (!raw || !raw.paymentData) continue;

            const pd = raw.paymentData;
            const hasPayerName = pd.payer?.name && pd.payer.name.trim().length > 0;
            const hasReceiverName = pd.receiver?.name && pd.receiver.name.trim().length > 0;

            totalChecked++;

            if (hasPayerName || hasReceiverName) {
                samplesWithNames++;

                if (samplesWithNames <= 10) {
                    console.log(`\n✅ TRANSAÇÃO COM NOME #${samplesWithNames}:`);
                    console.log(`   description: "${raw.description}"`);
                    console.log(`   descriptionRaw: "${raw.descriptionRaw || 'N/A'}"`);
                    console.log(`   payer.name: "${pd.payer?.name || 'N/A'}"`);
                    console.log(`   receiver.name: "${pd.receiver?.name || 'N/A'}"`);
                    console.log(`   paymentMethod: "${pd.paymentMethod}"`);
                    console.log(`   date: ${raw.date}`);
                }
            } else {
                samplesWithoutNames++;

                // Mostrar algumas sem nome para comparar
                if (samplesWithoutNames <= 3) {
                    console.log(`\n❌ TRANSAÇÃO SEM NOME #${samplesWithoutNames}:`);
                    console.log(`   description: "${raw.description}"`);
                    console.log(`   descriptionRaw: "${raw.descriptionRaw || 'N/A'}"`);
                    console.log(`   paymentMethod: "${pd.paymentMethod}"`);
                    console.log(`   date: ${raw.date}`);
                }
            }
        }
    }

    console.log('\n========================================');
    console.log('📊 RESUMO');
    console.log('========================================');
    console.log(`Total verificadas: ${totalChecked}`);
    console.log(`Com nome (payer ou receiver): ${samplesWithNames} (${(samplesWithNames / totalChecked * 100).toFixed(1)}%)`);
    console.log(`Sem nome: ${samplesWithoutNames} (${(samplesWithoutNames / totalChecked * 100).toFixed(1)}%)`);
    console.log('========================================\n');

    process.exit(0);
}

findTransactionsWithNames().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
