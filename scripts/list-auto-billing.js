/**
 * Lista completa de todos os assinantes que serão cobrados automaticamente
 * Com data e hora da próxima cobrança
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });

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

async function asaasRequest(endpoint) {
    const res = await fetch(`${ASAAS_BASE_URL}${endpoint}`, {
        headers: { 'access_token': ASAAS_API_KEY }
    });
    return res.json();
}

async function main() {
    console.log('\n========================================');
    console.log('✅ LISTA DE COBRANÇAS AUTOMÁTICAS');
    console.log('========================================\n');

    // Buscar usuários do Firebase
    const usersSnapshot = await db.collection('users').get();
    const subscribers = [];

    for (const doc of usersSnapshot.docs) {
        const data = doc.data();
        const sub = data.subscription || data.profile?.subscription;

        if (sub && sub.status === 'active' && sub.plan && sub.plan !== 'starter') {
            subscribers.push({
                firebaseId: doc.id,
                name: data.profile?.name || data.name || 'N/A',
                email: data.profile?.email || data.email || 'N/A',
                plan: sub.plan,
                asaasCustomerId: sub.asaasCustomerId,
                asaasSubscriptionId: sub.asaasSubscriptionId
            });
        }
    }

    const okList = [];

    for (const user of subscribers) {
        if (!user.asaasSubscriptionId || user.asaasSubscriptionId.startsWith('manual_')) {
            continue;
        }

        try {
            const subscription = await asaasRequest(`/subscriptions/${user.asaasSubscriptionId}`);

            if (subscription.errors || subscription.status !== 'ACTIVE') {
                continue;
            }

            const hasCard = !!(subscription.creditCard || subscription.creditCardToken);

            if (!hasCard && subscription.billingType === 'CREDIT_CARD') {
                continue; // Sem cartão - não vai passar
            }

            // Buscar próximo pagamento
            const payments = await asaasRequest(`/payments?subscription=${user.asaasSubscriptionId}&status=PENDING&limit=1`);
            const nextPayment = payments.data?.[0];

            okList.push({
                name: user.name,
                email: user.email,
                plan: user.plan,
                cardBrand: subscription.creditCard?.creditCardBrand || 'Token',
                cardLast4: subscription.creditCard?.creditCardNumber || 'OK',
                nextDueDate: nextPayment?.dueDate || subscription.nextDueDate,
                paymentId: nextPayment?.id,
                value: nextPayment?.value || subscription.value
            });

        } catch (error) {
            // Skip errors
        }
    }

    // Ordenar por data
    okList.sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));

    // Imprimir tabela
    console.log('| # | Nome | Email | Cartão | Valor | Data Cobrança |');
    console.log('|---|------|-------|--------|-------|---------------|');

    let count = 0;
    for (const user of okList) {
        count++;
        const card = `${user.cardBrand} ${user.cardLast4}`;
        const date = user.nextDueDate;
        console.log(`| ${count} | ${user.name.substring(0, 25)} | ${user.email.substring(0, 30)} | ${card} | R$ ${user.value?.toFixed(2)} | ${date} |`);
    }

    console.log('\n========================================');
    console.log(`📊 TOTAL: ${okList.length} assinantes com cobrança automática`);
    console.log('========================================\n');

    // Agrupar por mês
    const byMonth = {};
    for (const user of okList) {
        const month = user.nextDueDate?.substring(0, 7) || 'N/A';
        if (!byMonth[month]) byMonth[month] = [];
        byMonth[month].push(user);
    }

    console.log('📅 COBRANÇAS POR MÊS:');
    for (const [month, users] of Object.entries(byMonth)) {
        const total = users.reduce((sum, u) => sum + (u.value || 0), 0);
        console.log(`   ${month}: ${users.length} cobranças = R$ ${total.toFixed(2)}`);
    }

    // Verificar os 4 de aviso
    console.log('\n========================================');
    console.log('⚠️  VERIFICANDO OS 4 DE AVISO');
    console.log('========================================\n');

    const warningEmails = [
        'nicolaubatista@hotmail.com',
        'rafaelzanini54@gmail.com',
        'guilherme.luz@controlarmais.com.br',
        'erickdealexandro@gmail.com'
    ];

    for (const email of warningEmails) {
        const userDoc = usersSnapshot.docs.find(d => {
            const data = d.data();
            return (data.profile?.email || data.email) === email;
        });

        if (userDoc) {
            const data = userDoc.data();
            const sub = data.subscription || data.profile?.subscription;
            console.log(`👤 ${data.profile?.name || data.name}`);
            console.log(`   Email: ${email}`);
            console.log(`   Plano: ${sub?.plan}`);
            console.log(`   Status: ${sub?.status}`);
            console.log(`   Asaas ID: ${sub?.asaasSubscriptionId || 'NÃO TEM'}`);
            console.log(`   Customer ID: ${sub?.asaasCustomerId || 'NÃO TEM'}`);
            console.log('');
        }
    }

    console.log('✅ Script finalizado!\n');
    process.exit(0);
}

main().catch(console.error);
