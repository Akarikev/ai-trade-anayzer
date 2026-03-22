import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface SignalAnalysis {
  signal: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  reasoning: string;
  marketTrend: string;
}

export async function analyzeMarketSignal(marketName: string, data: string, timeframe: string): Promise<SignalAnalysis> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following market data for ${marketName} on a ${timeframe} timeframe. 
    Provide a clear signal (BUY/SELL/NEUTRAL) based on the current market price.
    Provide a confidence score (0-100%), a risk level (LOW/MEDIUM/HIGH), and a brief reasoning.
    Also include the current market trend.
    
    Data: ${data}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          signal: { type: Type.STRING, enum: ["BUY", "SELL", "NEUTRAL"] },
          confidence: { type: Type.NUMBER },
          risk: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
          reasoning: { type: Type.STRING },
          marketTrend: { type: Type.STRING },
        },
        required: ["signal", "confidence", "risk", "reasoning", "marketTrend"],
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    throw new Error("Invalid AI response format");
  }
}
