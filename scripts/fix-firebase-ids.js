/**
 * Script para atualizar campos específicos no Firebase
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

// Updates to apply
const updates = [
    {
        userId: 'c7sjLfa9EiYQoMcNbMm1BHCVlKY2',
        name: 'Igor',
        update: { 'subscription.asaasSubscriptionId': 'sub_ti4dm37wtb548i9e' }
    },
    {
        userId: 'yCdFcomhCEfiPxWmPczTfg8QqOj1',
        name: 'Sanderson',
        update: { 'subscription.asaasSubscriptionId': 'sub_w7a4s5ulfuq9bx60' }
    }
];

async function main() {
    console.log('\n=== ATUALIZANDO FIREBASE ===\n');

    for (const item of updates) {
        try {
            await db.collection('users').doc(item.userId).update(item.update);
            console.log(`✅ ${item.name}: atualizado com sucesso`);
        } catch (err) {
            console.error(`❌ ${item.name}: ${err.message}`);
        }
    }

    console.log('\n✅ Concluído!\n');
    process.exit(0);
}

main();
