/**
 * Script para cobrar pagamentos vencidos usando o cartão tokenizado da assinatura
 * 
 * Uso: node scripts/pay-overdue-with-card.js
 * 
 * Este script:
 * 1. Busca todos os pagamentos com status OVERDUE ou PENDING
 * 2. Para cada pagamento, busca o creditCardToken da assinatura
 * 3. Usa o endpoint /payments/{id}/payWithCreditCard para cobrar
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

// Pay with credit card using token
async function payWithCreditCard(paymentId, creditCardToken) {
    try {
        const result = await asaasRequest('POST', `/payments/${paymentId}/payWithCreditCard`, {
            creditCardToken: creditCardToken
        });
        return result;
    } catch (error) {
        return { ok: false, data: { error: error.message } };
    }
}

async function main() {
    console.log('========================================');
    console.log('💳 COBRANDO PAGAMENTOS NO CARTÃO');
    console.log('========================================\n');

    // 1. Buscar todos os pagamentos OVERDUE
    console.log('📥 Buscando pagamentos vencidos (OVERDUE)...');
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

    console.log(`   Encontrados ${overduePayments.length} pagamentos OVERDUE\n`);

    // 2. Buscar pagamentos PENDING (as novas cobranças que criamos)
    console.log('📥 Buscando pagamentos pendentes (PENDING)...');
    let pendingPayments = [];
    offset = 0;
    hasMore = true;

    while (hasMore) {
        const result = await asaasRequest('GET', `/payments?status=PENDING&limit=100&offset=${offset}`);
        if (result.data?.data && result.data.data.length > 0) {
            pendingPayments = pendingPayments.concat(result.data.data);
            offset += result.data.data.length;
            hasMore = result.data.data.length === 100;
        } else {
            hasMore = false;
        }
    }

    // Filtrar apenas os pagamentos de cartão de crédito com vencimento hoje ou antes
    const today = new Date().toISOString().split('T')[0];
    const creditCardPending = pendingPayments.filter(p =>
        p.billingType === 'CREDIT_CARD' &&
        p.dueDate <= today &&
        p.subscription // Apenas com assinatura (para ter o token)
    );

    console.log(`   Encontrados ${creditCardPending.length} pagamentos PENDING de cartão para processar\n`);

    // Combinar as listas
    const allPayments = [...overduePayments, ...creditCardPending];

    // Remover duplicatas
    const uniquePayments = [...new Map(allPayments.map(p => [p.id, p])).values()];

    console.log(`📊 Total de pagamentos para processar: ${uniquePayments.length}\n`);

    if (uniquePayments.length === 0) {
        console.log('✅ Nenhum pagamento para processar!');
        process.exit(0);
    }

    // 3. Processar cada pagamento
    console.log('========================================');
    console.log('⚡ PROCESSANDO COBRANÇAS NO CARTÃO');
    console.log('========================================\n');

    let successCount = 0;
    let failCount = 0;
    const failures = [];

    for (const payment of uniquePayments) {
        const customer = await getCustomerInfo(payment.customer);
        console.log(`\n💰 Pagamento: ${payment.id}`);
        console.log(`   Cliente: ${customer.name} <${customer.email}>`);
        console.log(`   Valor: R$ ${payment.value?.toFixed(2)}`);
        console.log(`   Vencimento: ${payment.dueDate}`);
        console.log(`   Status atual: ${payment.status}`);

        // Verificar se tem assinatura
        if (!payment.subscription) {
            console.log(`   ⚠️  PULANDO: Pagamento avulso (sem assinatura)`);
            failures.push({
                payment,
                customer,
                error: 'Pagamento avulso - sem cartão tokenizado'
            });
            failCount++;
            continue;
        }

        // Buscar dados da assinatura para obter o token
        console.log(`   🔍 Buscando token do cartão...`);
        const subscription = await getSubscription(payment.subscription);

        if (!subscription) {
            console.log(`   ❌ FALHA: Não foi possível buscar a assinatura`);
            failures.push({
                payment,
                customer,
                error: 'Assinatura não encontrada'
            });
            failCount++;
            continue;
        }

        if (subscription.status !== 'ACTIVE') {
            console.log(`   ⚠️  PULANDO: Assinatura não está ativa (status: ${subscription.status})`);
            failures.push({
                payment,
                customer,
                error: `Assinatura com status: ${subscription.status}`
            });
            failCount++;
            continue;
        }

        // Verificar se tem creditCardToken
        const creditCardToken = subscription.creditCardToken;

        if (!creditCardToken) {
            console.log(`   ❌ FALHA: Assinatura sem creditCardToken`);
            failures.push({
                payment,
                customer,
                error: 'Assinatura sem cartão tokenizado'
            });
            failCount++;
            continue;
        }

        console.log(`   ✅ Token encontrado: ${creditCardToken.substring(0, 10)}...`);
        console.log(`   🔄 Cobrando no cartão...`);

        // Tentar cobrar
        const result = await payWithCreditCard(payment.id, creditCardToken);

        if (result.ok) {
            const newStatus = result.data.status;
            console.log(`   ✅ SUCESSO! Status: ${newStatus}`);

            if (newStatus === 'CONFIRMED' || newStatus === 'RECEIVED') {
                console.log(`   💰 PAGAMENTO CONFIRMADO!`);
            } else if (newStatus === 'PENDING') {
                console.log(`   ⏳ Aguardando processamento da operadora`);
            } else if (newStatus === 'REFUSED') {
                console.log(`   ❌ CARTÃO RECUSADO`);
                failures.push({
                    payment,
                    customer,
                    error: 'Cartão recusado pela operadora'
                });
                failCount++;
                continue;
            }
            successCount++;
        } else {
            const errorMsg = result.data?.errors?.[0]?.description ||
                result.data?.error ||
                JSON.stringify(result.data);
            console.log(`   ❌ FALHA: ${errorMsg}`);
            failures.push({
                payment,
                customer,
                error: errorMsg
            });
            failCount++;
        }
    }

    // 4. Resumo final
    console.log('\n========================================');
    console.log('📊 RESULTADO FINAL');
    console.log('========================================\n');

    console.log(`✅ Sucesso: ${successCount}`);
    console.log(`❌ Falha: ${failCount}`);

    if (failures.length > 0) {
        console.log('\n----------------------------------------');
        console.log('❌ DETALHES DAS FALHAS:');
        console.log('----------------------------------------\n');

        for (const fail of failures) {
            console.log(`• ${fail.customer?.name || 'N/A'} <${fail.customer?.email || 'N/A'}>`);
            console.log(`  Pagamento: ${fail.payment.id}`);
            console.log(`  Valor: R$ ${fail.payment.value?.toFixed(2)}`);
            console.log(`  Motivo: ${fail.error}`);
            console.log('');
        }

        console.log('\n💡 RECOMENDAÇÕES PARA AS FALHAS:');
        console.log('1. Cartão recusado → Contatar cliente para atualizar cartão');
        console.log('2. Assinatura cancelada → Verificar se cliente quer renovar');
        console.log('3. Sem token → Cliente precisa refazer a assinatura');
    }

    console.log('\n✅ Script finalizado!\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
