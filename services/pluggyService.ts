
import { Transaction } from "../types";
import { addTransaction } from "./database";

// CREDENCIAIS DIRETAS (Nota: Em produção, use um backend para proteger o Client Secret)
const PLUGGY_CLIENT_ID = "d93b0176-0cd8-4563-b9c1-bcb9c6e510bd".trim();
const PLUGGY_CLIENT_SECRET = "2b45852a-9638-4677-8232-6b2da7c54967".trim();
const API_URL = "https://api.pluggy.ai";

interface PluggyAuthResponse {
  apiKey: string;
}

interface PluggyConnectTokenResponse {
  accessToken: string;
}

// Helper: Map Pluggy Categories to App Categories
const mapCategory = (pluggyCategory: string | undefined, description: string): string => {
  const lowerCat = pluggyCategory?.toLowerCase() || "";
  const lowerDesc = description.toLowerCase();
  const combined = lowerCat + " " + lowerDesc;
  
  if (combined.includes("transport") || combined.includes("uber") || combined.includes("posto") || combined.includes("gasolina")) return "Transporte";
  if (combined.includes("food") || combined.includes("aliment") || combined.includes("restaurante") || combined.includes("ifood") || combined.includes("mercado")) return "Alimentação";
  if (combined.includes("home") || combined.includes("housing") || combined.includes("aluguel") || combined.includes("luz") || combined.includes("internet") || combined.includes("condominio")) return "Moradia";
  if (combined.includes("health") || combined.includes("saude") || combined.includes("farmacia") || combined.includes("drogaria")) return "Saúde";
  if (combined.includes("entertainment") || combined.includes("lazer") || combined.includes("streaming") || combined.includes("cinema")) return "Lazer";
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
        throw new Error(`Falha na autenticação Pluggy (${response.status})`);
    }
    
    const data: PluggyAuthResponse = await response.json();
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
    
    const response = await fetch(`${API_URL}/connect_tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-API-KEY": apiKey
      },
      body: JSON.stringify({
          // Unique ID to maintain session state if needed, or let Pluggy handle it
          options: {
            clientUserId: `user_${Date.now()}` 
          }
      }), 
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar token de conexão: ${response.status}`);
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
    
    if(!accountsRes.ok) throw new Error("Erro ao buscar contas");
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
        
        if(!txRes.ok) continue;
        const txData = await txRes.json();
        const transactions = txData.results || [];

        // 3. Map and Save to Database
        for (const tx of transactions) {
            // Pluggy logic: Expenses are negative, Income is positive usually, but depends on type.
            // Usually: amount is positive, type determines flow.
            // Let's check amount sign just in case or use tx.type if available explicitly.
            // Standard Pluggy: Credit = Positive, Debit = Negative.
            
            const isExpense = tx.amount < 0;
            const absAmount = Math.abs(tx.amount);
            
            // Skip zero amount transactions if any
            if (absAmount === 0) continue;

            const newTx: Omit<Transaction, 'id'> = {
                description: tx.description || "Transação Bancária",
                amount: absAmount,
                date: tx.date.split('T')[0],
                type: isExpense ? 'expense' : 'income',
                category: mapCategory(tx.category, tx.description),
                status: 'completed', // Assumed completed since it comes from bank
                memberId: undefined // Main user
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
