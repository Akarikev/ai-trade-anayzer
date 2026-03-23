export interface SignalAnalysis {
  signal: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  reasoning: string;
  marketTrend: string;
}

export async function analyzeMarketSignal(
  marketName: string,
  data: string,
  timeframe: string
): Promise<SignalAnalysis> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ marketName, data, timeframe }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return await response.json() as SignalAnalysis;
}
