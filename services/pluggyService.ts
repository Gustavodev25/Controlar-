import { Transaction, ConnectedAccount, ConnectedTransactionPreview } from "../types";
import { addTransaction, transactionExists } from "./database";

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
 * Busca contas e transacoes do item conectado e salva no Firestore.
 */
export const syncPluggyData = async (userId: string, itemId: string, memberId?: string): Promise<number> => {
  try {
    const apiKey = await authenticate();
    let importedCount = 0;
    const savedIds = loadSavedTxIds(userId, itemId);
    const insertedKeys = new Set<string>();
    const shouldSkipTx = (tx: any, account: any) => {
      const descLower = (tx.description || "").toLowerCase();
      if (descLower.includes("saldo") || descLower.includes("balance") || descLower.includes("limite disponivel")) return true;
      const txType = (tx.type || "").toLowerCase();
      if (txType.includes("balance")) return true;
      return false;
    };

    const accountsRes = await fetch(`${API_URL}/accounts?itemId=${itemId}`, {
      headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
    });

    if (!accountsRes.ok) {
      const err = await accountsRes.text();
      console.error("Error fetching accounts:", err);
      throw new Error("Erro ao buscar contas");
    }
    const accountsData = await accountsRes.json();
    const accounts = accountsData.results || [];
    if (accounts.length === 0) return 0;

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

    for (const account of accounts) {
      const txRes = await fetch(`${API_URL}/transactions?accountId=${account.id}&from=${fromDate}`, {
        headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
      });

      if (!txRes.ok) continue;
      const txData = await txRes.json();
      const transactions = txData.results || [];

      for (const tx of transactions) {
        if (shouldSkipTx(tx, account)) continue;
        const isExpense = tx.amount < 0;
        const absAmount = Math.abs(tx.amount);
        if (absAmount === 0) continue;

        // Ignorar movimentos de saldo ou ajustes que podem inflar receita
        const descLower = (tx.description || "").toLowerCase();
        if (descLower.includes("saldo")) continue;

        const baseDesc = tx.description || account.name || "Transacao bancaria";
        const baseDateStr = (tx.date || new Date().toISOString()).split("T")[0];
        const baseDate = new Date(baseDateStr + "T12:00:00");

        // Detect installments
        const parsedMatch = baseDesc.match(/(\d+)\s*\/\s*(\d+)/);
        const descCurrent = parsedMatch ? Number(parsedMatch[1]) : undefined;
        const descTotal = parsedMatch ? Number(parsedMatch[2]) : undefined;
        const installData = tx.installment || tx.installments || tx.paymentData?.installments;
        const currentInstallment = installData?.number || installData?.current || installData?.currentNumber || tx.paymentData?.installmentsQuantity || descCurrent;
        const totalInstallments = installData?.total || installData?.quantity || installData?.totalNumber || descTotal;

        const installmentsCount = Number(totalInstallments) > 1 ? Number(totalInstallments) : 1;

        for (let i = 1; i <= installmentsCount; i++) {
          // If we know which installment is current, align start
          const installmentIndex = currentInstallment && currentInstallment > 0 ? i - currentInstallment : i - 1;
          const dateObj = new Date(baseDate);
          dateObj.setMonth(baseDate.getMonth() + installmentIndex);
          const dateStr = dateObj.toISOString().split("T")[0];

          const descWithParcel = installmentsCount > 1
            ? `Parcela ${i}/${installmentsCount} - ${baseDesc}`
            : baseDesc;

          const newTx: Omit<Transaction, "id"> = {
            description: descWithParcel,
            amount: absAmount,
            date: dateStr,
            type: isExpense ? "expense" : "income",
            category: mapCategory(tx.category, tx.description),
            status: "pending",
            memberId,
            importSource: "pluggy",
            needsApproval: !isExpense // somente receitas precisam confirmar
          };

          const uniquePluggyId = installmentsCount > 1 && tx.id ? `${tx.id}-inst-${i}` : tx.id;
          const txKey = uniquePluggyId || `${newTx.description}|${newTx.date}|${newTx.amount}|${newTx.type}|${memberId || ""}`;
          newTx.pluggyId = uniquePluggyId || txKey;
          newTx.pluggyItemId = itemId;

          // Skip if we already saved this transaction and it still exists in Firestore
          if (savedIds.has(txKey)) {
            const stillExists = await transactionExists(userId, newTx);
            if (stillExists) continue;
            // Allow reimport if the user removed it manually
            savedIds.delete(txKey);
          }

          if (insertedKeys.has(txKey)) continue;
          insertedKeys.add(txKey);

          // Use deterministic ID to prevent duplicates at Firestore level
          const firestoreId = `pluggy_${uniquePluggyId}`;

          // Double check existence (though addTransaction handles it safely now)
          const exists = await transactionExists(userId, newTx);
          if (exists) continue;

          await addTransaction(userId, newTx, firestoreId);
          importedCount++;
          savedIds.add(txKey);
        }
      }
    }

    persistSavedTxIds(userId, itemId, savedIds);
    return importedCount;
  } catch (error) {
    console.error("Error syncing Pluggy data:", error);
    throw error;
  }
};

/**
 * Lista contas conectadas e traz um preview de transacoes recentes para exibir no app.
 */
export const fetchPluggyAccounts = async (itemId: string): Promise<ConnectedAccount[]> => {
  const apiKey = await authenticate();

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
  const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

  const connectedAccounts: ConnectedAccount[] = [];

  for (const account of accounts) {
    // Buscar poucas transacoes recentes para mostrar no painel
    let previewTransactions: ConnectedTransactionPreview[] = [];
    try {
      const txRes = await fetch(`${API_URL}/transactions?accountId=${account.id}&from=${fromDate}&pageSize=5&sort=date`, {
        headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
      });
      if (txRes.ok) {
        const txData = await txRes.json();
        const txs = txData.results || [];
        previewTransactions = txs.slice(0, 5).map((tx: any) => ({
          id: tx.id || `${account.id}-${tx.date}-${Math.random()}`,
          description: tx.description || "Transacao",
          amount: tx.amount,
          date: (tx.date || new Date().toISOString()).split("T")[0],
          type: tx.amount >= 0 ? "income" : "expense",
          category: tx.category,
          currency: tx.currencyCode || account.currencyCode || "BRL",
          installments: tx.installment || tx.installments || tx.paymentData?.installments
            ? {
              number: tx.installment?.number || tx.installments?.number || tx.paymentData?.installments?.number,
              total: tx.installment?.total || tx.installments?.total || tx.paymentData?.installments?.total
            }
            : undefined
        }));
      }
    } catch (err) {
      console.warn("Erro ao buscar preview de transacoes Pluggy:", err);
    }

    connectedAccounts.push({
      id: account.id,
      itemId: account.itemId || itemId,
      name: account.name || account.type || "Conta bancaria",
      type: account.type,
      subtype: account.subtype,
      institution: account.institution?.name,
      balance: account.balance,
      currency: account.currencyCode || "BRL",
      lastUpdated: account.lastUpdatedAt || account.lastAccessedAt,
      previewTransactions
    });
  }

  return connectedAccounts;
};
