/**
 * Script para bloquear usuários na base de dados que estão com pagamento atrasado 
 * e não possuem cartão tokenizado no Asaas.
 * 
 * Uso: node scripts/block-overdue-users.js
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
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const isSandbox = ASAAS_API_KEY && ASAAS_API_KEY.includes('hmlg');
const ASAAS_BASE_URL = isSandbox
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';

console.log(`\n🔧 Ambiente: ${isSandbox ? 'SANDBOX' : 'PRODUÇÃO'}`);
console.log(`🔗 URL: ${ASAAS_BASE_URL}\n`);

// Asaas API helper
async function asaasRequest(method, endpoint, body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${ASAAS_BASE_URL}${endpoint}`, options);
    const data = await response.json();

    return { ok: response.ok, status: response.status, data };
}

// Get customer info
async function getCustomerInfo(customerId) {
    try {
        const result = await asaasRequest('GET', `/customers/${customerId}`);
        return result.data;
    } catch (error) {
        return { name: 'N/A', email: 'N/A' };
    }
}

// Get subscription details including creditCardToken
async function getSubscription(subscriptionId) {
    try {
        const result = await asaasRequest('GET', `/subscriptions/${subscriptionId}`);
        return result.data;
    } catch (error) {
        return null;
    }
}

async function main() {
    console.log('========================================');
    console.log('⛔ BLOQUEANDO USUÁRIOS ATRASADOS SEM CARTÃO');
    console.log('========================================\n');

    // 1. Buscar todos os pagamentos OVERDUE
    console.log('📥 Buscando pagamentos vencidos (OVERDUE) no Asaas...');
    let overduePayments = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const result = await asaasRequest('GET', `/payments?status=OVERDUE&limit=100&offset=${offset}`);
        if (result.data?.data && result.data.data.length > 0) {
            overduePayments = overduePayments.concat(result.data.data);
            offset += result.data.data.length;
            hasMore = result.data.data.length === 100;
        } else {
            hasMore = false;
        }
    }

    // Filtrar para remover duplicatas (um cliente pode ter mais de uma fatura atrasada)
    const uniqueCustomers = {};
    for (const payment of overduePayments) {
        if (!uniqueCustomers[payment.customer]) {
            uniqueCustomers[payment.customer] = payment;
        }
    }

    const customersToProcess = Object.values(uniqueCustomers);

    console.log(`📊 Total de clientes com faturas em atraso: ${customersToProcess.length}\n`);

    if (customersToProcess.length === 0) {
        console.log('✅ Nenhum cliente com fatura em atraso!');
        process.exit(0);
    }

    // 2. Processar cada cliente
    let successCount = 0;
    let skipCount = 0;

    for (const payment of customersToProcess) {
        const customer = await getCustomerInfo(payment.customer);
        console.log(`\n👤 Cliente: ${customer.name} <${customer.email}>`);

        if (!payment.subscription) {
            console.log(`   ⚠️ PULANDO: Pagamento avulso (sem assinatura no Asaas)`);
            skipCount++;
            continue;
        }

        const subscription = await getSubscription(payment.subscription);

        if (!subscription) {
            console.log(`   ❌ Assinatura não encontrada no Asaas.`);
            skipCount++;
            continue;
        }

        // Se tem token válido, ignoramos (pois o robô de cobrança de cartão deveria cobrar)
        if (subscription.creditCardToken && subscription.status === 'ACTIVE') {
            console.log(`   ⚠️ PULANDO: Cliente POSSUI token de cartão. O robô deve processar.`);
            skipCount++;
            continue;
        }

        console.log(`   ⛔ Cliente SEM token válido ou assinatura inativa. Bloqueando no Firebase...`);

        // 3. Buscar usuário no Firebase pelo email (ou ID Asaas)
        let userId = null;
        let userData = null;

        // Try searching by subscription.asaasCustomerId first
        let userQuery = await db.collection('users')
            .where('subscription.asaasCustomerId', '==', payment.customer)
            .limit(1)
            .get();

        if (userQuery.empty) {
            // Fallback: search by email
            userQuery = await db.collection('users')
                .where('email', '==', customer.email)
                .limit(1)
                .get();
        }

        if (userQuery.empty) {
            console.log(`   ❌ FALHA: Usuário não encontrado no Firebase (ID: ${payment.customer}, Email: ${customer.email}).`);
            continue;
        }

        const userDoc = userQuery.docs[0];
        userData = userDoc.data();
        userId = userDoc.id;

        // 4. Bloquear usuário alterando a assinatura
        const currentSub = userData.subscription || {};

        // Mudamos o status para 'canceled' (expirado) e o plano para 'starter'
        const updatedSub = {
            ...currentSub,
            status: 'canceled',
            plan: 'starter',
            autoRenew: false,
            paymentFailureReason: 'Plano expirado por não pagamento (sem cartão)'
        };

        // Força a atualização de todos na lista
        if (false) {
            console.log(`   ✅ USUÁRIO JÁ ESTAVA BLOQUEADO no Firebase.`);
        } else {
            await db.collection('users').doc(userId).update({
                "subscription": updatedSub,
                "profile.subscription": updatedSub
            });
            console.log(`   ⬇️ USUÁRIO REBAIXADO PARA STARTER C/ SUCESSO no Firebase!`);
            successCount++;
        }
    }

    console.log('\n========================================');
    console.log('📊 RESULTADO FINAL');
    console.log('========================================\n');
    console.log(`✅ Usuários recém bloqueados: ${successCount}`);
    console.log(`⚠️ Ignorados / Já processados: ${skipCount}`);
    console.log('\n✅ Script finalizado!\n');

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
