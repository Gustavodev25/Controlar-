
import { describe, it, expect } from 'vitest';
import { buildInvoices, validateClosingDay, toDateStr } from './invoiceBuilder';
import { Transaction, ConnectedAccount } from '../types';
import { toCents, fromCents } from '../utils/moneyUtils';

describe('InvoiceBuilder - Precision and Date Rules', () => {
  const mockCard: Partial<ConnectedAccount> = {
    id: 'card_123',
    closingDay: 10,
    dueDay: 20,
    currentBill: {
      totalAmount: 0,
      status: 'OPEN',
      dueDate: '2026-02-20'
    }
  };

  it('should calculate totals correctly using cents-based math', () => {
    const transactions: Partial<Transaction>[] = [
      { id: '1', amount: 10.1, date: '2026-01-05', type: 'expense', cardId: 'card_123' },
      { id: '2', amount: 20.2, date: '2026-01-06', type: 'expense', cardId: 'card_123' },
      { id: '3', amount: 0.05, date: '2026-01-07', type: 'expense', cardId: 'card_123' },
    ];

    const today = new Date(2026, 0, 15); // Jan 15th, 2026
    const result = buildInvoices(mockCard as ConnectedAccount, transactions as Transaction[], 'card_123', 0, today);
    
    // In current system, transactions fall into the current invoice if they are after the last closing date
    // Jan 15th today -> Current closing is Feb 10th. Last closing was Jan 10th.
    // So Jan 5, 6, 7 are in the CLOSED invoice (last period).
    
    expect(result.closedInvoice.total).toBe(30.35);
  });

  it('should handle floating point precision issues (0.1 + 0.2)', () => {
    const transactions: Partial<Transaction>[] = [
      { id: '1', amount: 0.1, date: '2026-01-05', type: 'expense', cardId: 'card_123' },
      { id: '2', amount: 0.2, date: '2026-01-06', type: 'expense', cardId: 'card_123' },
    ];

    const today = new Date(2026, 0, 15); // Jan 15th, 2026
    const result = buildInvoices(mockCard as ConnectedAccount, transactions as Transaction[], 'card_123', 0, today);
    
    expect(result.closedInvoice.total).toBe(0.3);
  });

  it('should adjust closing date to previous business day if it falls on a weekend', () => {
    // 2026-05-10 is a Sunday. Closing should move to Friday 2026-05-08.
    const sundayCard: Partial<ConnectedAccount> = {
      id: 'card_123',
      closingDay: 10,
      dueDay: 20
    };
    
    const today = new Date(2026, 4, 1); // May 1st, 2026
    const result = buildInvoices(sundayCard as ConnectedAccount, [], 'card_123', 0, today);
    
    // currentClosingDate should be 2026-05-08 (Friday)
    expect(toDateStr(result.periods.currentClosingDate)).toBe('2026-05-08');
  });

  it('should adjust due date to next business day if it falls on a holiday', () => {
    // 2026-05-01 is a Friday (Labor Day in Brazil). 
    const holidayCard: Partial<ConnectedAccount> = {
      id: 'card_123',
      closingDay: 20,
      dueDay: 1
    };
    
    const today = new Date(2026, 3, 25); // April 25th, 2026
    const result = buildInvoices(holidayCard as ConnectedAccount, [], 'card_123', 0, today);
    
    // April 25th -> Current closing is May 20th. Due date is June 1st.
    // Last closing was April 20th. Due date is May 1st.
    
    // May 1st, 2026 is Friday (Holiday). It should move to May 4th (Monday).
    expect(result.closedInvoice.dueDate).toBe('2026-05-04');
  });

  it('should NOT classify purchases with "PGTO" prefix as payments', () => {
    const transactions: Partial<Transaction>[] = [
      { id: '1', description: 'PGTO LOJA XYZ', amount: -100, date: '2026-01-05', type: 'expense', cardId: 'card_123' },
      { id: '2', description: 'PAGAMENTO DE FATURA', amount: 100, date: '2026-01-12', type: 'income', cardId: 'card_123' },
    ];

    const today = new Date(2026, 0, 15); // Jan 15th, 2026
    const result = buildInvoices(mockCard as ConnectedAccount, transactions as Transaction[], 'card_123', 0, today);
    
    // Only the 'PGTO LOJA XYZ' should count in the total.
    // The 'PAGAMENTO DE FATURA' is a payment and should be ignored in the total calculation.
    expect(result.closedInvoice.total).toBe(100);
    expect(result.closedInvoice.items.length).toBe(2);
    
    const purchase = result.closedInvoice.items.find(i => i.id === '1');
    const payment = result.closedInvoice.items.find(i => i.id === '2');
    
    expect(purchase?.isPayment).toBe(false);
    expect(payment?.isPayment).toBe(true);
  });

  it('should NOT classify expenses with refund keywords as refunds', () => {
    const transactions: Partial<Transaction>[] = [
      { id: '1', description: 'ESTORNO DE TAXA ADM', amount: -50, date: '2026-01-05', type: 'expense', cardId: 'card_123' },
    ];

    const today = new Date(2026, 0, 15);
    const result = buildInvoices(mockCard as ConnectedAccount, transactions as Transaction[], 'card_123', 0, today);
    
    // It's an expense, so it should be treated as a purchase (adding to total)
    // even if it has the word 'ESTORNO'.
    expect(result.closedInvoice.total).toBe(50);
    const item = result.closedInvoice.items[0];
    expect(item.isRefund).toBe(false);
  });
});
