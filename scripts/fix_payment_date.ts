/**
 * Script SIMPLES para corrigir a data de cobrança do Sanderson no Asaas
 * 
 * Problema: Cobrança pay_brgt4svl88e84j9d está com vencimento 06/02/2026
 * Solução: Mudar para 28/01/2026
 * 
 * Execute com: npx ts-node scripts/fix_payment_date.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Asaas config
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = 'https://www.asaas.com/api/v3';

console.log(`🔧 Environment: PRODUCTION`);
console.log(`🔧 API Key: ${ASAAS_API_KEY ? ASAAS_API_KEY.substring(0, 15) + '...' : 'MISSING'}`);

// Payment to fix
const PAYMENT_ID = 'pay_brgt4svl88e84j9d';
const CORRECT_DATE = '2026-01-28';

async function fixPaymentDate() {
    console.log('\n========================================');
    console.log('🔧 CORREÇÃO DE DATA DA COBRANÇA');
    console.log('========================================');
    console.log(`💳 Payment ID: ${PAYMENT_ID}`);
    console.log(`📅 Nova data: ${CORRECT_DATE}`);
    console.log('========================================\n');

    try {
        // 1. Get payment details
        console.log('📋 Buscando detalhes da cobrança...');
        const getResponse = await axios.get(`${ASAAS_API_URL}/payments/${PAYMENT_ID}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        const payment = getResponse.data;
        console.log(`   ID: ${payment.id}`);
        console.log(`   Valor: R$ ${payment.value}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Vencimento atual: ${payment.dueDate}`);
        console.log(`   Descrição: ${payment.description || 'N/A'}`);

        if (payment.dueDate === CORRECT_DATE) {
            console.log('\n✅ A data já está correta!');
            return;
        }

        // 2. Update payment date
        console.log(`\n⏳ Atualizando vencimento para ${CORRECT_DATE}...`);

        const updateResponse = await axios.put(
            `${ASAAS_API_URL}/payments/${PAYMENT_ID}`,
            { dueDate: CORRECT_DATE },
            { headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY } }
        );

        console.log(`\n✅ COBRANÇA ATUALIZADA COM SUCESSO!`);
        console.log(`   Novo vencimento: ${updateResponse.data.dueDate}`);

    } catch (error: any) {
        console.error('\n❌ ERRO:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(`   Message: ${error.message}`);
        }
    }

    console.log('\n========================================');
    console.log('🎉 SCRIPT FINALIZADO!');
    console.log('========================================\n');
}

fixPaymentDate();
