/**
 * Script para verificar transações específicas do usuário com C6 BANK
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
const TARGET_USER = 'kx7nssUhM5eZXk1fm2es4VJfV4p1';

async function inspectUserTransactions() {
    console.log('\n========================================');
    console.log(`🔍 INSPECIONANDO TRANSAÇÕES DO USUÁRIO`);
    console.log(`   ID: ${TARGET_USER}`);
    console.log('========================================\n');

    // 1. Ver dados do usuário
    const userDoc = await db.collection('users').doc(TARGET_USER).get();
    if (!userDoc.exists) {
        console.log('❌ Usuário não encontrado!');
        process.exit(1);
    }

    const userData = userDoc.data();
    console.log(`👤 Nome: ${userData.name || userData.displayName || 'N/A'}`);
    console.log(`📧 Email: ${userData.email || 'N/A'}`);

    // 2. Ver contas
    const accountsSnapshot = await db
        .collection('users')
        .doc(TARGET_USER)
        .collection('accounts')
        .get();

    console.log(`\n🏦 CONTAS (${accountsSnapshot.size}):`);
    for (const accDoc of accountsSnapshot.docs) {
        const acc = accDoc.data();
        console.log(`   - ${acc.name || 'N/A'} (${acc.type || 'N/A'})`);
        console.log(`     ID: ${accDoc.id}`);
        console.log(`     Connector: ${acc.connector?.name || acc.connectorName || 'N/A'}`);
    }

    // 3. Ver transações com descrições genéricas
    const txSnapshot = await db
        .collection('users')
        .doc(TARGET_USER)
        .collection('transactions')
        .orderBy('date', 'desc')
        .limit(50)
        .get();

    console.log(`\n📝 TRANSAÇÕES RECENTES (${txSnapshot.size}):`);

    let genericCount = 0;
    let enrichedCount = 0;

    for (const txDoc of txSnapshot.docs) {
        const tx = txDoc.data();
        const descLower = (tx.description || '').toLowerCase();

        // Verificar se é genérica
        const isGeneric = descLower.includes('pix recebido') ||
            descLower.includes('pix enviado') ||
            descLower.includes('transf enviada pix') ||
            descLower.includes('transf recebida pix');

        if (isGeneric) {
            genericCount++;

            if (genericCount <= 10) {
                console.log(`\n   ❌ GENÉRICA #${genericCount}:`);
                console.log(`      Desc: "${tx.description}"`);
                console.log(`      Data: ${tx.date}`);
                console.log(`      Valor: R$ ${tx.amount}`);

                if (tx.pluggyRaw) {
                    const raw = tx.pluggyRaw;
                    console.log(`      pluggyRaw.description: "${raw.description}"`);
                    console.log(`      pluggyRaw.descriptionRaw: "${raw.descriptionRaw || 'NULL'}"`);

                    if (raw.paymentData) {
                        const pd = raw.paymentData;
                        console.log(`      paymentData.payer.name: "${pd.payer?.name || 'NULL'}"`);
                        console.log(`      paymentData.receiver.name: "${pd.receiver?.name || 'NULL'}"`);
                        console.log(`      paymentData.reason: "${pd.reason || 'NULL'}"`);
                    } else {
                        console.log(`      paymentData: NULL`);
                    }
                } else {
                    console.log(`      pluggyRaw: NÃO EXISTE`);
                }
            }
        } else if (descLower.includes('pix')) {
            enrichedCount++;

            if (enrichedCount <= 3) {
                console.log(`\n   ✅ ENRIQUECIDA #${enrichedCount}:`);
                console.log(`      Desc: "${tx.description}"`);
                console.log(`      Data: ${tx.date}`);
            }
        }
    }

    console.log('\n========================================');
    console.log('📊 RESUMO');
    console.log('========================================');
    console.log(`Transações genéricas: ${genericCount}`);
    console.log(`Transações enriquecidas: ${enrichedCount}`);
    console.log('========================================\n');

    process.exit(0);
}

inspectUserTransactions().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
