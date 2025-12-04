import { Transaction, ConnectedAccount, ConnectedTransactionPreview } from "../types";
import { addTransaction, transactionExists } from "./database";
import { toLocalISODate } from "../utils/dateUtils";

// Credenciais: prioriza variáveis de ambiente (fallback para valores locais)
const PLUGGY_CLIENT_ID =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_PLUGGY_CLIENT_ID) ||
  (typeof process !== "undefined" ? process.env.VITE_PLUGGY_CLIENT_ID : "") ||
  "d93b0176-0cd8-4563-b9c1-bcb9c6e510bd";

const PLUGGY_CLIENT_SECRET =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_PLUGGY_CLIENT_SECRET) ||
  (typeof process !== "undefined" ? process.env.VITE_PLUGGY_CLIENT_SECRET : "") ||
  "2b45852a-9638-4677-8232-6b2da7c54967";
const API_URL = "https://api.pluggy.ai";
const DEFAULT_CLIENT_USER_ID = "financas-ai-guest";
const savedTxMemory = new Map<string, Set<string>>();

const getLocalStorageSafe = () => {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
};

const savedKey = (userId: string, itemId: string) => `pluggy_saved_tx_${userId}_${itemId}`;

const loadSavedTxIds = (userId: string, itemId: string): Set<string> => {
  const ls = getLocalStorageSafe();
  if (!ls) {
    return savedTxMemory.get(savedKey(userId, itemId)) || new Set();
  }
  try {
    const raw = ls.getItem(savedKey(userId, itemId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr);
  } catch {
    return new Set();
  }
  return new Set();
};

const persistSavedTxIds = (userId: string, itemId: string, ids: Set<string>) => {
  const ls = getLocalStorageSafe();
  if (ls) {
    try {
      ls.setItem(savedKey(userId, itemId), JSON.stringify(Array.from(ids)));
    } catch {
      // ignore persist errors
    }
  } else {
    savedTxMemory.set(savedKey(userId, itemId), new Set(ids));
  }
};

interface PluggyAuthResponse {
  apiKey: string;
}

interface PluggyConnectTokenResponse {
  accessToken: string;
}

// Helper: mapear categorias do Pluggy para categorias do app
const mapCategory = (pluggyCategory?: string, description?: string): string => {
  const lowerCat = pluggyCategory?.toLowerCase() || "";
  const lowerDesc = description?.toLowerCase() || "";
  const combined = `${lowerCat} ${lowerDesc}`.trim();

  if (combined.includes("transport") || combined.includes("uber") || combined.includes("posto") || combined.includes("gasolina")) return "Transporte";
  if (combined.includes("food") || combined.includes("aliment") || combined.includes("restaurante") || combined.includes("ifood") || combined.includes("mercado")) return "Alimentacao";
  if (combined.includes("home") || combined.includes("housing") || combined.includes("aluguel") || combined.includes("luz") || combined.includes("internet") || combined.includes("condominio")) return "Moradia";
  if (combined.includes("health") || combined.includes("saude") || combined.includes("farmacia") || combined.includes("drogaria")) return "Saude";
  if (combined.includes("entertainment") || combined.includes("lazer") || combined.includes("streaming") || combined.includes("cinema")) return "Lazer";
  if (combined.includes("shopping") || combined.includes("compras") || combined.includes("loja")) return "Outros";
  if (combined.includes("transfer") && combined.includes("credit")) return "Salario";
  if (combined.includes("salary") || combined.includes("salario") || combined.includes("payroll") || combined.includes("pagamento")) return "Salario";
  if (combined.includes("investment") || combined.includes("rendimento") || combined.includes("aplicacao")) return "Investimentos";

  return "Outros";
};

/**
 * Autentica no Pluggy e retorna o apiKey.
 */
const authenticate = async (): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        clientId: PLUGGY_CLIENT_ID,
        clientSecret: PLUGGY_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Pluggy Auth Error:", errText);
      throw new Error(`Falha na autenticacao Pluggy (${response.status})`);
    }

    const data: PluggyAuthResponse = await response.json();
    if (!data.apiKey) {
      throw new Error("Chave de API nao retornada pelo Pluggy.");
    }
    return data.apiKey;
  } catch (error) {
    console.error("Pluggy Auth Exception:", error);
    throw error;
  }
};

/**
 * Cria um Connect Token para abrir o widget.
 */
export const createConnectToken = async (clientUserId?: string): Promise<string> => {
  try {
    const apiKey = await authenticate();
    const resolvedUserId = clientUserId?.trim() || DEFAULT_CLIENT_USER_ID;

    const response = await fetch(`${API_URL}/connect_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-API-KEY": apiKey
      },
      body: JSON.stringify({
        clientUserId: resolvedUserId
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Pluggy Connect Token Error Body:", errText);

      if (response.status === 403) {
        throw new Error("Acesso negado (403). Verifique as credenciais.");
      }
      throw new Error(`Erro API Pluggy: ${response.status} - ${errText}`);
    }

    const data: PluggyConnectTokenResponse = await response.json();
    return data.accessToken;
  } catch (error) {
    console.error("Pluggy Connect Token Exception:", error);
    throw error;
  }
};

/**
 * Helper: Aguarda até que o Item termine a atualização (Status != UPDATING)
 */
const waitForItemUpdate = async (itemId: string, apiKey: string): Promise<boolean> => {
  const MAX_ATTEMPTS = 30; // 30 * 2s = 60 segundos timeout
  const DELAY_MS = 2000;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const response = await fetch(`${API_URL}/items/${itemId}`, {
        headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
      });
      
      if (!response.ok) continue;
      
      const item = await response.json();
      const status = item.status;
      
      // Se terminou a atualização (Sucesso ou Erro)
      if (status === "UPDATED" || status === "COMPLETED") {
        return true;
      }
      
      if (status === "LOGIN_ERROR" || status === "OUTDATED") {
        console.warn(`Item ${itemId} stopped with status: ${status}`);
        return false; // Parou com erro
      }

      // Se ainda está UPDATING ou WAITING_USER_INPUT, continua esperando
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    } catch (e) {
      console.error("Polling error:", e);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  console.warn(`Timeout waiting for item ${itemId} update.`);
  return false; // Timeout
};

/**
 * Força a atualização de um Item (Conexão Bancária) no Pluggy.
 * E aguarda o processo finalizar antes de retornar.
 */
export const triggerItemUpdate = async (itemId: string): Promise<boolean> => {
  try {
    const apiKey = await authenticate();
    
    // 1. Solicita a atualização
    const response = await fetch(`${API_URL}/items/${itemId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-API-KEY": apiKey
      },
      body: JSON.stringify({}), // Trigger update
    });

    if (!response.ok) {
      console.warn(`Trigger update request failed for item ${itemId}:`, response.status);
      // Mesmo falhando o trigger explícito, tentamos checar se ele já está rodando
    }
    
    // 2. Aguarda o Crawler terminar
    return await waitForItemUpdate(itemId, apiKey);
    
  } catch (error) {
    console.error("Error triggering item update:", error);
    return false;
  }
};

/**
 * Exclui um Item (Conexão Bancária) no Pluggy.
 */
export const deleteItem = async (itemId: string): Promise<boolean> => {
  try {
    const apiKey = await authenticate();
    
    const response = await fetch(`${API_URL}/items/${itemId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-API-KEY": apiKey
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Failed to delete item ${itemId}: ${response.status} - ${errText}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error deleting item:", error);
    throw error;
  }
};

/**
 * Busca transacoes do Pluggy e retorna objetos Transaction prontos para importação, sem salvar no banco.
 */
export const fetchPluggyTransactionsForImport = async (userId: string, itemId: string, targetAccountId?: string): Promise<Omit<Transaction, "id">[]> => {
  try {
    const apiKey = await authenticate();
    const resultTransactions: Omit<Transaction, "id">[] = [];

    const shouldSkipTx = (tx: any, account: any) => {
      const descLower = (tx.description || "").toLowerCase();
      if (descLower.includes("saldo anterior") || 
          descLower.includes("sdo ant") || 
          descLower.includes("saldo do dia") || 
          descLower.includes("saldo bloqueado") ||
          descLower.includes("limite disponivel") ||
          descLower.includes("balance carried") ||
          descLower === "saldo"
      ) return true;
      
      const txType = (tx.type || "").toLowerCase();
      if (txType.includes("balance")) return true;
      return false;
    };

    // 1. Get Accounts
    const accountsRes = await fetch(`${API_URL}/accounts?itemId=${itemId}`, {
      headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
    });

    if (!accountsRes.ok) {
      const err = await accountsRes.text();
      console.error("Error fetching accounts:", err);
      throw new Error("Erro ao buscar contas");
    }
    const accountsData = await accountsRes.json();
    let accounts = accountsData.results || [];
    if (accounts.length === 0) return [];

    // Filter if specific account requested
    if (targetAccountId) {
      accounts = accounts.filter((a: any) => a.id === targetAccountId);
    }

    const today = new Date();
    const searchDate = new Date();
    // CHANGE 1: Increase range to 6 months (180 days) to get full history as requested
    searchDate.setDate(today.getDate() - 180);
    const fromDate = toLocalISODate(searchDate);

    // 2. Iterate accounts
    for (const account of accounts) {
      console.log(`[PLUGGY] Fetching transactions for account ${account.name} (${account.type} / ${account.subtype})`);

      let transactions: any[] = [];
      let page = 1;
      let totalPages = 1;

      // CHANGE 2: Pagination Loop to fetch ALL transactions
      try {
        do {
            const url = `${API_URL}/transactions?accountId=${account.id}&from=${fromDate}&page=${page}&pageSize=500`;
            const txRes = await fetch(url, {
                headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
            });

            if (!txRes.ok) {
                console.error(`[PLUGGY] Erro ao buscar transacoes (Pagina ${page}) da conta ${account.name}: ${txRes.status}`);
                break;
            }

            const txData = await txRes.json();
            const pageResults = txData.results || [];
            transactions.push(...pageResults);
            
            totalPages = txData.totalPages || 1;
            console.log(`[PLUGGY] Account ${account.name}: Fetched page ${page}/${totalPages} (${pageResults.length} items)`);
            
            page++;
        } while (page <= totalPages);

        console.log(`[PLUGGY] Found TOTAL ${transactions.length} transactions for ${account.name}`);
      } catch (err) {
        console.error(`[PLUGGY] Excecao ao buscar transacoes da conta ${account.name}:`, err);
        continue;
      }

      const isCreditCard = (account.type === "CREDIT" || account.subtype === "CREDIT_CARD");
      console.log(`[PLUGGY] Account ${account.name} is${isCreditCard ? '' : ' NOT'} a credit card`);

      let processedCount = 0;
      for (const tx of transactions) {
        if (shouldSkipTx(tx, account)) {
          console.log(`[PLUGGY] Skipped transaction: ${tx.description} (balance/saldo)`);
          continue;
        }

        const category = mapCategory(tx.category, tx.description);
        let isExpense;
        
        const expenseCategories = ['Alimentacao', 'Transporte', 'Lazer', 'Saude', 'Moradia'];
        
        if (category === 'Salario') {
           isExpense = false;
        } else if (category === 'Investimentos') {
           isExpense = isCreditCard ? tx.amount > 0 : tx.amount < 0;
        } else if (expenseCategories.includes(category)) {
           isExpense = true;
        } else {
            if (isCreditCard) {
              isExpense = tx.amount > 0;
            } else {
              isExpense = tx.amount < 0;
            }
        }

        const absAmount = Math.abs(tx.amount);
        if (absAmount === 0) continue;

        const baseDesc = tx.description || account.name || "Transacao bancaria";
        const dateStr = tx.date ? tx.date.split("T")[0] : toLocalISODate();

        // Detect installments for Description Only
        const parsedMatch = baseDesc.match(/(\d+)\s*[\/|de]\s*(\d+)/i);
        const descCurrent = parsedMatch ? Number(parsedMatch[1]) : undefined;
        const descTotal = parsedMatch ? Number(parsedMatch[2]) : undefined;
        const installData = tx.installment || tx.installments || tx.paymentData?.installments;
        const currentInstallment = installData?.number || installData?.current || installData?.currentNumber || tx.paymentData?.installmentsQuantity || descCurrent;
        const totalInstallments = installData?.total || installData?.quantity || installData?.totalNumber || descTotal;

        let finalDesc = baseDesc;
        // Append (X/Y) if detected but not present in text
        if (currentInstallment && totalInstallments && !parsedMatch) {
             finalDesc = `${baseDesc} (${currentInstallment}/${totalInstallments})`;
        }

        const newTx: Omit<Transaction, "id"> = {
            description: finalDesc,
            amount: absAmount,
            date: dateStr,
            type: isExpense ? "expense" : "income",
            category: category,
            status: "completed",
            importSource: "pluggy",
            needsApproval: false,
            accountId: account.id,
            accountType: account.subtype || account.type,
            pluggyId: tx.id, // Use strict ID from Pluggy to prevent duplicates
            pluggyItemId: itemId
        };

        resultTransactions.push(newTx);
        processedCount++;
      }

      console.log(`[PLUGGY] Processed ${processedCount} transactions for account ${account.name}`);
    }

    console.log(`[PLUGGY] Total transactions to import: ${resultTransactions.length}`);
    return resultTransactions;
  } catch (error) {
    console.error("Error fetching Pluggy transactions:", error);
    throw error;
  }
};

/**
 * Helper: Generate all installment transactions from a base transaction
 */
const generateInstallmentTransactions = (baseTx: Omit<Transaction, "id">, currentInstallment: number, totalInstallments: number): Omit<Transaction, "id">[] => {
  const transactions: Omit<Transaction, "id">[] = [];
  const baseDate = new Date(baseTx.date + 'T00:00:00');
  const baseAmount = baseTx.amount;

  // Remove the installment info from description to get clean name
  const cleanDesc = baseTx.description.replace(/\s*\(?\d+\s*[\/|de]\s*\d+\)?/gi, '').trim();

  for (let i = 1; i <= totalInstallments; i++) {
    // Calculate date: add (i - currentInstallment) months
    const installmentDate = new Date(baseDate);
    installmentDate.setMonth(installmentDate.getMonth() + (i - currentInstallment));

    const dateStr = installmentDate.toISOString().split('T')[0];

    transactions.push({
      ...baseTx,
      description: `${cleanDesc} (${i}/${totalInstallments})`,
      date: dateStr,
      // Use a unique pluggyId for each installment
      pluggyId: `${baseTx.pluggyId}_inst_${i}`
    });
  }

  return transactions;
};

/**
 * Importa automaticamente todas as transacoes do Item para o Firestore.
 * Usado principalmente na primeira conexao para popular dados.
 */
export const autoImportPluggyItem = async (userId: string, itemId: string, memberId?: string): Promise<number> => {
  try {
    console.log(`[PLUGGY] Starting auto-import for item ${itemId}`);
    const candidates = await fetchPluggyTransactionsForImport(userId, itemId);
    console.log(`[PLUGGY] Fetched ${candidates.length} candidate transactions`);

    let importedCount = 0;
    const savedIds = loadSavedTxIds(userId, itemId);
    const insertedKeys = new Set<string>();

    for (const newTx of candidates) {
       // Add memberId if provided
       if (memberId) newTx.memberId = memberId;

       // Check if this is an installment transaction
       // Regex handles "1/12", "1 / 12", "1 de 12"
       const installmentMatch = newTx.description.match(/(\d+)\s*[\/|de]\s*(\d+)/i);
       const currentInstallment = installmentMatch ? parseInt(installmentMatch[1]) : null;
       const totalInstallments = installmentMatch ? parseInt(installmentMatch[2]) : null;

       let transactionsToSave: Omit<Transaction, "id">[] = [];

       if (currentInstallment && totalInstallments && totalInstallments > 1) {
         console.log(`[PLUGGY] Detected installment ${currentInstallment}/${totalInstallments} for ${newTx.description}`);
         
         // STRATEGY: To avoid duplicates (exponential growth of transactions), 
         // we only generate FUTURE installments if we are processing the FIRST installment (1/X).
         // If we are processing 2/X, 3/X, etc., we assume the future ones were already projected 
         // when 1/X was processed (or we skip projection to avoid duplicates if 1/X was missed).
         // We ALWAYS save the current one (which is the real one from the bank).

         if (currentInstallment === 1) {
            // Generate all future installments (2 to Total)
            // The current one (1/Total) is added by default below as 'newTx'? 
            // No, generateInstallmentTransactions usually generates ALL. 
            // Let's use a custom logic here to be safe.
            
            // 1. Add the Current One (1/X) - explicitly ensuring it keeps the original pluggyId
            transactionsToSave.push(newTx);

            // 2. Generate Future Ones (2..Total)
            const futureInstallments = generateInstallmentTransactions(newTx, currentInstallment, totalInstallments);
            // Filter out the first one since we just added the real 'newTx'
            // generateInstallmentTransactions creates 1..Total.
            // We want only 2..Total
            const futureOnly = futureInstallments.filter(t => {
                const match = t.description.match(/(\d+)\s*[\/|de]\s*(\d+)/i);
                const inst = match ? parseInt(match[1]) : 0;
                return inst > 1;
            });
            
            transactionsToSave.push(...futureOnly);
            console.log(`[PLUGGY] Generated ${futureOnly.length} future installment transactions (Projected)`);

         } else {
            // Current > 1. Only save the current one (Real).
            // Do not generate future ones to avoid duplicates.
            transactionsToSave.push(newTx);
         }

       } else {
         transactionsToSave = [newTx];
       }

       // Save all generated transactions
       for (const txToSave of transactionsToSave) {
         const txKey = txToSave.pluggyId!;

         // Skip if we already saved this transaction
         if (savedIds.has(txKey)) {
           const stillExists = await transactionExists(userId, txToSave);
           if (stillExists) continue;
           savedIds.delete(txKey);
         }

         if (insertedKeys.has(txKey)) continue;
         insertedKeys.add(txKey);

         const firestoreId = `pluggy_${txKey}`;

         const exists = await transactionExists(userId, txToSave);
         if (exists) continue;

         await addTransaction(userId, txToSave, firestoreId);
         importedCount++;
         savedIds.add(txKey);
       }
    }

    persistSavedTxIds(userId, itemId, savedIds);
    console.log(`[PLUGGY] Auto-import completed: ${importedCount} transactions imported`);
    return importedCount;
  } catch (error) {
    console.error("[PLUGGY] Error auto-importing Pluggy data:", error);
    return 0;
  }
};

/**
 * Busca contas e transacoes do item conectado e salva no Firestore.
 */
export const syncPluggyData = async (userId: string, itemId: string, memberId?: string): Promise<number> => {
  // Re-enabled automatic sync via autoImportPluggyItem
  return autoImportPluggyItem(userId, itemId, memberId);
};

export const markTransactionsAsImported = (userId: string, itemId: string, transactions: Omit<Transaction, "id">[]) => {
  const savedIds = loadSavedTxIds(userId, itemId);
  transactions.forEach(tx => {
    if (tx.pluggyId) savedIds.add(tx.pluggyId);
  });
  persistSavedTxIds(userId, itemId, savedIds);
};

/**
 * Lista contas conectadas e traz um preview de transacoes recentes para exibir no app.
 */
export const fetchPluggyAccounts = async (itemId: string): Promise<ConnectedAccount[]> => {
  const apiKey = await authenticate();

  // 1. Fetch item details to get the institution name reliably
  const itemRes = await fetch(`${API_URL}/items/${itemId}`, {
    headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
  });

  let itemInstitutionName: string = "Outros";
  if (itemRes.ok) {
    const itemData = await itemRes.json();
    // O nome do banco geralmente vem dentro de 'connector'
    itemInstitutionName = itemData.connector?.name || itemData.institution?.name || "Outros";
  } else if (itemRes.status === 404) {
    console.error(`[PLUGGY] Item ${itemId} not found (404). This item should be removed.`);
    throw new Error('ITEM_NOT_FOUND');
  } else {
    console.warn(`Could not fetch item details for ${itemId}. Using 'Outros' as fallback institution name.`);
  }

  const accountsRes = await fetch(`${API_URL}/accounts?itemId=${itemId}`, {
    headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
  });

  if (!accountsRes.ok) {
    const err = await accountsRes.text();
    console.error("Error fetching accounts:", err);
    throw new Error("Nao foi possivel buscar contas conectadas.");
  }

  const accountsData = await accountsRes.json();
  const accounts = accountsData.results || [];
  if (!accounts.length) return [];

  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const fromDate = toLocalISODate(thirtyDaysAgo);

  const connectedAccounts: ConnectedAccount[] = [];

  for (const account of accounts) {
    // Buscar poucas transacoes recentes para mostrar no painel
    let previewTransactions: ConnectedTransactionPreview[] = [];
    let bills: any[] = [];

    // Verifica tipo para preview também
    const isCreditCard = (account.type === "CREDIT" || account.subtype === "CREDIT_CARD");

    try {
      const txRes = await fetch(`${API_URL}/transactions?accountId=${account.id}&from=${fromDate}&pageSize=5&sort=date`, {
        headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
      });
      if (txRes.ok) {
        const txData = await txRes.json();
        const txs = txData.results || [];

        previewTransactions = txs.slice(0, 5).map((tx: any) => {
          // Aplica mesma lógica corrigida no preview
          let isExpense;
          if (isCreditCard) {
            isExpense = tx.amount > 0; // Cartão: Positivo é despesa (compra)
          } else {
            isExpense = tx.amount < 0; // Conta: Negativo é despesa
          }

          return {
            id: tx.id || `${account.id}-${tx.date}-${Math.random()}`,
            description: tx.description || "Transacao",
            amount: tx.amount,
            date: tx.date ? tx.date.split("T")[0] : toLocalISODate(),
            type: isExpense ? "expense" : "income",
            category: tx.category,
            currency: tx.currencyCode || account.currencyCode || "BRL",
            installments: tx.installment || tx.installments || tx.paymentData?.installments
              ? {
                number: tx.installment?.number || tx.installments?.number || tx.paymentData?.installments?.number,
                total: tx.installment?.total || tx.installments?.total || tx.paymentData?.installments?.total
              }
              : undefined
          };
        });
      }
    } catch (err) {
      console.warn("Erro ao buscar preview de transacoes Pluggy:", err);
    }

    // Fetch Bills if Credit Card
    if (isCreditCard) {
        try {
            // Request more bills with pageSize parameter to get all available invoices
            const billsRes = await fetch(`${API_URL}/bills?accountId=${account.id}&pageSize=100`, {
                headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
            });

            console.log(`[PLUGGY] Fetching bills for account ${account.id}...`);

            if (billsRes.ok) {
                const billsData = await billsRes.json();
                console.log(`[PLUGGY] Bills Response:`, billsData);

                bills = (billsData.results || []).map((b: any) => ({
                    id: b.id,
                    dueDate: b.dueDate,
                    totalAmount: b.totalAmount,
                    balanceCloseDate: b.balanceCloseDate
                }));

                console.log(`[PLUGGY] Parsed ${bills.length} bills for account ${account.id}`);
                console.log(`[PLUGGY] Bills:`, bills);
            } else {
                console.error(`[PLUGGY] Failed to fetch bills: ${billsRes.status}`);
                const errorText = await billsRes.text();
                console.error(`[PLUGGY] Error details:`, errorText);
            }
        } catch (err) {
            console.error(`[PLUGGY] Exception fetching bills for account ${account.id}:`, err);
        }
    }

    connectedAccounts.push({
      id: account.id,
      itemId: account.itemId || itemId,
      name: account.name || account.type || "Conta bancaria",
      type: account.type,
      subtype: account.subtype,
      institution: itemInstitutionName, // Use the reliably fetched institution name
      balance: account.balance,
      currency: account.currencyCode || "BRL",
      lastUpdated: account.lastUpdatedAt || account.lastAccessedAt,
      creditLimit: account.creditData?.creditLimit,
      availableCreditLimit: account.creditData?.availableCreditLimit,
      brand: account.creditData?.brand,
      balanceCloseDate: account.creditData?.balanceCloseDate,
      balanceDueDate: account.creditData?.balanceDueDate,
      minimumPayment: account.creditData?.minimumPayment,
      previewTransactions,
      bills
    });
  }

  return connectedAccounts;
};
