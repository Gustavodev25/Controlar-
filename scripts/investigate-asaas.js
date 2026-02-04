/**
 * Script para investigar por que o Asaas não está cobrando automaticamente
 * Verifica a configuração completa da assinatura e pagamentos
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const BASE_URL = 'https://api.asaas.com/v3';

async function asaasRequest(endpoint) {
    const res = await fetch(BASE_URL + endpoint, {
        headers: { 'access_token': ASAAS_API_KEY }
    });
    return res.json();
}

async function main() {
    // Verificar o Gregori especificamente
    const customerId = 'cus_000154863440';
    const subscriptionId = 'sub_s12ndxv6nniz1jqj';

    console.log('\n========================================');
    console.log('🔍 INVESTIGANDO ASSINATURA DO GREGORI');
    console.log('========================================\n');

    // 1. Dados do cliente no Asaas
    console.log('📋 DADOS DO CLIENTE NO ASAAS:');
    console.log('----------------------------------------');
    const customer = await asaasRequest('/customers/' + customerId);
    console.log('Nome:', customer.name);
    console.log('Email:', customer.email);
    console.log('CPF/CNPJ:', customer.cpfCnpj);
    console.log('');

    // 2. Dados completos da assinatura
    console.log('📋 DADOS COMPLETOS DA ASSINATURA:');
    console.log('----------------------------------------');
    const sub = await asaasRequest('/subscriptions/' + subscriptionId);
    console.log(JSON.stringify(sub, null, 2));
    console.log('');

    // 3. Todos os pagamentos desta assinatura
    console.log('📋 TODOS OS PAGAMENTOS DESTA ASSINATURA:');
    console.log('----------------------------------------');
    const payments = await asaasRequest('/payments?subscription=' + subscriptionId + '&limit=20');

    if (payments.data) {
        for (const p of payments.data) {
            console.log(`\n📄 Pagamento: ${p.id}`);
            console.log(`   Status: ${p.status}`);
            console.log(`   Valor: R$ ${p.value?.toFixed(2)}`);
            console.log(`   Vencimento: ${p.dueDate}`);
            console.log(`   billingType: ${p.billingType}`);
            console.log(`   Data confirmação: ${p.confirmedDate || 'N/A'}`);
            console.log(`   Data crédito: ${p.creditDate || 'N/A'}`);

            // Se tiver detalhes de falha
            if (p.status === 'REFUSED' || p.status === 'OVERDUE') {
                console.log(`   ⚠️ FALHA - Verificando detalhes...`);
            }
        }
    }

    // 4. Verificar configurações da conta (webhooks, etc)
    console.log('\n📋 VERIFICANDO CONFIGURAÇÕES:');
    console.log('----------------------------------------');

    // Verificar se a assinatura deveria ter cobrado
    const today = new Date('2026-02-04');
    const nextDue = new Date(sub.nextDueDate);
    const daysSinceFirstPayment = Math.floor((today - new Date('2026-01-02')) / (1000 * 60 * 60 * 24));

    console.log('Hoje:', today.toISOString().split('T')[0]);
    console.log('Próximo vencimento Asaas:', sub.nextDueDate);
    console.log('Dias desde primeiro pagamento:', daysSinceFirstPayment);
    console.log('');

    // O primeiro pagamento foi confirmado?
    const firstPayment = payments.data?.find(p => p.dueDate <= '2026-01-05');
    if (firstPayment) {
        console.log('📌 Primeiro pagamento (01/2026):');
        console.log('   ID:', firstPayment.id);
        console.log('   Status:', firstPayment.status);
        console.log('   Valor:', firstPayment.value);
    }

    // O segundo pagamento deveria ter sido cobrado?
    const secondPayment = payments.data?.find(p => p.dueDate >= '2026-02-01' && p.dueDate <= '2026-02-05');
    if (secondPayment) {
        console.log('\n📌 Segundo pagamento (02/2026):');
        console.log('   ID:', secondPayment.id);
        console.log('   Status:', secondPayment.status);
        console.log('   Valor:', secondPayment.value);
        console.log('   Vencimento:', secondPayment.dueDate);

        if (secondPayment.status === 'OVERDUE') {
            console.log('\n   ❌ PROBLEMA: O pagamento venceu e não foi cobrado automaticamente!');
            console.log('   Isso significa que o cartão não estava disponível para cobrança.');
        }
    }

    // 5. Verificar se o primeiro pagamento teve cartão
    console.log('\n📋 BUSCANDO PRIMEIRO PAGAMENTO CONFIRMADO:');
    console.log('----------------------------------------');
    const confirmedPayments = await asaasRequest('/payments?customer=' + customerId + '&status=CONFIRMED&limit=5');

    if (confirmedPayments.data && confirmedPayments.data.length > 0) {
        const first = confirmedPayments.data[0];
        console.log('Pagamento confirmado encontrado:', first.id);
        console.log('Data:', first.confirmedDate);
        console.log('Valor:', first.value);
        console.log('billingType:', first.billingType);

        // Buscar detalhes completos desse pagamento
        const paymentDetails = await asaasRequest('/payments/' + first.id);
        console.log('\nDetalhes do pagamento confirmado:');
        console.log('creditCard.creditCardNumber:', paymentDetails.creditCard?.creditCardNumber);
        console.log('creditCard.creditCardBrand:', paymentDetails.creditCard?.creditCardBrand);
        console.log('creditCard.creditCardToken:', paymentDetails.creditCard?.creditCardToken);
    } else {
        console.log('❌ Nenhum pagamento confirmado encontrado!');
    }

    console.log('\n========================================');
    console.log('✅ Investigação concluída');
    console.log('========================================\n');
}

main().catch(console.error);
