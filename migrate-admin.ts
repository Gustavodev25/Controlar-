// Script para migrar isAdmin do nível raiz para dentro do profile
// Execute este arquivo uma vez usando: npx tsx migrate-admin.ts

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

// Cole suas credenciais do Firebase aqui
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateAdminToProfile(userId: string) {
  try {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      console.error('❌ Usuário não encontrado');
      return;
    }

    const data = snap.data();
    console.log('📋 Dados atuais:', {
      rootIsAdmin: data.isAdmin,
      profileIsAdmin: data.profile?.isAdmin
    });

    // Se isAdmin existe no root mas não no profile, copiar
    if (data.isAdmin === true && data.profile?.isAdmin !== true) {
      await updateDoc(userRef, {
        'profile.isAdmin': true
      });
      console.log('✅ isAdmin migrado para profile.isAdmin com sucesso!');
    } else if (data.profile?.isAdmin === true) {
      console.log('✅ profile.isAdmin já está definido como true');
    } else {
      console.log('⚠️ isAdmin não está definido como true no root');
    }

    // Verificar resultado
    const updatedSnap = await getDoc(userRef);
    const updatedData = updatedSnap.data();
    console.log('📋 Dados após migração:', {
      rootIsAdmin: updatedData?.isAdmin,
      profileIsAdmin: updatedData?.profile?.isAdmin
    });

  } catch (error) {
    console.error('❌ Erro na migração:', error);
  }
}

// Seu user ID
const USER_ID = 'QhSwFzrJ9kSiR2h2GYeLm8xeCky1';

console.log('🚀 Iniciando migração...\n');
migrateAdminToProfile(USER_ID)
  .then(() => {
    console.log('\n✅ Migração concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });
