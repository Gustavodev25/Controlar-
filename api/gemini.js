import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

const getApiKey = () => (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim();

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
    return res.status(500).json({ error: "MISSING_GEMINI_API_KEY" });
  }

  const { model, contents, config: generationConfig } = req.body || {};

  const client = new GoogleGenAI({ apiKey });

  try {
    const result = await client.models.generateContent({
      model: model || DEFAULT_MODEL,
      contents,
      config: generationConfig,
    });

    // Some SDK versions expose text() under response, others as text.
    const text =
      result?.response?.text?.() ??
      result?.text ??
      result?.response?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
      "";

    return res.status(200).json({ text });
  } catch (error) {
    console.error("Gemini proxy error:", error);
    const statusCode = error?.status || error?.response?.status || 500;
    const message = error?.message || "GEMINI_REQUEST_FAILED";
    return res.status(statusCode).json({ error: message });
  }
}
