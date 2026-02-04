/**
 * Script para verificar detalhes de assinaturas vencidas
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
    const subscriptionIds = [
        'sub_w7a4s5ulfuq9bx60', // Sanderson
        'sub_xpoi8sich8mfbzf3', // Junior Dimas
        'sub_s12ndxv6nniz1jqj', // Gregori
    ];

    console.log('\n========================================');
    console.log('🔍 VERIFICANDO ASSINATURAS');
    console.log('========================================\n');

    for (const subId of subscriptionIds) {
        console.log(`\n📋 Assinatura: ${subId}`);
        console.log('----------------------------------------');

        const sub = await asaasRequest('/subscriptions/' + subId);

        console.log('Status:', sub.status);
        console.log('Valor:', `R$ ${sub.value?.toFixed(2)}`);
        console.log('Ciclo:', sub.cycle);
        console.log('Próximo vencimento:', sub.nextDueDate);
        console.log('billingType:', sub.billingType);
        console.log('');
        console.log('💳 DADOS DO CARTÃO:');
        console.log('   creditCardToken:', sub.creditCardToken || '❌ NÃO TEM');
        console.log('   creditCardNumber:', sub.creditCardNumber || 'N/A');
        console.log('   creditCardBrand:', sub.creditCardBrand || 'N/A');

        // Verificar últimos pagamentos
        console.log('');
        console.log('📝 Últimos pagamentos:');
        const payments = await asaasRequest('/payments?subscription=' + subId + '&limit=5');

        if (payments.data) {
            payments.data.forEach(p => {
                const statusIcon = p.status === 'CONFIRMED' || p.status === 'RECEIVED' ? '✅' :
                    p.status === 'OVERDUE' ? '🔴' :
                        p.status === 'PENDING' ? '⏳' :
                            p.status === 'REFUSED' ? '❌' : '❓';
                console.log(`   ${statusIcon} ${p.dueDate} | R$ ${p.value?.toFixed(2)} | ${p.status}`);
            });
        }
    }

    console.log('\n========================================');
    console.log('✅ Verificação concluída');
    console.log('========================================\n');
}

main().catch(console.error);
