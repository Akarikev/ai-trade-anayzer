import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Activity, 
  ShieldCheck, 
  BarChart3, 
  Zap,
  RefreshCw,
  Search,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Globe,
  Lock,
  Settings,
  History,
  Info
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { analyzeMarketSignal, type SignalAnalysis } from '../services/geminiService';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface MarketDataPoint {
  time: string;
  price: number;
}

interface Market {
  id: string;
  name: string;
  symbol: string; // For WebSocket
  basePrice: number;
  type: 'CRYPTO' | 'FOREX_OTC';
}

const MARKETS: Market[] = [
  { id: 'BTCUSD', name: 'Bitcoin / USD', symbol: 'btcusdt', basePrice: 64000, type: 'CRYPTO' },
  { id: 'ETHUSD', name: 'Ethereum / USD', symbol: 'ethusdt', basePrice: 3500, type: 'CRYPTO' },
  { id: 'EURUSD_OTC', name: 'EUR/USD OTC', symbol: 'eurusd', basePrice: 1.0845, type: 'FOREX_OTC' },
  { id: 'GBPUSD_OTC', name: 'GBP/USD OTC', symbol: 'gbpusd', basePrice: 1.2632, type: 'FOREX_OTC' },
  { id: 'USDJPY_OTC', name: 'USD/JPY OTC', symbol: 'usdjpy', basePrice: 151.42, type: 'FOREX_OTC' },
];

const TIMEFRAMES = [
  { id: 'S5', label: '5s', value: '5 seconds' },
  { id: 'S15', label: '15s', value: '15 seconds' },
  { id: 'S30', label: '30s', value: '30 seconds' },
  { id: 'M1', label: '1m', value: '1 minute' },
  { id: 'M3', label: '3m', value: '3 minutes' },
  { id: 'M5', label: '5m', value: '5 minutes' },
  { id: 'M30', label: '30m', value: '30 minutes' },
  { id: 'CUSTOM', label: 'Custom', value: 'Custom' },
];

export default function Dashboard() {
  const [selectedMarket, setSelectedMarket] = useState<Market>(MARKETS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState(TIMEFRAMES[0]);
  const [customTimeframe, setCustomTimeframe] = useState('');
  const [marketData, setMarketData] = useState<MarketDataPoint[]>([]);
  const [analysis, setAnalysis] = useState<SignalAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [history, setHistory] = useState<(SignalAnalysis & { timestamp: Date, market: string, timeframe: string })[]>([]);
  
  const ws = useRef<WebSocket | null>(null);

  // Filtered markets based on search
  const filteredMarkets = useMemo(() => {
    return MARKETS.filter(m => 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Initialize data
  useEffect(() => {
    const initialData: MarketDataPoint[] = [];
    let currentPrice = selectedMarket.basePrice;
    for (let i = 0; i < 30; i++) {
      currentPrice += (Math.random() - 0.5) * (selectedMarket.type === 'CRYPTO' ? 10 : 0.001);
      initialData.push({
        time: new Date(Date.now() - (30 - i) * 2000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        price: parseFloat(currentPrice.toFixed(selectedMarket.type === 'CRYPTO' ? 2 : 5))
      });
    }
    setMarketData(initialData);
  }, [selectedMarket]);

  // WebSocket Connection
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let connectionTimeout: NodeJS.Timeout | null = null;
    setIsConnected(false); // Reset on market change

    if (selectedMarket.type === 'CRYPTO') {
      const socketUrl = `wss://stream.binance.com:9443/ws/${selectedMarket.symbol}@trade`;
      
      connectionTimeout = setTimeout(() => {
        console.warn("WebSocket connection timed out. Falling back to simulation.");
        if (ws.current) {
          ws.current.onopen = null;
          ws.current.onclose = null;
          ws.current.onerror = null;
          ws.current.onmessage = null;
          ws.current.close();
          ws.current = null;
        }
        startSimulation();
      }, 5000);

      try {
        ws.current = new WebSocket(socketUrl);

        ws.current.onopen = () => {
          if (connectionTimeout) clearTimeout(connectionTimeout);
          console.log(`WebSocket Connected to ${selectedMarket.name}`);
          setIsConnected(true);
        };

        ws.current.onclose = () => {
          if (connectionTimeout) clearTimeout(connectionTimeout);
          console.log(`WebSocket Disconnected from ${selectedMarket.name}`);
          setIsConnected(false);
        };

        ws.current.onerror = (err) => {
          if (connectionTimeout) clearTimeout(connectionTimeout);
          console.error("WebSocket Error:", err);
          setIsConnected(false);
          startSimulation();
        };

        ws.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          const newPrice = parseFloat(data.p);
          
          setMarketData(prev => {
            const newData = [...prev.slice(1), {
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              price: newPrice
            }];
            return newData;
          });
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        startSimulation();
      }
    } else {
      startSimulation();
    }

    function startSimulation() {
      setIsConnected(true);
      intervalId = setInterval(() => {
        setMarketData(prev => {
          if (prev.length === 0) return prev;
          const lastPrice = prev[prev.length - 1].price;
          const volatility = selectedMarket.id.includes('JPY') ? 0.05 : 
                            selectedMarket.type === 'CRYPTO' ? 5 : 0.00005;
          const change = (Math.random() - 0.5) * volatility;
          const newPrice = parseFloat((lastPrice + change).toFixed(selectedMarket.type === 'CRYPTO' ? 2 : 5));
          return [...prev.slice(1), {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            price: newPrice
          }];
        });
      }, 1000);
    }

    return () => {
      if (connectionTimeout) clearTimeout(connectionTimeout);
      if (ws.current) {
        ws.current.onopen = null;
        ws.current.onclose = null;
        ws.current.onerror = null;
        ws.current.onmessage = null;
        ws.current.close();
        ws.current = null;
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
      setIsConnected(false);
    };
  }, [selectedMarket]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const dataString = marketData.map(d => `${d.time}: ${d.price}`).join(', ');
      const timeframeValue = selectedTimeframe.id === 'CUSTOM' ? customTimeframe : selectedTimeframe.value;
      const result = await analyzeMarketSignal(selectedMarket.name, dataString, timeframeValue);
      setAnalysis(result);
      setHistory(prev => [{ ...result, timestamp: new Date(), market: selectedMarket.name, timeframe: timeframeValue }, ...prev].slice(0, 10));
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const currentPrice = marketData.length > 0 ? marketData[marketData.length - 1].price : selectedMarket.basePrice;
  const startPrice = marketData.length > 0 ? marketData[0].price : selectedMarket.basePrice;
  const priceChange = currentPrice - startPrice;
  const priceChangePercent = ((priceChange / startPrice) * 100).toFixed(2);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5] font-sans selection:bg-emerald-500/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 space-y-8">
        
        {/* Navigation / Header */}
        <nav className="flex items-center justify-between border-b border-white/5 pb-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Zap size={22} className="text-black" fill="currentColor" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter uppercase italic">PocketSignal</h1>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">AI Core v2.4</span>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-neutral-500">
              <button className="text-white hover:text-white transition-colors">Dashboard</button>
              <button className="hover:text-white transition-colors">Markets</button>
              <button className="hover:text-white transition-colors">Signals</button>
              <button className="hover:text-white transition-colors">History</button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={cn(
              "px-3 py-1.5 rounded-full border flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
              isConnected ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            )}>
              <Globe size={12} />
              {isConnected ? 'Live Feed Active' : 'Connecting...'}
            </div>
            <button className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
              <Settings size={18} />
            </button>
          </div>
        </nav>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sidebar: Market Selection */}
          <aside className="lg:col-span-3 space-y-6">
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs font-black text-neutral-500 uppercase tracking-[0.2em]">Markets</h2>
                <div className="relative group/search">
                  <input 
                    type="text" 
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-emerald-500/50 transition-all w-32 group-hover/search:w-48"
                  />
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                </div>
              </div>
              
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
                {filteredMarkets.length > 0 ? filteredMarkets.map((market) => (
                  <button
                    key={market.id}
                    onClick={() => {
                      setSelectedMarket(market);
                      setAnalysis(null);
                    }}
                    className={cn(
                      "w-full group flex items-center justify-between p-4 rounded-2xl transition-all border",
                      selectedMarket.id === market.id 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-white" 
                        : "bg-transparent border-transparent hover:bg-white/5 text-neutral-500"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                        selectedMarket.id === market.id ? "bg-emerald-500 text-black" : "bg-white/5 text-neutral-400"
                      )}>
                        {market.id.substring(0, 2)}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold">{market.name}</p>
                        <p className="text-[10px] font-medium opacity-50">{market.type}</p>
                      </div>
                    </div>
                    <ChevronRight size={14} className={cn("transition-transform", selectedMarket.id === market.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0")} />
                  </button>
                )) : (
                  <div className="py-8 text-center text-neutral-600 text-xs font-bold uppercase tracking-widest">
                    No markets found
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-white/10 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <ShieldCheck size={80} />
              </div>
              <h3 className="text-sm font-bold mb-2">AI Precision</h3>
              <p className="text-2xl font-black mb-4">94.2%</p>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed">Our neural network analyzes over 50 indicators per second to provide high-accuracy signals.</p>
            </div>
          </aside>

          {/* Main Content: Chart & Analysis */}
          <div className="lg:col-span-9 space-y-8">
            
            {/* Chart Section */}
            <section className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 backdrop-blur-xl">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-4xl font-black tracking-tighter">{selectedMarket.name}</h2>
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded uppercase tracking-widest border border-emerald-500/20">Live</span>
                  </div>
                  <div className="flex items-center gap-4 text-neutral-500 font-mono text-sm">
                    <span>Vol: $1.2B</span>
                    <span>•</span>
                    <span>High: {(currentPrice * 1.02).toFixed(selectedMarket.type === 'CRYPTO' ? 2 : 5)}</span>
                    <span>•</span>
                    <span>Low: {(currentPrice * 0.98).toFixed(selectedMarket.type === 'CRYPTO' ? 2 : 5)}</span>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <p className="text-5xl font-black font-mono tracking-tighter tabular-nums">
                    {currentPrice.toLocaleString(undefined, { minimumFractionDigits: selectedMarket.type === 'CRYPTO' ? 2 : 5 })}
                  </p>
                  <div className={cn(
                    "flex items-center justify-end gap-1.5 font-bold text-sm",
                    priceChange >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {priceChange >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    {priceChangePercent}%
                  </div>
                </div>
              </div>

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={marketData}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={priceChange >= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={priceChange >= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis 
                      dataKey="time" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#525252', fontWeight: 600}} 
                      minTickGap={40}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#525252', fontWeight: 600}}
                      orientation="right"
                      tickFormatter={(val) => val.toLocaleString()}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#171717', 
                        borderRadius: '16px', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                        padding: '12px'
                      }}
                      itemStyle={{ color: '#FFF', fontWeight: 'bold' }}
                      labelStyle={{ color: '#737373', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke={priceChange >= 0 ? "#10b981" : "#f43f5e"} 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#chartGradient)" 
                      animationDuration={0}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex flex-col gap-3 w-full md:w-auto">
                  <div className="flex gap-1.5 flex-wrap">
                    {TIMEFRAMES.map(tf => (
                      <button 
                        key={tf.id} 
                        onClick={() => setSelectedTimeframe(tf)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all border",
                          selectedTimeframe.id === tf.id 
                            ? "bg-white text-black border-white" 
                            : "bg-white/5 text-neutral-500 border-white/5 hover:bg-white/10"
                        )}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>
                  
                  {selectedTimeframe.id === 'CUSTOM' && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="relative"
                    >
                      <input 
                        type="text"
                        placeholder="e.g. 10 minutes"
                        value={customTimeframe}
                        onChange={(e) => setCustomTimeframe(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs focus:outline-none focus:border-emerald-500/50 w-full md:w-48"
                      />
                    </motion.div>
                  )}
                </div>
                
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || (selectedTimeframe.id === 'CUSTOM' && !customTimeframe)}
                  className={cn(
                    "w-full md:w-auto px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3",
                    (isAnalyzing || (selectedTimeframe.id === 'CUSTOM' && !customTimeframe))
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" 
                      : "bg-emerald-500 text-black hover:bg-emerald-400 active:scale-95"
                  )}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap size={18} fill="currentColor" />
                      Analyze Signal
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Analysis Result Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              
              {/* Main Signal Card */}
              <div className="xl:col-span-2">
                <AnimatePresence mode="wait">
                  {analysis ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden backdrop-blur-xl h-full"
                    >
                      <div className={cn(
                        "p-8 flex items-center justify-between border-b border-white/5",
                        analysis.signal === 'BUY' ? "bg-emerald-500/5" : analysis.signal === 'SELL' ? "bg-rose-500/5" : "bg-neutral-500/5"
                      )}>
                        <div className="flex items-center gap-6">
                          <div className={cn(
                            "w-16 h-16 rounded-3xl flex items-center justify-center text-black shadow-2xl",
                            analysis.signal === 'BUY' ? "bg-emerald-500" : analysis.signal === 'SELL' ? "bg-rose-500" : "bg-neutral-500"
                          )}>
                            {analysis.signal === 'BUY' ? <TrendingUp size={32} /> : analysis.signal === 'SELL' ? <TrendingDown size={32} /> : <Activity size={32} />}
                          </div>
                          <div>
                            <h3 className="text-4xl font-black tracking-tighter uppercase italic">{analysis.signal}</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Confidence</span>
                              <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${analysis.confidence}%` }}
                                  className={cn(
                                    "h-full rounded-full",
                                    analysis.confidence > 80 ? "bg-emerald-500" : "bg-amber-500"
                                  )}
                                />
                              </div>
                              <span className="text-xs font-bold text-white">{analysis.confidence}%</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={cn(
                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest inline-block mb-2 border",
                            analysis.risk === 'LOW' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : 
                            analysis.risk === 'MEDIUM' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : 
                            "bg-rose-500/10 border-rose-500/20 text-rose-400"
                          )}>
                            {analysis.risk} RISK
                          </div>
                        </div>
                      </div>

                      <div className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <h4 className="flex items-center gap-2 text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                                <Info size={12} /> Reasoning
                              </h4>
                              <p className="text-neutral-400 leading-relaxed text-sm font-medium">{analysis.reasoning}</p>
                            </div>
                            <div className="space-y-2">
                              <h4 className="flex items-center gap-2 text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                                <TrendingUp size={12} /> Trend
                              </h4>
                              <p className="text-white font-bold text-sm">{analysis.marketTrend}</p>
                            </div>
                          </div>

                          <div className="bg-white/[0.03] rounded-3xl p-6 space-y-6 border border-white/5">
                            <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Target Levels</h4>
                            <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-neutral-500 uppercase">Entry</p>
                                <p className="text-xl font-mono font-black text-white">{analysis.recommendedEntryPrice || currentPrice}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-neutral-500 uppercase">Take Profit</p>
                                <p className="text-xl font-mono font-black text-emerald-400">{analysis.takeProfit || (currentPrice * (analysis.signal === 'BUY' ? 1.005 : 0.995)).toFixed(selectedMarket.type === 'CRYPTO' ? 2 : 5)}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-neutral-500 uppercase">Stop Loss</p>
                                <p className="text-xl font-mono font-black text-rose-400">{analysis.stopLoss || (currentPrice * (analysis.signal === 'BUY' ? 0.995 : 1.005)).toFixed(selectedMarket.type === 'CRYPTO' ? 2 : 5)}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-neutral-500 uppercase">Duration</p>
                                <p className="text-xl font-black text-white">{selectedTimeframe.id === 'CUSTOM' ? customTimeframe : selectedTimeframe.label}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="bg-white/[0.01] border border-dashed border-white/10 rounded-[40px] p-16 flex flex-col items-center justify-center text-center space-y-6 h-full">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-neutral-700">
                        <BarChart3 size={40} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-neutral-400 uppercase tracking-widest">Awaiting Analysis</h3>
                        <p className="text-sm text-neutral-600 max-w-xs font-medium">Our AI is ready to scan the markets. Select a pair and trigger the analysis core.</p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* History Sidebar */}
              <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.2em]">Recent Signals</h3>
                  <History size={16} className="text-neutral-500" />
                </div>
                
                <div className="space-y-4">
                  {history.length > 0 ? history.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black",
                          item.signal === 'BUY' ? "bg-emerald-500 text-black" : item.signal === 'SELL' ? "bg-rose-500 text-black" : "bg-neutral-500 text-black"
                        )}>
                          {item.signal[0]}
                        </div>
                        <div>
                          <p className="text-xs font-bold">{item.market}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-neutral-500 font-medium">{item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            <span className="text-[10px] text-neutral-600">•</span>
                            <p className="text-[10px] text-emerald-500/70 font-black uppercase tracking-widest">{item.timeframe}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-white">{item.confidence}%</p>
                        <p className={cn(
                          "text-[8px] font-black uppercase tracking-widest",
                          item.risk === 'LOW' ? "text-emerald-400" : "text-rose-400"
                        )}>{item.risk}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="py-12 text-center space-y-3">
                      <Clock size={24} className="mx-auto text-neutral-800" />
                      <p className="text-[10px] font-black text-neutral-700 uppercase tracking-widest">No history yet</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 text-neutral-600 text-[10px] font-black uppercase tracking-[0.2em]">
          <div className="flex items-center gap-4">
            <p>© 2026 PocketSignal AI Core</p>
            <span className="text-neutral-800">•</span>
            <div className="flex items-center gap-2">
              <Lock size={12} />
              <span>End-to-End Encrypted</span>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">API Status</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
          </div>
        </footer>

      </div>
    </div>
  );
}
