// Script para atualizar o nome da instituição das contas conectadas
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Parse service account from env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const PLUGGY_API_URL = process.env.PLUGGY_API_URL || 'https://api.pluggy.ai';

// Cache para armazenar nomes de conectores já buscados
const connectorCache = new Map();

async function getPluggyApiKey() {
    const response = await axios.post(`${PLUGGY_API_URL}/auth`, {
        clientId: PLUGGY_CLIENT_ID,
        clientSecret: PLUGGY_CLIENT_SECRET
    });
    return response.data.apiKey;
}

async function getItemInfo(apiKey, itemId) {
    // Verificar cache primeiro
    if (connectorCache.has(itemId)) {
        return connectorCache.get(itemId);
    }

    try {
        const response = await axios.get(`${PLUGGY_API_URL}/items/${itemId}`, {
            headers: { 'X-API-KEY': apiKey }
        });

        const connectorName = response.data?.connector?.name || null;
        connectorCache.set(itemId, connectorName);
        return connectorName;
    } catch (error) {
        console.log(`   ⚠️  Não foi possível buscar item ${itemId}: ${error.message}`);
        return null;
    }
}

async function updateInstitutionNames() {
    console.log('🔄 Iniciando atualização de nomes de instituições...\n');

    // Obter API key do Pluggy
    console.log('🔑 Obtendo API key do Pluggy...');
    const apiKey = await getPluggyApiKey();
    console.log('✅ API key obtida!\n');

    // Buscar todos os usuários
    const usersSnapshot = await db.collection('users').get();
    console.log(`👥 Encontrados ${usersSnapshot.size} usuários\n`);

    let totalUpdated = 0;

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        // Buscar contas conectadas do usuário (subcoleção "accounts")
        const accountsRef = db.collection('users').doc(userId).collection('accounts');
        const accountsSnapshot = await accountsRef.get();

        if (accountsSnapshot.empty) continue;

        console.log(`\n📱 Usuário: ${userId}`);
        console.log(`   Contas encontradas: ${accountsSnapshot.size}`);

        for (const accountDoc of accountsSnapshot.docs) {
            const account = accountDoc.data();
            const currentInstitution = account.institution;

            // Pular se já tem um nome válido (não é "Banco" ou similar)
            if (currentInstitution && currentInstitution !== 'Banco' && currentInstitution.length > 5) {
                console.log(`   ✓ ${account.name}: "${currentInstitution}" (já atualizado)`);
                continue;
            }

            // Buscar o nome real do conector via API
            const itemId = account.itemId;
            if (!itemId) {
                console.log(`   ⚠️  ${account.name}: sem itemId`);
                continue;
            }

            const connectorName = await getItemInfo(apiKey, itemId);

            if (connectorName && connectorName !== currentInstitution) {
                // Atualizar no Firestore
                await accountDoc.ref.update({ institution: connectorName });
                console.log(`   ✅ ${account.name}: "${currentInstitution}" → "${connectorName}"`);
                totalUpdated++;
            } else if (!connectorName) {
                console.log(`   ❌ ${account.name}: não foi possível obter nome do conector`);
            } else {
                console.log(`   ○ ${account.name}: "${currentInstitution}" (sem mudança)`);
            }
        }
    }

    console.log(`\n✅ Processo concluído! ${totalUpdated} contas atualizadas.`);
    process.exit(0);
}

updateInstitutionNames().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
