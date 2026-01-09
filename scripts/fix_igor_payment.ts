/**
 * Script para corrigir a cobrança do Igor Nogueira
 * 
 * Problema: Cobrança com vencimento 06/02/2026, deveria ser 27/01/2026
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

// Igor data
const CUSTOMER_ID = 'cus_000154263214';
const SUBSCRIPTION_ID = 'sub_ti4dm37wtb548i9e';
const USER_NAME = 'Igor Nogueira';
const CORRECT_DATE = '2026-01-27';

async function fixIgorPayment() {
    console.log('\n========================================');
    console.log(`🔧 CORREÇÃO DE COBRANÇA - ${USER_NAME}`);
    console.log('========================================');
    console.log(`🏦 Customer ID: ${CUSTOMER_ID}`);
    console.log(`📄 Subscription ID: ${SUBSCRIPTION_ID}`);
    console.log(`📅 Data correta: ${CORRECT_DATE}`);
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

        // Update subscription if date is wrong
        if (sub.nextDueDate !== CORRECT_DATE && sub.status === 'ACTIVE') {
            console.log(`\n⏳ Atualizando assinatura para ${CORRECT_DATE}...`);
            try {
                const updateSubRes = await axios.put(
                    `${ASAAS_API_URL}/subscriptions/${SUBSCRIPTION_ID}`,
                    {
                        nextDueDate: CORRECT_DATE,
                        updatePendingPayments: true
                    },
                    { headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY } }
                );
                console.log(`   ✅ Assinatura atualizada! Novo vencimento: ${updateSubRes.data.nextDueDate}`);
            } catch (e: any) {
                console.log(`   ⚠️ Não foi possível atualizar assinatura: ${e.response?.data?.errors?.[0]?.description || e.message}`);
            }
        }
    } catch (e: any) {
        console.log(`   ❌ Erro: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
    }

    // 2. Check and fix payments
    console.log(`\n📋 Verificando cobranças do cliente...`);
    try {
        const payRes = await axios.get(`${ASAAS_API_URL}/payments?customer=${CUSTOMER_ID}&limit=20`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        console.log(`   Total de cobranças: ${payRes.data.data?.length || 0}`);

        for (const payment of payRes.data.data || []) {
            console.log(`   - ${payment.id}: R$ ${payment.value} | ${payment.status} | Venc: ${payment.dueDate} | ${payment.description || ''}`);

            // Fix payment with wrong date (06/02/2026)
            if (payment.dueDate === '2026-02-06' && payment.status === 'PENDING') {
                console.log(`\n   ⚠️ Encontrada cobrança com data errada!`);
                console.log(`   ⏳ Atualizando para ${CORRECT_DATE}...`);

                try {
                    const updateRes = await axios.put(
                        `${ASAAS_API_URL}/payments/${payment.id}`,
                        { dueDate: CORRECT_DATE },
                        { headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY } }
                    );
                    console.log(`   ✅ Cobrança ${payment.id} atualizada! Novo vencimento: ${updateRes.data.dueDate}`);
                } catch (e: any) {
                    console.error(`   ❌ Erro ao atualizar cobrança:`, e.response?.data?.errors || e.message);
                }
            }
        }
    } catch (e: any) {
        console.log(`   ❌ Erro: ${e.message}`);
    }

    console.log('\n========================================');
    console.log('✅ VERIFICAÇÃO/CORREÇÃO FINALIZADA!');
    console.log('========================================\n');
}

fixIgorPayment();
