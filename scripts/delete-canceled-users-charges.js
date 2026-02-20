/**
 * Script para Apagar Cobranças de Usuários Cancelados no Asaas
 * 
 * Este script:
 * 1. Busca todos os usuários com status 'canceled' no Firebase
 * 2. Para cada usuário cancelado, busca cobranças pendentes no Asaas
 * 3. Deleta as cobranças pendentes encontradas
 * 
 * Uso: node scripts/delete-canceled-users-charges.js
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
    console.log('🗑️  DELETAR COBRANÇAS DE USUÁRIOS CANCELADOS');
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
        console.log('✅ Nenhum usuário cancelado encontrado. Nada a fazer.\n');
        process.exit(0);
    }

    // 2. Para cada usuário cancelado, buscar e deletar cobranças pendentes
    console.log('🔄 Processando cobranças pendentes...\n');

    const results = {
        processed: 0,
        deleted: 0,
        errors: 0,
        noCharges: 0,
        details: []
    };

    for (const user of canceledUsers) {
        results.processed++;
        process.stdout.write(`   [${results.processed}/${canceledUsers.length}] ${user.name}... `);

        // Se não tem ID de assinatura ou cliente no Asaas, pular
        if (!user.asaasSubscriptionId && !user.asaasCustomerId) {
            console.log('⏭️  Sem ID Asaas');
            results.noCharges++;
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

            // Remover duplicatas (caso tenha buscado por ambos)
            const uniquePayments = Array.from(new Map(pendingPayments.map(p => [p.id, p])).values());

            if (uniquePayments.length === 0) {
                console.log('✅ Sem cobranças pendentes');
                results.noCharges++;
                continue;
            }

            // Deletar cada cobrança pendente
            let deletedCount = 0;
            for (const payment of uniquePayments) {
                try {
                    await asaasRequest('DELETE', `/payments/${payment.id}`);
                    deletedCount++;
                } catch (deleteError) {
                    console.error(`\n      ❌ Erro ao deletar cobrança ${payment.id}: ${deleteError.message}`);
                }
            }

            results.deleted += deletedCount;
            console.log(`🗑️  ${deletedCount} cobrança(s) deletada(s)`);

            results.details.push({
                user: user.name,
                email: user.email,
                deletedCount,
                totalFound: uniquePayments.length
            });

        } catch (error) {
            console.log(`❌ Erro: ${error.message}`);
            results.errors++;
        }

        // Pequeno delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 3. Relatório final
    console.log('\n========================================');
    console.log('📊 RELATÓRIO FINAL');
    console.log('========================================\n');

    console.log(`Usuários processados: ${results.processed}`);
    console.log(`Cobranças deletadas: ${results.deleted}`);
    console.log(`Usuários sem cobranças: ${results.noCharges}`);
    console.log(`Erros: ${results.errors}`);

    if (results.details.length > 0) {
        console.log('\n========================================');
        console.log('🗑️  COBRANÇAS DELETADAS');
        console.log('========================================\n');

        for (const detail of results.details) {
            console.log(`✅ ${detail.user} <${detail.email}>`);
            console.log(`   Cobranças deletadas: ${detail.deletedCount}/${detail.totalFound}`);
        }
    }

    console.log('\n✅ Processo concluído!\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
