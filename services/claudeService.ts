import { Transaction, AIParsedTransaction, Budget, Investment, Reminder, Subscription } from "../types";
import { getCurrentLocalMonth, toLocalISODate } from "../utils/dateUtils";

const MODEL_NAME = "claude-sonnet-4-20250514";
const CLAUDE_API_URL =
    (
        (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_CLAUDE_API_URL) ||
        (typeof process !== "undefined" ? process.env.VITE_CLAUDE_API_URL : "") ||
        "/api/claude"
    ).trim();

const MISSING_KEY_MESSAGE = "Configure a variável ANTHROPIC_API_KEY no backend (/api/claude).";

const isMissingKeyError = (error: any) =>
    String(error?.message || "").includes("MISSING_ANTHROPIC_API_KEY");

interface ClaudeMessage {
    role: "user" | "assistant";
    content: string;
}

async function callClaude(params: {
    messages: ClaudeMessage[];
    system?: string;
    max_tokens?: number;
    temperature?: number;
}) {
    const endpoint = CLAUDE_API_URL || "/api/claude";
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
        const error = new Error((data && data.error) || raw || "CLAUDE_REQUEST_FAILED");
        (error as any).status = res.status;
        throw error;
    }

    return data;
}

// Helper function to handle errors with exponential backoff
async function generateWithRetry(params: {
    messages: ClaudeMessage[];
    system?: string;
    max_tokens?: number;
    temperature?: number;
}, retries = 3) {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            return await callClaude(params);
        } catch (error: any) {
            lastError = error;
            const statusCode = error?.status || error?.response?.status;
            const msg = String(error?.message || "").toLowerCase();
            const isOverloaded =
                statusCode === 503 ||
                statusCode === 529 ||  // Claude overloaded
                statusCode === 429 ||
                msg.includes("overloaded") ||
                msg.includes("unavailable");
            if (isOverloaded && i < retries - 1) {
                const delay = 2000 * Math.pow(2, i);
                console.warn(`Claude overloaded (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            break;
        }
    }
    throw lastError || new Error("Failed to generate content after retries");
}

export interface AIParsedReminder {
    description: string;
    amount: number;
    category: string;
    dueDate: string;
    type: 'income' | 'expense';
    isRecurring: boolean;
    frequency?: 'monthly' | 'weekly' | 'yearly';
}

export interface AIParsedSubscription {
    name: string;
    amount: number;
    category: string;
    billingCycle: 'monthly' | 'yearly';
}

export type ClaudeAssistantResponse =
    | { type: "text"; content: string }
    | { type: "transaction"; data: AIParsedTransaction }
    | { type: "multiple_transactions"; data: AIParsedTransaction[]; askUnify: boolean; unifiedSuggestion?: AIParsedTransaction }
    | { type: "reminder"; data: AIParsedReminder }
    | { type: "subscription"; data: AIParsedSubscription };

/**
 * Processa mensagem do assistente usando Claude 3.5 Sonnet
 */
export const processClaudeAssistantMessage = async (
    text: string,
    contextTransactions: Transaction[] = [],
    contextBudgets: Budget[] = [],
    contextInvestments: Investment[] = [],
    conversationHistory: ClaudeMessage[] = []
): Promise<ClaudeAssistantResponse> => {
    const today = new Date();
    const todayISO = toLocalISODate(); // YYYY-MM-DD format
    const currentYear = today.getFullYear();
    const todayStr = today.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const recentTx = contextTransactions.slice(0, 15).map(t =>
        `${t.date}: ${t.description} (R$ ${t.amount}) [${t.type}]`
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

    const systemPrompt = `Você é o Coinzinha, um assistente financeiro pessoal inteligente e amigável.

IMPORTANTE - DATA ATUAL:
- Hoje é: ${todayStr}
- Data em formato ISO: ${todayISO}
- Ano atual: ${currentYear}

ATENÇÃO: Quando criar transações SEM data especificada pelo usuário, use SEMPRE a data de hoje: ${todayISO}

Contexto financeiro do usuário:
Transações recentes:
${recentTx || 'Nenhuma transação ainda.'}

Orçamentos:
${budgetsSummary || 'Nenhum orçamento definido.'}

Investimentos:
${investmentsSummary || 'Nenhum investimento registrado.'}

REGRAS IMPORTANTES:

1. Se o usuário mencionar MÚLTIPLOS GASTOS em uma única frase (ex: "gastei 30 de uber e 140 no restaurante para almoçar"), responda com JSON:
{
  "intent": "multiple_transactions",
  "transactions": [
    {
      "description": "Uber para almoço",
      "amount": 30,
      "category": "Transporte",
      "date": "${todayISO}",
      "type": "expense",
      "installments": 1,
      "isSubscription": false
    },
    {
      "description": "Restaurante - Almoço",
      "amount": 140,
      "category": "Alimentação",
      "date": "${todayISO}",
      "type": "expense",
      "installments": 1,
      "isSubscription": false
    }
  ],
  "unifiedSuggestion": {
    "description": "Almoço (Uber + Restaurante)",
    "amount": 170,
    "category": "Alimentação",
    "date": "${todayISO}",
    "type": "expense",
    "installments": 1,
    "isSubscription": false
  }
}

2. Se o usuário mencionar UM ÚNICO GASTO ou RECEITA:
{
  "intent": "transaction",
  "transactionData": {
    "description": "descrição curta",
    "amount": número positivo,
    "category": "categoria adequada",
    "date": "${todayISO}",
    "type": "income" ou "expense",
    "installments": número (1 se à vista),
    "isSubscription": true/false
  }
}

4. Se o usuário mencionar um LEMBRETE ou CONTA A PAGAR FUTURA (ex: "lembrar de pagar luz dia 20", "vence conta de água dia 15"):
{
  "intent": "reminder",
  "reminderData": {
    "description": "Conta de Luz",
    "amount": 150,
    "category": "Moradia",
    "dueDate": "${todayISO}",
    "type": "expense",
    "isRecurring": true,
    "frequency": "monthly"
  }
}

5. Se o usuário mencionar uma ASSINATURA ou SERVIÇO RECORRENTE (ex: "assino Netflix 55 reais", "tenho Spotify por 22"):
{
  "intent": "subscription",
  "subscriptionData": {
    "name": "Netflix",
    "amount": 55,
    "category": "Lazer",
    "billingCycle": "monthly"
  }
}

6. Para QUALQUER outro tipo de mensagem (perguntas, conversas, análises):
{
  "intent": "chat",
  "chatResponse": "sua resposta aqui..."
}

7. Seja simpático, use emojis ocasionalmente e dê dicas financeiras úteis.
8. Se não tiver certeza se é uma transação, lembrete ou assinatura, pergunte ao usuário para confirmar.
9. Categorias comuns: Alimentação, Transporte, Saúde, Educação, Lazer, Moradia, Vestuário, Tecnologia, Serviços, Outros.
10. A data da transação DEVE usar o ano ${currentYear} (ano atual) se não for especificado.
11. Na descrição das transações, seja detalhado mas conciso.
12. Serviços de streaming (Netflix, Spotify, Disney+, etc.) são ASSINATURAS, não transações.
13. CORRIJA ERROS DE DIGITAÇÃO: Se o usuário escrever "ubeer", entenda como "Uber". "ifood", "iFood". "Restaurante", etc.
14. Se a entrada for ambígua, tente inferir o contexto mais provável (ex: "luz 100" -> Provável conta de luz/Lembrete).

SEMPRE responda EXCLUSIVAMENTE com o JSON válido, sem texto antes ou depois.`;

    // Construir o histórico de mensagens
    const messages: ClaudeMessage[] = [
        ...conversationHistory.slice(-10), // Últimas 10 mensagens para contexto
        { role: "user", content: text }
    ];

    try {
        const response = await generateWithRetry({
            messages,
            system: systemPrompt,
            max_tokens: 2048,
            temperature: 0.5 // Reduzido para ser mais determinístico
        });

        const responseText = response?.text || "";

        // Tentar parsear o JSON da resposta de forma robusta
        let result: any;
        try {
            // Tenta encontrar o primeiro objeto JSON válido na string
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : responseText;
            
            result = JSON.parse(jsonString);
        } catch (e) {
            console.error("Erro ao parsear JSON do Claude:", e);
            console.log("Resposta bruta:", responseText);
            // Se falhar, tenta limpar crase tripla
            try {
                 let cleanText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
                 result = JSON.parse(cleanText);
            } catch {
                return { type: "text", content: responseText || "Não entendi. Pode repetir de outra forma?" };
            }
        }

        // Helper para corrigir data
        const fixDate = (date: string | undefined): string => {
            if (!date) return todayISO;
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, month, day] = date.split('-').map(Number);
                if (year !== currentYear && year < currentYear) {
                    console.log(`[Claude] Data corrigida de ${year} para ${currentYear}`);
                    return `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                }
            }
            return date;
        };

        // Helper para sanitizar transação
        const sanitizeTransaction = (t: AIParsedTransaction): AIParsedTransaction => ({
            ...t,
            date: fixDate(t.date),
            installments: t.installments && t.installments >= 1 ? t.installments : 1,
            description: t.description || "Transação",
            category: t.category || "Outros",
            type: t.type || "expense",
            amount: t.amount || 0
        });

        // Processar múltiplas transações
        if (result.intent === "multiple_transactions" && result.transactions && Array.isArray(result.transactions)) {
            const transactions = result.transactions.map(sanitizeTransaction);
            const unifiedSuggestion = result.unifiedSuggestion
                ? sanitizeTransaction(result.unifiedSuggestion)
                : undefined;

            return {
                type: "multiple_transactions",
                data: transactions,
                askUnify: true,
                unifiedSuggestion
            };
        }

        // Processar transação única
        if (result.intent === "transaction" && result.transactionData) {
            const data = sanitizeTransaction(result.transactionData as AIParsedTransaction);
            return { type: "transaction", data };
        }

        // Processar lembrete
        if (result.intent === "reminder" && result.reminderData) {
            const reminder: AIParsedReminder = {
                description: result.reminderData.description || "Lembrete",
                amount: result.reminderData.amount || 0,
                category: result.reminderData.category || "Outros",
                dueDate: fixDate(result.reminderData.dueDate),
                type: result.reminderData.type || "expense",
                isRecurring: result.reminderData.isRecurring ?? false,
                frequency: result.reminderData.frequency
            };
            return { type: "reminder", data: reminder };
        }

        // Processar assinatura
        if (result.intent === "subscription" && result.subscriptionData) {
            const subscription: AIParsedSubscription = {
                name: result.subscriptionData.name || "Assinatura",
                amount: result.subscriptionData.amount || 0,
                category: result.subscriptionData.category || "Lazer",
                billingCycle: result.subscriptionData.billingCycle || "monthly"
            };
            return { type: "subscription", data: subscription };
        }

        return { type: "text", content: result.chatResponse || responseText || "Entendido." };
    } catch (error) {
        console.error("Erro ao processar mensagem do assistente (Claude):", error);
        if (isMissingKeyError(error)) {
            return { type: "text", content: MISSING_KEY_MESSAGE };
        }
        return { type: "text", content: "Estou com dificuldades técnicas no momento. Tente novamente." };
    }
};

/**
 * Tenta extrair uma assinatura de um texto usando o Claude
 */
export const parseSubscriptionFromText = async (text: string): Promise<AIParsedSubscription | null> => {
    try {
        const result = await processClaudeAssistantMessage(text);
        if (result.type === 'subscription') {
            return result.data;
        }
        return null;
    } catch (error) {
        console.error("Erro ao fazer parse da assinatura:", error);
        return null;
    }
};

/**
 * Tenta extrair um lembrete de um texto usando o Claude
 */
export const parseReminderFromText = async (text: string): Promise<AIParsedReminder | null> => {
    try {
        const result = await processClaudeAssistantMessage(text);
        if (result.type === 'reminder') {
            return result.data;
        }
        return null;
    } catch (error) {
        console.error("Erro ao fazer parse do lembrete:", error);
        return null;
    }
};

/**
 * Identifica a intenção da mensagem e retorna os dados estruturados
 */
export const parseMessageIntent = async (text: string) => {
    return await processClaudeAssistantMessage(text);
};
