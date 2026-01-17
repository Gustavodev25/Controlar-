import { firebaseAdmin } from '../api/firebaseAdmin.js';

const userId = process.argv[2] || 'ufpITw1NeichV1AtkNaPeI1acPn1';

const investigate = async () => {
    if (!firebaseAdmin) {
        console.error('Firebase Admin not initialized.');
        process.exit(1);
    }

    const db = firebaseAdmin.firestore();

    console.log(`\n🔍 Investigando usuário: ${userId}\n`);
    console.log('='.repeat(60));

    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.log('❌ Usuário não encontrado!');
            process.exit(1);
        }

        const data = userDoc.data();

        // Basic Info
        console.log('\n📋 INFORMAÇÕES BÁSICAS:');
        console.log(`   Nome: ${data.profile?.name || data.name || 'N/A'}`);
        console.log(`   Email: ${data.profile?.email || data.email || 'N/A'}`);
        console.log(`   Criado em: ${data.createdAt || 'N/A'}`);

        // Root Subscription
        console.log('\n📦 SUBSCRIPTION (Root):');
        if (data.subscription) {
            console.log(JSON.stringify(data.subscription, null, 2));
        } else {
            console.log('   ⚠️ NÃO EXISTE subscription no nível raiz');
        }

        // Profile Subscription
        console.log('\n📦 SUBSCRIPTION (profile.subscription):');
        if (data.profile?.subscription) {
            console.log(JSON.stringify(data.profile.subscription, null, 2));
        } else {
            console.log('   ⚠️ NÃO EXISTE subscription dentro de profile');
        }

        // Connection Logs
        console.log('\n🔌 ÚLTIMOS ACESSOS:');
        const logs = data.connectionLogs || [];
        if (logs.length > 0) {
            logs.slice(0, 5).forEach((log, i) => {
                console.log(`   ${i + 1}. ${log.timestamp} - ${log.browser} / ${log.os}`);
            });
        } else {
            console.log('   Nenhum log de acesso');
        }

        // Check Asaas IDs
        const asaasCustomerId = data.subscription?.asaasCustomerId || data.profile?.subscription?.asaasCustomerId;
        const asaasSubscriptionId = data.subscription?.asaasSubscriptionId || data.profile?.subscription?.asaasSubscriptionId;

        console.log('\n💳 ASAAS IDs:');
        console.log(`   Customer ID: ${asaasCustomerId || 'NÃO ENCONTRADO'}`);
        console.log(`   Subscription ID: ${asaasSubscriptionId || 'NÃO ENCONTRADO'}`);

        // Summary
        console.log('\n' + '='.repeat(60));
        const mergedPlan = data.subscription?.plan || data.profile?.subscription?.plan || 'NÃO DEFINIDO';
        const mergedStatus = data.subscription?.status || data.profile?.subscription?.status || 'NÃO DEFINIDO';

        console.log('\n📊 RESUMO DO PROBLEMA:');
        console.log(`   Plano atual (merge): ${mergedPlan}`);
        console.log(`   Status atual (merge): ${mergedStatus}`);

        if (mergedPlan === 'starter') {
            console.log('\n❓ POSSÍVEIS CAUSAS:');
            if (!asaasSubscriptionId) {
                console.log('   1. 💡 O campo asaasSubscriptionId está vazio - o pagamento pode ter falhado ou o userId não foi passado corretamente');
            }
            if (!data.subscription) {
                console.log('   2. 💡 O campo "subscription" no nível raiz não existe - o servidor pode não ter atualizado');
            }
            if (!data.profile?.subscription) {
                console.log('   3. 💡 O campo "profile.subscription" não existe');
            }
            console.log('\n   🔧 Para corrigir manualmente, execute:');
            console.log(`   node scripts/fix_subscription.js ${userId} pro monthly`);
        }

    } catch (error) {
        console.error('Erro ao investigar usuário:', error);
    }

    process.exit(0);
};

investigate();
