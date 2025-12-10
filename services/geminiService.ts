
import { Type, Schema } from "@google/genai";
import { Transaction, AIParsedTransaction, Budget, Investment } from "../types";
import { getCurrentLocalMonth, toLocalISODate } from "../utils/dateUtils";

const MODEL_NAME = "gemini-2.5-pro";
const GEMINI_API_URL =
  (
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_URL) ||
    (typeof process !== "undefined" ? process.env.VITE_GEMINI_API_URL : "") ||
    "/api/gemini"
  ).trim();

const MISSING_KEY_MESSAGE = "Configure a variavel GEMINI_API_KEY no backend (/api/gemini).";

const isMissingKeyError = (error: any) =>
  String(error?.message || "").includes("MISSING_GEMINI_API_KEY");

async function callGemini(params: any) {
  const endpoint = GEMINI_API_URL || "/api/gemini";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL_NAME, ...params }),
  });

  let data: any = null;
  const raw = await res.text();
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const error = new Error((data && data.error) || raw || "GEMINI_REQUEST_FAILED");
    (error as any).status = res.status;
    throw error;
  }

  return data;
}

export interface AIParsedReminder {
  description: string;
  amount: number;
  category: string;
  dueDate: string;
  isRecurring: boolean;
  frequency?: "monthly" | "weekly" | "yearly";
  type: "income" | "expense";
}

// Helper function to handle 503 Overloaded errors with exponential backoff
async function generateWithRetry(params: any, retries = 3) {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await callGemini(params);
    } catch (error: any) {
      lastError = error;
      const statusCode = error?.status || error?.response?.status;
      const msg = String(error?.message || "").toLowerCase();
      const isOverloaded =
        statusCode === 503 ||
        statusCode === 429 ||
        msg.includes("overloaded") ||
        msg.includes("unavailable") ||
        msg.includes("503");
      if (isOverloaded && i < retries - 1) {
        const delay = 2000 * Math.pow(2, i);
        console.warn(`Gemini overloaded (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
  }
  throw lastError || new Error("Failed to generate content after retries");
}

/**
 * Analyzes financial data to provide insights.
 */
export const analyzeFinances = async (
  transactions: Transaction[],
  focus: "general" | "savings" | "future" = "general"
): Promise<{ analysis: string }> => {
  if (!transactions.length) return { analysis: "Adicione transacoes para receber uma analise da IA." };

  const today = new Date();
  const todayStr = today.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const recentTx = transactions.slice(0, 50).map(t =>
    `${t.date}: ${t.description} (${t.category}) - R$ ${t.amount} [${t.type}]`
  ).join("\n");

  let focusInstruction = "";
  if (focus === "savings") {
    focusInstruction = "Foque em achar gastos desnecessarios e sugerir cortes praticos. Seja direto.";
  } else if (focus === "future") {
    focusInstruction = "Foque em projecao: se vai fechar o mes no positivo e metas de investimento.";
  } else {
    focusInstruction = "Faca uma analise geral: saude financeira, categorias pesadas e um elogio ou alerta.";
  }

  const prompt = `
    Hoje eh: ${todayStr}.
    Voce eh um consultor financeiro pessoal.

    Analise as seguintes transacoes recentes do usuario:
    ${recentTx}

    Instrucao Especifica: ${focusInstruction}

    Responda com um texto curto, direto e util (max 3 paragrafos). Use Markdown.
  `;

  try {
    const response = await generateWithRetry({ contents: prompt });
    return { analysis: response?.text || "Nao foi possivel gerar analise no momento." };
  } catch (error: any) {
    console.error("Erro ao analisar financas:", error);
    if (isMissingKeyError(error)) {
      return { analysis: MISSING_KEY_MESSAGE };
    }
    return { analysis: "O consultor IA esta indisponivel no momento. Tente novamente." };
  }
};

/**
 * Parses natural language text into structured transaction objects (Array).
 */
export const parseTransactionFromText = async (text: string): Promise<AIParsedTransaction[] | null> => {
  const today = new Date();
  const todayStr = today.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const prompt = `
    Hoje eh: ${todayStr}.
    Voce eh um assistente que extrai dados de transacoes financeiras a partir de texto natural.

    Texto do usuario: "${text}"

    Instrucoes:
    1. Identifique TODAS as transacoes mencionadas no texto.
    2. Se o texto for apenas conversa (ex: "ola", "bom dia"), ou nao contiver dados financeiros validos (valor e item), retorne uma lista VAZIA [].
    3. Ignore nomes de arquivos (ex: .tsx, .js) ou textos tecnicos que nao sejam gastos reais.
    4. Para cada transacao:
       - Identifique se eh DESPESA (expense) ou RECEITA (income).
       - Extraia: descricao, valor (> 0), categoria, data (YYYY-MM-DD), parcelas.
       - Se a data nao for informada, use a data de hoje.

    Retorne APENAS JSON (Array).
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING },
        amount: { type: Type.NUMBER, description: "Valor total ou da parcela" },
        category: { type: Type.STRING },
        date: { type: Type.STRING, description: "YYYY-MM-DD" },
        type: { type: Type.STRING, enum: ["income", "expense"] },
        installments: { type: Type.INTEGER, description: "Quantidade de parcelas (1 se a vista)" },
        isSubscription: { type: Type.BOOLEAN, description: "True se for assinatura/servico recorrente" }
      },
      required: ["description", "amount", "category", "type", "date"]
    }
  };

  try {
    const response = await generateWithRetry({
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema }
    });

    const results = JSON.parse(response?.text || "[]") as AIParsedTransaction[];

    if (!Array.isArray(results)) return [];

    // Filter and sanitize
    const validTransactions = results
      .map(result => {
        if (!result.description) result.description = "Nova Transacao";
        if (result.amount === undefined || result.amount === null) result.amount = 0;
        if (!result.category) result.category = "Outros";
        if (!result.type) result.type = "expense";
        if (!result.date) result.date = toLocalISODate();
        if (!result.installments || result.installments < 1) result.installments = 1;
        return result;
      })
      .filter(t => t.amount > 0); // Filter out zero or negative amounts

    return validTransactions;
  } catch (error) {
    console.error("Erro ao interpretar texto:", error);
    if (isMissingKeyError(error)) throw error;
    return null;
  }
};

/**
 * Parses natural language text into a Reminder object.
 */
export const parseReminderFromText = async (text: string): Promise<AIParsedReminder | null> => {
  const today = toLocalISODate();

  const prompt = `
    Hoje eh: ${today}.
    Extraia dados de um lembrete financeiro (conta a pagar ou receber) do texto abaixo.

    Texto: "${text}"

    Identifique: Descricao, Valor, Data de Vencimento (YYYY-MM-DD), Categoria, Recorrencia.
    Retorne JSON.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING },
      amount: { type: Type.NUMBER },
      category: { type: Type.STRING },
      dueDate: { type: Type.STRING, description: "YYYY-MM-DD" },
      isRecurring: { type: Type.BOOLEAN },
      frequency: { type: Type.STRING, enum: ["monthly", "weekly", "yearly"], nullable: true },
      type: { type: Type.STRING, enum: ["income", "expense"] }
    },
    required: ["description", "amount", "category", "dueDate", "isRecurring", "type"]
  };

  try {
    const response = await generateWithRetry({
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema }
    });
    const result = JSON.parse(response?.text || "{}") as AIParsedReminder;

    if (!result.description) result.description = "Lembrete";
    if (!result.amount) result.amount = 0;
    if (!result.category) result.category = "Outros";
    if (!result.dueDate) result.dueDate = today;
    if (!result.type) result.type = "expense";
    if (result.isRecurring === undefined) result.isRecurring = false;

    return result;
  } catch (error) {
    console.error("Erro ao interpretar lembrete:", error);
    if (isMissingKeyError(error)) throw error;
    return null;
  }
};

/**
 * Parses natural language text into a Subscription object.
 */
export const parseSubscriptionFromText = async (text: string): Promise<{ name: string, amount: number, billingCycle: "monthly" | "yearly", category: string } | null> => {
  const prompt = `
    Extraia dados de uma assinatura/servico recorrente do texto: "${text}"

    Identifique:
    - Nome do Servico (ex: Netflix, Spotify)
    - Valor (amount)
    - Ciclo de Cobranca (billingCycle): 'monthly' (mensal) ou 'yearly' (anual). Se nao especificado, assuma 'monthly'.
    - Categoria (ex: Lazer, Trabalho, Educacao)

    Retorne JSON.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      amount: { type: Type.NUMBER },
      billingCycle: { type: Type.STRING, enum: ["monthly", "yearly"] },
      category: { type: Type.STRING }
    },
    required: ["name", "amount", "billingCycle", "category"]
  };

  try {
    const response = await generateWithRetry({
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema }
    });
    const result = JSON.parse(response?.text || "{}");

    if (!result.name) result.name = "Assinatura";
    if (!result.amount) result.amount = 0;
    if (!result.billingCycle) result.billingCycle = "monthly";
    if (!result.category) result.category = "Outros";

    return result;
  } catch (error) {
    console.error("Erro ao interpretar assinatura:", error);
    if (isMissingKeyError(error)) throw error;
    return null;
  }
};

export const parseStatementFile = async (base64Data: string, mimeType: string): Promise<AIParsedTransaction[] | null> => {
  const todayStr = toLocalISODate();

  const prompt = `
    Analise este documento (extrato bancario/fatura).
    Extraia todas as transacoes financeiras encontradas.
    Hoje eh ${todayStr}. Se o ano nao estiver explicito, assuma o ano atual ou recente.
    Ignore saldos acumulados, foque em movimentacoes individuais.
    Retorne um array JSON.
    - isSubscription: true se for assinatura
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING },
        amount: { type: Type.NUMBER },
        category: { type: Type.STRING },
        date: { type: Type.STRING, description: "YYYY-MM-DD" },
        type: { type: Type.STRING, enum: ["income", "expense"] },
        isSubscription: { type: Type.BOOLEAN }
      },
      required: ["description", "amount", "category", "type", "date"]
    }
  };

  try {
    const response = await generateWithRetry({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const results = JSON.parse(response?.text || "[]") as AIParsedTransaction[];
    return results.map(r => ({
      ...r,
      description: r.description || "Transacao",
      amount: r.amount || 0,
      category: r.category || "Outros",
      type: r.type || "expense",
      date: r.date || todayStr
    }));
  } catch (error) {
    console.error("Erro ao processar extrato:", error);
    if (isMissingKeyError(error)) throw error;
    return null;
  }
};

export type ParsedIntent = 
  | { type: 'transaction'; data: AIParsedTransaction[] }
  | { type: 'reminder'; data: AIParsedReminder[] }
  | null;

export const parseMessageIntent = async (text: string): Promise<ParsedIntent> => {
  const today = new Date();
  const todayStr = today.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const prompt = `
    Hoje eh: ${todayStr}.
    Analise o texto: "${text}"

    Decida se o usuario quer:
    1. Registrar transacoes passadas/atuais (intent: 'transaction')
    2. Criar lembretes de contas futuras (intent: 'reminder')

    Se for 'transaction': Extraia lista de transacoes.
    Se for 'reminder': Extraia lista de lembretes.

    Retorne JSON:
    {
      "intent": "transaction" | "reminder",
      "items": [
        // Schema misto, campos dependem do intent
        // Transacao: { description, amount, category, date, type, installments, isSubscription }
        // Lembrete: { description, amount, category, dueDate, isRecurring, frequency, type }
      ]
    }
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      intent: { type: Type.STRING, enum: ["transaction", "reminder"] },
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            date: { type: Type.STRING },
            dueDate: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["income", "expense"] },
            installments: { type: Type.INTEGER },
            isSubscription: { type: Type.BOOLEAN },
            isRecurring: { type: Type.BOOLEAN },
            frequency: { type: Type.STRING, enum: ["monthly", "weekly", "yearly"] }
          }
        }
      }
    },
    required: ["intent", "items"]
  };

  try {
    const response = await generateWithRetry({
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema }
    });

    const result = JSON.parse(response?.text || "{}");
    
    if (!result.items || !Array.isArray(result.items)) return null;

    if (result.intent === 'transaction') {
       const transactions = result.items.map((item: any) => ({
          description: item.description || "Transacao",
          amount: item.amount || 0,
          category: item.category || "Outros",
          date: item.date || toLocalISODate(),
          type: item.type || "expense",
          installments: item.installments || 1,
          isSubscription: item.isSubscription || false
       })).filter((t: any) => t.amount > 0);
       
       return transactions.length > 0 ? { type: 'transaction', data: transactions } : null;
    } 
    
    if (result.intent === 'reminder') {
       const reminders = result.items.map((item: any) => ({
          description: item.description || "Lembrete",
          amount: item.amount || 0,
          category: item.category || "Outros",
          dueDate: item.dueDate || item.date || toLocalISODate(), // Fallback to date if dueDate missing
          type: item.type || "expense",
          isRecurring: item.isRecurring || false,
          frequency: item.frequency
       })).filter((r: any) => r.amount > 0);

       return reminders.length > 0 ? { type: 'reminder', data: reminders } : null;
    }

    return null;
  } catch (error) {
    console.error("Erro ao interpretar intencao:", error);
    if (isMissingKeyError(error)) throw error;
    return null;
  }
};

export type AssistantResponse =
  | { type: "text"; content: string }
  | { type: "transaction"; data: AIParsedTransaction };

export const processAssistantMessage = async (
  text: string,
  contextTransactions: Transaction[] = [],
  contextBudgets: Budget[] = [],
  contextInvestments: Investment[] = []
): Promise<AssistantResponse> => {
  const today = new Date();
  const todayStr = today.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const recentTx = contextTransactions.slice(0, 15).map(t =>
    `${t.date}: ${t.description} (${t.amount})`
  ).join("\n");

  const currentMonth = getCurrentLocalMonth();
  const budgetsSummary = contextBudgets.slice(0, 5).map(b => {
    const spent = contextTransactions
      .filter(t => t.type === "expense" && t.category === b.category && t.date.startsWith(currentMonth))
      .reduce((sum, t) => sum + t.amount, 0);
    return `${b.category}: gasto R$ ${spent.toFixed(2)} de R$ ${Number(b.limitAmount || 0).toFixed(2)}`;
  }).join("\n");

  const investmentsSummary = contextInvestments.slice(0, 5).map(inv => {
    return `${inv.name}: R$ ${Number(inv.currentAmount || 0).toFixed(2)}`;
  }).join("\n");

  const prompt = `
    Hoje eh: ${todayStr}.
    Voce eh um assistente financeiro pessoal inteligente.

    O usuario enviou: "${text}"

    Contexto recente (Resumo):
    Transacoes:
    ${recentTx}

    Orcamentos:
    ${budgetsSummary || 'Nenhum.'}

    Investimentos:
    ${investmentsSummary || 'Nenhum.'}

    Tarefa:
    1. Se for um LANCAMENTO (ex: "gastei 50"), extraia os dados.
    2. Se for uma PERGUNTA/CONVERSA, responda de forma util.

    Retorne JSON.

    Para transactionData, siga as regras:
    - amount: numero positivo
    - type: 'income' ou 'expense'
    - category: escolha a melhor categoria
    - date: YYYY-MM-DD (hoje se nao especificado)
    - description: titulo curto
    - installments: 1 se a vista
    - isSubscription: true se for assinatura
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      intent: { type: Type.STRING, enum: ["transaction", "chat"] },
      chatResponse: { type: Type.STRING },
      transactionData: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          category: { type: Type.STRING },
          date: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["income", "expense"] },
          installments: { type: Type.INTEGER },
          isSubscription: { type: Type.BOOLEAN }
        },
        nullable: true
      }
    },
    required: ["intent"]
  };

  try {
    const response = await generateWithRetry({
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema }
    });

    const result = JSON.parse(response?.text || "{}");

    if (result.intent === "transaction" && result.transactionData) {
      const data = result.transactionData as AIParsedTransaction;
      if (!data.date) data.date = toLocalISODate();
      if (!data.installments || data.installments < 1) data.installments = 1;
      if (!data.description) data.description = "Transacao";
      if (!data.category) data.category = "Outros";
      if (!data.type) data.type = "expense";
      if (!data.amount) data.amount = 0;
      return { type: "transaction", data };
    }

    return { type: "text", content: result.chatResponse || "Entendido." };
  } catch (error) {
    console.error("Erro ao processar mensagem do assistente:", error);
    if (isMissingKeyError(error)) {
      return { type: "text", content: MISSING_KEY_MESSAGE };
    }
    return { type: "text", content: "Estou com dificuldades tecnicas no momento. Tente novamente." };
  }
};
