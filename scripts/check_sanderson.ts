/**
 * Script para verificar status das assinaturas do Sanderson
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

const CUSTOMER_ID = 'cus_000154340501';
const SUBSCRIPTION_IDS = ['sub_silnbjtn59y1jru7', 'sub_w7a4s5ulfuq9bx60'];

async function checkStatus() {
    console.log('\n========================================');
    console.log('📋 VERIFICAÇÃO DE STATUS - SANDERSON');
    console.log('========================================\n');

    // Check subscriptions
    for (const subId of SUBSCRIPTION_IDS) {
        console.log(`\n🔍 Assinatura: ${subId}`);
        try {
            const res = await axios.get(`${ASAAS_API_URL}/subscriptions/${subId}`, {
                headers: { 'access_token': ASAAS_API_KEY }
            });
            const sub = res.data;
            console.log(`   Status: ${sub.status}`);
            console.log(`   Valor: R$ ${sub.value}`);
            console.log(`   Próximo Vencimento: ${sub.nextDueDate}`);
            console.log(`   Ciclo: ${sub.cycle}`);
        } catch (e: any) {
            console.log(`   ❌ Erro: ${e.response?.status} - ${e.response?.data?.errors?.[0]?.description || e.message}`);
        }
    }

    // Check payments
    console.log(`\n📋 Cobranças do cliente ${CUSTOMER_ID}:`);
    try {
        const res = await axios.get(`${ASAAS_API_URL}/payments?customer=${CUSTOMER_ID}&limit=10`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        for (const payment of res.data.data) {
            console.log(`   - ${payment.id}: R$ ${payment.value} | ${payment.status} | Venc: ${payment.dueDate} | ${payment.description || ''}`);
        }
    } catch (e: any) {
        console.log(`   ❌ Erro: ${e.message}`);
    }

    console.log('\n========================================\n');
}

checkStatus();
