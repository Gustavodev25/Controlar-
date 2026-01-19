
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Assuming .env is in the root (one level up from scripts/)
dotenv.config({ path: path.join(__dirname, '../.env') });

const getAnthropicApiKey = () => (process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || "").trim();

const detectSubscriptionsWithAI = async (transactions) => {
    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
        console.log('[AI-Detection] ⚠️ No Anthropic API key, skipping AI detection');
        return [];
    }

    // Mock filtering logic from main code
    const expenseTransactions = transactions
        .map(tx => ({
            description: tx.description,
            amount: Math.abs(tx.amount),
            date: tx.date
        }));

    const client = new Anthropic({ apiKey });

    const prompt = `Analise as seguintes transações bancárias e identifique APENAS as que são assinaturas recorrentes (serviços que cobram mensalmente/anualmente).

TRANSAÇÕES:
${JSON.stringify(expenseTransactions, null, 2)}

REGRAS:
1. Identificar APENAS serviços de assinatura recorrente (streaming, software, academia, apps, etc)
2. NÃO incluir compras avulsas (mercado, restaurante, loja, combustível)
3. NÃO incluir compras em lojas de jogos (Steam, Epic Games, etc) - only subscriptions
4. Para cada assinatura detectada, fornecer:
   - name: Nome padronizado do serviço
   - amount: Valor mais recente
   - category: Uma de [Lazer, Tecnologia, Trabalho, Educação, Saúde, Alimentação, Outros]

RESPONDA APENAS em JSON válido no formato:
{"subscriptions": [{"name": "Serviço", "amount": 29.90, "category": "Lazer"}]}

Se não encontrar nenhuma assinatura, responda: {"subscriptions": []}`;

    try {
        console.log(`[AI-Detection] 🤖 Analyzing ${expenseTransactions.length} transactions with Claude AI...`);
        console.log(`[AI-Detection] 🔑 Using Key: ${apiKey.slice(0, 8)}...`);

        const response = await client.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1024,
            temperature: 0.1,
            system: 'Você é um especialista em identificar assinaturas e serviços recorrentes em extratos bancários. Seja preciso e retorne APENAS JSON válido.',
            messages: [{ role: 'user', content: prompt }]
        });

        const text = response.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');

        console.log('[AI-Detection] 🔍 Raw AI Response:', text);

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            const detected = result.subscriptions || [];
            console.log(`[AI-Detection] 🎯 AI found ${detected.length} potential subscriptions:`, JSON.stringify(detected, null, 2));
            return detected;
        }
        return [];
    } catch (error) {
        console.error('[AI-Detection] ❌ Error calling Anthropic API:', error.message);
        if (error.status === 401) console.error('[AI-Detection] 🔑 Check your ANTHROPIC_API_KEY');
        return [];
    }
};

// TEST DATA
const mockTransactions = [
    { description: "MERCADO LIVRE *COMPRA", amount: -150.00, date: "2024-03-10" },
    { description: "NETFLIX.COM", amount: -55.90, date: "2024-03-15" },
    { description: "PAG*Spotify", amount: -21.90, date: "2024-03-20" },
    { description: "Uber *Trip", amount: -24.90, date: "2024-03-22" },
    { description: "ADOBE CREATIVE CLOUD", amount: -240.00, date: "2024-03-05" },
    { description: "RESTAURANTE DO JOAO", amount: -89.90, date: "2024-03-01" },
    { description: "OPENAI *CHATGPT", amount: -100.00, date: "2024-03-25" }
];

console.log("🚀 Starting AI Detection Test...");
detectSubscriptionsWithAI(mockTransactions).then(() => {
    console.log("✅ Test Completed");
});
