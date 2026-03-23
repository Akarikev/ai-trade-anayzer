import express from "express";
import { createServer as createViteServer } from "vite";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust the first proxy to correctly get the client IP
  app.set('trust proxy', 1);

  app.use(express.json());

  // Rate limiting: 5 requests per minute per IP
  const analyzeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: "Too many analysis requests. Please try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/api/analyze", analyzeLimiter, async (req, res) => {
    try {
      const { marketName, data, timeframe } = req.body;
      
      const client = new Anthropic({ 
        apiKey: process.env.ANTHROPIC_API_KEY || "",
      });

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: `You are a professional forex and market analyst. 
You analyze market data and return structured trading signals.
Always respond with valid JSON only — no markdown, no explanation outside the JSON.`,
        messages: [
          {
            role: "user",
            content: `Analyze the following market data for ${marketName} on a ${timeframe} timeframe.

Provide:
- signal: "BUY", "SELL", or "NEUTRAL"
- confidence: number from 0 to 100
- risk: "LOW", "MEDIUM", or "HIGH"
- reasoning: brief explanation of your analysis
- marketTrend: description of the current market trend

Data: ${data}

Respond with this exact JSON shape:
{
  "signal": "BUY" | "SELL" | "NEUTRAL",
  "confidence": number,
  "risk": "LOW" | "MEDIUM" | "HIGH",
  "reasoning": string,
  "marketTrend": string
}`,
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text response from Claude");
      }

      const parsed = JSON.parse(textBlock.text);
      res.json(parsed);
    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze market" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
