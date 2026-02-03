/**
 * Installment Service - Sistema de Parcelas Independente
 *
 * A Pluggy NÃO é dona da regra de parcelamento.
 * Ela só replica o que o banco manda (incompleto/inconsistente).
 * Este serviço é a FONTE DA VERDADE para parcelas.
 *
 * Conceitos:
 * - Purchase: Compra parcelada (entidade PAI)
 * - Installment: Parcela individual (entidade FILHA)
 * - Fatura é apenas AGRUPADOR, parcela é o DADO real
 */

import {
  Transaction,
  Purchase,
  Installment,
  InstallmentStatus,
  PurchaseWithInstallments,
  InstallmentsByMonth,
  InstallmentForecast
} from '../types';

import {
  adjustClosingDate,
  adjustDueDate,
  isBusinessDay
} from '../utils/dateUtils';

import {
  toCents,
  fromCents,
  sumMoney
} from '../utils/moneyUtils';

// ============================================================
// HELPERS
// ============================================================

/**
 * Gera ID único para compra
 */
const generatePurchaseId = (tx: Transaction): string => {
  const normalized = normalizeDescription(tx.description || '');
  const cardId = tx.cardId || tx.accountId || 'unknown';
  const total = tx.totalInstallments || 1;
  return `purchase_${cardId}_${normalized.slice(0, 20)}_${total}x_${tx.date}`;
};

/**
 * Gera ID único para parcela
 */
const generateInstallmentId = (purchaseId: string, installmentNumber: number): string => {
  return `${purchaseId}_inst_${installmentNumber}`;
};

/**
 * Normaliza descrição para agrupar parcelas
 */
export const normalizeDescription = (desc: string): string => {
  return (desc || '')
    .trim()
    .toLowerCase()
    .replace(/\s*\d+\s*\/\s*\d+\s*$/g, '')  // Remove "1/10" no final
    .replace(/\s*\d+\/\d+\s*/g, '')          // Remove "1/10" no meio
    .replace(/\s*parcela\s*\d+\s*/gi, '')    // Remove "parcela 1"
    .replace(/\s*parc\s*\d+\s*/gi, '')       // Remove "parc 1"
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')             // Remove caracteres especiais
    .trim();
};

// Merchants que NÃO devem ser tratados como parcelamento, mesmo com campos preenchidos
const NON_INSTALLMENT_MERCHANTS = new Set([
  'mpinnerai',
  'manual saude bra'
]);

const shouldIgnoreInstallment = (tx: Transaction): boolean => {
  const normalized = normalizeDescription(tx.description || '');
  return NON_INSTALLMENT_MERCHANTS.has(normalized);
};

/**
 * Extrai número de parcela da descrição (ex: "COMPRA 3/10")
 */
export const extractInstallmentFromDesc = (desc: string): { current: number; total: number } | null => {
  const match = (desc || '').match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    const current = parseInt(match[1]);
    const total = parseInt(match[2]);
    if (current > 0 && total > 0 && current <= total) {
      return { current, total };
    }
  }
  return null;
};

/**
 * Extrai dados de parcelamento de uma transação de qualquer fonte disponível.
 * 
 * FONTES DE DADOS (em ordem de prioridade):
 * 1. tx.pluggyRaw?.creditCardMetadata (dados brutos da API Pluggy - fonte da verdade quando presente)
 * 2. tx.totalInstallments / tx.installmentNumber (campos diretos, fallback para transações manuais/legadas)
 */
export const extractInstallmentInfo = (tx: Transaction): { totalInstallments: number; installmentNumber: number } => {
  let totalInstallments = 1;
  let installmentNumber = 1;

  if (shouldIgnoreInstallment(tx)) {
    return { totalInstallments, installmentNumber };
  }

  // PRIORIDADE 1: pluggyRaw.creditCardMetadata (quando presente, é a fonte da verdade)
  const pluggyRaw = (tx as any).pluggyRaw;
  const isPluggy = (tx as any).importSource === 'pluggy';
  if (pluggyRaw?.creditCardMetadata) {
    const ccMeta = pluggyRaw.creditCardMetadata;
    if (ccMeta.totalInstallments && ccMeta.totalInstallments > 1) {
      totalInstallments = ccMeta.totalInstallments;
      installmentNumber = ccMeta.installmentNumber || 1;
      return { totalInstallments, installmentNumber };
    }
    // Se a Pluggy não indicar parcelamento, NÃO usar campos diretos
    return { totalInstallments, installmentNumber };
  }

  // Se é transação Pluggy, mas não temos metadados brutos,
  // NÃO confiar em campos diretos (evita falsos parcelamentos).
  if (isPluggy) {
    return { totalInstallments, installmentNumber };
  }

  // PRIORIDADE 2: Campos diretos da transação (fallback)
  if (tx.totalInstallments && tx.totalInstallments > 1) {
    totalInstallments = tx.totalInstallments;
    installmentNumber = tx.installmentNumber || 1;
    return { totalInstallments, installmentNumber };
  }

  return { totalInstallments, installmentNumber };
};

/**
 * Converte string YYYY-MM-DD para Date
 */
const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d || 1, 12, 0, 0);
};

/**
 * Converte Date para string YYYY-MM-DD
 */
const toDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Cria monthKey (YYYY-MM) a partir de uma data
 */
const toMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// ============================================================
// REGRA DE ALOCAÇÃO DE PARCELA NA FATURA
// ============================================================

/**
 * Calcula em qual mês/fatura uma parcela deve cair.
 *
 * REGRA FUNDAMENTAL:
 * - Se compra foi feita ANTES do billingDay → parcela 1 entra na fatura do MÊS ATUAL
 * - Se compra foi feita NO DIA ou APÓS o billingDay → parcela 1 entra na fatura do MÊS SEGUINTE
 *
 * Exemplo:
 * - billingDay = 10
 * - Compra dia 07/jan → parcela 1 na fatura de JAN (fecha 10/jan)
 * - Compra dia 12/jan → parcela 1 na fatura de FEV (fecha 10/fev)
 */
export const calculateFirstBillingMonth = (
  purchaseDate: string,
  billingDay: number
): string => {
  const date = parseDate(purchaseDate);
  const purchaseDay = date.getDate();

  let year = date.getFullYear();
  let month = date.getMonth();

  // Se compra foi DEPOIS do dia de fechamento, vai para o próximo mês
  if (purchaseDay > billingDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return `${year}-${String(month + 1).padStart(2, '0')}`;
};

/**
 * Calcula o mês de uma parcela específica.
 *
 * Parcela N = firstBillingMonth + (N - 1) meses
 */
export const calculateInstallmentMonth = (
  firstBillingMonth: string,
  installmentNumber: number
): string => {
  const [year, month] = firstBillingMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + (installmentNumber - 1), 1);
  return toMonthKey(date);
};

/**
 * Calcula a data de fechamento para um mês específico
 * Considera regras bancárias para fins de semana e feriados.
 */
export const calculateBillingDate = (
  monthKey: string,
  billingDay: number
): string => {
  const [year, month] = monthKey.split('-').map(Number);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(billingDay, lastDayOfMonth);

  const closingDate = new Date(year, month - 1, safeDay, 12, 0, 0);
  return toDateStr(adjustClosingDate(closingDate));
};

/**
 * Calcula a data de vencimento para um mês específico
 * Considera regras bancárias para fins de semana e feriados.
 */
export const calculateDueDate = (
  monthKey: string,
  billingDay: number,
  dueDay: number
): string => {
  const [year, month] = monthKey.split('-').map(Number);

  // Vencimento é no mês seguinte ao fechamento
  let dueYear = year;
  let dueMonth = month + 1;
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }

  const lastDayOfTargetMonth = new Date(dueYear, dueMonth, 0).getDate();
  const safeDay = Math.min(dueDay, lastDayOfTargetMonth);

  const dueDate = new Date(dueYear, dueMonth - 1, safeDay, 12, 0, 0);
  return toDateStr(adjustDueDate(dueDate));
};

// ============================================================
// GERAÇÃO DE PARCELAS
// ============================================================

/**
 * Determina o status de uma parcela baseado na data atual
 */
const determineInstallmentStatus = (
  billingDate: string,
  dueDate: string,
  isPaid: boolean = false
): InstallmentStatus => {
  if (isPaid) return 'PAID';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const billing = parseDate(billingDate);
  const due = parseDate(dueDate);

  // Fatura ainda não fechou
  if (today <= billing) {
    return 'OPEN';
  }

  // Fatura fechou mas ainda não venceu
  if (today <= due) {
    return 'CLOSED';
  }

  // Venceu e não foi paga
  return 'FUTURE'; // Na verdade seria OVERDUE, mas mantemos FUTURE para parcelas futuras
};

/**
 * Gera todas as parcelas de uma compra.
 *
 * Este é o método principal que cria as N parcelas de uma compra,
 * alocando cada uma na fatura correta.
 */
export const generateInstallments = (
  purchase: Purchase,
  existingTransactions: Transaction[] = [],
  dueDay: number = 10
): Installment[] => {
  const installments: Installment[] = [];

  // Criar mapa de transações existentes por número de parcela
  const existingByNumber = new Map<number, Transaction>();
  existingTransactions.forEach(tx => {
    const instNum = tx.installmentNumber || 1;
    existingByNumber.set(instNum, tx);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i <= purchase.totalInstallments; i++) {
    const monthKey = calculateInstallmentMonth(purchase.firstBillingMonth, i);
    const billingDate = calculateBillingDate(monthKey, purchase.billingDay);
    const dueDateStr = calculateDueDate(monthKey, purchase.billingDay, dueDay);

    const existingTx = existingByNumber.get(i);
    const isFromAPI = !!existingTx;

    // Determinar status
    const billingDateObj = parseDate(billingDate);
    const dueDateObj = parseDate(dueDateStr);

    let status: InstallmentStatus;
    if (today < billingDateObj) {
      status = 'FUTURE';
    } else if (today <= dueDateObj) {
      status = 'OPEN';
    } else {
      status = 'CLOSED';
    }

    // override monthKey if manualInvoiceMonth is present on existing transaction
    const finalMonthKey = existingTx?.manualInvoiceMonth || monthKey;

    const installment: Installment = {
      id: existingTx?.id || generateInstallmentId(purchase.id, i),
      purchaseId: purchase.id,
      installmentNumber: i,
      totalInstallments: purchase.totalInstallments,
      amount: purchase.installmentAmount,
      referenceMonth: finalMonthKey, // Use the final month key (manual or calculated)
      billingDate,
      dueDate: dueDateStr,
      status,
      description: existingTx?.description || purchase.description,
      category: purchase.category,
      creditCardId: purchase.creditCardId,
      purchaseDate: purchase.purchaseDate,
      isProjected: !isFromAPI,
      isFromAPI,
      transactionId: existingTx?.id,
      // Se tiver transação real, usa a data dela. Se não, estima (purchaseDate + N meses)
      date: existingTx?.date
        ? existingTx.date
        : (() => {
          const pDate = parseDate(purchase.purchaseDate);
          pDate.setMonth(pDate.getMonth() + (i - 1));
          return toDateStr(pDate);
        })(),
      // Propagate refund info
      _refundAmount: (existingTx as any)?._refundAmount,
      isRefund: (existingTx as any)?.isRefund,
      _manualRefund: (existingTx as any)?._manualRefund,
      manualInvoiceMonth: existingTx?.manualInvoiceMonth
    };

    installments.push(installment);
  }

  return installments;
};

// ============================================================
// PROCESSAMENTO DE TRANSAÇÕES
// ============================================================

/**
 * Detecta se uma transação é parte de uma compra parcelada
 * 
 * FONTES DE DADOS (em ordem de prioridade):
 * 1. tx.pluggyRaw?.creditCardMetadata?.totalInstallments (dados brutos da API - fonte da verdade quando presente)
 * 2. tx.totalInstallments (campo no nível superior - fallback para transações manuais/legadas)
 */
export const isInstallmentTransaction = (tx: Transaction): boolean => {
  if (shouldIgnoreInstallment(tx)) {
    return false;
  }

  // PRIORIDADE 1: pluggyRaw.creditCardMetadata (quando presente, é a fonte da verdade)
  const pluggyRaw = (tx as any).pluggyRaw;
  const isPluggy = (tx as any).importSource === 'pluggy';
  if (pluggyRaw?.creditCardMetadata) {
    return !!(pluggyRaw.creditCardMetadata.totalInstallments && pluggyRaw.creditCardMetadata.totalInstallments > 1);
  }

  // Se é transação Pluggy sem metadados, não tratar como parcelada
  if (isPluggy) {
    return false;
  }

  // PRIORIDADE 2: Campo no nível superior da transação (fallback)
  if (tx.totalInstallments && tx.totalInstallments > 1) {
    return true;
  }

  return false;
};

/**
 * Calcula o referenceMonth para uma parcela específica baseado na data da transação.
 *
 * LÓGICA INTELIGENTE:
 * A data da transação representa a parcela N atual.
 * Para calcular o mês da parcela 1, voltamos (N-1) meses.
 * Para calcular o mês da parcela X, avançamos (X-1) meses a partir da parcela 1.
 *
 * Exemplo: Parcela 2/3 com data 15/dez, billingDay = 1
 * - Data 15/dez >= billingDay 1, então esta parcela cai em JANEIRO
 * - Parcela 1 caiu em DEZEMBRO (janeiro - 1)
 * - Parcela 3 cairá em FEVEREIRO (janeiro + 1)
 */
export const calculateInstallmentReferenceMonth = (
  txDate: string,
  txInstallmentNumber: number,
  targetInstallmentNumber: number,
  billingDay: number
): string => {
  const date = parseDate(txDate);
  const day = date.getDate();

  // Primeiro, determinar em qual mês a transação atual (parcela N) cai
  let currentInstallmentMonth = date.getMonth();
  let currentInstallmentYear = date.getFullYear();

  // Se a data > billingDay, a parcela atual cai no MÊS SEGUINTE
  if (day > billingDay) {
    currentInstallmentMonth += 1;
    if (currentInstallmentMonth > 11) {
      currentInstallmentMonth = 0;
      currentInstallmentYear += 1;
    }
  }

  // Agora calcular o mês da parcela alvo
  // Diferença de parcelas: targetInstallmentNumber - txInstallmentNumber
  const monthDiff = targetInstallmentNumber - txInstallmentNumber;

  const targetDate = new Date(currentInstallmentYear, currentInstallmentMonth + monthDiff, 1);

  return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Cria uma Purchase a partir de uma transação parcelada
 */
export const createPurchaseFromTransaction = (
  tx: Transaction,
  billingDay: number
): Purchase | null => {
  if (!isInstallmentTransaction(tx)) {
    return null;
  }

  // Usa helper centralizado que verifica todas as fontes de dados
  const { totalInstallments, installmentNumber } = extractInstallmentInfo(tx);

  if (totalInstallments <= 1) {
    return null;
  }

  const installmentAmount = Math.abs(tx.amount);
  const totalAmount = installmentAmount * totalInstallments;

  let firstBillingMonth: string;

  if (tx.manualInvoiceMonth) {
    // Se o usuário forçou um mês específico para esta parcela,
    // calculamos o mês de início (parcela 1) com engenharia reversa.
    const [mY, mM] = tx.manualInvoiceMonth.split('-').map(Number);
    // Parcela 1 = Mês Manual - (N - 1) meses
    const startD = new Date(mY, mM - 1 - (installmentNumber - 1), 1);
    firstBillingMonth = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}`;
  } else {
    // Lógica padrão: calcula baseado na data e dia de fechamento
    firstBillingMonth = calculateInstallmentReferenceMonth(
      tx.date,
      installmentNumber,
      1, // Parcela 1
      billingDay
    );
  }

  // Data da compra é estimada (não crítica, apenas para referência)
  const txDate = parseDate(tx.date);
  const purchaseDate = new Date(txDate);
  purchaseDate.setMonth(purchaseDate.getMonth() - (installmentNumber - 1));

  const purchase: Purchase = {
    id: generatePurchaseId(tx),
    creditCardId: tx.cardId || tx.accountId || '',
    transactionId: tx.id,
    description: tx.description || '',
    totalAmount,
    installmentAmount,
    totalInstallments,
    purchaseDate: toDateStr(purchaseDate),
    billingDay,
    firstBillingMonth,
    category: tx.category,
    createdAt: new Date().toISOString(),
    source: 'pluggy'
  };

  return purchase;
};

/**
 * Processa todas as transações e extrai compras parceladas com suas parcelas.
 *
 * Este método:
 * 1. Identifica transações parceladas
 * 2. Agrupa por compra (mesma descrição normalizada + total de parcelas)
 * 3. Cria Purchase para cada grupo
 * 4. Gera todas as Installments (incluindo futuras projetadas)
 */
export const processTransactionsToInstallments = (
  transactions: Transaction[],
  billingDay: number,
  dueDay: number = 10
): PurchaseWithInstallments[] => {
  // Agrupar transações parceladas por chave única
  const purchaseGroups = new Map<string, Transaction[]>();

  // DEBUG: Contar transações parceladas
  let installmentTxCount = 0;
  let nonInstallmentTxCount = 0;

  transactions.forEach(tx => {
    if (!isInstallmentTransaction(tx)) {
      nonInstallmentTxCount++;
      return;
    }
    installmentTxCount++;

    // Usa helper centralizado que verifica todas as fontes de dados
    const { totalInstallments, installmentNumber } = extractInstallmentInfo(tx);

    if (totalInstallments <= 1) return;

    const normalizedDesc = normalizeDescription(tx.description || '');
    const cardId = tx.cardId || tx.accountId || 'unknown';

    // Chave única: cartão + descrição normalizada + total de parcelas
    const groupKey = `${cardId}_${normalizedDesc}_${totalInstallments}x`;

    if (!purchaseGroups.has(groupKey)) {
      purchaseGroups.set(groupKey, []);
    }
    purchaseGroups.get(groupKey)!.push(tx);
  });

  // Log removed
  console.log('[installmentService] Análise de transações:', {
    totalInputTxs: transactions.length,
    installmentTxCount,
    nonInstallmentTxCount,
    purchaseGroups: purchaseGroups.size,
    // Amostra de 3 transações para debug
    sample: transactions.slice(0, 3).map(tx => ({
      desc: tx.description?.slice(0, 40),
      totalInstallments: tx.totalInstallments,
    }))
  });

  const results: PurchaseWithInstallments[] = [];

  purchaseGroups.forEach((txGroup, groupKey) => {
    // Encontrar a transação com menor número de parcela (mais próxima da compra original)
    let earliestTx = txGroup[0];
    let earliestInstNum = 999;

    txGroup.forEach(tx => {
      const instNum = tx.installmentNumber || 1;
      if (instNum < earliestInstNum) {
        earliestInstNum = instNum;
        earliestTx = tx;
      }
    });

    // Criar Purchase
    const purchase = createPurchaseFromTransaction(earliestTx, billingDay);
    if (!purchase) return;

    // Gerar todas as parcelas
    const installments = generateInstallments(purchase, txGroup, dueDay);

    results.push({ purchase, installments });
  });

  return results;
};

// ============================================================
// ALOCAÇÃO EM FATURAS
// ============================================================

/**
 * Agrupa parcelas por mês para alocação em faturas.
 */
export const groupInstallmentsByMonth = (
  installments: Installment[]
): InstallmentsByMonth => {
  const byMonth: InstallmentsByMonth = {};

  installments.forEach(inst => {
    if (!byMonth[inst.referenceMonth]) {
      byMonth[inst.referenceMonth] = [];
    }
    byMonth[inst.referenceMonth].push(inst);
  });

  // Ordenar parcelas dentro de cada mês por data
  Object.keys(byMonth).forEach(month => {
    byMonth[month].sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
  });

  return byMonth;
};

/**
 * Obtém parcelas para um mês específico.
 */
export const getInstallmentsForMonth = (
  purchases: PurchaseWithInstallments[],
  monthKey: string
): Installment[] => {
  const installments: Installment[] = [];

  purchases.forEach(({ installments: purchaseInstallments }) => {
    purchaseInstallments.forEach(inst => {
      if (inst.referenceMonth === monthKey) {
        installments.push(inst);
      }
    });
  });

  return installments.sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
};

// ============================================================
// PREVISÃO FUTURA
// ============================================================

/**
 * Gera previsão de parcelas para os próximos N meses.
 */
export const generateInstallmentForecast = (
  purchases: PurchaseWithInstallments[],
  monthsAhead: number = 12
): InstallmentForecast[] => {
  const today = new Date();
  const forecasts: InstallmentForecast[] = [];

  for (let i = 0; i < monthsAhead; i++) {
    const forecastDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const monthKey = toMonthKey(forecastDate);

    const monthInstallments = getInstallmentsForMonth(purchases, monthKey);

    const forecast: InstallmentForecast = {
      monthKey,
      totalAmount: sumMoney(...monthInstallments.map(inst => inst.amount)),
      installmentsCount: monthInstallments.length,
      purchases: monthInstallments.map(inst => ({
        purchaseId: inst.purchaseId,
        description: inst.description,
        installmentNumber: inst.installmentNumber,
        totalInstallments: inst.totalInstallments,
        amount: inst.amount
      }))
    };

    forecasts.push(forecast);
  }

  return forecasts;
};

/**
 * Calcula o total comprometido em parcelas futuras.
 */
export const calculateFutureCommitment = (
  purchases: PurchaseWithInstallments[]
): { total: number; byMonth: Record<string, number> } => {
  const today = new Date();
  const currentMonth = toMonthKey(today);

  let totalCents = 0;
  const byMonthCents: Record<string, number> = {};

  purchases.forEach(({ installments }) => {
    installments.forEach(inst => {
      if (inst.referenceMonth > currentMonth) {
        const amountCents = toCents(inst.amount);
        totalCents += amountCents;

        if (!byMonthCents[inst.referenceMonth]) {
          byMonthCents[inst.referenceMonth] = 0;
        }
        byMonthCents[inst.referenceMonth] += amountCents;
      }
    });
  });

  // Converte de volta para decimal
  const byMonth: Record<string, number> = {};
  Object.entries(byMonthCents).forEach(([month, cents]) => {
    byMonth[month] = fromCents(cents);
  });

  return { total: fromCents(totalCents), byMonth };
};

// ============================================================
// CONVERSÃO PARA INVOICE ITEMS (compatibilidade)
// ============================================================

/**
 * Converte Installment para InvoiceItem (formato usado no invoiceBuilder).
 */
export const installmentToInvoiceItem = (inst: Installment): any => {
  const isRefund = (inst as any).isRefund === true || (inst as any)._manualRefund === true;
  const fixedType: 'income' | 'expense' = isRefund ? 'income' : 'expense';
  const amount = isRefund ? Math.abs(inst.amount) : -Math.abs(inst.amount);

  return {
    id: inst.id,
    transactionId: inst.transactionId,
    description: inst.description,
    amount,
    // CORREÇÃO: Usar a data real da transação (se existir) ou a data calculada da parcela
    // BillingDate joga tudo para o dia do fechamento, o que confunde o usuário
    date: inst.date || inst.billingDate,
    category: inst.category,
    accountId: inst.creditCardId, // Essential for grouping and saving
    cardId: inst.creditCardId,    // Essential for grouping and saving
    type: fixedType,
    installmentNumber: inst.installmentNumber,
    totalInstallments: inst.totalInstallments,
    originalDate: inst.purchaseDate,
    isProjected: inst.isProjected,
    isPayment: false,
    isCharge: false,
    _refundAmount: (inst as any)._refundAmount,
    isRefund: isRefund,
    _manualRefund: (inst as any)._manualRefund,
    manualInvoiceMonth: inst.manualInvoiceMonth
  };
};

/**
 * Converte lista de Installments para InvoiceItems.
 */
export const installmentsToInvoiceItems = (installments: Installment[]): any[] => {
  return installments.map(installmentToInvoiceItem);
};
