/**
 * Script de diagnóstico detalhado para ver estrutura das contas
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });

// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || "financeiro-609e1"
    });
}

const db = admin.firestore();

async function diagnoseDetailedAccounts() {
    console.log('\n========================================');
    console.log('🔍 DIAGNÓSTICO DETALHADO: Estrutura das Contas');
    console.log('========================================\n');

    const usersSnapshot = await db.collection('users').get();
    let sampleShown = 0;
    let c6Found = false;

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const userName = userData.displayName || userData.email || userData.name || userId;

        const accountsSnapshot = await db
            .collection('users')
            .doc(userId)
            .collection('accounts')
            .get();

        for (const accDoc of accountsSnapshot.docs) {
            const accData = accDoc.data();

            // Check if any field contains "c6"
            const accStr = JSON.stringify(accData).toLowerCase();
            if (accStr.includes('c6')) {
                console.log(`\n🔵 CONTA C6 ENCONTRADA!`);
                console.log(`   Usuário: ${userName}`);
                console.log(`   Account ID: ${accDoc.id}`);
                console.log(`   Dados completos:`);
                console.log(JSON.stringify(accData, null, 2));
                c6Found = true;
            }

            // Show first 3 samples regardless
            if (sampleShown < 3 && !c6Found) {
                console.log(`\n📋 AMOSTRA ${sampleShown + 1}:`);
                console.log(`   Usuário: ${userName}`);
                console.log(`   Account ID: ${accDoc.id}`);
                console.log(`   Campos: ${Object.keys(accData).join(', ')}`);
                console.log(`   name: ${accData.name}`);
                console.log(`   type: ${accData.type}`);
                console.log(`   connector: ${accData.connector ? JSON.stringify(accData.connector) : 'N/A'}`);
                console.log(`   connectorName: ${accData.connectorName}`);
                console.log(`   institutionName: ${accData.institutionName}`);
                console.log(`   institution: ${accData.institution ? JSON.stringify(accData.institution) : 'N/A'}`);
                sampleShown++;
            }
        }
    }

    if (!c6Found) {
        console.log('\n⚠️ Nenhuma conta C6 encontrada em nenhum campo!');
        console.log('Verificando transações diretamente...\n');

        // Check transactions directly for C6 mentions
        let txC6Found = false;

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const userName = userData.displayName || userData.email || userData.name || userId;

            const txSnapshot = await db
                .collection('users')
                .doc(userId)
                .collection('transactions')
                .limit(50)
                .get();

            for (const txDoc of txSnapshot.docs) {
                const txData = txDoc.data();
                const txStr = JSON.stringify(txData).toLowerCase();

                if (txStr.includes('c6')) {
                    console.log(`\n🔵 TRANSAÇÃO C6 ENCONTRADA!`);
                    console.log(`   Usuário: ${userName}`);
                    console.log(`   Transaction ID: ${txDoc.id}`);
                    console.log(`   accountId: ${txData.accountId}`);
                    console.log(`   description: ${txData.description}`);

                    if (txData.pluggyRaw) {
                        console.log(`   pluggyRaw.paymentData: ${txData.pluggyRaw.paymentData ? 'EXISTS' : 'NULL'}`);
                        if (txData.pluggyRaw.paymentData) {
                            console.log(`   paymentData: ${JSON.stringify(txData.pluggyRaw.paymentData)}`);
                        }
                    }

                    txC6Found = true;
                    if (txC6Found) break;
                }
            }
            if (txC6Found) break;
        }
    }

    console.log('\n========================================\n');
    process.exit(0);
}

diagnoseDetailedAccounts().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
