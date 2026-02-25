import { Transaction } from '../types';

/**
 * Determina em qual fatura uma transação deve pertencer (considerando overrides manuais)
 * Segue o contrato de sincronização Web/Mobile.
 */
export function getEffectiveInvoiceMonth(transaction: Partial<Transaction>): string | null {
    // Prioridade 1: manualInvoiceMonth (campo do web)
    if (transaction.manualInvoiceMonth && /^\d{4}-\d{2}$/.test(transaction.manualInvoiceMonth)) {
        return transaction.manualInvoiceMonth;
    }

    // Prioridade 2: invoiceMonthKey do app (se marcado como manual)
    if (transaction.invoiceMonthKeyManual === true
        && transaction.invoiceMonthKey
        && /^\d{4}-\d{2}$/.test(transaction.invoiceMonthKey)) {
        return transaction.invoiceMonthKey;
    }

    // Sem override - usar calculo automatico por data
    return null;
}
