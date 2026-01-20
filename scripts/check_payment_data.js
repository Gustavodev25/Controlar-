/**
 * Script para verificar transações recentes e ver se têm paymentData
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

// Descrições genéricas
const GENERIC_PATTERNS = [
    'pix recebido',
    'pix enviado',
    'transf enviada pix',
    'transf recebida pix',
    'pix recebido c6',
    'pix enviado c6'
];

async function checkRecentTransactions() {
    console.log('\n========================================');
    console.log('🔍 VERIFICANDO TRANSAÇÕES RECENTES');
    console.log('========================================\n');

    const usersSnapshot = await db.collection('users').get();

    let samplesWithPaymentData = 0;
    let samplesWithoutPaymentData = 0;
    let samplesWithoutPluggyRaw = 0;
    let totalGenericFound = 0;

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const userName = userData.email || userData.name || userId.slice(0, 12);

        // Buscar transações mais recentes
        const txSnapshot = await db
            .collection('users')
            .doc(userId)
            .collection('transactions')
            .orderBy('date', 'desc')
            .limit(100)
            .get();

        for (const txDoc of txSnapshot.docs) {
            const txData = txDoc.data();
            const descLower = (txData.description || '').toLowerCase();

            // Verificar se é descrição genérica
            const isGeneric = GENERIC_PATTERNS.some(p => descLower.includes(p));

            if (isGeneric) {
                totalGenericFound++;

                if (totalGenericFound <= 15) {
                    console.log(`\n📝 Transação Genérica #${totalGenericFound}:`);
                    console.log(`   Usuário: ${userName}`);
                    console.log(`   Desc: "${txData.description}"`);
                    console.log(`   Data: ${txData.date}`);
                    console.log(`   Valor: R$ ${txData.amount}`);

                    if (!txData.pluggyRaw) {
                        console.log(`   ❌ pluggyRaw: NÃO EXISTE`);
                        samplesWithoutPluggyRaw++;
                    } else if (!txData.pluggyRaw.paymentData) {
                        console.log(`   ⚠️ paymentData: NULL/UNDEFINED`);

                        // Mostrar o que tem no pluggyRaw
                        const raw = txData.pluggyRaw;
                        console.log(`   📋 pluggyRaw campos: ${Object.keys(raw).join(', ')}`);
                        console.log(`   📋 pluggyRaw.description: "${raw.description}"`);
                        console.log(`   📋 pluggyRaw.descriptionRaw: "${raw.descriptionRaw || 'N/A'}"`);

                        samplesWithoutPaymentData++;
                    } else {
                        console.log(`   ✅ paymentData: EXISTE`);
                        const pd = txData.pluggyRaw.paymentData;
                        console.log(`   👤 payer.name: ${pd.payer?.name || 'N/A'}`);
                        console.log(`   👤 receiver.name: ${pd.receiver?.name || 'N/A'}`);
                        console.log(`   📝 reason: ${pd.reason || 'N/A'}`);
                        console.log(`   💳 paymentMethod: ${pd.paymentMethod || 'N/A'}`);

                        samplesWithPaymentData++;
                    }
                }
            }
        }

        if (totalGenericFound >= 15) break;
    }

    console.log('\n========================================');
    console.log('📊 RESUMO');
    console.log('========================================');
    console.log(`Total transações genéricas encontradas: ${totalGenericFound}`);
    console.log(`Com paymentData: ${samplesWithPaymentData}`);
    console.log(`Sem paymentData: ${samplesWithoutPaymentData}`);
    console.log(`Sem pluggyRaw: ${samplesWithoutPluggyRaw}`);
    console.log('========================================\n');

    process.exit(0);
}

checkRecentTransactions().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
