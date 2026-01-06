/**
 * Script para comparar assinaturas entre Firebase e Asaas
 * Identifica discrepâncias entre os sistemas
 * 
 * Uso: node scripts/compare-subscriptions.js
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
const ASAAS_BASE_URL = 'https://api.asaas.com/v3';

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
    console.log('🔍 COMPARANDO ASSINATURAS: Firebase vs Asaas');
    console.log('========================================\n');

    // 1. Get all Firebase users with active pro/family subscriptions
    console.log('📥 Buscando usuários no Firebase...');
    const usersSnapshot = await db.collection('users').get();

    const firebaseActiveUsers = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    usersSnapshot.forEach(doc => {
        const data = doc.data();
        const sub = data.subscription;

        if (sub && sub.status === 'active' && sub.plan !== 'starter') {
            firebaseActiveUsers.push({
                id: doc.id,
                email: data.email || data.profile?.email,
                name: data.name || data.profile?.name,
                plan: sub.plan,
                billingCycle: sub.billingCycle,
                asaasCustomerId: sub.asaasCustomerId,
                asaasSubscriptionId: sub.asaasSubscriptionId,
                nextBillingDate: sub.nextBillingDate,
                paymentMethod: sub.paymentMethod,
                startDate: sub.startDate
            });
        }
    });

    console.log(`   ✅ Encontrados ${firebaseActiveUsers.length} usuários ativos no Firebase\n`);

    // 2. Get all active subscriptions from Asaas
    console.log('📥 Buscando assinaturas no Asaas...');
    let asaasSubscriptions = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const result = await asaasRequest('GET', `/subscriptions?status=ACTIVE&limit=100&offset=${offset}`);
        if (result.data && result.data.length > 0) {
            asaasSubscriptions = asaasSubscriptions.concat(result.data);
            offset += result.data.length;
            hasMore = result.data.length === 100;
        } else {
            hasMore = false;
        }
    }

    console.log(`   ✅ Encontradas ${asaasSubscriptions.length} assinaturas ativas no Asaas\n`);

    // 3. Get this month's payments from Asaas
    console.log('📥 Buscando pagamentos deste mês no Asaas...');
    const startOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const endOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`;

    let asaasPayments = [];
    offset = 0;
    hasMore = true;

    while (hasMore) {
        const result = await asaasRequest('GET', `/payments?dateCreated[ge]=${startOfMonth}&dateCreated[le]=${endOfMonth}&limit=100&offset=${offset}`);
        if (result.data && result.data.length > 0) {
            asaasPayments = asaasPayments.concat(result.data);
            offset += result.data.length;
            hasMore = result.data.length === 100;
        } else {
            hasMore = false;
        }
    }

    // Filter only confirmed/received payments
    const confirmedPayments = asaasPayments.filter(p =>
        p.status === 'CONFIRMED' || p.status === 'RECEIVED' || p.status === 'RECEIVED_IN_CASH'
    );

    console.log(`   ✅ Encontrados ${asaasPayments.length} pagamentos, ${confirmedPayments.length} confirmados\n`);

    // 4. Create lookup maps
    const asaasSubsById = new Map();
    asaasSubscriptions.forEach(sub => {
        asaasSubsById.set(sub.id, sub);
    });

    const asaasSubsByCustomer = new Map();
    asaasSubscriptions.forEach(sub => {
        if (!asaasSubsByCustomer.has(sub.customer)) {
            asaasSubsByCustomer.set(sub.customer, []);
        }
        asaasSubsByCustomer.get(sub.customer).push(sub);
    });

    // 5. Compare and categorize
    const matched = [];        // Firebase users with matching Asaas subscription
    const noAsaasId = [];      // Firebase users without asaasSubscriptionId
    const invalidAsaasId = []; // Firebase users with asaasSubscriptionId that doesn't exist in Asaas
    const coupon100 = [];      // Firebase users with COUPON_100

    firebaseActiveUsers.forEach(user => {
        if (user.paymentMethod === 'COUPON_100') {
            coupon100.push(user);
        } else if (!user.asaasSubscriptionId) {
            noAsaasId.push(user);
        } else if (user.asaasSubscriptionId.startsWith('manual_recheck_needed')) {
            invalidAsaasId.push({ ...user, reason: 'manual_recheck_needed' });
        } else if (!asaasSubsById.has(user.asaasSubscriptionId)) {
            // Check if subscription was maybe cancelled
            invalidAsaasId.push({ ...user, reason: 'not_found_in_asaas' });
        } else {
            matched.push(user);
        }
    });

    // 6. Print results
    console.log('========================================');
    console.log('📊 RESULTADOS DA COMPARAÇÃO');
    console.log('========================================\n');

    console.log(`🟢 CORRETOS (Firebase ↔ Asaas): ${matched.length}`);
    console.log(`🟡 CUPOM 100% (sem Asaas): ${coupon100.length}`);
    console.log(`🔴 SEM ID ASAAS: ${noAsaasId.length}`);
    console.log(`🔴 ID ASAAS INVÁLIDO: ${invalidAsaasId.length}`);
    console.log(`\n📊 TOTAL FIREBASE: ${firebaseActiveUsers.length}`);
    console.log(`📊 TOTAL ASAAS ATIVO: ${asaasSubscriptions.length}`);
    console.log(`📊 PAGAMENTOS CONFIRMADOS ESTE MÊS: ${confirmedPayments.length}`);

    // Details
    if (coupon100.length > 0) {
        console.log('\n----------------------------------------');
        console.log('🟡 USUÁRIOS COM CUPOM 100% (sem cobrança):');
        console.log('----------------------------------------');
        coupon100.forEach(u => {
            console.log(`  • ${u.name || 'N/A'} <${u.email || 'N/A'}>`);
            console.log(`    ID: ${u.id}`);
            console.log(`    Próx. Cobrança: ${u.nextBillingDate}`);
            console.log('');
        });
    }

    if (noAsaasId.length > 0) {
        console.log('\n----------------------------------------');
        console.log('🔴 USUÁRIOS SEM asaasSubscriptionId:');
        console.log('----------------------------------------');
        noAsaasId.forEach(u => {
            console.log(`  • ${u.name || 'N/A'} <${u.email || 'N/A'}>`);
            console.log(`    ID: ${u.id}`);
            console.log(`    Customer ID: ${u.asaasCustomerId || 'N/A'}`);
            console.log(`    Plano: ${u.plan}, Ciclo: ${u.billingCycle}`);
            console.log(`    Início: ${u.startDate}`);
            console.log('');
        });
    }

    if (invalidAsaasId.length > 0) {
        console.log('\n----------------------------------------');
        console.log('🔴 USUÁRIOS COM asaasSubscriptionId INVÁLIDO:');
        console.log('----------------------------------------');
        invalidAsaasId.forEach(u => {
            console.log(`  • ${u.name || 'N/A'} <${u.email || 'N/A'}>`);
            console.log(`    ID: ${u.id}`);
            console.log(`    Asaas Sub ID: ${u.asaasSubscriptionId}`);
            console.log(`    Motivo: ${u.reason}`);
            console.log('');
        });
    }

    // Summary table
    console.log('\n========================================');
    console.log('📋 RESUMO FINAL');
    console.log('========================================\n');

    const shouldBePaying = matched.length + invalidAsaasId.length + noAsaasId.length;
    console.log(`Usuários que DEVERIAM pagar este mês: ${shouldBePaying}`);
    console.log(`Usuários com cupom 100% (grátis este mês): ${coupon100.length}`);
    console.log(`Assinaturas ativas no Asaas: ${asaasSubscriptions.length}`);
    console.log(`Pagamentos confirmados este mês: ${confirmedPayments.length}`);
    console.log(`\n⚠️  DIFERENÇA: ${shouldBePaying - asaasSubscriptions.length} usuários precisam de correção`);

    // List Asaas subscriptions not in Firebase
    const firebaseAsaasIds = new Set(firebaseActiveUsers.map(u => u.asaasSubscriptionId).filter(Boolean));
    const orphanedAsaas = asaasSubscriptions.filter(sub => !firebaseAsaasIds.has(sub.id));

    if (orphanedAsaas.length > 0) {
        console.log('\n----------------------------------------');
        console.log('⚠️  ASSINATURAS ASAAS SEM USUÁRIO NO FIREBASE:');
        console.log('----------------------------------------');
        for (const sub of orphanedAsaas) {
            // Get customer info
            const customer = await asaasRequest('GET', `/customers/${sub.customer}`);
            console.log(`  • ${customer.name || 'N/A'} <${customer.email || 'N/A'}>`);
            console.log(`    Asaas Sub ID: ${sub.id}`);
            console.log(`    Valor: R$ ${sub.value}`);
            console.log(`    Próx. Cobrança: ${sub.nextDueDate}`);
            console.log('');
        }
    }

    // List matched users with their next billing dates
    console.log('\n----------------------------------------');
    console.log('✅ USUÁRIOS CORRETOS (com assinatura no Asaas):');
    console.log('----------------------------------------');
    matched.forEach(u => {
        const asaasSub = asaasSubsById.get(u.asaasSubscriptionId);
        console.log(`  • ${u.name || 'N/A'} <${u.email || 'N/A'}>`);
        console.log(`    Valor Asaas: R$ ${asaasSub?.value || 'N/A'}`);
        console.log(`    Próx. Cobrança: ${asaasSub?.nextDueDate || u.nextBillingDate}`);
        console.log('');
    });

    console.log('\n✅ Comparação concluída!\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
