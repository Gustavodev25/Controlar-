/**
 * Script para identificar e cobrar novamente pagamentos vencidos no Asaas
 * 
 * Uso: node scripts/charge-overdue.js
 * 
 * Este script:
 * 1. Busca todos os pagamentos com status OVERDUE no Asaas
 * 2. Lista os usuários afetados
 * 3. Tenta cobrar novamente cada pagamento
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

    if (!response.ok) {
        throw new Error(JSON.stringify(data));
    }

    return data;
}

// Get customer info
async function getCustomerInfo(customerId) {
    try {
        const customer = await asaasRequest('GET', `/customers/${customerId}`);
        return customer;
    } catch (error) {
        return { name: 'N/A', email: 'N/A' };
    }
}

// Get Firebase user by customer ID
async function getFirebaseUser(customerId) {
    try {
        const snapshot = await db.collection('users')
            .where('subscription.asaasCustomerId', '==', customerId)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Retry payment - create new charge with same subscription card
async function retryCharge(payment) {
    try {
        // Para cartão de crédito, tentamos criar uma nova cobrança
        // usando o cartão tokenizado da assinatura
        if (payment.subscription) {
            // Buscar assinatura para obter dados do cartão tokenizado
            const subscription = await asaasRequest('GET', `/subscriptions/${payment.subscription}`);

            if (subscription && subscription.status === 'ACTIVE') {
                // Criar nova cobrança usando a assinatura
                // O Asaas usará o cartão já tokenizado
                const newPayment = await asaasRequest('POST', '/payments', {
                    customer: payment.customer,
                    billingType: 'CREDIT_CARD',
                    value: payment.value,
                    dueDate: new Date().toISOString().split('T')[0], // Hoje
                    description: `Retentativa de cobrança - ${payment.description || 'Assinatura'}`,
                    subscription: payment.subscription, // Vincula à assinatura para usar o cartão
                    externalReference: payment.externalReference
                });

                return { success: true, newPayment };
            } else {
                // Assinatura não está ativa, não podemos cobrar
                return { success: false, error: 'Assinatura não está ativa' };
            }
        } else {
            // Pagamento avulso sem assinatura
            return { success: false, error: 'Pagamento sem assinatura vinculada' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('========================================');
    console.log('💳 BUSCANDO PAGAMENTOS VENCIDOS (OVERDUE)');
    console.log('========================================\n');

    // 1. Buscar todos os pagamentos OVERDUE
    let overduePayments = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const result = await asaasRequest('GET', `/payments?status=OVERDUE&limit=100&offset=${offset}`);
        if (result.data && result.data.length > 0) {
            overduePayments = overduePayments.concat(result.data);
            offset += result.data.length;
            hasMore = result.data.length === 100;
        } else {
            hasMore = false;
        }
    }

    console.log(`📊 Encontrados ${overduePayments.length} pagamentos vencidos\n`);

    if (overduePayments.length === 0) {
        console.log('✅ Nenhum pagamento vencido encontrado!');
        process.exit(0);
    }

    // 2. Listar detalhes de cada pagamento
    console.log('----------------------------------------');
    console.log('📋 DETALHES DOS PAGAMENTOS VENCIDOS:');
    console.log('----------------------------------------\n');

    const paymentsInfo = [];

    for (const payment of overduePayments) {
        const customer = await getCustomerInfo(payment.customer);
        const firebaseUser = await getFirebaseUser(payment.customer);

        const info = {
            paymentId: payment.id,
            customerId: payment.customer,
            customerName: customer.name,
            customerEmail: customer.email,
            firebaseUserId: firebaseUser?.id || 'N/A',
            value: payment.value,
            dueDate: payment.dueDate,
            billingType: payment.billingType,
            subscriptionId: payment.subscription || 'N/A',
            description: payment.description
        };

        paymentsInfo.push(info);

        console.log(`💰 Pagamento: ${payment.id}`);
        console.log(`   Cliente: ${customer.name} <${customer.email}>`);
        console.log(`   Firebase ID: ${firebaseUser?.id || 'Não encontrado'}`);
        console.log(`   Valor: R$ ${payment.value.toFixed(2)}`);
        console.log(`   Vencimento: ${payment.dueDate}`);
        console.log(`   Tipo: ${payment.billingType}`);
        console.log(`   Assinatura: ${payment.subscription || 'Avulso'}`);
        console.log('');
    }

    // 3. Resumo
    console.log('========================================');
    console.log('📊 RESUMO');
    console.log('========================================\n');

    const totalValue = overduePayments.reduce((acc, p) => acc + p.value, 0);
    console.log(`Total de pagamentos vencidos: ${overduePayments.length}`);
    console.log(`Valor total em aberto: R$ ${totalValue.toFixed(2)}`);

    // Agrupar por tipo de cobrança
    const byType = overduePayments.reduce((acc, p) => {
        acc[p.billingType] = (acc[p.billingType] || 0) + 1;
        return acc;
    }, {});
    console.log('\nPor tipo de cobrança:');
    Object.entries(byType).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}`);
    });

    // 4. Perguntar se quer tentar cobrar
    console.log('\n========================================');
    console.log('🔄 OPÇÕES DE COBRANÇA');
    console.log('========================================\n');

    console.log('Para cobrar novamente, você pode:');
    console.log('');
    console.log('1. No painel do Asaas:');
    console.log('   - Ir em Cobranças → Filtrar por "Vencidas"');
    console.log('   - Selecionar as cobranças e clicar em "Cobrar novamente"');
    console.log('');
    console.log('2. Via API (cartão de crédito):');
    console.log('   - O Asaas vai tentar cobrar usando o cartão tokenizado da assinatura');
    console.log('   - Execute: node scripts/charge-overdue.js --execute');
    console.log('');

    // Check if --execute flag is passed
    const shouldExecute = process.argv.includes('--execute');

    if (shouldExecute) {
        console.log('========================================');
        console.log('⚡ EXECUTANDO RETENTATIVAS DE COBRANÇA');
        console.log('========================================\n');

        let successCount = 0;
        let failCount = 0;

        for (const payment of overduePayments) {
            // Só tenta cobrar cartão de crédito
            if (payment.billingType !== 'CREDIT_CARD') {
                console.log(`⏭️  Pulando ${payment.id} - Tipo: ${payment.billingType} (não é cartão)`);
                continue;
            }

            console.log(`\n🔄 Tentando cobrar ${payment.id}...`);

            const result = await retryCharge(payment);

            if (result.success) {
                console.log(`   ✅ SUCESSO! Nova cobrança: ${result.newPayment.id}`);
                console.log(`   Status: ${result.newPayment.status}`);
                successCount++;
            } else {
                console.log(`   ❌ FALHA: ${result.error}`);
                failCount++;
            }
        }

        console.log('\n========================================');
        console.log('📊 RESULTADO DAS RETENTATIVAS');
        console.log('========================================\n');
        console.log(`✅ Sucesso: ${successCount}`);
        console.log(`❌ Falha: ${failCount}`);
    } else {
        console.log('💡 Para executar as cobranças automaticamente, rode:');
        console.log('   node scripts/charge-overdue.js --execute');
    }

    console.log('\n✅ Script finalizado!\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
