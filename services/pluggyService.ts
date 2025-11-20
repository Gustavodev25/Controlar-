import { Transaction } from "../types";
import { addTransaction } from "./database";

// CREDENCIAIS HARDCODED (Inseridas diretamente conforme solicitado)
const PLUGGY_CLIENT_ID = "d93b0176-0cd8-4563-b9c1-bcb9c6e510bd";
const PLUGGY_CLIENT_SECRET = "2b45852a-9638-4677-8232-6b2da7c54967";
const API_URL = "https://api.pluggy.ai";

interface PluggyAuthResponse {
  apiKey: string;
}

interface PluggyConnectTokenResponse {
  accessToken: string;
}

// Helper: Map Pluggy Categories to App Categories (uses category and description for better guesses)
const mapCategory = (pluggyCategory?: string, description?: string): string => {
  const lowerCat = pluggyCategory?.toLowerCase() || "";
  const lowerDesc = description?.toLowerCase() || "";
  const combined = `${lowerCat} ${lowerDesc}`.trim();

  if (combined.includes("transport") || combined.includes("uber") || combined.includes("posto") || combined.includes("gasolina")) return "Transporte";
  if (combined.includes("food") || combined.includes("aliment") || combined.includes("restaurante") || combined.includes("ifood") || combined.includes("mercado")) return "Alimentação";
  if (combined.includes("home") || combined.includes("housing") || combined.includes("aluguel") || combined.includes("luz") || combined.includes("internet") || combined.includes("condominio")) return "Moradia";
  if (combined.includes("health") || combined.includes("saude") || combined.includes("farmacia") || combined.includes("drogaria")) return "Saúde";
  if (combined.includes("entertainment") || combined.includes("lazer") || combined.includes("streaming") || combined.includes("cinema")) return "Lazer";
  if (combined.includes("shopping") || combined.includes("compras") || combined.includes("loja")) return "Outros";
  if (combined.includes("transfer") && combined.includes("credit")) return "Salário";
  if (combined.includes("salary") || combined.includes("salario") || combined.includes("payroll") || combined.includes("pagamento")) return "Salário";
  if (combined.includes("investment") || combined.includes("rendimento") || combined.includes("aplicacao")) return "Investimentos";

  return "Outros";
};

/**
 * Authenticates with Pluggy to get an API Key.
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
      throw new Error(`Falha na autenticação Pluggy (${response.status})`);
    }

    const data: PluggyAuthResponse = await response.json();
    if (!data.apiKey) {
      throw new Error("Chave de API não retornada pelo Pluggy.");
    }
    return data.apiKey;
  } catch (error) {
    console.error("Pluggy Auth Exception:", error);
    throw error;
  }
};

/**
 * Creates a Connect Token to initialize the widget.
 */
export const createConnectToken = async (): Promise<string> => {
  try {
    const apiKey = await authenticate();

    // Usando um ID fixo e simples para Sandbox para evitar problemas de validação
    const staticUserId = "financas-ai-guest";

    const response = await fetch(`${API_URL}/connect_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-API-KEY": apiKey
      },
      body: JSON.stringify({
        clientUserId: staticUserId
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Pluggy Connect Token Error Body:", errText);

      if (response.status === 403) {
        throw new Error("Acesso Negado (403). Verifique suas credenciais de Sandbox.");
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
 * Fetches accounts and transactions for a specific Item (Connection).
 */
export const syncPluggyData = async (userId: string, itemId: string): Promise<number> => {
  try {
    const apiKey = await authenticate();
    let importedCount = 0;

    // 1. Get Accounts associated with the Item
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

    // 2. Get Transactions (Last 30 days) for each account
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

    for (const account of accounts) {
      const txRes = await fetch(`${API_URL}/transactions?accountId=${account.id}&from=${fromDate}`, {
        headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
      });

      if (!txRes.ok) continue;
      const txData = await txRes.json();
      const transactions = txData.results || [];

      // 3. Map and Save
      for (const tx of transactions) {
        const isExpense = tx.amount < 0;
        const absAmount = Math.abs(tx.amount);

        if (absAmount === 0) continue;

        const newTx: Omit<Transaction, 'id'> = {
          description: tx.description || "Transação bancária",
          amount: absAmount,
          date: tx.date.split('T')[0],
          type: isExpense ? 'expense' : 'income',
          category: mapCategory(tx.category, tx.description),
          status: 'completed',
          memberId: undefined // Belongs to the main user flow for now
        };

        await addTransaction(userId, newTx);
        importedCount++;
      }
    }

    return importedCount;

  } catch (error) {
    console.error("Error syncing Pluggy data:", error);
    throw error;
  }
};
