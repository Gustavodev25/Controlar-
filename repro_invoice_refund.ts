
// Mock Types
interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
    type: 'income' | 'expense';
    status: string;
    cardId?: string;
    accountId?: string;
    installmentNumber?: number;
    totalInstallments?: number;
    isProjected?: boolean;
    isPayment?: boolean;
    manualInvoiceMonth?: string;
    currencyCode?: string;
    amountOriginal?: number;
    amountInAccountCurrency?: number;
    pluggyRaw?: any;
}

interface InvoiceItem {
    id: string;
    transactionId?: string;
    description: string;
    amount: number;
    date: string;
    category?: string;
    type: 'income' | 'expense';
    installmentNumber?: number;
    totalInstallments?: number;
    isProjected?: boolean;
    isPayment?: boolean;
    isRefund?: boolean;
    // ... other fields irrelevant for this test
}

// ============================================================
// COPIED LOGIC FROM services/invoiceBuilder.ts (AS IS / BEFORE FIX)
// ============================================================

const getPaymentKeywords = () => [
    'pagamento de fatura',
    'pagamento fatura',
    'pagamento recebido',
    'credit card payment',
    'pag fatura',
    'pgto fatura',
    'pgto'
];

const isCreditCardPayment = (tx: Transaction): boolean => {
    const d = (tx.description || '').toLowerCase();
    const c = (tx.category || '').toLowerCase();

    const paymentKeywords = getPaymentKeywords();
    const isExplicitPayment = paymentKeywords.some(kw => d.includes(kw) || c.includes(kw) || d === 'pgto');

    if (isExplicitPayment) {
        if (d.includes('estorno') || d.includes('cancelamento')) {
            return false;
        }
        return true;
    }

    const refundKeywords = ['estorno', 'reembolso', 'devolução', 'cancelamento', 'refund', 'chargeback', 'cashback'];
    if (refundKeywords.some(kw => d.includes(kw) || c.includes(kw))) {
        return false;
    }

    return false;
};

const isTransactionRefund = (tx: Transaction): boolean => {
    if (isCreditCardPayment(tx)) {
        return false;
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

// THE FUNCTION TO TEST (Current Implementation)
const transactionToInvoiceItem = (tx: Transaction, isProjected = false): InvoiceItem => {
    const isPayment = isCreditCardPayment(tx);
    // FIX APPLIED: Check for negative amount!
    const isRefund = isTransactionRefund(tx) || (!isPayment && tx.amount < 0);

    let fixedType: 'income' | 'expense' = 'expense';
    let amount = -Math.abs(tx.amount); // Despesa por padrão (negativo)

    if (isPayment) {
        fixedType = 'income';
        amount = Math.abs(tx.amount);
    } else if (isRefund) {
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
        isPayment,
        isRefund
    };
};

// ============================================================
// TEST EXECUTION
// ============================================================

const refundWithoutKeyword: Transaction = {
    id: '3',
    description: 'TKT360*SUUE',
    amount: -359.20,
    date: '2026-01-06',
    category: 'Tickets',
    type: 'expense',
    status: 'completed'
};

function runTest() {
    console.log('Testing transaction:', refundWithoutKeyword.description, 'Amount:', refundWithoutKeyword.amount);
    const result = transactionToInvoiceItem(refundWithoutKeyword);
    console.log('Result Amount:', result.amount);
    console.log('Result Type:', result.type);
    console.log('Is Refund detected?', result.isRefund);

    if (result.amount < 0) {
        console.log('FAIL: Transaction treated as expense (negative amount).');
    } else {
        console.log('PASS: Transaction treated as income (positive amount).');
    }
}

runTest();
