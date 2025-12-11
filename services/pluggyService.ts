/**
 * Pluggy Service - Client-side helper for Pluggy integration
 *
 * This service provides helper functions for the frontend to interact
 * with the Pluggy API through our backend endpoints.
 *
 * API Documentation: https://docs.pluggy.ai/docs/accounts
 *
 * Account Types (from Pluggy API):
 * - type: "BANK" = Bank accounts (checking, savings)
 * - type: "CREDIT" = Credit cards
 * - subtype: "CHECKING_ACCOUNT" = Checking account
 * - subtype: "SAVINGS_ACCOUNT" = Savings account
 * - subtype: "CREDIT_CARD" = Credit card
 */

import axios from 'axios';

// Types
export interface PluggyAccount {
  id: string;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'LOAN';
  subtype: string;
  balance: number;
  currency: string;
  institution: string;
  itemId: string;
  providerId: string;
  accountNumber?: string;
  branchCode?: string;
  creditLimit?: number | null;
  availableCreditLimit?: number | null;
  balanceCloseDate?: string | null;
  balanceDueDate?: string | null;
  transferNumber?: string | null;
  closingBalance?: number | null;
  lastSyncedAt?: string;
}

export interface PluggyTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  subcategory: string;
  type: 'expense' | 'income';
  status: string;
  accountId: string;
  providerId: string;
  importSource: string;
  merchant?: string | null;
  merchantCategory?: string | null;
  paymentMethod?: string | null;
}

export interface PluggySyncResult {
  accounts: PluggyAccount[];
  transactions: PluggyTransaction[];
  creditCardTransactions: PluggyTransaction[];
  source: string;
  debug?: {
    institution: string;
    itemStatus: string;
    products: string[];
    accountSummary: {
      total: number;
      checking: number;
      savings: number;
      creditCard: number;
      investment: number;
      loan: number;
    };
    transactionSummary: {
      total: number;
      bank: number;
      creditCard: number;
    };
  };
}

/**
 * Create a connect token for Pluggy Connect widget
 */
export const createConnectToken = async (userId: string, itemId?: string): Promise<string> => {
  console.log('[PLUGGY SERVICE] Creating connect token...', { userId, itemId });

  try {
    const response = await axios.post('/api/pluggy/create-token', {
      userId,
      itemId
    });

    console.log('[PLUGGY SERVICE] Connect token created successfully');
    return response.data.accessToken;
  } catch (error: any) {
    console.error('[PLUGGY SERVICE] Failed to create connect token:', error.message);
    throw error;
  }
};

/**
 * Sync data from Pluggy for a connected item
 * Returns accounts and transactions
 */
export const syncPluggyData = async (itemId: string): Promise<PluggySyncResult> => {
  console.log('[PLUGGY SERVICE] Starting sync for item:', itemId);

  try {
    const response = await axios.post<PluggySyncResult>('/api/pluggy/sync', { itemId });

    const result = response.data;

    console.log('[PLUGGY SERVICE] Sync completed:');
    console.log(`  - Accounts: ${result.accounts.length}`);
    console.log(`  - Bank Transactions: ${result.transactions.length}`);
    console.log(`  - Credit Card Transactions: ${result.creditCardTransactions.length}`);

    if (result.debug) {
      console.log('[PLUGGY SERVICE] Debug info:', result.debug);
    }

    return result;
  } catch (error: any) {
    console.error('[PLUGGY SERVICE] Sync failed:', error.message);
    throw error;
  }
};

/**
 * Fetch accounts for a specific item
 * This is a convenience wrapper that calls sync and returns only accounts
 */
export const fetchPluggyAccounts = async (itemId: string): Promise<PluggyAccount[]> => {
  console.log('[PLUGGY SERVICE] Fetching accounts for item:', itemId);

  try {
    const syncResult = await syncPluggyData(itemId);
    return syncResult.accounts;
  } catch (error: any) {
    console.error('[PLUGGY SERVICE] Failed to fetch accounts:', error.message);
    return [];
  }
};

/**
 * Fetch transactions for import (combines bank and credit card transactions)
 */
export const fetchPluggyTransactionsForImport = async (
  userId: string,
  itemId: string,
  accountId?: string
): Promise<PluggyTransaction[]> => {
  console.log('[PLUGGY SERVICE] Fetching transactions for import:', { userId, itemId, accountId });

  try {
    const syncResult = await syncPluggyData(itemId);

    let transactions = [
      ...syncResult.transactions,
      ...syncResult.creditCardTransactions
    ];

    // Filter by accountId if provided
    if (accountId) {
      transactions = transactions.filter(tx => tx.accountId === accountId);
    }

    console.log(`[PLUGGY SERVICE] Found ${transactions.length} transactions for import`);
    return transactions;
  } catch (error: any) {
    console.error('[PLUGGY SERVICE] Failed to fetch transactions:', error.message);
    return [];
  }
};

/**
 * Trigger an item update (refresh data from bank)
 */
export const triggerItemUpdate = async (itemId: string): Promise<boolean> => {
  console.log('[PLUGGY SERVICE] Triggering item update:', itemId);

  try {
    // The sync endpoint already triggers an update
    await syncPluggyData(itemId);
    return true;
  } catch (error: any) {
    console.error('[PLUGGY SERVICE] Failed to trigger update:', error.message);
    return false;
  }
};

/**
 * Get debug information for an item
 */
export const getItemDebugInfo = async (itemId: string): Promise<any> => {
  console.log('[PLUGGY SERVICE] Getting debug info for item:', itemId);

  try {
    const response = await axios.get(`/api/pluggy/debug/item/${itemId}`);
    return response.data;
  } catch (error: any) {
    console.error('[PLUGGY SERVICE] Failed to get debug info:', error.message);
    return null;
  }
};

/**
 * Mark transactions as imported (placeholder - actual implementation in database)
 */
export const markTransactionsAsImported = (
  userId: string,
  itemId: string,
  transactions: PluggyTransaction[]
): void => {
  console.log(`[PLUGGY SERVICE] Marking ${transactions.length} transactions as imported`);
  // This is handled by the database service when saving transactions
};

// Export default object for backward compatibility
export default {
  createConnectToken,
  syncPluggyData,
  fetchPluggyAccounts,
  fetchPluggyTransactionsForImport,
  triggerItemUpdate,
  getItemDebugInfo,
  markTransactionsAsImported,
};
