/**
 * Script para criar a cobrança faltante do Thomas Soto Firmani
 * 
 * Problema: A assinatura está ativa mas não criou a cobrança de 29/01/2026
 * Solução: Criar uma cobrança manual vinculada à assinatura
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = 'https://www.asaas.com/api/v3';

// Thomas data
const CUSTOMER_ID = 'cus_000154359092';
const SUBSCRIPTION_ID = 'sub_icdsm9w3qzxczfjo';
const USER_NAME = 'Thomas Soto Firmani';
const DUE_DATE = '2026-01-29';
const VALUE = 35.90;

async function createPaymentForThomas() {
    console.log('\n========================================');
    console.log(`💳 CRIAR COBRANÇA - ${USER_NAME}`);
    console.log('========================================');
    console.log(`🏦 Customer ID: ${CUSTOMER_ID}`);
    console.log(`📄 Subscription ID: ${SUBSCRIPTION_ID}`);
    console.log(`📅 Data de Vencimento: ${DUE_DATE}`);
    console.log(`💰 Valor: R$ ${VALUE}`);
    console.log('========================================\n');

    // First, verify the subscription
    console.log('🔍 Verificando assinatura...');
    try {
        const subRes = await axios.get(`${ASAAS_API_URL}/subscriptions/${SUBSCRIPTION_ID}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        const sub = subRes.data;
        console.log(`   Status: ${sub.status}`);
        console.log(`   Próximo Vencimento na Assinatura: ${sub.nextDueDate}`);

        if (sub.status !== 'ACTIVE') {
            console.log('\n❌ ERRO: Assinatura não está ativa!');
            return;
        }
    } catch (e: any) {
        console.log(`   ❌ Erro ao verificar assinatura: ${e.message}`);
        return;
    }

    // Check existing payments to avoid duplicates
    console.log('\n📋 Verificando cobranças existentes...');
    try {
        const payRes = await axios.get(`${ASAAS_API_URL}/payments?customer=${CUSTOMER_ID}&limit=20`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        const existingPayment = payRes.data.data?.find((p: any) =>
            p.dueDate === DUE_DATE &&
            p.value === VALUE &&
            (p.status === 'PENDING' || p.status === 'CONFIRMED')
        );

        if (existingPayment) {
            console.log(`   ⚠️ Já existe cobrança para ${DUE_DATE}:`);
            console.log(`   - ${existingPayment.id}: R$ ${existingPayment.value} | ${existingPayment.status}`);
            console.log('\n✅ Nenhuma ação necessária!');
            return;
        }

        console.log('   Nenhuma cobrança para 29/01/2026 encontrada. Criando...');
    } catch (e: any) {
        console.log(`   ⚠️ Aviso ao verificar cobranças: ${e.message}`);
    }

    // Get customer's credit card info (tokenized)
    console.log('\n💳 Obtendo dados do cartão...');
    let creditCardToken = null;
    try {
        // Try to get tokenized card from subscription payments
        const subPaymentsRes = await axios.get(`${ASAAS_API_URL}/subscriptions/${SUBSCRIPTION_ID}/payments`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        if (subPaymentsRes.data.data && subPaymentsRes.data.data.length > 0) {
            const lastPayment = subPaymentsRes.data.data[0];
            console.log(`   Último pagamento: ${lastPayment.id}`);

            // Get payment details to find card token
            const paymentDetails = await axios.get(`${ASAAS_API_URL}/payments/${lastPayment.id}`, {
                headers: { 'access_token': ASAAS_API_KEY }
            });

            if (paymentDetails.data.creditCard?.creditCardToken) {
                creditCardToken = paymentDetails.data.creditCard.creditCardToken;
                console.log(`   Token do cartão encontrado!`);
            }
        }
    } catch (e: any) {
        console.log(`   ⚠️ Não foi possível obter token do cartão: ${e.message}`);
    }

    // Create the payment
    console.log('\n⏳ Criando cobrança...');
    try {
        const paymentData: any = {
            customer: CUSTOMER_ID,
            billingType: 'CREDIT_CARD',
            value: VALUE,
            dueDate: DUE_DATE,
            description: `Plano pro - Mensal`,
            externalReference: `subscription_${SUBSCRIPTION_ID}_manual`
        };

        // If we have a credit card token, use it
        if (creditCardToken) {
            paymentData.creditCardToken = creditCardToken;
        }

        const createRes = await axios.post(`${ASAAS_API_URL}/payments`, paymentData, {
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY
            }
        });

        const newPayment = createRes.data;
        console.log(`\n✅ COBRANÇA CRIADA COM SUCESSO!`);
        console.log(`   ID: ${newPayment.id}`);
        console.log(`   Valor: R$ ${newPayment.value}`);
        console.log(`   Vencimento: ${newPayment.dueDate}`);
        console.log(`   Status: ${newPayment.status}`);
        console.log(`   Link de Pagamento: ${newPayment.invoiceUrl || 'N/A'}`);

    } catch (e: any) {
        console.error('\n❌ ERRO ao criar cobrança:');
        if (e.response) {
            console.error(`   Status: ${e.response.status}`);
            console.error(`   Data:`, JSON.stringify(e.response.data, null, 2));
        } else {
            console.error(`   Message: ${e.message}`);
        }
    }

    console.log('\n========================================\n');
}

createPaymentForThomas();
