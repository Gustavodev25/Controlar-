/**
 * Invoice Builder - Sistema de construção de faturas de cartão de crédito
 *
 * A API da Pluggy NÃO entrega "fatura pronta" como um banco mostra no app.
 * Ela entrega transações + metadados do cartão.
 * Quem monta fatura atual, fechada e futura é ESTE MÓDULO.
 *
 * Conceito base:
 * - Fatura fecha todo mês no billingDay (closingDay)
 * - Tudo que cair entre dois fechamentos pertence à mesma fatura
 * - Parcelas futuras são projetadas automaticamente
 */

import {
  Transaction,
  ConnectedAccount,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  InvoiceForecast,
  InstallmentSeries,
  FinanceCharges,
  InvoicePeriods,
  PurchaseWithInstallments,
  Installment
} from '../types';

import {
  processTransactionsToInstallments,
  getInstallmentsForMonth,
  installmentToInvoiceItem,
  generateInstallmentForecast as generateInstForecast,
  calculateFutureCommitment,
  isInstallmentTransaction
} from './installmentService';

// ============================================================
// HELPERS - Funções utilitárias
// ============================================================

/**
 * Valida e normaliza o dia de fechamento (1-28)
 */
export const validateClosingDay = (day: number | null | undefined): number => {
  if (!day || typeof day !== 'number') return 10; // Default
  return Math.max(1, Math.min(28, day));
};

/**
 * Converte string YYYY-MM-DD ou ISO para Date
 * IMPORTANTE: Cria data ao meio-dia local para evitar problemas de timezone
 */
export const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  // Trata datas em formato ISO (com 'T')
  if (dateStr.includes('T')) {
    const isoDate = new Date(dateStr);
    return new Date(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate(), 12, 0, 0);
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d || 1, 12, 0, 0);
};

/**
 * Converte Date para string YYYY-MM-DD
 * IMPORTANTE: Usa método local para evitar conversão UTC que pode mudar a data
 */
export const toDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Cria monthKey (YYYY-MM) a partir de uma data
 */
export const toMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Cria data de fechamento segura (evita problemas com meses curtos)
 */
const getClosingDate = (year: number, month: number, day: number): Date => {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(day, lastDayOfMonth);
  return new Date(year, month, safeDay, 23, 59, 59);
};

/**
 * Normaliza descrição para agrupar parcelas da mesma compra
 */
const normalizeDescription = (desc: string): string => {
  return (desc || '')
    .trim()
    .toLowerCase()
    .replace(/\s*\d+\s*\/\s*\d+\s*$/g, '')  // Remove "1/10" no final
    .replace(/\s*\d+\/\d+\s*/g, '')          // Remove "1/10" no meio
    .replace(/\s*parcela\s*\d+\s*/gi, '')    // Remove "parcela 1"
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Extrai número de parcela da descrição (ex: "COMPRA 3/10")
 */
const extractInstallmentFromDesc = (desc: string): { current: number; total: number } | null => {
  const match = (desc || '').match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    return { current: parseInt(match[1]), total: parseInt(match[2]) };
  }
  return null;
};

/**
 * Verifica se uma transação é um reembolso/estorno/crédito
 * IMPORTANTE: Essas transações aparecem como créditos que REDUZEM o valor da fatura
 * 
 * ATENÇÃO: NÃO incluir palavras genéricas como 'crédito' ou 'desconto'
 * que aparecem em transações normais de cartão!
 */
const getPaymentKeywords = () => [
  'pagamento de fatura',
  'pagamento fatura',
  'pagamento recebido',
  'credit card payment',
  'pag fatura',
  'pgto fatura',
  'pgto'
];

/**
 * Verifica se uma transação é pagamento de fatura
 * IMPORTANTE: Prioridade sobre Reembolso se a descrição for explícita.
 */
export const isCreditCardPayment = (tx: Transaction): boolean => {
  const d = (tx.description || '').toLowerCase();
  const c = (tx.category || '').toLowerCase();

  // 1. Verifica keywords de PAGAMENTO primeiro
  const paymentKeywords = getPaymentKeywords();
  const isExplicitPayment = paymentKeywords.some(kw => d.includes(kw) || c.includes(kw) || d === 'pgto');

  if (isExplicitPayment) {
    // Se a descrição diz explicitamente que é pagamento, É PAGAMENTO.
    // Mesmo que tenha 'estorno' no meio (raro) ou categoria 'Reembolso'.
    // Exceção: "Estorno de pagamento" - mas geralmente vem como "Estorno..." apenas.
    if (d.includes('estorno') || d.includes('cancelamento')) {
      return false; // É um estorno de pagamento
    }
    return true;
  }

  // 2. Se não é explicitamente pagamento, verifica se é estorno/reembolso
  // Se for reembolso, não é pagamento
  const refundKeywords = ['estorno', 'reembolso', 'devolução', 'cancelamento', 'refund', 'chargeback', 'cashback'];
  if (refundKeywords.some(kw => d.includes(kw) || c.includes(kw))) {
    return false;
  }

  return false;
};

/**
 * Verifica se uma transação é um reembolso/estorno/crédito
 * IMPORTANTE: Não deve classificar "Pagamento de Fatura" como reembolso.
 * 
 * Verifica também as flags manuais (isRefund, _manualRefund) que são
 * definidas quando o usuário marca manualmente uma transação como reembolso.
 */
export const isTransactionRefund = (tx: Transaction): boolean => {
  // Se for pagamento de fatura, NÃO é reembolso
  if (isCreditCardPayment(tx)) {
    return false;
  }

  // 1. NOVA REGRA: Verifica flags manuais de reembolso definidas pelo usuário
  // Se o usuário marcou manualmente como reembolso, respeitar essa escolha
  if ((tx as any).isRefund === true || (tx as any)._manualRefund === true) {
    return true;
  }

  // 2. Se o type é 'income' e categoria é 'Reembolso' (marcado pelo handleMarkAsRefund)
  if (tx.type === 'income' && (tx.category || '').toLowerCase() === 'reembolso') {
    return true;
  }

  const d = (tx.description || '').toLowerCase();
  const c = (tx.category || '').toLowerCase();

  const refundKeywords = [
    'estorno', 'reembolso', 'devolução', 'devolucao',
    'cancelamento', 'cancelado',
    'refund', 'chargeback',
    'cashback'
  ];

  return refundKeywords.some(kw => d.includes(kw) || c.includes(kw));
};


// ============================================================
// CÁLCULO DE PERÍODOS
// ============================================================

export interface InvoicePeriodDates {
  closingDay: number;
  dueDay: number;

  // Datas de fechamento
  beforeLastClosingDate: Date;
  lastClosingDate: Date;
  currentClosingDate: Date;
  nextClosingDate: Date;

  // Datas de início de cada período
  lastInvoiceStart: Date;
  currentInvoiceStart: Date;
  nextInvoiceStart: Date;

  // Datas de vencimento
  lastDueDate: Date;
  currentDueDate: Date;
  nextDueDate: Date;

  // Month keys
  lastMonthKey: string;
  currentMonthKey: string;
  nextMonthKey: string;
}

/**
 * Calcula todas as datas relevantes para faturas de um cartão
 * @param monthOffset - Offset de meses: 0 = mês atual, -1 = mês anterior, +1 = próximo mês
 */
export const calculateInvoicePeriodDates = (
  closingDayRaw: number | null | undefined,
  dueDayRaw: number | null | undefined,
  today: Date = new Date(),
  monthOffset: number = 0,
  card: ConnectedAccount | null = null
): InvoicePeriodDates => {
  let closingDay = validateClosingDay(closingDayRaw);
  let dueDay = dueDayRaw || closingDay + 10;

  // Aplicar o offset de meses à data de referência
  const referenceDate = new Date(today);
  if (monthOffset !== 0) {
    referenceDate.setMonth(referenceDate.getMonth() + monthOffset);
  }
  const todayWithOffset = referenceDate;

  let currentClosingDate: Date | null = null;

  // ============================================================
  // LÓGICA SMART (Portada do App Mobile)
  // ============================================================

  // PRIORIDADE 0: Usar periodStart e periodEnd do currentBill se disponíveis (Dados REAIS do Banco)
  if (card?.currentBill?.periodStart && card?.currentBill?.periodEnd) {
    const periodEnd = parseDate(card.currentBill.periodEnd);
    // periodStart não é estritamente necessário para calcular datas futuras, apenas closingDay importa

    closingDay = periodEnd.getDate(); // Atualiza closingDay real

    if (card.currentBill.dueDate) {
      dueDay = parseDate(card.currentBill.dueDate).getDate();
    } else {
      dueDay = Math.min(closingDay + 10, 28);
    }

    currentClosingDate = new Date(periodEnd);
  }
  // PRIORIDADE 1: Usar currentBill.dueDate (Dados REAIS da Fatura)
  else if (card?.currentBill?.dueDate) {
    const billDueDate = parseDate(card.currentBill.dueDate);
    dueDay = billDueDate.getDate();

    // Tentar deduzir closingDay
    if (card.currentBill.closeDate) {
      closingDay = parseDate(card.currentBill.closeDate).getDate();
    } else if (card.balanceCloseDate) {
      closingDay = parseDate(card.balanceCloseDate).getDate();
    } else {
      // Estima 10 dias antes
      closingDay = Math.max(1, dueDay - 10);
    }

    if (card.currentBill.closeDate) {
      currentClosingDate = parseDate(card.currentBill.closeDate);
    } else if (card.balanceCloseDate) {
      currentClosingDate = parseDate(card.balanceCloseDate);
    } else {
      currentClosingDate = new Date(billDueDate);
      currentClosingDate.setDate(currentClosingDate.getDate() - 10);
    }
  }
  // PRIORIDADE 2: Usar balanceCloseDate (Dado real do Pluggy)
  else if (card?.balanceCloseDate) {
    const pluggyCloseDate = parseDate(card.balanceCloseDate);
    closingDay = pluggyCloseDate.getDate();

    if (card.balanceDueDate) {
      dueDay = parseDate(card.balanceDueDate).getDate();
    } else {
      dueDay = Math.min(closingDay + 10, 28);
    }

    currentClosingDate = new Date(pluggyCloseDate);
  }

  // 3. Rotação Automática ou Fallback
  if (currentClosingDate) {
    // Se temos uma data base, rotacionamos se ela já passou para achar a "atual" relativa a hoje (com offset)
    while (todayWithOffset > currentClosingDate) {
      currentClosingDate.setMonth(currentClosingDate.getMonth() + 1);
      currentClosingDate = getClosingDate(currentClosingDate.getFullYear(), currentClosingDate.getMonth(), closingDay);
    }
  } else {
    // Fallback: Cálculo puramente matemático baseado no dia
    // Se hoje >= closingDay, a fatura desse mês JÁ FECHOU -> fatura atual é do próximo mês
    if (todayWithOffset.getDate() < closingDay) {
      currentClosingDate = getClosingDate(todayWithOffset.getFullYear(), todayWithOffset.getMonth(), closingDay);
    } else {
      const nextMonth = todayWithOffset.getMonth() === 11 ? 0 : todayWithOffset.getMonth() + 1;
      const nextYear = todayWithOffset.getMonth() === 11 ? todayWithOffset.getFullYear() + 1 : todayWithOffset.getFullYear();
      currentClosingDate = getClosingDate(nextYear, nextMonth, closingDay);
    }
  }

  // ============================================================
  // CÁLCULO DE DATAS DERIVADAS
  // ============================================================

  // ÚLTIMA fatura (um mês antes da atual)
  const lastClosingMonth = currentClosingDate.getMonth() === 0 ? 11 : currentClosingDate.getMonth() - 1;
  const lastClosingYear = currentClosingDate.getMonth() === 0 ? currentClosingDate.getFullYear() - 1 : currentClosingDate.getFullYear();
  const lastClosingDate = getClosingDate(lastClosingYear, lastClosingMonth, closingDay);

  // ANTES DA ÚLTIMA (dois meses antes da atual)
  const beforeLastMonth = lastClosingDate.getMonth() === 0 ? 11 : lastClosingDate.getMonth() - 1;
  const beforeLastYear = lastClosingDate.getMonth() === 0 ? lastClosingDate.getFullYear() - 1 : lastClosingDate.getFullYear();
  const beforeLastClosingDate = getClosingDate(beforeLastYear, beforeLastMonth, closingDay);

  // PRÓXIMA fatura (um mês após a atual)
  const nextClosingMonth = currentClosingDate.getMonth() === 11 ? 0 : currentClosingDate.getMonth() + 1;
  const nextClosingYear = currentClosingDate.getMonth() === 11 ? currentClosingDate.getFullYear() + 1 : currentClosingDate.getFullYear();
  const nextClosingDate = getClosingDate(nextClosingYear, nextClosingMonth, closingDay);

  // Datas de INÍCIO de cada período (dia após fechamento anterior)
  const lastInvoiceStart = new Date(beforeLastClosingDate.getTime() + 24 * 60 * 60 * 1000);
  const currentInvoiceStart = new Date(lastClosingDate.getTime() + 24 * 60 * 60 * 1000);
  const nextInvoiceStart = new Date(currentClosingDate.getTime() + 24 * 60 * 60 * 1000);

  // Datas de VENCIMENTO
  const safeDueDay = dueDay; // Já validado/ajustado acima

  const calculateDueDate = (closingDate: Date): Date => {
    let targetMonth = closingDate.getMonth();
    let targetYear = closingDate.getFullYear();

    // Se dueDay <= closingDay, o vencimento é no mês seguinte
    // Se dueDay > closingDay, o vencimento é no mesmo mês
    if (safeDueDay <= closingDay) {
      targetMonth = targetMonth === 11 ? 0 : targetMonth + 1;
      targetYear = targetMonth === 0 ? targetYear + 1 : targetYear;
    }

    const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    return new Date(targetYear, targetMonth, Math.min(safeDueDay, lastDayOfTargetMonth));
  };

  const lastDueDate = calculateDueDate(lastClosingDate);
  const currentDueDate = calculateDueDate(currentClosingDate);
  const nextDueDate = calculateDueDate(nextClosingDate);

  return {
    closingDay,
    dueDay: safeDueDay,
    beforeLastClosingDate,
    lastClosingDate,
    currentClosingDate,
    nextClosingDate,
    lastInvoiceStart,
    currentInvoiceStart,
    nextInvoiceStart,
    lastDueDate,
    currentDueDate,
    nextDueDate,
    // MonthKeys são baseados no mês do FECHAMENTO
    lastMonthKey: toMonthKey(lastClosingDate),
    currentMonthKey: toMonthKey(currentClosingDate),
    nextMonthKey: toMonthKey(nextClosingDate)
  };
};

/**
 * Calcula o monthKey da fatura para uma transação
 * Regra: Se dia da transação > closingDay → pertence ao MÊS SEGUINTE
 */
export const getTransactionInvoiceMonthKey = (txDate: string, closingDay: number): string => {
  const validClosingDay = validateClosingDay(closingDay);
  const date = parseDate(txDate);

  if (date.getDate() > validClosingDay) {
    date.setMonth(date.getMonth() + 1);
  }

  return toMonthKey(date);
};

// ============================================================
// PROCESSAMENTO DE PARCELAS
// ============================================================

interface ProcessedInstallment {
  series: InstallmentSeries[];
  nonInstallmentTxs: Transaction[];
}

/**
 * Processa e agrupa transações parceladas
 */
export const processInstallments = (
  transactions: Transaction[],
  cardId: string
): ProcessedInstallment => {
  const installmentMap: Record<string, { firstInstDate: Date; transactions: Transaction[] }> = {};
  const nonInstallmentTxs: Transaction[] = [];

  transactions.forEach(tx => {
    if (!tx.date) return;
    if (isCreditCardPayment(tx)) return; // Ignora pagamentos

    // Filtra por cartão
    const txCardId = tx.cardId || tx.accountId || '';
    if (cardId !== 'all' && txCardId !== cardId) return;

    const descInstallment = extractInstallmentFromDesc(tx.description || '');
    const installmentNumber = tx.installmentNumber || descInstallment?.current || 1;
    const totalInstallments = tx.totalInstallments || (tx as any).installments || descInstallment?.total || 0;

    if (totalInstallments > 1) {
      const normalizedDesc = normalizeDescription(tx.description || '');
      const seriesKey = `${txCardId}-${normalizedDesc}-${totalInstallments}`;

      if (!installmentMap[seriesKey]) {
        installmentMap[seriesKey] = { firstInstDate: new Date(9999, 0, 1), transactions: [] };
      }

      const txWithInstallment = {
        ...tx,
        installmentNumber,
        totalInstallments
      };
      installmentMap[seriesKey].transactions.push(txWithInstallment);

      const txDate = parseDate(tx.date);

      if (installmentNumber === 1) {
        installmentMap[seriesKey].firstInstDate = txDate;
      } else if (installmentMap[seriesKey].firstInstDate.getFullYear() === 9999) {
        const firstInstDate = new Date(txDate);
        firstInstDate.setMonth(firstInstDate.getMonth() - (installmentNumber - 1));
        installmentMap[seriesKey].firstInstDate = firstInstDate;
      }
    } else {
      nonInstallmentTxs.push(tx);
    }
  });

  // Converte para InstallmentSeries
  const series: InstallmentSeries[] = Object.entries(installmentMap).map(([seriesKey, data]) => {
    const baseTx = data.transactions[0];
    const totalInstallments = baseTx.totalInstallments || 1;
    const paidInstallments = data.transactions.length;
    const installmentAmount = -Math.abs(baseTx.amount);

    // Calcula data da última parcela
    const lastInstDate = new Date(data.firstInstDate);
    lastInstDate.setMonth(lastInstDate.getMonth() + totalInstallments - 1);

    return {
      seriesKey,
      description: normalizeDescription(baseTx.description || ''),
      originalAmount: installmentAmount * totalInstallments,
      installmentAmount,
      totalInstallments,
      paidInstallments,
      remainingInstallments: totalInstallments - paidInstallments,
      firstInstallmentDate: toDateStr(data.firstInstDate),
      lastInstallmentDate: toDateStr(lastInstDate),
      cardId: baseTx.cardId || baseTx.accountId || '',
      items: data.transactions.map(tx => transactionToInvoiceItem(tx))
    };
  });

  return { series, nonInstallmentTxs };
};

// ============================================================
// CONVERSÃO DE TRANSAÇÕES PARA INVOICE ITEMS
// ============================================================

/**
 * Converte uma Transaction para InvoiceItem
 * 
 * REGRA IMPORTANTE:
 * - Pagamentos de fatura: NÃO afetam o total (são apenas informativos)
 * - Reembolsos/estornos: REDUZEM o total (são créditos reais)
 * - Despesas normais: AUMENTAM o total
 */
export const transactionToInvoiceItem = (tx: Transaction, isProjected = false): InvoiceItem => {
  const isPayment = isCreditCardPayment(tx);
  // FIX: rely only on explicit flags or helper detection, not just negative amount
  const isRefund = isTransactionRefund(tx);

  // Determina tipo e sinal baseado na natureza da transação
  // Pagamentos: marcados como income, mas com flag especial
  // Reembolsos: income real que reduz o total
  // Despesas: expense normal
  let fixedType: 'income' | 'expense' = 'expense';
  let amount = -Math.abs(tx.amount); // Despesa por padrão (negativo)

  if (isPayment) {
    // Pagamento de fatura: positivo mas NÃO conta no total
    fixedType = 'income';
    amount = Math.abs(tx.amount);
  } else if (isRefund) {
    // Reembolso/estorno real: positivo e CONTA no total (reduz a fatura)
    fixedType = 'income';
    amount = Math.abs(tx.amount);
  }

  return {
    id: tx.id,
    transactionId: tx.id,
    description: tx.description,
    amount,
    date: tx.date,
    category: tx.category,
    type: fixedType,
    installmentNumber: tx.installmentNumber,
    totalInstallments: tx.totalInstallments,
    isProjected,
    isPayment, // Flag para identificar pagamentos (não devem afetar total)
    isRefund,  // Flag para identificar reembolsos (devem afetar total)
    // Dados de moeda para transações internacionais
    currencyCode: tx.currencyCode,
    amountOriginal: tx.amountOriginal,
    amountInAccountCurrency: tx.amountInAccountCurrency,
    pluggyRaw: tx.pluggyRaw,
    manualInvoiceMonth: tx.manualInvoiceMonth
  };
};

/**
 * Cria um InvoiceItem projetado para parcela futura
 */
export const createProjectedInstallment = (
  baseTx: Transaction,
  installmentNumber: number,
  installmentDate: Date
): InvoiceItem => {
  return {
    id: `proj_${baseTx.id}_${installmentNumber}`,
    transactionId: baseTx.id,
    description: baseTx.description,
    amount: -Math.abs(baseTx.amount),
    date: toDateStr(installmentDate),
    category: baseTx.category,
    type: baseTx.type,
    installmentNumber,
    totalInstallments: baseTx.totalInstallments,
    originalDate: baseTx.date,
    originalAmount: Math.abs(baseTx.amount) * (baseTx.totalInstallments || 1),
    isProjected: true
  };
};

// ============================================================
// CONSTRUÇÃO DE FATURAS
// ============================================================

export interface InvoiceBuildResult {
  closedInvoice: Invoice;     // Última fatura (fechada)
  currentInvoice: Invoice;    // Fatura atual (em aberto)
  futureInvoices: Invoice[];  // Faturas futuras (parcelas projetadas)
  allFutureTotal: number;     // Total comprometido futuro
  periods: InvoicePeriodDates;
}

/**
 * Determina o status de uma fatura
 */
const determineInvoiceStatus = (
  isClosedInvoice: boolean,
  dueDate: Date,
  paidAmount: number,
  total: number,
  billStatus?: string
): InvoiceStatus => {
  const today = new Date();

  if (isClosedInvoice) {
    // Fatura fechada
    if (billStatus === 'CLOSED' || (paidAmount > 0 && paidAmount >= total * 0.95)) {
      return 'PAID';
    }
    if (dueDate < today) {
      return 'OVERDUE';
    }
    return 'CLOSED';
  }

  return 'OPEN';
};

/**
 * Constrói todas as faturas de um cartão
 *
 * Este é o método principal que implementa toda a lógica de faturas.
 *
 * PRIORIDADE de datas:
 * 1. Datas manuais (manualLastClosingDate / manualCurrentClosingDate) - usuário define
 * 2. invoicePeriods do backend (calculado no sync)
 * 3. Cálculo automático baseado no closingDay
 * 
 * @param monthOffset - Offset de meses para navegação rotativa (0 = hoje, -1 = mês anterior, +1 = próximo)
 */
export const buildInvoices = (
  card: ConnectedAccount | undefined,
  transactions: Transaction[],
  cardId: string = 'all',
  monthOffset: number = 0
): InvoiceBuildResult => {
  const today = new Date();

  // IMPORTANTE: NÃO usar invoicePeriods do backend - sempre calcular localmente
  // Isso garante que a lógica correta seja usada (o backend pode ter dados antigos)
  // O closingDay ainda é pego do backend, mas os períodos são calculados aqui
  const closingDay = card?.invoicePeriods?.closingDay || card?.closingDay || 10;
  const dueDay = card?.invoicePeriods?.dueDay || card?.dueDay || closingDay + 10;

  // ========================================
  // PRIORIDADE 1: Datas manuais definidas pelo usuário
  // ========================================
  let periods: InvoicePeriodDates;

  if (card?.manualLastClosingDate && card?.manualCurrentClosingDate) {
    // Parse das datas manuais
    let lastClosingDate = parseDate(card.manualLastClosingDate);
    let currentClosingDate = parseDate(card.manualCurrentClosingDate);

    // IMPORTANTE: Extrair o dia de fechamento da data manual
    const manualClosingDay = currentClosingDate.getDate();

    // ========================================
    // CORREÇÃO: Avançar datas automáticamente se estiverem desatualizadas
    // Se a data de fechamento atual (currentClosingDate) já passou,
    // precisamos avançar os períodos para refletir a realidade
    // ========================================
    const todayNum = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    let currentClosingNum = currentClosingDate.getFullYear() * 10000 + (currentClosingDate.getMonth() + 1) * 100 + currentClosingDate.getDate();

    let advancedMonths = 0;
    while (todayNum >= currentClosingNum && advancedMonths < 12) {
      // Avançar um mês
      lastClosingDate = new Date(currentClosingDate);
      currentClosingDate = new Date(currentClosingDate);
      currentClosingDate.setMonth(currentClosingDate.getMonth() + 1);
      // Ajustar dia para meses curtos
      const lastDayOfMonth = new Date(currentClosingDate.getFullYear(), currentClosingDate.getMonth() + 1, 0).getDate();
      if (manualClosingDay > lastDayOfMonth) {
        currentClosingDate.setDate(lastDayOfMonth);
      } else {
        currentClosingDate.setDate(manualClosingDay);
      }
      currentClosingNum = currentClosingDate.getFullYear() * 10000 + (currentClosingDate.getMonth() + 1) * 100 + currentClosingDate.getDate();
      advancedMonths++;
    }

    if (advancedMonths > 0) {
      console.log('[InvoiceBuilder] Datas MANUAIS avançadas automaticamente:', {
        original: { last: card.manualLastClosingDate, current: card.manualCurrentClosingDate },
        adjusted: { last: toDateStr(lastClosingDate), current: toDateStr(currentClosingDate) },
        advancedMonths
      });
    } else {
      console.log('[InvoiceBuilder] Usando datas MANUAIS:', {
        manualLast: card.manualLastClosingDate,
        manualCurrent: card.manualCurrentClosingDate,
        manualClosingDay,
        originalClosingDay: closingDay
      });
    }

    // Inferir próximo fechamento (current + 1 mês, mantendo o dia)
    const nextClosingDate = new Date(currentClosingDate);
    nextClosingDate.setMonth(nextClosingDate.getMonth() + 1);

    // Inferir fechamento anterior ao último (last - 1 mês, mantendo o dia)
    const beforeLastClosingDate = new Date(lastClosingDate);
    beforeLastClosingDate.setMonth(beforeLastClosingDate.getMonth() - 1);

    // Calcular inícios dos períodos (dia seguinte ao fechamento anterior)
    const lastInvoiceStart = new Date(beforeLastClosingDate);
    lastInvoiceStart.setDate(lastInvoiceStart.getDate() + 1);

    const currentInvoiceStart = new Date(lastClosingDate);
    currentInvoiceStart.setDate(currentInvoiceStart.getDate() + 1);

    const nextInvoiceStart = new Date(currentClosingDate);
    nextInvoiceStart.setDate(nextInvoiceStart.getDate() + 1);

    // Calcular datas de vencimento
    const calculateDueDateManual = (closingDate: Date): Date => {
      const dueDateCalc = new Date(closingDate);
      dueDateCalc.setMonth(dueDateCalc.getMonth() + 1);
      dueDateCalc.setDate(Math.min(dueDay, 28));
      return dueDateCalc;
    };

    periods = {
      closingDay: manualClosingDay, // USA O DIA EXTRAÍDO DA DATA MANUAL!
      dueDay,
      beforeLastClosingDate,
      lastClosingDate,
      currentClosingDate,
      nextClosingDate,
      lastInvoiceStart,
      currentInvoiceStart,
      nextInvoiceStart,
      lastDueDate: calculateDueDateManual(lastClosingDate),
      currentDueDate: calculateDueDateManual(currentClosingDate),
      nextDueDate: calculateDueDateManual(nextClosingDate),
      lastMonthKey: toMonthKey(lastClosingDate),
      currentMonthKey: toMonthKey(currentClosingDate),
      nextMonthKey: toMonthKey(nextClosingDate)
    };
  } else {
    // ========================================
    // PRIORIDADE 2: Cálculo automático (SEMPRE recalcula)
    // ========================================
    console.log('[InvoiceBuilder] Calculando períodos automaticamente:', {
      closingDay,
      dueDay,
      today: today.toISOString()
    });
    periods = calculateInvoicePeriodDates(closingDay, dueDay, today, monthOffset, card || null);
  }

  // Filtra transações do cartão
  const cardTransactions = cardId === 'all'
    ? transactions
    : transactions.filter(t => {
      const txCardId = t.cardId ? String(t.cardId) : '';
      const txAccountId = t.accountId ? String(t.accountId) : '';
      return txCardId === cardId || txAccountId === cardId;
    });

  // DEBUG: Mostrar datas das transações do cartão
  const sortedDates = cardTransactions.map(t => t.date).sort();
  const lastPeriodDates = sortedDates.filter(d => d >= '2025-11-24' && d <= '2025-12-23');
  console.log('[InvoiceBuilder] DATAS DAS TRANSAÇÕES DO CARTÃO:', {
    total: cardTransactions.length,
    minDate: sortedDates[0],
    maxDate: sortedDates[sortedDates.length - 1],
    recentDates: sortedDates.slice(-20).join(', '), // últimas 20 datas como string
    periodNeeded: `${toDateStr(periods.lastInvoiceStart)} a ${toDateStr(periods.lastClosingDate)}`,
    datesInLastPeriod: lastPeriodDates.length,
    lastPeriodDatesFound: lastPeriodDates.join(', ')
  });

  // Separa pagamentos das demais transações
  const paymentTxs = cardTransactions.filter(isCreditCardPayment);
  const nonPaymentTxs = cardTransactions.filter(t => !isCreditCardPayment(t));

  // ============================================================
  // NOVO SISTEMA DE PARCELAS - Usa installmentService.ts
  // Processa transações parceladas de forma robusta e independente
  // ============================================================
  const purchasesWithInstallments = processTransactionsToInstallments(
    nonPaymentTxs,
    periods.closingDay,
    periods.dueDay
  );

  console.log('[InvoiceBuilder] Parcelas processadas:', {
    totalPurchases: purchasesWithInstallments.length,
    purchases: purchasesWithInstallments.map(p => ({
      desc: p.purchase.description.slice(0, 30),
      total: p.purchase.totalInstallments,
      firstMonth: p.purchase.firstBillingMonth,
      installments: p.installments.length
    }))
  });

  // Separa transações simples (não parceladas)
  const processedTxIds = new Set<string>();
  purchasesWithInstallments.forEach(({ installments }) => {
    installments.forEach(inst => {
      if (inst.transactionId) {
        processedTxIds.add(inst.transactionId);
      }
    });
  });

  const simpleTxs = nonPaymentTxs.filter(tx =>
    !isInstallmentTransaction(tx) && !processedTxIds.has(tx.id)
  );

  // Inicializa containers para cada fatura
  const closedItems: InvoiceItem[] = [];
  const currentItems: InvoiceItem[] = [];
  const futureItemsByMonth: Record<string, InvoiceItem[]> = {};

  // TOTAIS LÍQUIDOS (despesas - créditos/reembolsos, sem subtrair pagamentos)
  let closedTotalGross = 0;
  let currentTotalGross = 0;
  let allFutureTotalGross = 0;

  // Helper para comparação de datas (numero YYYYMMDD)
  const dateToNumber = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

  const lastStartNum = dateToNumber(periods.lastInvoiceStart);
  const lastEndNum = dateToNumber(periods.lastClosingDate);
  const currentStartNum = dateToNumber(periods.currentInvoiceStart);
  const currentEndNum = dateToNumber(periods.currentClosingDate);

  // DEBUG: Log dos períodos calculados
  console.log('[InvoiceBuilder] PERÍODOS CALCULADOS:', {
    lastMonthKey: periods.lastMonthKey,
    currentMonthKey: periods.currentMonthKey,
    lastInvoiceStart: toDateStr(periods.lastInvoiceStart),
    lastClosingDate: toDateStr(periods.lastClosingDate),
    currentInvoiceStart: toDateStr(periods.currentInvoiceStart),
    currentClosingDate: toDateStr(periods.currentClosingDate),
    closingDay: periods.closingDay,
    simpleTxsCount: simpleTxs.length,
    purchasesWithInstallmentsCount: purchasesWithInstallments.length,
    totalCardTransactions: cardTransactions.length,
    nonPaymentTxsCount: nonPaymentTxs.length
  });

  // ============================================================
  // 1. Processa transações simples (não parceladas) por DATA
  // ============================================================

  // DEBUG: Mostrar amostra de transações simples e seus períodos
  const txDatesSample = simpleTxs.slice(0, 10).map(tx => {
    const txDate = parseDate(tx.date);
    const txDateNum = dateToNumber(txDate);
    return {
      date: tx.date,
      dateNum: txDateNum,
      desc: tx.description?.slice(0, 30),
      inLastPeriod: txDateNum >= lastStartNum && txDateNum <= lastEndNum,
      inCurrentPeriod: txDateNum >= currentStartNum && txDateNum <= currentEndNum,
      inFuture: txDateNum > currentEndNum,
      inPast: txDateNum < lastStartNum
    };
  });
  console.log('[InvoiceBuilder] TRANSAÇÕES SIMPLES - Amostra:', {
    totalSimpleTxs: simpleTxs.length,
    lastStartNum,
    lastEndNum,
    currentStartNum,
    currentEndNum,
    sampleDates: simpleTxs.slice(0, 15).map(tx => tx.date),
    sample: txDatesSample
  });

  // DEBUG: Contar quantas transações caem em cada período
  let inLastCount = 0, inCurrentCount = 0, inFutureCount = 0, inPastCount = 0;
  simpleTxs.forEach(tx => {
    const txDate = parseDate(tx.date);
    const txDateNum = dateToNumber(txDate);
    if (txDateNum >= lastStartNum && txDateNum <= lastEndNum) inLastCount++;
    else if (txDateNum >= currentStartNum && txDateNum <= currentEndNum) inCurrentCount++;
    else if (txDateNum > currentEndNum) inFutureCount++;
    else inPastCount++;
  });
  console.log('[InvoiceBuilder] DISTRIBUIÇÃO DE TRANSAÇÕES:', {
    inLast: inLastCount,
    inCurrent: inCurrentCount,
    inFuture: inFutureCount,
    inPast: inPastCount,
    total: simpleTxs.length
  });

  simpleTxs.forEach(tx => {
    if (!tx.date) return;

    const txDate = parseDate(tx.date);
    const txDateNum = dateToNumber(txDate);
    const item = transactionToInvoiceItem(tx);

    // ========================================
    // CÁLCULO DO TOTAL - REGRA IMPORTANTE:
    // - Pagamentos de fatura (isPayment): NÃO afetam o total!
    //   Eles são apenas informativos - mostram que a fatura anterior foi paga
    // - Reembolsos/estornos: REDUZEM o total (são créditos reais)
    // - Despesas normais: AUMENTAM o total
    // ========================================
    const amt = item.isPayment ? 0 : item.amount;

    // ========================================
    // LÓGICA DE OVERRIDE MANUAL
    // ========================================
    if (tx.manualInvoiceMonth) {
      const manualKey = tx.manualInvoiceMonth;
      console.log('[DEBUG InvoiceBuilder] Manual Override:', {
        desc: tx.description,
        manualKey,
        last: periods.lastMonthKey,
        current: periods.currentMonthKey,
        matchLast: manualKey === periods.lastMonthKey,
        matchCurrent: manualKey === periods.currentMonthKey,
        goesToFuture: manualKey > periods.currentMonthKey,
        goesToPast: manualKey < periods.lastMonthKey
      });

      // Lógica de alocação baseada no manualKey:
      // - Futuro: manualKey > currentMonthKey
      // - Atual: manualKey === currentMonthKey
      // - Fechada: manualKey <= lastMonthKey (inclui meses mais antigos)
      // - Entre "fechada" e "atual": vai para fechada (caso raro de inconsistência)

      if (manualKey > periods.currentMonthKey) {
        // Vai para fatura futura
        if (!futureItemsByMonth[manualKey]) {
          futureItemsByMonth[manualKey] = [];
        }
        futureItemsByMonth[manualKey].push(item);
        allFutureTotalGross += amt;
      } else if (manualKey === periods.currentMonthKey) {
        // Vai para fatura atual
        currentItems.push(item);
        currentTotalGross += amt;
      } else {
        // Vai para fatura fechada (qualquer mês <= lastMonthKey)
        closedItems.push(item);
        closedTotalGross += amt;
      }

      return; // PULA a lógica de data automática
    }

    if (txDateNum >= lastStartNum && txDateNum <= lastEndNum) {
      closedItems.push(item);
      closedTotalGross += amt;
    } else if (txDateNum >= currentStartNum && txDateNum <= currentEndNum) {
      currentItems.push(item);
      currentTotalGross += amt;
    } else if (txDateNum > currentEndNum) {
      const monthKey = toMonthKey(txDate);
      if (!futureItemsByMonth[monthKey]) {
        futureItemsByMonth[monthKey] = [];
      }
      futureItemsByMonth[monthKey].push(item);
      allFutureTotalGross += amt;
    }
  });

  // ============================================================
  // 2. Processa parcelas por REFERENCE MONTH (não por data!)
  // Cada parcela já sabe em qual fatura deve cair
  // ============================================================

  // DEBUG: Mostrar todas as parcelas e seus referenceMonths
  purchasesWithInstallments.forEach(({ purchase, installments }) => {
    console.log('[InvoiceBuilder] Compra parcelada:', {
      desc: purchase.description.slice(0, 40),
      totalInstallments: purchase.totalInstallments,
      firstBillingMonth: purchase.firstBillingMonth,
      installments: installments.map(inst => ({
        num: inst.installmentNumber,
        referenceMonth: inst.referenceMonth,
        matchesLast: inst.referenceMonth === periods.lastMonthKey,
        matchesCurrent: inst.referenceMonth === periods.currentMonthKey
      }))
    });
  });

  purchasesWithInstallments.forEach(({ purchase, installments }) => {
    installments.forEach(inst => {
      const item = installmentToInvoiceItem(inst);
      // Parcelas são tipicamente despesas (negativas), mas se for income, mantém positivo
      const amt = item.amount;

      // Aloca baseado no referenceMonth da parcela (calculado corretamente pelo installmentService)
      if (inst.referenceMonth === periods.lastMonthKey) {
        closedItems.push(item);
        closedTotalGross += amt;
      } else if (inst.referenceMonth === periods.currentMonthKey) {
        currentItems.push(item);
        currentTotalGross += amt;
      } else if (inst.referenceMonth > periods.currentMonthKey) {
        // Parcela futura
        if (!futureItemsByMonth[inst.referenceMonth]) {
          futureItemsByMonth[inst.referenceMonth] = [];
        }
        futureItemsByMonth[inst.referenceMonth].push(item);
        allFutureTotalGross += amt;
      }
      // Parcelas de meses anteriores são ignoradas (já foram pagas)
    });
  });

  // DEBUG: Mostrar totais após alocação de parcelas
  console.log('[InvoiceBuilder] ALOCAÇÃO DE ITENS:', {
    closedItemsCount: closedItems.length,
    closedTotalGross,
    currentItemsCount: currentItems.length,
    currentTotalGross,
    futureMonths: Object.keys(futureItemsByMonth),
    allFutureTotalGross
  });

  // ============================================================
  // 3. Processa pagamentos (associa à fatura que está sendo quitada)
  // ============================================================
  // REGRA: Um pagamento feito durante o período da fatura ATUAL
  // está quitando a fatura FECHADA (anterior).
  // Pagamentos feitos durante o período da fatura FECHADA
  // estavam quitando a fatura ANTES DA FECHADA (duas atrás).
  // 
  // Para cada fatura, mostramos apenas o pagamento que a quita.
  // ============================================================

  // Encontrar o pagamento mais adequado para a fatura FECHADA
  // (pagamento feito durante o período da fatura ATUAL que quita a FECHADA)
  const paymentForClosedInvoice = paymentTxs.find(tx => {
    if (!tx.date) return false;
    const txDate = parseDate(tx.date);
    const txDateNum = dateToNumber(txDate);
    // Pagamento feito no período ATUAL quita a fatura FECHADA
    return txDateNum >= currentStartNum && txDateNum <= currentEndNum;
  });

  // Se não encontrou pagamento no período atual, busca pagamento
  // feito logo após o fechamento da fatura FECHADA (até o vencimento)
  const paymentForClosedInvoiceAlt = !paymentForClosedInvoice ? paymentTxs.find(tx => {
    if (!tx.date) return false;
    const txDate = parseDate(tx.date);
    const txDateNum = dateToNumber(txDate);
    const lastDueDateNum = dateToNumber(periods.lastDueDate);
    // Pagamento feito após fechamento e até o vencimento da fatura FECHADA
    return txDateNum > lastEndNum && txDateNum <= lastDueDateNum;
  }) : null;

  const effectivePaymentForClosed = paymentForClosedInvoice || paymentForClosedInvoiceAlt;

  if (effectivePaymentForClosed) {
    const item: InvoiceItem = {
      ...transactionToInvoiceItem(effectivePaymentForClosed),
      isPayment: true
    };
    closedItems.push(item);
  }

  // Para a fatura ATUAL (ainda em aberto), pagamentos serão mostrados
  // apenas quando ela fechar e virar "fechada" no próximo ciclo

  // Pega valor da última fatura da API se disponível
  const billTotalFromAPI = card?.currentBill?.totalAmount;
  const billStatus = card?.currentBill?.status;
  const paidAmount = card?.currentBill?.paidAmount || 0;

  // ============================================================
  // DEFINIÇÃO DOS TOTAIS
  // ============================================================
  // REGRA DE OURO: Fatura = Soma de Transações do Período
  // Não usamos usedCreditLimit ou balance pois são dados instáveis na API Pluggy.
  // ============================================================

  // Totais já calculados anteriormente pela soma dos itens:
  // closedTotalGross (apenas despesas, sem pagamentos)
  // currentTotalGross (apenas despesas, sem pagamentos)
  // allFutureTotalGross (apenas despesas, sem pagamentos)

  console.log('[InvoiceBuilder] TOTAIS LÍQUIDOS (DESPESAS - CRÉDITOS):', {
    closedTotal: closedTotalGross,
    currentTotal: currentTotalGross,
    allFutureTotal: allFutureTotalGross
  });

  // Constrói Invoice da fatura fechada
  const closedInvoice: Invoice = {
    id: `${cardId}_${periods.lastMonthKey}`,
    creditCardId: cardId,
    referenceMonth: periods.lastMonthKey,
    status: determineInvoiceStatus(true, periods.lastDueDate, paidAmount, billTotalFromAPI || closedTotalGross, billStatus),
    billingDate: toDateStr(periods.lastClosingDate),
    dueDate: toDateStr(periods.lastDueDate),
    periodStart: toDateStr(periods.lastInvoiceStart),
    periodEnd: toDateStr(periods.lastClosingDate),
    total: Math.max(0, -closedTotalGross), // TOTAL LÍQUIDO - inverte sinal pois despesas agora são negativas
    totalExpenses: closedItems.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0),
    totalIncomes: closedItems.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0),
    minimumPayment: card?.currentBill?.minimumPaymentAmount,
    paidAmount,
    financeCharges: card?.currentBill?.financeCharges,
    items: closedItems.sort((a, b) => b.date.localeCompare(a.date))
  };

  // Constrói Invoice da fatura atual (SOMA PURA)
  const currentInvoice: Invoice = {
    id: `${cardId}_${periods.currentMonthKey}`,
    creditCardId: cardId,
    referenceMonth: periods.currentMonthKey,
    status: 'OPEN',
    billingDate: toDateStr(periods.currentClosingDate),
    dueDate: toDateStr(periods.currentDueDate),
    periodStart: toDateStr(periods.currentInvoiceStart),
    periodEnd: toDateStr(periods.currentClosingDate),
    total: Math.max(0, -currentTotalGross), // TOTAL LÍQUIDO - inverte sinal pois despesas agora são negativas
    totalExpenses: currentItems.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0),
    totalIncomes: currentItems.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0),
    projectedInstallments: currentItems.filter(i => i.isProjected).length,
    items: currentItems.sort((a, b) => b.date.localeCompare(a.date)),
    usedLimitBasedCalculation: false
  } as Invoice & { usedLimitBasedCalculation?: boolean };

  // Constrói faturas futuras
  const futureInvoices: Invoice[] = Object.entries(futureItemsByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, items]) => {
      const [year, month] = monthKey.split('-').map(Number);
      const billingDate = getClosingDate(year, month - 1, closingDay);
      const dueDate = new Date(billingDate);
      dueDate.setMonth(dueDate.getMonth() + 1);
      dueDate.setDate(Math.min(dueDay, 28));

      const total = items.reduce((s, i) => s + i.amount, 0);
      const totalToPay = Math.max(0, -total);

      return {
        id: `${cardId}_${monthKey}`,
        creditCardId: cardId,
        referenceMonth: monthKey,
        status: 'FUTURE' as InvoiceStatus,
        billingDate: toDateStr(billingDate),
        dueDate: toDateStr(dueDate),
        periodStart: toDateStr(new Date(billingDate.getTime() - 30 * 24 * 60 * 60 * 1000)),
        periodEnd: toDateStr(billingDate),
        total: totalToPay,
        totalExpenses: items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0),
        totalIncomes: items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0),
        projectedInstallments: items.filter(i => i.isProjected).length,
        items: items.sort((a, b) => b.date.localeCompare(a.date))
      };
    });

  return {
    closedInvoice,
    currentInvoice,
    futureInvoices,
    allFutureTotal: allFutureTotalGross,
    periods
  };
};

// ============================================================
// FUNÇÕES DE FORECAST (Visão de longo prazo)
// ============================================================

/**
 * Gera previsão de faturas para os próximos N meses
 */
export const generateInvoiceForecast = (
  buildResult: InvoiceBuildResult,
  monthsAhead: number = 12
): InvoiceForecast[] => {
  const forecasts: InvoiceForecast[] = [];
  const today = new Date();

  // Adiciona fatura atual
  forecasts.push({
    monthKey: buildResult.currentInvoice.referenceMonth,
    total: buildResult.currentInvoice.total,
    installmentsCount: buildResult.currentInvoice.items.filter(i => i.totalInstallments && i.totalInstallments > 1).length,
    newPurchasesCount: buildResult.currentInvoice.items.filter(i => !i.totalInstallments || i.totalInstallments === 1).length,
    items: buildResult.currentInvoice.items
  });

  // Adiciona faturas futuras
  buildResult.futureInvoices.forEach(inv => {
    forecasts.push({
      monthKey: inv.referenceMonth,
      total: inv.total,
      installmentsCount: inv.items.filter(i => i.totalInstallments && i.totalInstallments > 1).length,
      newPurchasesCount: inv.items.filter(i => !i.totalInstallments || i.totalInstallments === 1).length,
      items: inv.items
    });
  });

  // Preenche meses vazios
  for (let i = 0; i < monthsAhead; i++) {
    const futureDate = new Date(today);
    futureDate.setMonth(futureDate.getMonth() + i);
    const monthKey = toMonthKey(futureDate);

    if (!forecasts.find(f => f.monthKey === monthKey)) {
      forecasts.push({
        monthKey,
        total: 0,
        installmentsCount: 0,
        newPurchasesCount: 0,
        items: []
      });
    }
  }

  return forecasts.sort((a, b) => a.monthKey.localeCompare(b.monthKey)).slice(0, monthsAhead);
};

/**
 * Calcula o impacto no limite futuro
 */
export const calculateFutureLimitImpact = (
  card: ConnectedAccount | undefined,
  buildResult: InvoiceBuildResult
): { available: number; committed: number; afterClosed: number } => {
  const creditLimit = card?.creditLimit || card?.manualCreditLimit || 0;
  const usedLimit = card?.usedCreditLimit || Math.abs(card?.balance || 0);

  return {
    available: creditLimit - usedLimit,
    committed: buildResult.allFutureTotal,
    afterClosed: creditLimit - buildResult.currentInvoice.total - buildResult.allFutureTotal
  };
};

// ============================================================
// EXPORTS AUXILIARES
// ============================================================

/**
 * Formata monthKey para exibição (ex: "JAN/2025")
 */
export const formatMonthKey = (monthKey: string): string => {
  if (!monthKey) return '';
  const MONTH_NAMES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const [year, month] = monthKey.split('-');
  const monthIndex = parseInt(month) - 1;
  return `${MONTH_NAMES[monthIndex]}/${year}`;
};

/**
 * Formata valor como moeda BRL
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

/**
 * Formata data YYYY-MM-DD para DD/MM/YYYY
 */
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};
