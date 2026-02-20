/**
 * Script de Preview - Listar Cobranças de Usuários Cancelados
 * 
 * Este script apenas LISTA (não deleta) os usuários cancelados e suas cobranças pendentes
 * 
 * Uso: node scripts/preview-canceled-users-charges.js
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
const ASAAS_BASE_URL = process.env.ASAAS_API_KEY?.includes('hmlg') 
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://www.asaas.com/api/v3';

// Asaas API helper
async function asaasRequest(method, endpoint, body = null) {
    const options = {
        method,
        headers: { 
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const res = await fetch(`${ASAAS_BASE_URL}${endpoint}`, options);
    return res.json();
}

async function main() {
    console.log('\n========================================');
    console.log('👀 PREVIEW - USUÁRIOS CANCELADOS COM COBRANÇAS');
    console.log('========================================\n');
    
    console.log(`Ambiente: ${ASAAS_BASE_URL.includes('sandbox') ? '🧪 SANDBOX' : '🔴 PRODUÇÃO'}`);
    console.log(`URL: ${ASAAS_BASE_URL}\n`);

    // 1. Buscar todos os usuários cancelados no Firebase
    console.log('📥 Buscando usuários cancelados no Firebase...');

    const usersSnapshot = await db.collection('users').get();
    const canceledUsers = [];

    for (const doc of usersSnapshot.docs) {
        const data = doc.data();
        const sub = data.subscription || data.profile?.subscription;

        if (sub && sub.status === 'canceled') {
            canceledUsers.push({
                firebaseId: doc.id,
                name: data.profile?.name || data.name || 'N/A',
                email: data.profile?.email || data.email || 'N/A',
                plan: sub.plan,
                asaasCustomerId: sub.asaasCustomerId,
                asaasSubscriptionId: sub.asaasSubscriptionId,
                canceledAt: sub.canceledAt
            });
        }
    }

    console.log(`   ✅ Encontrados ${canceledUsers.length} usuários cancelados\n`);

    if (canceledUsers.length === 0) {
        console.log('✅ Nenhum usuário cancelado encontrado.\n');
        process.exit(0);
    }

    // 2. Para cada usuário cancelado, buscar cobranças pendentes (SEM DELETAR)
    console.log('🔄 Verificando cobranças pendentes...\n');

    const usersWithCharges = [];
    const usersWithoutCharges = [];
    let totalCharges = 0;
    let totalAmount = 0;

    for (let i = 0; i < canceledUsers.length; i++) {
        const user = canceledUsers[i];
        process.stdout.write(`   [${i + 1}/${canceledUsers.length}] ${user.name}... `);

        // Se não tem ID de assinatura ou cliente no Asaas, pular
        if (!user.asaasSubscriptionId && !user.asaasCustomerId) {
            console.log('⏭️  Sem ID Asaas');
            usersWithoutCharges.push(user);
            continue;
        }

        try {
            let pendingPayments = [];

            // Buscar cobranças pendentes por assinatura
            if (user.asaasSubscriptionId && !user.asaasSubscriptionId.startsWith('manual_')) {
                const subPayments = await asaasRequest('GET', `/payments?subscription=${user.asaasSubscriptionId}&status=PENDING`);
                if (subPayments.data && subPayments.data.length > 0) {
                    pendingPayments = pendingPayments.concat(subPayments.data);
                }
            }

            // Buscar cobranças pendentes por cliente
            if (user.asaasCustomerId) {
                const custPayments = await asaasRequest('GET', `/payments?customer=${user.asaasCustomerId}&status=PENDING`);
                if (custPayments.data && custPayments.data.length > 0) {
                    pendingPayments = pendingPayments.concat(custPayments.data);
                }
            }

            // Remover duplicatas
            const uniquePayments = Array.from(new Map(pendingPayments.map(p => [p.id, p])).values());

            if (uniquePayments.length === 0) {
                console.log('✅ Sem cobranças');
                usersWithoutCharges.push(user);
                continue;
            }

            const chargesAmount = uniquePayments.reduce((sum, p) => sum + (p.value || 0), 0);
            totalCharges += uniquePayments.length;
            totalAmount += chargesAmount;

            console.log(`⚠️  ${uniquePayments.length} cobrança(s) - R$ ${chargesAmount.toFixed(2)}`);

            usersWithCharges.push({
                ...user,
                charges: uniquePayments.map(p => ({
                    id: p.id,
                    value: p.value,
                    dueDate: p.dueDate,
                    description: p.description
                })),
                totalCharges: uniquePayments.length,
                totalAmount: chargesAmount
            });

        } catch (error) {
            console.log(`❌ Erro: ${error.message}`);
            usersWithoutCharges.push(user);
        }

        // Pequeno delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 3. Relatório detalhado
    console.log('\n========================================');
    console.log('📊 RESUMO');
    console.log('========================================\n');

    console.log(`Total de usuários cancelados: ${canceledUsers.length}`);
    console.log(`Usuários COM cobranças pendentes: ${usersWithCharges.length}`);
    console.log(`Usuários SEM cobranças pendentes: ${usersWithoutCharges.length}`);
    console.log(`Total de cobranças a deletar: ${totalCharges}`);
    console.log(`Valor total das cobranças: R$ ${totalAmount.toFixed(2)}`);

    if (usersWithCharges.length > 0) {
        console.log('\n========================================');
        console.log('⚠️  USUÁRIOS COM COBRANÇAS PENDENTES');
        console.log('========================================\n');

        for (const user of usersWithCharges) {
            console.log(`\n👤 ${user.name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Plano: ${user.plan || 'N/A'}`);
            console.log(`   Cancelado em: ${user.canceledAt || 'N/A'}`);
            console.log(`   Total de cobranças: ${user.totalCharges}`);
            console.log(`   Valor total: R$ ${user.totalAmount.toFixed(2)}`);
            console.log(`   Cobranças:`);
            
            for (const charge of user.charges) {
                console.log(`      - ID: ${charge.id}`);
                console.log(`        Valor: R$ ${charge.value.toFixed(2)}`);
                console.log(`        Vencimento: ${charge.dueDate}`);
                console.log(`        Descrição: ${charge.description || 'N/A'}`);
            }
        }
    }

    console.log('\n========================================');
    console.log('✅ Preview concluído!');
    console.log('========================================\n');
    
    if (usersWithCharges.length > 0) {
        console.log('⚠️  Para deletar essas cobranças, execute:');
        console.log('   node scripts/delete-canceled-users-charges.js\n');
    } else {
        console.log('✅ Nenhuma cobrança pendente encontrada para usuários cancelados.\n');
    }

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
