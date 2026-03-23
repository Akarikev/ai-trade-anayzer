import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

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

    const textBlock = response.content.find((block: any) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const parsed = JSON.parse(textBlock.text);
    res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze market" });
  }
}
