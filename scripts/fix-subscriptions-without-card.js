/**
 * Script para corrigir assinaturas existentes que estão sem cartão tokenizado
 * 
 * Como não temos mais acesso aos dados completos do cartão (número, CVV),
 * este script identifica as assinaturas problemáticas e gera links para
 * os clientes atualizarem seus cartões.
 * 
 * Uso: node scripts/fix-subscriptions-without-card.js
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
    return response.json();
}

async function main() {
    console.log('\n========================================');
    console.log('🔍 IDENTIFICANDO ASSINATURAS SEM CARTÃO');
    console.log('========================================\n');

    // 1. Buscar todas as assinaturas ACTIVE do Asaas
    let subscriptions = [];
    let offset = 0;
    let hasMore = true;

    console.log('📥 Buscando assinaturas ativas no Asaas...');

    while (hasMore) {
        const result = await asaasRequest('GET', `/subscriptions?status=ACTIVE&limit=100&offset=${offset}`);
        if (result.data && result.data.length > 0) {
            subscriptions = subscriptions.concat(result.data);
            offset += result.data.length;
            hasMore = result.data.length === 100;
        } else {
            hasMore = false;
        }
    }

    console.log(`   Total de assinaturas ativas: ${subscriptions.length}\n`);

    // 2. Verificar quais NÃO têm creditCardToken
    const problematic = [];
    const healthy = [];

    for (const sub of subscriptions) {
        if (sub.billingType !== 'CREDIT_CARD') {
            continue; // Ignorar assinaturas não-cartão
        }

        // Buscar dados completos
        const fullSub = await asaasRequest('GET', `/subscriptions/${sub.id}`);

        // Buscar cliente
        const customer = await asaasRequest('GET', `/customers/${sub.customer}`);

        if (!fullSub.creditCard && !fullSub.creditCardToken) {
            problematic.push({
                subscriptionId: sub.id,
                customerId: sub.customer,
                customerName: customer.name,
                customerEmail: customer.email,
                value: sub.value,
                nextDueDate: sub.nextDueDate,
                hasCard: false
            });
        } else {
            healthy.push({
                subscriptionId: sub.id,
                customerId: sub.customer,
                customerName: customer.name,
                hasCard: true
            });
        }
    }

    console.log('========================================');
    console.log('📊 RESULTADO DA ANÁLISE');
    console.log('========================================\n');

    console.log(`✅ Assinaturas OK (com cartão): ${healthy.length}`);
    console.log(`❌ Assinaturas SEM cartão: ${problematic.length}\n`);

    if (problematic.length === 0) {
        console.log('🎉 Todas as assinaturas estão com cartão configurado!\n');
        process.exit(0);
    }

    console.log('========================================');
    console.log('❌ ASSINATURAS PROBLEMÁTICAS');
    console.log('========================================\n');

    for (const item of problematic) {
        console.log(`👤 ${item.customerName} <${item.customerEmail}>`);
        console.log(`   Assinatura: ${item.subscriptionId}`);
        console.log(`   Valor: R$ ${item.value?.toFixed(2)}`);
        console.log(`   Próximo vencimento: ${item.nextDueDate}`);
        console.log('');
    }

    // 3. Gerar links para atualização de cartão
    console.log('========================================');
    console.log('🔗 SOLUÇÃO: LINKS PARA ATUALIZAR CARTÃO');
    console.log('========================================\n');

    console.log('Os clientes abaixo precisam atualizar o cartão de crédito.');
    console.log('Envie o link correspondente para cada um:\n');

    for (const item of problematic) {
        // Pegar a próxima cobrança pendente
        const payments = await asaasRequest('GET', `/payments?subscription=${item.subscriptionId}&status=PENDING&limit=1`);

        let paymentLink = null;
        if (payments.data && payments.data.length > 0) {
            paymentLink = payments.data[0].invoiceUrl;
        }

        console.log(`📨 ${item.customerName}`);
        console.log(`   Email: ${item.customerEmail}`);
        console.log(`   Valor mensal: R$ ${item.value?.toFixed(2)}`);
        if (paymentLink) {
            console.log(`   Link de pagamento: ${paymentLink}`);
        } else {
            console.log(`   ⚠️ Sem cobrança pendente - cliente precisa refazer assinatura`);
        }
        console.log('');
    }

    // 4. Gerar modelo de mensagem
    console.log('========================================');
    console.log('📝 MODELO DE MENSAGEM');
    console.log('========================================\n');

    console.log('Olá [NOME],\n');
    console.log('Identificamos um problema técnico com a cobrança automática da sua assinatura do Controlar.');
    console.log('Para garantir que seu acesso continue funcionando, precisamos que você atualize o cartão de crédito.\n');
    console.log('Clique no link abaixo para regularizar o pagamento:\n');
    console.log('[LINK]\n');
    console.log('Após o pagamento, as próximas cobranças serão realizadas automaticamente.\n');
    console.log('Pedimos desculpas pelo transtorno e agradecemos a compreensão!\n');
    console.log('Atenciosamente,');
    console.log('Equipe Controlar');

    console.log('\n✅ Script finalizado!\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
