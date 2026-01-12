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
    | { type: "subscription"; data: AIParsedSubscription }
    | { type: "mixed_items"; transactions?: AIParsedTransaction[]; reminders?: AIParsedReminder[]; subscriptions?: AIParsedSubscription[] };

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
    "isSubscription": true/false,
    "accountName": "Nome da conta/banco/cartão se especificado ou inferido (ex: Nubank, Carteira, BB, Inter, C6, Itaú)",
    "needsAccountConfirmation": true/false (true se o usuário NÃO especificou a conta e você precisa perguntar)
  }
}

IMPORTANTE SOBRE CONTAS E CARTÕES:
- Se o usuário mencionar explicitamente um banco/conta/cartão (ex: "gastei 50 no Nubank", "paguei com Inter", "na carteira", "no C6"), preencha "accountName" com o nome e "needsAccountConfirmation": false
- Se o usuário NÃO especificar onde gastou, defina "needsAccountConfirmation": true e "accountName": null
- Nomes comuns de bancos/cartões: Nubank, Inter, C6, Itaú, Bradesco, Santander, BB (Banco do Brasil), Caixa, BTG, Original, Next, Neon, PicPay, Mercado Pago, Carteira, Dinheiro
- Interprete variações como: "nu" = Nubank, "inter" = Inter, "c6" ou "cseis" = C6, "bb" = BB, "dinheiro"/"cash" = Carteira

3. Se o usuário mencionar ITENS MISTOS (combinação de despesas, lembretes e/ou assinaturas), use o intent "mixed_items":
Exemplo: "gastei 50 no uber, preciso lembrar de pagar a luz dia 20 que é 150 reais, e tenho netflix 55 por mês"
{
  "intent": "mixed_items",
  "transactions": [
    {
      "description": "Uber",
      "amount": 50,
      "category": "Transporte",
      "date": "${todayISO}",
      "type": "expense",
      "installments": 1,
      "isSubscription": false,
      "accountName": null,
      "needsAccountConfirmation": true
    }
  ],
  "reminders": [
    {
      "description": "Conta de Luz",
      "amount": 150,
      "category": "Moradia",
      "dueDate": "${todayISO}",
      "type": "expense",
      "isRecurring": true,
      "frequency": "monthly"
    }
  ],
  "subscriptions": [
    {
      "name": "Netflix",
      "amount": 55,
      "category": "Lazer",
      "billingCycle": "monthly"
    }
  ]
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
15. FLEXIBILIDADE: Entenda frases informais como "Preciso receber 200 do João" (Transação de Receita ou Lembrete).
16. CONTA/CARTÃO OBRIGATÓRIO: Se o usuário não mencionar em qual conta/cartão foi o gasto, defina needsAccountConfirmation como true. O sistema vai perguntar depois.
17. Interprete corretamente quando o usuário disser onde foi: "no nubank", "pelo inter", "na carteira", "com o c6", etc.

SEMPRE responda EXCLUSIVAMENTE com o JSON válido, sem texto antes ou depois. Se não for possível extrair dados, use intent: "chat".`;

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
            temperature: 0.5 // Reduzido para equilibrar criatividade e estrutura
        });

        const responseText = response?.text || "";

        // Tentar parsear o JSON da resposta de forma robusta
        let result: any;
        try {
            // Tenta encontrar o primeiro objeto JSON válido na string (non-greedy para fechar no primeiro })
            // A regex abaixo procura o primeiro { e vai até o último } balanceado (simplificado aqui para o maior bloco)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : responseText;

            result = JSON.parse(jsonString);
        } catch (e) {
            // Tentativa 2: Limpeza agressiva de markdown
            try {
                let cleanText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
                // Se ainda tiver texto antes do primeiro {, corta
                const firstBrace = cleanText.indexOf('{');
                const lastBrace = cleanText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
                }
                result = JSON.parse(cleanText);
            } catch (e2) {
                console.error("Falha total no parse do JSON:", e2);
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
            amount: t.amount || 0,
            accountName: t.accountName || undefined,
            needsAccountConfirmation: t.needsAccountConfirmation ?? (t.accountName ? false : true)
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

        // Processar itens mistos (transações + lembretes + assinaturas)
        if (result.intent === "mixed_items") {
            const transactions = (result.transactions || []).map(sanitizeTransaction);

            const reminders = (result.reminders || []).map((r: any): AIParsedReminder => ({
                description: r.description || "Lembrete",
                amount: r.amount || 0,
                category: r.category || "Outros",
                dueDate: fixDate(r.dueDate),
                type: r.type || "expense",
                isRecurring: r.isRecurring ?? false,
                frequency: r.frequency
            }));

            const subscriptions = (result.subscriptions || []).map((s: any): AIParsedSubscription => ({
                name: s.name || "Assinatura",
                amount: s.amount || 0,
                category: s.category || "Lazer",
                billingCycle: s.billingCycle || "monthly"
            }));

            // Só retorna mixed_items se houver pelo menos um item
            if (transactions.length > 0 || reminders.length > 0 || subscriptions.length > 0) {
                return {
                    type: "mixed_items",
                    transactions: transactions.length > 0 ? transactions : undefined,
                    reminders: reminders.length > 0 ? reminders : undefined,
                    subscriptions: subscriptions.length > 0 ? subscriptions : undefined
                };
            }
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
 * Tenta extrair uma assinatura de um texto usando o Claude com prompt específico
 */
export const parseSubscriptionFromText = async (text: string): Promise<AIParsedSubscription | null> => {
    const today = new Date();
    const todayISO = toLocalISODate();

    const systemPrompt = `Você é um assistente especializado em extrair dados de ASSINATURAS E RECORRÊNCIAS.
    
    Hoje é: ${todayISO}
    
    O usuário vai fornecer um texto e você deve extrair os dados da assinatura.
    Mesmo que pareça uma transação única, trate como uma assinatura mensal ou anual.
    
    Retorne APENAS um JSON neste formato:
    {
      "intent": "subscription",
      "subscriptionData": {
        "name": "Nome do serviço",
        "amount": 0.00,
        "category": "Categoria (Lazer, Serviços, etc)",
        "billingCycle": "monthly" ou "yearly"
      }
    }
    
    Regras:
    1. Se não tiver valor, tente inferir ou coloque 0.
    2. Se não tiver nome, coloque "Assinatura".
    3. Se não especificar ciclo, assuma "monthly".
    4. CORRIJA ERROS DE DIGITAÇÃO.
    
    Responda APENAS O JSON.`;

    try {
        const response = await generateWithRetry({
            messages: [{ role: "user", content: text }],
            system: systemPrompt,
            max_tokens: 1024,
            temperature: 0.2
        });

        const responseText = response?.text || "";
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : responseText;
        const result = JSON.parse(jsonString);

        if (result.subscriptionData) {
            return {
                name: result.subscriptionData.name || "Assinatura",
                amount: result.subscriptionData.amount || 0,
                category: result.subscriptionData.category || "Lazer",
                billingCycle: result.subscriptionData.billingCycle || "monthly"
            };
        }
        return null;
    } catch (error) {
        console.error("Erro ao fazer parse da assinatura:", error);
        return null;
    }
};

/**
 * Tenta extrair um lembrete de um texto usando o Claude com prompt específico
 */
export const parseReminderFromText = async (text: string): Promise<AIParsedReminder | null> => {
    const today = new Date();
    const todayISO = toLocalISODate();
    const currentYear = today.getFullYear();

    const systemPrompt = `Você é um assistente especializado em extrair dados de LEMBRETES E CONTAS.
    
    Hoje é: ${todayISO}
    
    O usuário vai fornecer um texto e você deve extrair os dados para um lembrete.
    Mesmo que o usuário diga "Gastei" ou "Recebi", interprete OBRIGATORIAMENTE como um lembrete.
    
    Exemplo: "Preciso receber 210 que emprestei para o Rafael"
    Interpretação: Descrição: "Receber do Rafael", Valor: 210, Tipo: "income", Data: Hoje.
    
    Retorne APENAS um JSON neste formato:
    {
      "intent": "reminder",
      "reminderData": {
        "description": "Descrição curta e clara",
        "amount": 0.00,
        "category": "Categoria (ex: Outros, Moradia, Empréstimos)",
        "dueDate": "YYYY-MM-DD",
        "type": "income" ou "expense",
        "isRecurring": true ou false,
        "frequency": "monthly" (apenas se for recorrente)
      }
    }
    
    Regras:
    1. Se não tiver data explícita, use a data de hoje: ${todayISO}.
    2. Se indicar entrada de dinheiro ("receber", "ganhei"), type = "income".
    3. Se indicar saída ("pagar", "gastei", "conta"), type = "expense".
    4. CORRIJA ERROS DE DIGITAÇÃO.
    
    Responda APENAS O JSON.`;

    try {
        const response = await generateWithRetry({
            messages: [{ role: "user", content: text }],
            system: systemPrompt,
            max_tokens: 1024,
            temperature: 0.2 // Mantido baixo para precisão estrutural
        });

        const responseText = response?.text || "";
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : responseText;
        const result = JSON.parse(jsonString);

        if (result.reminderData) {
            // Helper para corrigir data (local)
            const fixDate = (date: string | undefined): string => {
                if (!date) return todayISO;
                if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const [year, month, day] = date.split('-').map(Number);
                    if (year !== currentYear && year < currentYear) {
                        return `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    }
                }
                return date;
            };

            return {
                description: result.reminderData.description || "Lembrete",
                amount: result.reminderData.amount || 0,
                category: result.reminderData.category || "Outros",
                dueDate: fixDate(result.reminderData.dueDate),
                type: result.reminderData.type || "expense",
                isRecurring: result.reminderData.isRecurring ?? false,
                frequency: result.reminderData.frequency
            };
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