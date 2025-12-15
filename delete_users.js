// Script para remover usuários do Firestore
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

// Parse service account from env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

const userIdsToDelete = [
    'JAws8SOPXqeqyre0jjwtm5kHXw82',
    'QCsY7Ptl3KUNdIFrX5F6ONvhOgo2',
    'uWxCjtVyy7cNUB1HsXyOUHidJzB2'
];

// Subcoleções que podem existir dentro de cada usuário
const subcollections = [
    'transactions',
    'reminders',
    'members',
    'investments',
    'budgets',
    'familyGoals',
    'subscriptions',
    'connectedAccounts',
    'creditCardTransactions',
    'notifications'
];

async function deleteCollection(collectionRef) {
    const snapshot = await collectionRef.get();
    if (snapshot.empty) return 0;

    const batch = db.batch();
    let count = 0;

    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        count++;
    });

    await batch.commit();
    return count;
}

async function deleteUser(userId) {
    console.log(`\n🗑️  Deletando usuário: ${userId}`);

    // Deletar subcoleções
    for (const subcol of subcollections) {
        const colRef = db.collection('users').doc(userId).collection(subcol);
        const count = await deleteCollection(colRef);
        if (count > 0) {
            console.log(`   ├─ ${subcol}: ${count} documentos removidos`);
        }
    }

    // Deletar documento principal do usuário
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
        await userRef.delete();
        console.log(`   └─ Documento do usuário removido ✅`);
    } else {
        console.log(`   └─ Usuário não encontrado (já removido ou inexistente)`);
    }
}

async function main() {
    console.log('🔥 Iniciando remoção de usuários do Firestore...');
    console.log(`   Usuários a remover: ${userIdsToDelete.length}`);

    for (const userId of userIdsToDelete) {
        try {
            await deleteUser(userId);
        } catch (error) {
            console.error(`❌ Erro ao deletar ${userId}:`, error.message);
        }
    }

    console.log('\n✅ Processo concluído!');
    process.exit(0);
}

main().catch(console.error);
