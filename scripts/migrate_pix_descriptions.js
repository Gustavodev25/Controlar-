/**
 * Script de Migração: Enriquecer descrições de transações PIX
 * 
 * Este script atualiza as descrições genéricas como "PIX RECEBIDO" para
 * descrições detalhadas como "Pix Recebido De Giga Advisors Ltda"
 * usando os dados do campo pluggyRaw.paymentData já salvos no Firebase.
 * 
 * Funciona para TODAS as contas (não apenas C6) que tenham transações PIX
 * com paymentData disponível.
 * 
 * Uso: node scripts/migrate_pix_descriptions.js
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

// Descrições genéricas que precisam ser enriquecidas
const GENERIC_DESCRIPTIONS = [
    'pix recebido',
    'pix enviado',
    'transf enviada pix',
    'transf recebida pix',
    'transferencia pix',
    'transferência pix',
    'ted recebido',
    'ted enviado',
    'transf enviada',
    'transf recebida'
];

// ============================================================
// Função de enriquecimento (mesma lógica do pluggy.js)
// ============================================================
const enrichTransactionDescription = (tx) => {
    if (!tx) return tx?.description || '';

    const originalDesc = tx.description || '';
    const descLower = originalDesc.toLowerCase();
    const paymentData = tx.paymentData;

    // Se não tem paymentData, retorna descrição original
    if (!paymentData) return originalDesc;

    const payerName = paymentData.payer?.name;
    const receiverName = paymentData.receiver?.name;
    const reason = paymentData.reason;

    // Função auxiliar para formatar nome (Title Case)
    const formatName = (name) => {
        if (!name) return null;
        return name
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // Detectar tipo de transação e enriquecer descrição
    const isPix = descLower.includes('pix') || paymentData.paymentMethod === 'PIX';
    const isTed = descLower.includes('ted') || paymentData.paymentMethod === 'TED';
    const isTransfer = descLower.includes('transf') || descLower.includes('transfer');
    const isReceived = descLower.includes('recebido') || descLower.includes('recebid') ||
        descLower.includes('credit') || descLower.includes('entrada') ||
        tx.type === 'CREDIT' || tx.amount > 0;
    const isSent = descLower.includes('enviado') || descLower.includes('enviad') ||
        descLower.includes('debit') || descLower.includes('saida') ||
        descLower.includes('saída') || tx.type === 'DEBIT' || tx.amount < 0;

    // Para PIX/Transferências recebidas, usar nome do pagador
    if ((isPix || isTed || isTransfer) && isReceived && payerName) {
        const formattedName = formatName(payerName);
        if (isPix) {
            return `Pix Recebido De ${formattedName}`;
        } else if (isTed) {
            return `TED Recebido De ${formattedName}`;
        } else {
            return `Transferência Recebida De ${formattedName}`;
        }
    }

    // Para PIX/Transferências enviadas, usar nome do recebedor
    if ((isPix || isTed || isTransfer) && isSent && receiverName) {
        const formattedName = formatName(receiverName);
        if (isPix) {
            return `Pix Enviado Para ${formattedName}`;
        } else if (isTed) {
            return `TED Enviado Para ${formattedName}`;
        } else {
            return `Transferência Enviada Para ${formattedName}`;
        }
    }

    // Se tem reason (motivo da transferência), usar como descrição adicional
    if (reason && reason.trim().length > 0) {
        // Se a descrição original é muito genérica, usar reason como base
        if (GENERIC_DESCRIPTIONS.some(g => descLower === g)) {
            return reason;
        }
        // Caso contrário, anexar reason se for diferente
        if (!originalDesc.toLowerCase().includes(reason.toLowerCase())) {
            return `${originalDesc} - ${reason}`;
        }
    }

    // Fallback: retorna descrição original
    return originalDesc;
};

// Verifica se a descrição é genérica e precisa ser enriquecida
const isGenericDescription = (description) => {
    if (!description) return false;
    const descLower = description.toLowerCase().trim();
    return GENERIC_DESCRIPTIONS.some(g => descLower === g || descLower.startsWith(g));
};

// ============================================================
// Função principal de migração
// ============================================================
async function migratePixDescriptions() {
    console.log('\n========================================');
    console.log('🔄 MIGRAÇÃO: Enriquecer Descrições PIX');
    console.log('========================================\n');

    try {
        // 1. Buscar todos os usuários
        const usersSnapshot = await db.collection('users').get();
        console.log(`📊 Total de usuários: ${usersSnapshot.size}\n`);

        let totalUsersProcessed = 0;
        let totalTransactionsUpdated = 0;
        let totalTransactionsSkipped = 0;
        let totalTransactionsNoPaymentData = 0;

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const userName = userData.displayName || userData.email || userData.name || userId.slice(0, 12);

            // 2. Buscar TODAS as transações do usuário
            const txSnapshot = await db
                .collection('users')
                .doc(userId)
                .collection('transactions')
                .get();

            if (txSnapshot.size === 0) continue;

            let userTransactionsUpdated = 0;
            let userTransactionsSkipped = 0;
            let userNoPaymentData = 0;
            let batch = db.batch();
            let batchCount = 0;

            for (const txDoc of txSnapshot.docs) {
                const txData = txDoc.data();
                const pluggyRaw = txData.pluggyRaw;

                // Só processa transações com descrições genéricas
                if (!isGenericDescription(txData.description)) {
                    userTransactionsSkipped++;
                    continue;
                }

                if (!pluggyRaw) {
                    userTransactionsSkipped++;
                    continue;
                }

                if (!pluggyRaw.paymentData) {
                    userNoPaymentData++;
                    continue;
                }

                const newDescription = enrichTransactionDescription(pluggyRaw);

                // Só atualiza se a descrição mudou
                if (newDescription !== txData.description) {
                    batch.update(txDoc.ref, {
                        description: newDescription,
                        descriptionOriginal: txData.description,
                        migratedAt: new Date().toISOString()
                    });
                    batchCount++;
                    userTransactionsUpdated++;

                    // Log de exemplo
                    if (userTransactionsUpdated <= 3 && totalTransactionsUpdated < 20) {
                        console.log(`   ✏️ "${txData.description}" → "${newDescription}"`);
                    }

                    // Commit em batches de 450
                    if (batchCount >= 450) {
                        await batch.commit();
                        batch = db.batch();
                        batchCount = 0;
                    }
                } else {
                    userTransactionsSkipped++;
                }
            }

            // Também processar transações de cartão de crédito
            const ccTxSnapshot = await db
                .collection('users')
                .doc(userId)
                .collection('creditCardTransactions')
                .get();

            for (const ccDoc of ccTxSnapshot.docs) {
                const ccData = ccDoc.data();
                const pluggyRaw = ccData.pluggyRaw;

                if (!isGenericDescription(ccData.description)) {
                    userTransactionsSkipped++;
                    continue;
                }

                if (!pluggyRaw) {
                    userTransactionsSkipped++;
                    continue;
                }

                if (!pluggyRaw.paymentData) {
                    userNoPaymentData++;
                    continue;
                }

                const newDescription = enrichTransactionDescription(pluggyRaw);

                if (newDescription !== ccData.description) {
                    batch.update(ccDoc.ref, {
                        description: newDescription,
                        descriptionOriginal: ccData.description,
                        migratedAt: new Date().toISOString()
                    });
                    batchCount++;
                    userTransactionsUpdated++;

                    if (userTransactionsUpdated <= 5 && totalTransactionsUpdated < 30) {
                        console.log(`   ✏️ "${ccData.description}" → "${newDescription}"`);
                    }

                    if (batchCount >= 450) {
                        await batch.commit();
                        batch = db.batch();
                        batchCount = 0;
                    }
                } else {
                    userTransactionsSkipped++;
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }

            if (userTransactionsUpdated > 0) {
                totalUsersProcessed++;
                console.log(`\n👤 ${userName}: ${userTransactionsUpdated} atualizadas`);
            }

            totalTransactionsUpdated += userTransactionsUpdated;
            totalTransactionsSkipped += userTransactionsSkipped;
            totalTransactionsNoPaymentData += userNoPaymentData;
        }

        console.log('\n========================================');
        console.log('📊 RESUMO DA MIGRAÇÃO');
        console.log('========================================');
        console.log(`👥 Usuários com transações atualizadas: ${totalUsersProcessed}`);
        console.log(`✅ Transações atualizadas: ${totalTransactionsUpdated}`);
        console.log(`⏭️ Transações ignoradas: ${totalTransactionsSkipped}`);
        console.log(`📭 Sem paymentData: ${totalTransactionsNoPaymentData}`);
        console.log('========================================\n');

    } catch (error) {
        console.error('\n❌ ERRO na migração:', error.message);
        console.error(error.stack);
    }

    process.exit(0);
}

// Executar
migratePixDescriptions();
