/**
 * Script para corrigir o primeiro mês do Igor Nogueira para R$ 5,00
 * 
 * Execute com: npx ts-node scripts/fix_igor_subscription.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

// Firebase config - use the same as the main app
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDwSj2xb-iZlWMJUBUDG4rN0rJqMxNJi5o",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "controlar-f4bf8.firebaseapp.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "controlar-f4bf8",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "controlar-f4bf8.firebasestorage.app",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "665766682215",
    appId: process.env.VITE_FIREBASE_APP_ID || "1:665766682215:web:d33bed1ae1e1dd9aca1ac2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixIgorSubscription() {
    console.log('🔍 Buscando usuário Igor Nogueira...');

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('profile.email', '==', 'igornog@gmail.com'));

    let snapshot = await getDocs(q);

    // Try alternative field location
    if (snapshot.empty) {
        console.log('Tentando buscar por email no root...');
        const q2 = query(usersRef, where('email', '==', 'igornog@gmail.com'));
        snapshot = await getDocs(q2);
    }

    if (snapshot.empty) {
        console.log('❌ Usuário não encontrado. Buscando por nome...');

        // Fallback: get all users and filter manually
        const allSnapshot = await getDocs(usersRef);
        let found = false;

        for (const docSnap of allSnapshot.docs) {
            const data = docSnap.data();
            const name = data.profile?.name || data.name || '';
            const email = data.profile?.email || data.email || '';

            if (name.toLowerCase().includes('igor') || email.toLowerCase().includes('igor')) {
                console.log(`\n📋 Encontrado: ${name} (${email})`);
                console.log(`   ID: ${docSnap.id}`);
                console.log(`   Subscription:`, JSON.stringify(data.profile?.subscription || data.subscription, null, 2));

                // Ask for confirmation before updating
                console.log('\n⏳ Atualizando firstMonthOverridePrice para 5...');

                const userRef = doc(db, 'users', docSnap.id);

                // Check where subscription is stored
                if (data.profile?.subscription) {
                    await updateDoc(userRef, {
                        'profile.subscription.firstMonthOverridePrice': 5
                    });
                } else if (data.subscription) {
                    await updateDoc(userRef, {
                        'subscription.firstMonthOverridePrice': 5
                    });
                }

                console.log('✅ Atualizado com sucesso!');
                found = true;
                break;
            }
        }

        if (!found) {
            console.log('❌ Nenhum usuário Igor encontrado.');
        }
        return;
    }

    const userDoc = snapshot.docs[0];
    console.log(`✅ Encontrado: ${userDoc.id}`);

    const data = userDoc.data();
    console.log('Subscription atual:', JSON.stringify(data.profile?.subscription || data.subscription, null, 2));

    console.log('\n⏳ Atualizando firstMonthOverridePrice para 5...');

    const userRef = doc(db, 'users', userDoc.id);

    if (data.profile?.subscription) {
        await updateDoc(userRef, {
            'profile.subscription.firstMonthOverridePrice': 5
        });
    } else if (data.subscription) {
        await updateDoc(userRef, {
            'subscription.firstMonthOverridePrice': 5
        });
    }

    console.log('✅ Atualizado com sucesso!');
}

fixIgorSubscription()
    .then(() => {
        console.log('\n🎉 Script finalizado!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Erro:', error);
        process.exit(1);
    });
