import Anthropic from "@anthropic-ai/sdk";

// Ensure Node runtime (not Edge) so the SDK works properly
export const runtime = "nodejs20.x";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "10mb",
        },
    },
};

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929"; 

const getApiKey = () => (process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || "").trim();

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ALLOW_ORIGIN || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        return res.status(500).json({ error: "MISSING_ANTHROPIC_API_KEY" });
    }

    const {
        model,
        messages,
        system,
        max_tokens = 4096,
        temperature = 0.7
    } = req.body || {};

    const client = new Anthropic({ apiKey });

    try {
        const response = await client.messages.create({
            model: model || DEFAULT_MODEL,
            max_tokens,
            temperature,
            system: system || "Você é um assistente financeiro pessoal inteligente e amigável. Responda sempre em português brasileiro.",
            messages: messages || [],
        });

        // Extrair o texto da resposta
        const text = response.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("");

        return res.status(200).json({
            text,
            usage: response.usage,
            stop_reason: response.stop_reason
        });
    } catch (error) {
        const statusCode = error?.status || 500;
        const message = error?.message || "CLAUDE_REQUEST_FAILED";
        console.error("Claude proxy error:", {
            message,
            statusCode,
            stack: error?.stack,
            details: error?.error,
        });
        return res.status(statusCode).json({ error: message, statusCode });
    }
}
