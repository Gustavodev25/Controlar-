/**
 * Script de diagnóstico para ver quais contas existem no Firebase
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

async function diagnoseAccounts() {
    console.log('\n========================================');
    console.log('🔍 DIAGNÓSTICO: Contas no Firebase');
    console.log('========================================\n');

    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Total de usuários: ${usersSnapshot.size}\n`);

    const allConnectors = new Map();
    let totalAccounts = 0;
    let usersWithAccounts = 0;

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const userName = userData.displayName || userData.email || userData.name || userId;

        const accountsSnapshot = await db
            .collection('users')
            .doc(userId)
            .collection('accounts')
            .get();

        if (accountsSnapshot.size > 0) {
            usersWithAccounts++;
            totalAccounts += accountsSnapshot.size;

            for (const accDoc of accountsSnapshot.docs) {
                const accData = accDoc.data();
                const connectorName = accData.connectorName || accData.institutionName || 'UNKNOWN';

                if (!allConnectors.has(connectorName)) {
                    allConnectors.set(connectorName, {
                        count: 0,
                        users: [],
                        sample: null
                    });
                }

                const entry = allConnectors.get(connectorName);
                entry.count++;
                if (entry.users.length < 3) {
                    entry.users.push(userName);
                }
                if (!entry.sample) {
                    entry.sample = {
                        name: accData.name,
                        type: accData.type,
                        subtype: accData.subtype,
                        fields: Object.keys(accData).join(', ')
                    };
                }
            }
        }
    }

    console.log(`👥 Usuários com contas: ${usersWithAccounts}`);
    console.log(`🏦 Total de contas: ${totalAccounts}`);
    console.log(`📋 Conectores únicos: ${allConnectors.size}\n`);

    console.log('----------------------------------------');
    console.log('LISTA DE CONECTORES:');
    console.log('----------------------------------------');

    // Sort by count descending
    const sortedConnectors = [...allConnectors.entries()].sort((a, b) => b[1].count - a[1].count);

    for (const [name, data] of sortedConnectors) {
        const isC6 = name.toLowerCase().includes('c6');
        const prefix = isC6 ? '🔵' : '  ';
        console.log(`${prefix} ${name}: ${data.count} contas`);
        if (isC6) {
            console.log(`     Usuários: ${data.users.join(', ')}`);
            console.log(`     Sample: ${JSON.stringify(data.sample)}`);
        }
    }

    console.log('\n========================================\n');
    process.exit(0);
}

diagnoseAccounts().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
