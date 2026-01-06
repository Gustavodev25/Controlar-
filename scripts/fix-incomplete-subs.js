/**
 * Script para corrigir assinaturas incompletas de Igor e Sanderson
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

// Complete subscription data
const fixes = [
    {
        userId: 'c7sjLfa9EiYQoMcNbMm1BHCVlKY2',
        name: 'Igor',
        subscription: {
            plan: 'pro',
            status: 'active',
            billingCycle: 'monthly',
            asaasCustomerId: 'cus_000154263214',
            asaasSubscriptionId: 'sub_ti4dm37wtb548i9e',
            nextBillingDate: '2026-03-06',
            paymentMethod: 'CREDIT_CARD',
            startDate: '2025-12-27',
            installments: 1,
            firstMonthOverridePrice: 5
        }
    },
    {
        userId: 'yCdFcomhCEfiPxWmPczTfg8QqOj1',
        name: 'Sanderson',
        subscription: {
            plan: 'pro',
            status: 'active',
            billingCycle: 'monthly',
            asaasCustomerId: 'cus_000154340501',
            asaasSubscriptionId: 'sub_w7a4s5ulfuq9bx60',
            nextBillingDate: '2026-03-06',
            paymentMethod: 'CREDIT_CARD',
            startDate: '2025-12-28',
            installments: 1
        }
    }
];

async function main() {
    console.log('\n=== CORRIGINDO ASSINATURAS INCOMPLETAS ===\n');

    for (const fix of fixes) {
        try {
            await db.collection('users').doc(fix.userId).update({
                subscription: fix.subscription
            });
            console.log(`✅ ${fix.name}: assinatura completa restaurada`);
        } catch (err) {
            console.error(`❌ ${fix.name}: ${err.message}`);
        }
    }

    console.log('\n✅ Concluído!\n');
    process.exit(0);
}

main();
