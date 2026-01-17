import { firebaseAdmin } from '../api/firebaseAdmin.js';

const userId = process.argv[2];
const plan = process.argv[3] || 'pro';
const status = process.argv[4] || 'active';

if (!userId) {
    console.log('❌ Uso: node scripts/fix_subscription.js <userId> [plan] [status]');
    console.log('   Exemplo: node scripts/fix_subscription.js ufpITw1NeichV1AtkNaPeI1acPn1 pro active');
    process.exit(1);
}

const fix = async () => {
    if (!firebaseAdmin) {
        console.error('Firebase Admin not initialized.');
        process.exit(1);
    }

    const db = firebaseAdmin.firestore();

    console.log(`\n🔧 Corrigindo assinatura do usuário: ${userId}`);
    console.log(`   Plano: ${plan}`);
    console.log(`   Status: ${status}`);
    console.log('');

    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.log('❌ Usuário não encontrado!');
            process.exit(1);
        }

        const now = new Date().toISOString();

        // Update BOTH subscription.* AND profile.subscription.* for consistency
        await userRef.update({
            'subscription.plan': plan,
            'subscription.status': status,
            'subscription.updatedAt': now,
            'profile.subscription.plan': plan,
            'profile.subscription.status': status,
            'profile.subscription.updatedAt': now
        });

        console.log('✅ Assinatura corrigida com sucesso!');
        console.log('');
        console.log('📋 Dados atualizados:');
        console.log(`   subscription.plan: ${plan}`);
        console.log(`   subscription.status: ${status}`);
        console.log(`   profile.subscription.plan: ${plan}`);
        console.log(`   profile.subscription.status: ${status}`);

    } catch (error) {
        console.error('❌ Erro ao corrigir assinatura:', error);
    }

    process.exit(0);
};

fix();
