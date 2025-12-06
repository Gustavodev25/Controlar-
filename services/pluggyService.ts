// Stub service - Pluggy integration has been removed
// These functions are kept as no-ops to prevent import errors

export const fetchPluggyAccounts = async (itemId: string): Promise<any[]> => {
  console.warn('[PLUGGY] Service has been removed - fetchPluggyAccounts is a no-op');
  return [];
};

export const syncPluggyData = async (userId: string, itemId: string, memberId?: string): Promise<void> => {
  console.warn('[PLUGGY] Service has been removed - syncPluggyData is a no-op');
};

export const fetchPluggyTransactionsForImport = async (userId: string, itemId: string, accountId: string): Promise<any[]> => {
  console.warn('[PLUGGY] Service has been removed - fetchPluggyTransactionsForImport is a no-op');
  return [];
};

export const markTransactionsAsImported = (userId: string, itemId: string, transactions: any[]): void => {
  console.warn('[PLUGGY] Service has been removed - markTransactionsAsImported is a no-op');
};

export const triggerItemUpdate = async (itemId: string): Promise<boolean> => {
  console.warn('[PLUGGY] Service has been removed - triggerItemUpdate is a no-op');
  return false;
};
