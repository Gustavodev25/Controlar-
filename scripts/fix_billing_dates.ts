/**
 * Script para corrigir a data de cobrança do Sanderson no Asaas
 * 
 * Problema: O usuário assinou dia 28/12/2025, a próxima cobrança deveria ser 28/01/2026
 * mas no Asaas está como 06/02/2026.
 * 
 * Este script:
 * 1. Lista as cobranças/assinaturas do cliente no Asaas
 * 2. Atualiza a próxima data de cobrança para 28/01/2026
 * 3. Atualiza o Firebase também
 * 
 * Execute com: npx ts-node scripts/fix_billing_dates.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Firebase config
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDwSj2xb-iZlWMJUBUDG4rN0rJqMxNJi5o",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "controlar-f4bf8.firebaseapp.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "controlar-f4bf8",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "controlar-f4bf8.firebasestorage.app",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "665766682215",
    appId: process.env.VITE_FIREBASE_APP_ID || "1:665766682215:web:d33bed1ae1e1dd9aca1ac2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Asaas config
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const isSandbox = ASAAS_API_KEY && ASAAS_API_KEY.includes('hmlg');
const ASAAS_API_URL = isSandbox
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://www.asaas.com/api/v3';

console.log(`🔧 Environment: ${isSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
console.log(`🔧 Asaas URL: ${ASAAS_API_URL}`);
console.log(`🔧 API Key: ${ASAAS_API_KEY ? ASAAS_API_KEY.substring(0, 15) + '...' : 'MISSING'}`);

// Sanderson's data
const USER_ID = 'yCdFcomhCEfiPxWmPczTfg8QqOj1';
const ASAAS_CUSTOMER_ID = 'cus_000154340501';
const ASAAS_SUBSCRIPTION_IDS = [
    'sub_silnbjtn59y1jru7',
    'sub_w7a4s5ulfuq9bx60'
];
const CORRECT_BILLING_DATE = '2026-01-28';

async function asaasRequest(method: string, endpoint: string, data: any = null) {
    const config: any = {
        method,
        url: `${ASAAS_API_URL}${endpoint}`,
        headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY
        }
    };

    if (data) config.data = data;

    try {
        const response = await axios(config);
        return response.data;
    } catch (error: any) {
        console.error(`❌ Asaas Error:`, error.response?.data || error.message);
        throw error;
    }
}

async function listPaymentsForCustomer(customerId: string) {
    console.log(`\n� Listando cobranças do cliente ${customerId}...`);

    try {
        const payments = await asaasRequest('GET', `/payments?customer=${customerId}&limit=50`);

        if (payments.data && payments.data.length > 0) {
            console.log(`   Encontradas ${payments.data.length} cobranças:`);

            for (const payment of payments.data) {
                console.log(`   - ${payment.id}: R$ ${payment.value} | Status: ${payment.status} | Vencimento: ${payment.dueDate}`);
            }
        } else {
            console.log('   Nenhuma cobrança encontrada.');
        }

        return payments.data || [];
    } catch (error) {
        console.error('   Erro ao listar cobranças');
        return [];
    }
}

async function getSubscription(subscriptionId: string) {
    console.log(`\n🔍 Buscando assinatura ${subscriptionId}...`);

    try {
        const subscription = await asaasRequest('GET', `/subscriptions/${subscriptionId}`);
        console.log(`   Status: ${subscription.status}`);
        console.log(`   Valor: R$ ${subscription.value}`);
        console.log(`   Próximo Vencimento: ${subscription.nextDueDate}`);
        console.log(`   Ciclo: ${subscription.cycle}`);
        return subscription;
    } catch (error: any) {
        if (error.response?.status === 404) {
            console.log(`   ⚠️ Assinatura não encontrada`);
        }
        return null;
    }
}

async function updateSubscriptionDueDate(subscriptionId: string, nextDueDate: string) {
    console.log(`\n⏳ Atualizando assinatura ${subscriptionId} para vencer em ${nextDueDate}...`);

    try {
        const result = await asaasRequest('PUT', `/subscriptions/${subscriptionId}`, {
            nextDueDate: nextDueDate,
            updatePendingPayments: true // Update pending payments to new date
        });

        console.log(`   ✅ Assinatura atualizada!`);
        console.log(`   Novo vencimento: ${result.nextDueDate}`);
        return result;
    } catch (error: any) {
        console.error(`   ❌ Erro ao atualizar assinatura:`, error.response?.data?.errors || error.message);
        return null;
    }
}

async function updatePaymentDueDate(paymentId: string, newDueDate: string) {
    console.log(`\n⏳ Atualizando cobrança ${paymentId} para vencer em ${newDueDate}...`);

    try {
        const result = await asaasRequest('PUT', `/payments/${paymentId}`, {
            dueDate: newDueDate
        });

        console.log(`   ✅ Cobrança atualizada!`);
        console.log(`   Novo vencimento: ${result.dueDate}`);
        return result;
    } catch (error: any) {
        console.error(`   ❌ Erro ao atualizar cobrança:`, error.response?.data?.errors || error.message);
        return null;
    }
}

async function updateFirebaseNextBillingDate(userId: string, nextBillingDate: string) {
    console.log(`\n📝 Atualizando Firebase para o usuário ${userId}...`);

    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.log('   ❌ Usuário não encontrado no Firebase');
            return false;
        }

        const userData = userSnap.data();
        console.log(`   Usuário: ${userData.profile?.name || userData.name}`);
        console.log(`   nextBillingDate atual: ${userData.subscription?.nextBillingDate || userData.profile?.subscription?.nextBillingDate}`);

        // Update the subscription
        if (userData.profile?.subscription) {
            await updateDoc(userRef, {
                'profile.subscription.nextBillingDate': nextBillingDate
            });
        } else if (userData.subscription) {
            await updateDoc(userRef, {
                'subscription.nextBillingDate': nextBillingDate
            });
        }

        console.log(`   ✅ Firebase atualizado! Novo nextBillingDate: ${nextBillingDate}`);
        return true;
    } catch (error) {
        console.error('   ❌ Erro ao atualizar Firebase:', error);
        return false;
    }
}

async function fixBillingDates() {
    console.log('\n========================================');
    console.log('🔧 CORREÇÃO DE DATA DE COBRANÇA');
    console.log('========================================');
    console.log(`👤 Usuário: Sanderson`);
    console.log(`🆔 User ID: ${USER_ID}`);
    console.log(`🏦 Asaas Customer: ${ASAAS_CUSTOMER_ID}`);
    console.log(`📅 Data correta: ${CORRECT_BILLING_DATE}`);
    console.log('========================================\n');

    // 1. List current payments
    const payments = await listPaymentsForCustomer(ASAAS_CUSTOMER_ID);

    // 2. Check each subscription
    for (const subId of ASAAS_SUBSCRIPTION_IDS) {
        const subscription = await getSubscription(subId);

        if (subscription && subscription.nextDueDate !== CORRECT_BILLING_DATE) {
            console.log(`\n⚠️ Próximo vencimento incorreto: ${subscription.nextDueDate}`);
            console.log(`   Deveria ser: ${CORRECT_BILLING_DATE}`);

            // Update subscription
            await updateSubscriptionDueDate(subId, CORRECT_BILLING_DATE);
        } else if (subscription) {
            console.log(`   ✅ Data já está correta!`);
        }
    }

    // 3. Check for pending payments with wrong date
    const wrongDatePayments = payments.filter((p: any) =>
        p.status === 'PENDING' &&
        p.dueDate !== CORRECT_BILLING_DATE &&
        new Date(p.dueDate) > new Date('2026-01-01')
    );

    if (wrongDatePayments.length > 0) {
        console.log(`\n📋 Encontradas ${wrongDatePayments.length} cobranças pendentes com data errada:`);

        for (const payment of wrongDatePayments) {
            console.log(`   - ${payment.id}: Vencimento ${payment.dueDate}`);
            await updatePaymentDueDate(payment.id, CORRECT_BILLING_DATE);
        }
    }

    // 4. Update Firebase
    await updateFirebaseNextBillingDate(USER_ID, CORRECT_BILLING_DATE);

    console.log('\n========================================');
    console.log('✅ CORREÇÃO FINALIZADA!');
    console.log('========================================\n');
}

fixBillingDates()
    .then(() => {
        console.log('🎉 Script finalizado com sucesso!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });
