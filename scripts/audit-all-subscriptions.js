/**
 * Script de Auditoria Completa: Firebase x Asaas
 * 
 * Cruza os dados de todos os assinantes do Firebase com o Asaas
 * para garantir que não terão problemas de cobrança.
 * 
 * Uso: node scripts/audit-all-subscriptions.js
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
async function asaasRequest(endpoint) {
    const res = await fetch(`${ASAAS_BASE_URL}${endpoint}`, {
        headers: { 'access_token': ASAAS_API_KEY }
    });
    return res.json();
}

async function main() {
    console.log('\n========================================');
    console.log('🔍 AUDITORIA COMPLETA: FIREBASE x ASAAS');
    console.log('========================================\n');

    // 1. Buscar todos os usuários com assinatura ativa no Firebase
    console.log('📥 Buscando usuários com assinatura no Firebase...');

    const usersSnapshot = await db.collection('users').get();
    const activeSubscribers = [];

    for (const doc of usersSnapshot.docs) {
        const data = doc.data();
        const sub = data.subscription || data.profile?.subscription;

        if (sub && sub.status === 'active' && sub.plan && sub.plan !== 'starter') {
            activeSubscribers.push({
                firebaseId: doc.id,
                name: data.profile?.name || data.name || 'N/A',
                email: data.profile?.email || data.email || 'N/A',
                plan: sub.plan,
                billingCycle: sub.billingCycle,
                asaasCustomerId: sub.asaasCustomerId,
                asaasSubscriptionId: sub.asaasSubscriptionId,
                nextBillingDate: sub.nextBillingDate,
                paymentMethod: sub.paymentMethod
            });
        }
    }

    console.log(`   Encontrados ${activeSubscribers.length} assinantes ativos no Firebase\n`);

    // 2. Verificar cada assinante no Asaas
    console.log('🔄 Verificando cada assinante no Asaas...\n');

    const results = {
        ok: [],
        warning: [],
        critical: []
    };

    for (const user of activeSubscribers) {
        process.stdout.write(`   Verificando ${user.name}... `);

        if (!user.asaasSubscriptionId || user.asaasSubscriptionId.startsWith('manual_')) {
            results.warning.push({
                ...user,
                issue: 'Sem ID de assinatura no Asaas',
                recommendation: 'Verificar manualmente'
            });
            console.log('⚠️ Sem assinatura Asaas');
            continue;
        }

        try {
            // Buscar assinatura no Asaas
            const subscription = await asaasRequest(`/subscriptions/${user.asaasSubscriptionId}`);

            if (subscription.errors) {
                results.critical.push({
                    ...user,
                    issue: 'Assinatura não encontrada no Asaas',
                    recommendation: 'Criar nova assinatura ou verificar ID'
                });
                console.log('❌ Não encontrada no Asaas');
                continue;
            }

            // Verificar status
            if (subscription.status !== 'ACTIVE') {
                results.warning.push({
                    ...user,
                    issue: `Assinatura ${subscription.status} no Asaas`,
                    asaasStatus: subscription.status,
                    recommendation: 'Reativar ou sincronizar status'
                });
                console.log(`⚠️ Status: ${subscription.status}`);
                continue;
            }

            // Verificar se tem cartão
            const hasCard = !!(subscription.creditCard || subscription.creditCardToken);

            if (!hasCard && subscription.billingType === 'CREDIT_CARD') {
                results.critical.push({
                    ...user,
                    issue: 'Assinatura ATIVA mas SEM CARTÃO',
                    nextDueDate: subscription.nextDueDate,
                    recommendation: 'Enviar link para atualizar cartão'
                });
                console.log('❌ SEM CARTÃO!');
                continue;
            }

            // Buscar próximo pagamento
            const payments = await asaasRequest(`/payments?subscription=${user.asaasSubscriptionId}&status=PENDING&limit=1`);
            const nextPayment = payments.data?.[0];

            results.ok.push({
                ...user,
                asaasStatus: subscription.status,
                hasCard: hasCard,
                cardBrand: subscription.creditCard?.creditCardBrand || 'N/A',
                cardLast4: subscription.creditCard?.creditCardNumber || 'N/A',
                nextDueDate: subscription.nextDueDate,
                nextPaymentId: nextPayment?.id,
                nextPaymentDate: nextPayment?.dueDate,
                nextPaymentStatus: nextPayment?.status
            });
            console.log(`✅ OK (${subscription.creditCard?.creditCardBrand || 'token'} ${subscription.creditCard?.creditCardNumber || ''})`);

        } catch (error) {
            results.warning.push({
                ...user,
                issue: `Erro ao verificar: ${error.message}`,
                recommendation: 'Verificar manualmente'
            });
            console.log('⚠️ Erro');
        }
    }

    // 3. Relatório final
    console.log('\n========================================');
    console.log('📊 RELATÓRIO FINAL');
    console.log('========================================\n');

    console.log(`✅ OK: ${results.ok.length}`);
    console.log(`⚠️  Avisos: ${results.warning.length}`);
    console.log(`❌ Críticos: ${results.critical.length}`);

    // Detalhes dos OK
    if (results.ok.length > 0) {
        console.log('\n========================================');
        console.log('✅ ASSINANTES OK - VÃO SER COBRADOS NORMALMENTE');
        console.log('========================================\n');

        console.log('| Nome | Email | Cartão | Próx. Venc. |');
        console.log('|------|-------|--------|-------------|');
        for (const user of results.ok) {
            const card = user.cardLast4 !== 'N/A' ? `${user.cardBrand} ${user.cardLast4}` : 'Token OK';
            console.log(`| ${user.name.substring(0, 20)} | ${user.email.substring(0, 25)} | ${card} | ${user.nextPaymentDate || user.nextDueDate} |`);
        }
    }

    // Detalhes dos críticos
    if (results.critical.length > 0) {
        console.log('\n========================================');
        console.log('❌ CRÍTICOS - PRECISAM DE AÇÃO IMEDIATA');
        console.log('========================================\n');

        for (const user of results.critical) {
            console.log(`❌ ${user.name} <${user.email}>`);
            console.log(`   Problema: ${user.issue}`);
            console.log(`   Próximo vencimento: ${user.nextDueDate || 'N/A'}`);
            console.log(`   Ação: ${user.recommendation}`);
            console.log('');
        }
    }

    // Detalhes dos avisos
    if (results.warning.length > 0) {
        console.log('\n========================================');
        console.log('⚠️  AVISOS - VERIFICAR MANUALMENTE');
        console.log('========================================\n');

        for (const user of results.warning) {
            console.log(`⚠️  ${user.name} <${user.email}>`);
            console.log(`   Problema: ${user.issue}`);
            console.log(`   Ação: ${user.recommendation}`);
            console.log('');
        }
    }

    // Resumo
    console.log('\n========================================');
    console.log('📋 RESUMO EXECUTIVO');
    console.log('========================================\n');

    const totalActive = activeSubscribers.length;
    const okPercent = ((results.ok.length / totalActive) * 100).toFixed(1);

    console.log(`Total de assinantes ativos: ${totalActive}`);
    console.log(`Funcionando corretamente: ${results.ok.length} (${okPercent}%)`);
    console.log(`Precisam de atenção: ${results.critical.length + results.warning.length}`);

    if (results.critical.length === 0) {
        console.log('\n🎉 NENHUM PROBLEMA CRÍTICO! Todas as cobranças devem funcionar.');
    } else {
        console.log(`\n⚠️  ${results.critical.length} assinantes PRECISAM de ação para evitar problemas.`);
    }

    console.log('\n✅ Auditoria concluída!\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
