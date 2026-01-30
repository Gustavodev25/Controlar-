import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreditCardTable } from '../components/CreditCardTable';
import * as dbService from '../services/database';

// Mock das dependências
vi.mock('../services/database', () => ({
  transactionExists: vi.fn(),
  creditCardTransactionExists: vi.fn(),
  deleteTransaction: vi.fn(),
  deleteCreditCardTransaction: vi.fn(),
}));

vi.mock('../components/Toast', () => ({
  useToasts: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      message: vi.fn(),
    },
  }),
}));

vi.mock('../services/invoiceBuilder', () => ({
  buildInvoices: vi.fn(() => ({
    closedInvoice: { items: [], total: 0 },
    currentInvoice: { items: [], total: 0 },
    futureInvoices: [],
    periods: {},
    allFutureTotal: 0,
  })),
  getTransactionInvoiceMonthKey: vi.fn(),
  isCreditCardPayment: vi.fn(),
}));

vi.mock('../hooks/useCategoryTranslation', () => ({
  useCategoryTranslation: () => ({
    translate: (category: string) => category,
    translateAll: (categories: string[]) => categories,
  }),
}));

vi.mock('../services/currencyService', () => ({
  getExchangeRateSync: vi.fn(() => 1),
  fetchExchangeRates: vi.fn(),
}));

describe('CreditCardTable - Refund Removal Integration', () => {
  const mockUserId = 'user123';
  const mockTransactions = [
    {
      id: 'tx1',
      description: 'Compra teste',
      amount: 100,
      date: '2024-01-15',
      type: 'expense',
      category: 'Shopping',
      isRefund: false,
      status: 'completed',
      totalInstallments: 1,
      installmentNumber: 1,
      invoiceMonthKey: '2024-01',
      timestamp: '2024-01-15T10:00:00Z',
    },
    {
      id: 'refund1',
      description: 'Estorno: Compra teste',
      amount: 100,
      date: '2024-01-16',
      type: 'income',
      category: 'Reembolso',
      isRefund: true,
      status: 'completed',
      totalInstallments: 1,
      installmentNumber: 1,
      invoiceMonthKey: '2024-01',
      timestamp: '2024-01-16T10:00:00Z',
    },
  ];

  const mockCreditCardAccounts = [
    {
      id: 'card1',
      name: 'Cartão Teste',
      bank: 'Banco Teste',
      closingDay: 10,
      dueDay: 20,
      limit: 5000,
      availableLimit: 4500,
      invoicePeriods: {},
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful deletion by default
    vi.mocked(dbService.deleteTransaction).mockResolvedValue(true);
    vi.mocked(dbService.deleteCreditCardTransaction).mockResolvedValue(true);
    vi.mocked(dbService.transactionExists).mockResolvedValue(false);
    vi.mocked(dbService.creditCardTransactionExists).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully remove refund and persist to database', async () => {
    const onDelete = vi.fn().mockImplementation(async (id) => {
      // Simulate successful deletion
      return Promise.resolve();
    });

    render(
      <CreditCardTable
        transactions={mockTransactions}
        creditCardAccounts={mockCreditCardAccounts}
        selectedCardId="card1"
        onDelete={onDelete}
        onUpdate={() => {}}
        onAdd={() => {}}
        userId={mockUserId}
        currentDate={new Date('2024-01-20')}
      />
    );

    // Find and click the refund button
    const refundButton = screen.getByTitle('Remover Lançamento de Estorno');
    expect(refundButton).toBeInTheDocument();

    fireEvent.click(refundButton);

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Remover estorno desta transação?')).toBeInTheDocument();
    });

    // Click confirm button
    const confirmButton = screen.getByText('Sim, remover estorno');
    fireEvent.click(confirmButton);

    // Wait for deletion to complete
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('refund1');
      expect(dbService.deleteTransaction).toHaveBeenCalledWith(mockUserId, 'refund1');
    });
  });

  it('should handle database deletion failure gracefully', async () => {
    // Mock deletion failure
    vi.mocked(dbService.deleteTransaction).mockResolvedValue(false);

    const onDelete = vi.fn().mockImplementation(async (id) => {
      return Promise.reject(new Error('Database error'));
    });

    render(
      <CreditCardTable
        transactions={mockTransactions}
        creditCardAccounts={mockCreditCardAccounts}
        selectedCardId="card1"
        onDelete={onDelete}
        onUpdate={() => {}}
        onAdd={() => {}}
        userId={mockUserId}
        currentDate={new Date('2024-01-20')}
      />
    );

    // Find and click the refund button
    const refundButton = screen.getByTitle('Remover Lançamento de Estorno');
    fireEvent.click(refundButton);

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Remover estorno desta transação?')).toBeInTheDocument();
    });

    // Click confirm button
    const confirmButton = screen.getByText('Sim, remover estorno');
    fireEvent.click(confirmButton);

    // Wait for error handling
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('refund1');
    });
  });

  it('should verify transaction is actually removed from database', async () => {
    const onDelete = vi.fn().mockImplementation(async (id) => {
      // Simulate successful deletion
      return Promise.resolve();
    });

    render(
      <CreditCardTable
        transactions={mockTransactions}
        creditCardAccounts={mockCreditCardAccounts}
        selectedCardId="card1"
        onDelete={onDelete}
        onUpdate={() => {}}
        onAdd={() => {}}
        userId={mockUserId}
        currentDate={new Date('2024-01-20')}
      />
    );

    // Find and click the refund button
    const refundButton = screen.getByTitle('Remover Lançamento de Estorno');
    fireEvent.click(refundButton);

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Remover estorno desta transação?')).toBeInTheDocument();
    });

    // Click confirm button
    const confirmButton = screen.getByText('Sim, remover estorno');
    fireEvent.click(confirmButton);

    // Wait for deletion and verification
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('refund1');
      expect(dbService.transactionExists).toHaveBeenCalledWith(mockUserId, 'refund1');
    });
  });

  it('should handle multiple refund removals', async () => {
    const multipleRefunds = [
      ...mockTransactions,
      {
        id: 'refund2',
        description: 'Estorno: Outra compra',
        amount: 50,
        date: '2024-01-17',
        type: 'income',
        category: 'Reembolso',
        isRefund: true,
        status: 'completed',
        totalInstallments: 1,
        installmentNumber: 1,
        invoiceMonthKey: '2024-01',
        timestamp: '2024-01-17T10:00:00Z',
      },
    ];

    const onDelete = vi.fn().mockImplementation(async (id) => {
      return Promise.resolve();
    });

    render(
      <CreditCardTable
        transactions={multipleRefunds}
        creditCardAccounts={mockCreditCardAccounts}
        selectedCardId="card1"
        onDelete={onDelete}
        onUpdate={() => {}}
        onAdd={() => {}}
        userId={mockUserId}
        currentDate={new Date('2024-01-20')}
      />
    );

    // Find refund buttons
    const refundButtons = screen.getAllByTitle('Remover Lançamento de Estorno');
    expect(refundButtons).toHaveLength(2);

    // Click both refund buttons
    fireEvent.click(refundButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Remover estorno desta transação?')).toBeInTheDocument();
    });

    // Confirm first removal
    const confirmButton = screen.getByText('Sim, remover estorno');
    fireEvent.click(confirmButton);

    // Wait for first deletion
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('refund1');
    });

    // Click second refund button
    fireEvent.click(refundButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Remover estorno desta transação?')).toBeInTheDocument();
    });

    // Confirm second removal
    fireEvent.click(confirmButton);

    // Wait for second deletion
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('refund2');
    });
  });
});