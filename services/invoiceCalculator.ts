import {
    parseISO,
    isBefore,
    isAfter,
    isEqual,
    subMonths,
    setDate,
    startOfDay,
    isValid
} from 'date-fns';

export interface KlaviTransaction {
    transaction_id: string;

    date: string;

    amount: number;

    type: string;

    status: 'posted' | 'pending';

    description: string;
}

export interface CardMetadata {
    closingDay: number;

    timezone?: string;
}

export interface InvoiceSummary {
    currentBalance: number;
    statementBalance: number;
    transactionsInCycle: KlaviTransaction[];
    lastClosingDate: Date;
    nextClosingDate: Date;
}

export function getLastClosingDate(referenceDate: Date, closingDay: number): Date {
    const safeClosingDay = Math.min(Math.max(closingDay, 1), 28);

    const refDateStart = startOfDay(referenceDate);

    let closingThisMonth = setDate(refDateStart, safeClosingDay);
    closingThisMonth = startOfDay(closingThisMonth);

    if (isAfter(refDateStart, closingThisMonth) || isEqual(refDateStart, closingThisMonth)) {
        return closingThisMonth;
    }

    return startOfDay(setDate(subMonths(refDateStart, 1), safeClosingDay));
}

export function getNextClosingDate(lastClosingDate: Date, closingDay: number): Date {
    const safeClosingDay = Math.min(Math.max(closingDay, 1), 28);

    const nextMonth = new Date(lastClosingDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    return startOfDay(setDate(nextMonth, safeClosingDay));
}

function parseTransactionDate(dateString: string): Date | null {
    if (!dateString) return null;

    try {
        const parsed = parseISO(dateString);
        return isValid(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function filterPostedTransactions(
    transactions: KlaviTransaction[],
    referenceDate: Date
): KlaviTransaction[] {
    const refDateEnd = startOfDay(referenceDate);

    return transactions.filter(tx => {
        if (tx.status !== 'posted') {
            return false;
        }

        const txDate = parseTransactionDate(tx.date);
        if (!txDate) {
            console.warn(`Invalid date for transaction ${tx.transaction_id}: ${tx.date}`);
            return false;
        }

        return isBefore(startOfDay(txDate), refDateEnd) ||
            isEqual(startOfDay(txDate), refDateEnd);
    });
}

function filterTransactionsInCycle(
    transactions: KlaviTransaction[],
    lastClosingDate: Date,
    referenceDate: Date
): KlaviTransaction[] {
    const lastCloseStart = startOfDay(lastClosingDate);
    const refDateEnd = startOfDay(referenceDate);

    return transactions.filter(tx => {
        const txDate = parseTransactionDate(tx.date);
        if (!txDate) return false;

        const txDateStart = startOfDay(txDate);

        const isAfterClosing = isAfter(txDateStart, lastCloseStart);
        const isBeforeOrOnRef = isBefore(txDateStart, refDateEnd) || isEqual(txDateStart, refDateEnd);

        return isAfterClosing && isBeforeOrOnRef;
    });
}

function sumTransactionAmounts(transactions: KlaviTransaction[]): number {
    return transactions.reduce((sum, tx) => {
        // Ensure amount is a valid number
        const amount = typeof tx.amount === 'number' && !isNaN(tx.amount)
            ? tx.amount
            : 0;
        return sum + amount;
    }, 0);
}

export function calculateInvoiceSummary(
    transactions: KlaviTransaction[],
    cardMetadata: CardMetadata,
    referenceDate: Date
): InvoiceSummary {
    if (!Array.isArray(transactions)) {
        throw new Error('transactions must be an array');
    }

    if (!cardMetadata || typeof cardMetadata.closingDay !== 'number') {
        throw new Error('cardMetadata.closingDay must be a number');
    }

    if (!(referenceDate instanceof Date) || !isValid(referenceDate)) {
        throw new Error('referenceDate must be a valid Date');
    }

    const lastClosingDate = getLastClosingDate(referenceDate, cardMetadata.closingDay);
    const nextClosingDate = getNextClosingDate(lastClosingDate, cardMetadata.closingDay);

    const postedTransactions = filterPostedTransactions(transactions, referenceDate);

    const currentBalance = sumTransactionAmounts(postedTransactions);

    const transactionsInCycle = filterTransactionsInCycle(
        postedTransactions,
        lastClosingDate,
        referenceDate
    );

    const statementBalance = sumTransactionAmounts(transactionsInCycle);

    const sortedTransactionsInCycle = [...transactionsInCycle].sort((a, b) => {
        const dateA = parseTransactionDate(a.date);
        const dateB = parseTransactionDate(b.date);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
    });

    return {
        currentBalance: Math.round(currentBalance * 100) / 100, 
        statementBalance: Math.round(statementBalance * 100) / 100,
        transactionsInCycle: sortedTransactionsInCycle,
        lastClosingDate,
        nextClosingDate,
    };
}


export function formatInvoiceSummary(summary: InvoiceSummary): string {
    return `
=== Invoice Summary ===
Current Balance: R$ ${summary.currentBalance.toFixed(2)}
Statement Balance: R$ ${summary.statementBalance.toFixed(2)}
Billing Cycle: ${summary.lastClosingDate.toLocaleDateString()} - ${summary.nextClosingDate.toLocaleDateString()}
Transactions in Cycle: ${summary.transactionsInCycle.length}
=======================
  `.trim();
}

export function categorizeTransactions(
    transactions: KlaviTransaction[]
): Record<string, KlaviTransaction[]> {
    return transactions.reduce((acc, tx) => {
        const type = tx.type || 'unknown';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(tx);
        return acc;
    }, {} as Record<string, KlaviTransaction[]>);
}

export function getTotalsByType(
    transactions: KlaviTransaction[]
): Record<string, number> {
    const categorized = categorizeTransactions(transactions);

    return Object.entries(categorized).reduce((acc, [type, txs]) => {
        acc[type] = Math.round(sumTransactionAmounts(txs) * 100) / 100;
        return acc;
    }, {} as Record<string, number>);
}

/**
 * Calculates the invoice month key (YYYY-MM) for a transaction based on the card's closing day.
 *
 * Rule:
 * - If transaction day < closingDay: belongs to CURRENT month's invoice.
 * - If transaction day >= closingDay: belongs to NEXT month's invoice.
 *
 * Example:
 * Closing Day: 10
 * Tx Date: 2025-12-05 -> belongs to invoice 2025-12
 * Tx Date: 2025-12-15 -> belongs to invoice 2026-01
 *
 * @param transactionDate Date object or ISO string (YYYY-MM-DD)
 * @param closingDay The day of the month the invoice closes (1-31)
 */
export function getInvoiceMonthKey(transactionDate: Date | string, closingDay: number): string {
    const date = typeof transactionDate === 'string' ? parseISO(transactionDate) : transactionDate;
    if (!isValid(date)) return '';

    const day = date.getDate();
    let month = date.getMonth(); // 0-indexed
    let year = date.getFullYear();

    // If transaction is on or after closing day, it goes to the next month
    if (day >= closingDay) {
        month += 1;
        if (month > 11) {
            month = 0;
            year += 1;
        }
    }

    // Format YYYY-MM
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

// Re-export from invoiceBuilder for convenience
export {
    buildInvoices,
    generateInvoiceForecast,
    calculateFutureLimitImpact,
    formatMonthKey,
    formatCurrency,
    formatDate,
    isCreditCardPayment,
    validateClosingDay,
    calculateInvoicePeriodDates,
    getTransactionInvoiceMonthKey,
    transactionToInvoiceItem,
    processInstallments,
    type InvoiceBuildResult,
    type InvoicePeriodDates
} from './invoiceBuilder';