/**
 * Script de Migração V2: Enriquecer descrições de transações PIX
 * 
 * Agora também extrai nomes de descrições no formato C6 Bank:
 * "PIX RECEBIDO   NOME" → "Pix Recebido De Nome"
 * "PIX ENVIADO   NOME" → "Pix Enviado Para Nome"
 * 
 * Uso: node scripts/migrate_pix_descriptions_v2.js
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

// ============================================================
// Função de enriquecimento ATUALIZADA
// ============================================================
const enrichTransactionDescription = (tx) => {
    if (!tx) return tx?.description || '';

    const originalDesc = tx.description || '';
    const descLower = originalDesc.toLowerCase().trim();
    const paymentData = tx.paymentData;

    // Função auxiliar para formatar nome (Title Case)
    const formatName = (name) => {
        if (!name) return null;
        return name
            .trim()
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // ============================================================
    // ETAPA 1: Verificar se a descrição JÁ contém o nome (formato C6 Bank)
    // Padrões: "PIX RECEBIDO   NOME" ou "PIX ENVIADO   NOME"
    // ============================================================

    // Regex para extrair nome após PIX RECEBIDO/ENVIADO com múltiplos espaços
    const pixReceivedWithNameRegex = /^pix\s+recebido\s{2,}(.+)$/i;
    const pixSentWithNameRegex = /^pix\s+enviado\s{2,}(.+)$/i;
    const transfSentPixWithNameRegex = /^transf\s+enviada\s+pix\s{2,}(.+)$/i;
    const transfReceivedPixWithNameRegex = /^transf\s+recebida\s+pix\s{2,}(.+)$/i;

    // Também padrão alternativo: "PIX RECEBIDO C6 NOME" ou "PIX RECEBIDO NOME"
    const pixReceivedC6Regex = /^pix\s+recebido\s+c6\s+(.+)$/i;
    const pixSentC6Regex = /^pix\s+enviado\s+c6\s+(.+)$/i;

    // Verificar PIX RECEBIDO com nome
    let match = originalDesc.match(pixReceivedWithNameRegex);
    if (match && match[1] && match[1].trim().length > 2) {
        return `Pix Recebido De ${formatName(match[1])}`;
    }

    match = originalDesc.match(pixReceivedC6Regex);
    if (match && match[1] && match[1].trim().length > 2) {
        return `Pix Recebido De ${formatName(match[1])}`;
    }

    // Verificar PIX ENVIADO com nome
    match = originalDesc.match(pixSentWithNameRegex);
    if (match && match[1] && match[1].trim().length > 2) {
        return `Pix Enviado Para ${formatName(match[1])}`;
    }

    match = originalDesc.match(pixSentC6Regex);
    if (match && match[1] && match[1].trim().length > 2) {
        return `Pix Enviado Para ${formatName(match[1])}`;
    }

    // Verificar TRANSF com nome
    match = originalDesc.match(transfSentPixWithNameRegex);
    if (match && match[1] && match[1].trim().length > 2) {
        return `Pix Enviado Para ${formatName(match[1])}`;
    }

    match = originalDesc.match(transfReceivedPixWithNameRegex);
    if (match && match[1] && match[1].trim().length > 2) {
        return `Pix Recebido De ${formatName(match[1])}`;
    }

    // ============================================================
    // ETAPA 2: Tentar usar descriptionRaw se for diferente e mais detalhada
    // ============================================================
    const descriptionRaw = tx.descriptionRaw || '';
    if (descriptionRaw && descriptionRaw !== originalDesc && descriptionRaw.length > originalDesc.length) {
        match = descriptionRaw.match(pixReceivedWithNameRegex);
        if (match && match[1]) return `Pix Recebido De ${formatName(match[1])}`;

        match = descriptionRaw.match(pixSentWithNameRegex);
        if (match && match[1]) return `Pix Enviado Para ${formatName(match[1])}`;
    }

    // ============================================================
    // ETAPA 3: Usar paymentData.payer/receiver.name se disponível
    // ============================================================
    if (paymentData) {
        const payerName = paymentData.payer?.name;
        const receiverName = paymentData.receiver?.name;
        const reason = paymentData.reason;

        const isPix = descLower.includes('pix') || paymentData.paymentMethod === 'PIX';
        const isTed = descLower.includes('ted') || paymentData.paymentMethod === 'TED';
        const isTransfer = descLower.includes('transf') || descLower.includes('transfer');
        const isReceived = descLower.includes('recebido') || descLower.includes('recebid') ||
            descLower.includes('credit') || descLower.includes('entrada') ||
            tx.type === 'CREDIT' || tx.amount > 0;
        const isSent = descLower.includes('enviado') || descLower.includes('enviad') ||
            descLower.includes('debit') || descLower.includes('saida') ||
            descLower.includes('saída') || tx.type === 'DEBIT' || tx.amount < 0;

        if ((isPix || isTed || isTransfer) && isReceived && payerName) {
            const formattedName = formatName(payerName);
            if (isPix) return `Pix Recebido De ${formattedName}`;
            if (isTed) return `TED Recebido De ${formattedName}`;
            return `Transferência Recebida De ${formattedName}`;
        }

        if ((isPix || isTed || isTransfer) && isSent && receiverName) {
            const formattedName = formatName(receiverName);
            if (isPix) return `Pix Enviado Para ${formattedName}`;
            if (isTed) return `TED Enviado Para ${formattedName}`;
            return `Transferência Enviada Para ${formattedName}`;
        }

        if (reason && reason.trim().length > 0) {
            const genericPatterns = ['pix recebido', 'pix enviado', 'transf enviada pix', 'transferencia pix'];
            if (genericPatterns.some(p => descLower === p)) {
                return reason;
            }
            if (!originalDesc.toLowerCase().includes(reason.toLowerCase())) {
                return `${originalDesc} - ${reason}`;
            }
        }
    }

    return originalDesc;
};

// Verifica se precisa ser processada (tem nome embutido ou é genérica)
const needsProcessing = (description) => {
    if (!description) return false;
    const d = description.toLowerCase().trim();

    // Padrões que precisam ser processados
    return (
        d.match(/^pix\s+recebido\s{2,}/) ||    // PIX RECEBIDO   NOME
        d.match(/^pix\s+enviado\s{2,}/) ||     // PIX ENVIADO   NOME
        d.match(/^transf\s+enviada\s+pix\s{2,}/) ||
        d.match(/^transf\s+recebida\s+pix\s{2,}/) ||
        d.match(/^pix\s+recebido\s+c6\s+/) ||  // PIX RECEBIDO C6 NOME
        d.match(/^pix\s+enviado\s+c6\s+/) ||
        d === 'pix recebido' ||
        d === 'pix enviado' ||
        d === 'transf enviada pix' ||
        d === 'transf recebida pix'
    );
};

// ============================================================
// Migração
// ============================================================
async function migratePixDescriptionsV2() {
    console.log('\n========================================');
    console.log('🔄 MIGRAÇÃO V2: Extrair Nomes do Formato C6');
    console.log('========================================\n');

    try {
        const usersSnapshot = await db.collection('users').get();
        console.log(`📊 Total de usuários: ${usersSnapshot.size}\n`);

        let totalUsersProcessed = 0;
        let totalTransactionsUpdated = 0;
        let totalTransactionsSkipped = 0;

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const userName = userData.displayName || userData.email || userData.name || userId.slice(0, 12);

            // Buscar TODAS as transações do usuário
            const txSnapshot = await db
                .collection('users')
                .doc(userId)
                .collection('transactions')
                .get();

            let userTransactionsUpdated = 0;
            let batch = db.batch();
            let batchCount = 0;

            for (const txDoc of txSnapshot.docs) {
                const txData = txDoc.data();

                // Só processa transações que precisam
                if (!needsProcessing(txData.description)) {
                    totalTransactionsSkipped++;
                    continue;
                }

                // Usar pluggyRaw se existir, senão usar a própria txData
                const sourceData = txData.pluggyRaw || txData;
                const newDescription = enrichTransactionDescription(sourceData);

                // Só atualiza se a descrição mudou
                if (newDescription !== txData.description) {
                    batch.update(txDoc.ref, {
                        description: newDescription,
                        descriptionOriginal: txData.descriptionOriginal || txData.description,
                        migratedAt: new Date().toISOString(),
                        migratedVersion: 2
                    });
                    batchCount++;
                    userTransactionsUpdated++;

                    if (userTransactionsUpdated <= 5 && totalTransactionsUpdated < 30) {
                        console.log(`   ✏️ "${txData.description}" → "${newDescription}"`);
                    }

                    if (batchCount >= 450) {
                        await batch.commit();
                        batch = db.batch();
                        batchCount = 0;
                    }
                } else {
                    totalTransactionsSkipped++;
                }
            }

            // Também processar creditCardTransactions
            const ccTxSnapshot = await db
                .collection('users')
                .doc(userId)
                .collection('creditCardTransactions')
                .get();

            for (const ccDoc of ccTxSnapshot.docs) {
                const ccData = ccDoc.data();

                if (!needsProcessing(ccData.description)) {
                    totalTransactionsSkipped++;
                    continue;
                }

                const sourceData = ccData.pluggyRaw || ccData;
                const newDescription = enrichTransactionDescription(sourceData);

                if (newDescription !== ccData.description) {
                    batch.update(ccDoc.ref, {
                        description: newDescription,
                        descriptionOriginal: ccData.descriptionOriginal || ccData.description,
                        migratedAt: new Date().toISOString(),
                        migratedVersion: 2
                    });
                    batchCount++;
                    userTransactionsUpdated++;

                    if (batchCount >= 450) {
                        await batch.commit();
                        batch = db.batch();
                        batchCount = 0;
                    }
                } else {
                    totalTransactionsSkipped++;
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
        }

        console.log('\n========================================');
        console.log('📊 RESUMO DA MIGRAÇÃO V2');
        console.log('========================================');
        console.log(`👥 Usuários com transações atualizadas: ${totalUsersProcessed}`);
        console.log(`✅ Transações atualizadas: ${totalTransactionsUpdated}`);
        console.log(`⏭️ Transações ignoradas: ${totalTransactionsSkipped}`);
        console.log('========================================\n');

    } catch (error) {
        console.error('\n❌ ERRO na migração:', error.message);
        console.error(error.stack);
    }

    process.exit(0);
}

migratePixDescriptionsV2();
