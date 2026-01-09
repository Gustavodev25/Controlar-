/**
 * Script para verificar e criar cobrança do Thomas Soto Firmani
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

async function checkThomas() {
    console.log('\n========================================');
    console.log(`📋 VERIFICAÇÃO - ${USER_NAME}`);
    console.log('========================================');
    console.log(`🏦 Customer ID: ${CUSTOMER_ID}`);
    console.log(`📄 Subscription ID: ${SUBSCRIPTION_ID}`);
    console.log('========================================\n');

    // 1. Check subscription
    console.log('🔍 Verificando assinatura...');
    try {
        const subRes = await axios.get(`${ASAAS_API_URL}/subscriptions/${SUBSCRIPTION_ID}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        const sub = subRes.data;
        console.log(`   Status: ${sub.status}`);
        console.log(`   Valor: R$ ${sub.value}`);
        console.log(`   Próximo Vencimento: ${sub.nextDueDate}`);
        console.log(`   Ciclo: ${sub.cycle}`);
        console.log(`   Billing Type: ${sub.billingType}`);
    } catch (e: any) {
        console.log(`   ❌ Erro: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
    }

    // 2. Check payments for this customer
    console.log(`\n📋 Cobranças do cliente ${CUSTOMER_ID}:`);
    try {
        const payRes = await axios.get(`${ASAAS_API_URL}/payments?customer=${CUSTOMER_ID}&limit=20`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        if (payRes.data.data && payRes.data.data.length > 0) {
            for (const payment of payRes.data.data) {
                console.log(`   - ${payment.id}: R$ ${payment.value} | ${payment.status} | Venc: ${payment.dueDate} | ${payment.description || ''}`);
            }
        } else {
            console.log('   ⚠️ NENHUMA COBRANÇA ENCONTRADA!');
        }

        return payRes.data.data || [];
    } catch (e: any) {
        console.log(`   ❌ Erro: ${e.message}`);
        return [];
    }
}

checkThomas().then((payments) => {
    console.log('\n========================================');
    if (payments.length === 0) {
        console.log('⚠️ AÇÃO NECESSÁRIA: Criar cobrança manualmente ou via assinatura!');
    }
    console.log('========================================\n');
});
