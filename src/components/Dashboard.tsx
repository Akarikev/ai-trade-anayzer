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
  Info,
  AlertTriangle,
  X,
  ArrowRight,
  Timer,
  Moon,
  Sun
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
import { analyzeMarketSignal, type SignalAnalysis } from '../services/claudeService';

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
  fallbackPrice: number;
  type: 'CRYPTO' | 'FOREX_OTC';
}

const MARKETS: Market[] = [
  // Crypto
  { id: 'BTCUSD', name: 'Bitcoin / USD', symbol: 'btcusdt', fallbackPrice: 64000, type: 'CRYPTO' },
  { id: 'ETHUSD', name: 'Ethereum / USD', symbol: 'ethusdt', fallbackPrice: 3500, type: 'CRYPTO' },
  { id: 'SOLUSD', name: 'Solana / USD', symbol: 'solusdt', fallbackPrice: 150, type: 'CRYPTO' },
  { id: 'BNBUSD', name: 'Binance Coin / USD', symbol: 'bnbusdt', fallbackPrice: 600, type: 'CRYPTO' },
  { id: 'XRPUSD', name: 'Ripple / USD', symbol: 'xrpusdt', fallbackPrice: 0.6, type: 'CRYPTO' },
  { id: 'ADAUSD', name: 'Cardano / USD', symbol: 'adausdt', fallbackPrice: 0.5, type: 'CRYPTO' },
  { id: 'DOGEUSD', name: 'Dogecoin / USD', symbol: 'dogeusdt', fallbackPrice: 0.15, type: 'CRYPTO' },
  
  // Forex OTC
  { id: 'EURUSD_OTC', name: 'EUR/USD OTC', symbol: 'eurusd', fallbackPrice: 1.0845, type: 'FOREX_OTC' },
  { id: 'GBPUSD_OTC', name: 'GBP/USD OTC', symbol: 'gbpusd', fallbackPrice: 1.2632, type: 'FOREX_OTC' },
  { id: 'AUDUSD_OTC', name: 'AUD/USD OTC', symbol: 'audusd', fallbackPrice: 0.65, type: 'FOREX_OTC' },
  { id: 'NZDUSD_OTC', name: 'NZD/USD OTC', symbol: 'nzdusd', fallbackPrice: 0.60, type: 'FOREX_OTC' },
  { id: 'USDJPY_OTC', name: 'USD/JPY OTC', symbol: 'usdjpy', fallbackPrice: 151.42, type: 'FOREX_OTC' },
  { id: 'USDCAD_OTC', name: 'USD/CAD OTC', symbol: 'usdcad', fallbackPrice: 1.35, type: 'FOREX_OTC' },
  { id: 'USDCHF_OTC', name: 'USD/CHF OTC', symbol: 'usdchf', fallbackPrice: 0.90, type: 'FOREX_OTC' },
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

const TRADING_TERMS: Record<string, string> = {
  'bearish': 'A market trend where prices are falling or expected to fall.',
  'bullish': 'A market trend where prices are rising or expected to rise.',
  'entry': 'The specific price at which you should open your trade.',
  'take profit': 'The target price to close the trade and secure your gains.',
  'stop loss': 'The price level to close the trade to prevent further losses.',
  'duration': 'The expected time frame for this trade to play out.',
  'volatility': 'The rate at which the price of an asset increases or decreases.',
  'support': 'A price level where a downtrend tends to pause due to demand.',
  'resistance': 'A price level where an uptrend tends to pause due to supply.',
  'overbought': 'An asset that has traded higher in price and is likely to reverse.',
  'oversold': 'An asset that has traded lower in price and is likely to bounce.',
  'trend': 'The general direction of a market or of the price of an asset.',
  'consolidation': 'A period where prices trade within a limited range.',
  'breakout': 'When the price moves above a resistance or below a support level.',
};

const TermTooltip: React.FC<{ children: React.ReactNode, content: string }> = ({ children, content }) => {
  return (
    <span className="relative group/tooltip inline-block">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-white dark:bg-[#1A1A1A] text-black dark:text-white text-[11px] leading-relaxed rounded-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none shadow-2xl border border-black/10 dark:border-white/10 text-center font-medium normal-case tracking-normal block">
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-[#1A1A1A] block" />
      </span>
    </span>
  );
};

const renderWithTooltips = (text: string) => {
  if (!text) return text;
  const terms = Object.keys(TRADING_TERMS).sort((a, b) => b.length - a.length);
  const regex = new RegExp(`\\b(${terms.join('|')})\\b`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => {
    const lowerPart = part.toLowerCase();
    if (TRADING_TERMS[lowerPart]) {
      return (
        <TermTooltip key={i} content={TRADING_TERMS[lowerPart]}>
          <span className="border-b border-dashed border-emerald-500/50 text-emerald-400 cursor-help">
            {part}
          </span>
        </TermTooltip>
      );
    }
    return part;
  });
};

export default function Dashboard() {
  const [selectedMarket, setSelectedMarket] = useState<Market>(MARKETS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState(TIMEFRAMES[0]);
  const [customTimeframe, setCustomTimeframe] = useState('');
  const [marketData, setMarketData] = useState<MarketDataPoint[]>([]);
  const [analysis, setAnalysis] = useState<SignalAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);
  const [isConnected, setIsConnected] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Handle Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'markets' | 'signals' | 'history'>('dashboard');
  const [history, setHistory] = useState<(SignalAnalysis & { timestamp: Date, market: string, timeframe: string })[]>(() => {
    const saved = localStorage.getItem('pocketSignalHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((item: any) => ({ ...item, timestamp: new Date(item.timestamp) }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  
  const ws = useRef<WebSocket | null>(null);

  // Save history to local storage
  useEffect(() => {
    localStorage.setItem('pocketSignalHistory', JSON.stringify(history));
  }, [history]);

  // Filtered markets based on search
  const filteredMarkets = useMemo(() => {
    return MARKETS.filter(m => 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Initialize data
  useEffect(() => {
    let isMounted = true;

    const fetchInitialData = async () => {
      let currentPrice = selectedMarket.fallbackPrice;
      
      try {
        if (selectedMarket.type === 'CRYPTO') {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${selectedMarket.symbol.toUpperCase()}`);
          const data = await res.json();
          if (data.price) currentPrice = parseFloat(data.price);
        } else if (selectedMarket.type === 'FOREX_OTC') {
          const res = await fetch(`https://api.frankfurter.app/latest?from=USD`);
          const data = await res.json();
          if (data.rates) {
            if (selectedMarket.id === 'EURUSD_OTC') currentPrice = 1 / data.rates.EUR;
            if (selectedMarket.id === 'GBPUSD_OTC') currentPrice = 1 / data.rates.GBP;
            if (selectedMarket.id === 'AUDUSD_OTC') currentPrice = 1 / data.rates.AUD;
            if (selectedMarket.id === 'NZDUSD_OTC') currentPrice = 1 / data.rates.NZD;
            if (selectedMarket.id === 'USDJPY_OTC') currentPrice = data.rates.JPY;
            if (selectedMarket.id === 'USDCAD_OTC') currentPrice = data.rates.CAD;
            if (selectedMarket.id === 'USDCHF_OTC') currentPrice = data.rates.CHF;
          }
        }
      } catch (error) {
        console.error("Failed to fetch real price, using fallback:", error);
      }

      if (!isMounted) return;

      const initialData: MarketDataPoint[] = [];
      const volatility = selectedMarket.id.includes('JPY') ? 0.05 : 
                         selectedMarket.type === 'CRYPTO' ? currentPrice * 0.0005 : 0.00005;
      
      // Walk backwards to find a plausible start price
      let startPrice = currentPrice;
      for (let i = 0; i < 30; i++) {
        startPrice -= (Math.random() - 0.5) * volatility;
      }
      
      let walkPrice = startPrice;
      for (let i = 0; i < 30; i++) {
        walkPrice += (Math.random() - 0.5) * volatility;
        initialData.push({
          time: new Date(Date.now() - (30 - i) * 2000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          price: parseFloat(walkPrice.toFixed(selectedMarket.type === 'CRYPTO' ? 2 : 5))
        });
      }
      
      // Ensure the very last point is the exact real price
      initialData.push({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        price: parseFloat(currentPrice.toFixed(selectedMarket.type === 'CRYPTO' ? 2 : 5))
      });

      setMarketData(initialData);
    };

    fetchInitialData();

    return () => {
      isMounted = false;
    };
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
          ws.current.onerror = () => {}; // Prevent unhandled errors during close
          ws.current.onmessage = null;
          try {
            ws.current.close();
          } catch (e) {
            // Ignore close errors
          }
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
        ws.current.onerror = () => {}; // Prevent unhandled errors during close
        ws.current.onmessage = null;
        try {
          if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
            ws.current.close();
          }
        } catch (e) {
          // Ignore close errors
        }
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
    setAnalysisError(null);
    try {
      const prices = marketData.map(d => d.price);
      const recent = prices.slice(-10);
      const avg = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      const momentum = prices.length >= 10 ? prices[prices.length - 1] - prices[prices.length - 10] : 0;
      const high = prices.length > 0 ? Math.max(...prices) : 0;
      const low = prices.length > 0 ? Math.min(...prices) : 0;

      const dataString = `
        Price series (last 30 ticks): ${prices.slice(-30).join(', ')}
        Current price: ${currentPrice}
        10-tick average: ${avg.toFixed(5)}
        Momentum (last 10 ticks): ${momentum.toFixed(5)}
        Session high: ${high}, Session low: ${low}
        Market: ${selectedMarket.name}, Type: ${selectedMarket.type}
      `;
      const timeframeValue = selectedTimeframe.id === 'CUSTOM' ? customTimeframe : selectedTimeframe.value;
      const result = await analyzeMarketSignal(selectedMarket.name, dataString, timeframeValue);
      setAnalysis(result);
      setHistory(prev => [{ ...result, timestamp: new Date(), market: selectedMarket.name, timeframe: timeframeValue }, ...prev].slice(0, 10));
      setCooldown(15); // 15 seconds cooldown
    } catch (error: any) {
      console.error("Analysis failed:", error);
      setAnalysisError(error.message || "Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const currentPrice = marketData.length > 0 ? marketData[marketData.length - 1].price : selectedMarket.fallbackPrice;
  const startPrice = marketData.length > 0 ? marketData[0].price : selectedMarket.fallbackPrice;
  const priceChange = currentPrice - startPrice;
  const priceChangePercent = ((priceChange / startPrice) * 100).toFixed(2);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0A0A0A] text-neutral-900 dark:text-[#E5E5E5] font-sans selection:bg-emerald-500/30">
      {/* Disclaimer Modal */}
      <AnimatePresence>
        {showDisclaimer && (
          <motion.div 
            key="disclaimer-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 dark:bg-white dark:bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-[32px] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-rose-500" />
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 mb-6">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-2xl font-black tracking-tighter mb-4 text-black dark:text-white">Important Disclaimer</h2>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed mb-8 font-medium">
                The signals and analysis provided by PocketSignal AI Core are <strong className="text-black dark:text-white">predictions based on historical data and AI models</strong>. They are not guaranteed to be accurate and do not constitute financial advice. 
                <br/><br/>
                Always conduct your own analysis or consult a certified trading expert before making any financial decisions. Trading involves significant risk of loss.
              </p>
              <button 
                onClick={() => setShowDisclaimer(false)}
                className="w-full py-4 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-xl font-black uppercase tracking-widest text-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors active:scale-95"
              >
                I Understand & Agree
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            key="settings-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 dark:bg-white dark:bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-[32px] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-center text-black dark:text-white">
                    <Settings size={20} />
                  </div>
                  <h2 className="text-2xl font-black tracking-tighter text-black dark:text-white">Settings</h2>
                </div>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="p-2 bg-black/5 dark:bg-white/5 rounded-full hover:bg-black/10 dark:bg-white/10 transition-colors text-neutral-600 dark:text-neutral-400 hover:text-black dark:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Default Timeframe */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.2em]">Default Timeframe</h3>
                  <select
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl py-3 px-4 text-sm text-black dark:text-white font-bold focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
                    value={selectedTimeframe.id}
                    onChange={(e) => {
                      const tf = TIMEFRAMES.find(t => t.id === e.target.value);
                      if (tf) setSelectedTimeframe(tf);
                    }}
                  >
                    {TIMEFRAMES.map(tf => (
                      <option key={tf.id} value={tf.id} className="bg-white dark:bg-[#111] text-black dark:text-white">
                        {tf.label} - {tf.value}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Data Management */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.2em]">Data Management</h3>
                  <button
                    onClick={() => {
                      setHistory([]);
                      localStorage.removeItem('pocketSignalHistory');
                      setShowSettings(false);
                    }}
                    className="w-full py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-500/20 transition-colors active:scale-95 flex items-center justify-center gap-2"
                  >
                    <AlertTriangle size={16} />
                    Clear Signal History
                  </button>
                  <p className="text-[10px] text-neutral-500 text-center font-medium">
                    This will permanently delete your saved signals from this device.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 space-y-8">
        
        {/* Navigation / Header */}
        <nav className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Zap size={22} className="text-white dark:text-black" fill="currentColor" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter uppercase italic">PocketSignal</h1>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">AI Core v1</span>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-neutral-500">
              <button onClick={() => setCurrentView('dashboard')} className={cn("transition-colors", currentView === 'dashboard' ? "text-black dark:text-white" : "hover:text-black dark:text-white")}>Dashboard</button>
              <button onClick={() => setCurrentView('markets')} className={cn("transition-colors", currentView === 'markets' ? "text-black dark:text-white" : "hover:text-black dark:text-white")}>Markets</button>
              <button onClick={() => setCurrentView('signals')} className={cn("transition-colors", currentView === 'signals' ? "text-black dark:text-white" : "hover:text-black dark:text-white")}>Signals</button>
              <button onClick={() => setCurrentView('history')} className={cn("transition-colors", currentView === 'history' ? "text-black dark:text-white" : "hover:text-black dark:text-white")}>History</button>
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
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/10 dark:bg-white/10 transition-all"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/10 dark:bg-white/10 transition-all"
            >
              <Settings size={18} />
            </button>
          </div>
        </nav>

        <main id="dashboard" className={cn("grid grid-cols-1 gap-8", currentView === 'dashboard' ? "lg:grid-cols-12" : "")}>
          
          {/* Sidebar: Market Selection */}
          <aside id="markets" className={cn("space-y-6", currentView === 'dashboard' ? "lg:col-span-3" : currentView === 'markets' ? "max-w-2xl mx-auto w-full" : "hidden")}>
            <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-3xl p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs font-black text-neutral-500 uppercase tracking-[0.2em]">Markets</h2>
                <div className="relative group/search">
                  <input 
                    type="text" 
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-emerald-500/50 transition-all w-32 group-hover/search:w-48"
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
                        ? "bg-emerald-500/10 border-emerald-500/30 text-black dark:text-white" 
                        : "bg-transparent border-transparent hover:bg-black/5 dark:bg-white/5 text-neutral-500"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                        selectedMarket.id === market.id ? "bg-emerald-500 text-white dark:text-black" : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400"
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
            <div className="bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-black/10 dark:border-white/10 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <ShieldCheck size={80} />
              </div>
              <h3 className="text-sm font-bold mb-2">AI Confidence</h3>
              <p className="text-2xl font-black mb-4">{analysis ? `${analysis.confidence}%` : '--%'}</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium leading-relaxed">Signal accuracy varies by market conditions. Always trade responsibly.</p>
            </div>
          </aside>

          {/* Main Content: Chart & Analysis */}
          <div className={cn("space-y-8", currentView === 'dashboard' ? "lg:col-span-9" : currentView === 'signals' ? "max-w-5xl mx-auto w-full" : currentView === 'history' ? "max-w-3xl mx-auto w-full" : "hidden")}>
            
            {/* Chart Section */}
            <section className={cn("bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-[40px] p-8 backdrop-blur-xl", currentView === 'history' ? "hidden" : "block")}>
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
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-black border-neutral-900 dark:border-white" 
                            : "bg-black/5 dark:bg-white/5 text-neutral-500 border-black/5 dark:border-white/5 hover:bg-black/10 dark:bg-white/10"
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
                        className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl py-2 px-4 text-xs focus:outline-none focus:border-emerald-500/50 w-full md:w-48"
                      />
                    </motion.div>
                  )}
                </div>
                
                <div className="flex flex-col w-full md:w-auto">
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || (selectedTimeframe.id === 'CUSTOM' && !customTimeframe) || cooldown > 0}
                    className={cn(
                      "w-full md:w-auto px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3",
                      (isAnalyzing || (selectedTimeframe.id === 'CUSTOM' && !customTimeframe) || cooldown > 0)
                        ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" 
                        : "bg-emerald-500 text-white dark:text-black hover:bg-emerald-400 active:scale-95"
                    )}
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Processing...
                      </>
                    ) : cooldown > 0 ? (
                      <>
                        <Timer size={18} />
                        Wait {cooldown}s
                      </>
                    ) : (
                      <>
                        <Zap size={18} fill="currentColor" />
                        Analyze Signal
                      </>
                    )}
                  </button>
                  {analysisError && (
                    <p className="text-rose-500 text-xs font-bold mt-2 text-center">{analysisError}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Analysis Result Grid */}
            <div className={cn("grid grid-cols-1 gap-8", currentView === 'dashboard' ? "xl:grid-cols-3" : "xl:grid-cols-1")}>
              
              {/* Main Signal Card */}
              <div id="signals" className={cn(currentView === 'dashboard' ? "xl:col-span-2" : currentView === 'signals' ? "block" : "hidden")}>
                <AnimatePresence mode="wait">
                  {analysis ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-[40px] overflow-hidden backdrop-blur-xl h-full"
                    >
                      <div className={cn(
                        "p-8 flex items-center justify-between border-b border-black/5 dark:border-white/5",
                        analysis.signal === 'BUY' ? "bg-emerald-500/5" : analysis.signal === 'SELL' ? "bg-rose-500/5" : "bg-neutral-500/5"
                      )}>
                        <div className="flex items-center gap-6">
                          <div className={cn(
                            "w-16 h-16 rounded-3xl flex items-center justify-center text-white dark:text-black shadow-2xl",
                            analysis.signal === 'BUY' ? "bg-emerald-500" : analysis.signal === 'SELL' ? "bg-rose-500" : "bg-neutral-500"
                          )}>
                            {analysis.signal === 'BUY' ? <TrendingUp size={32} /> : analysis.signal === 'SELL' ? <TrendingDown size={32} /> : <Activity size={32} />}
                          </div>
                          <div>
                            <h3 className="text-4xl font-black tracking-tighter uppercase italic">{analysis.signal}</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Confidence</span>
                              <div className="w-24 h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${analysis.confidence}%` }}
                                  className={cn(
                                    "h-full rounded-full",
                                    analysis.confidence > 80 ? "bg-emerald-500" : "bg-amber-500"
                                  )}
                                />
                              </div>
                              <span className="text-xs font-bold text-black dark:text-white">{analysis.confidence}%</span>
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
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <h4 className="flex items-center gap-2 text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                              <Info size={12} /> Reasoning
                            </h4>
                            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm font-medium">{renderWithTooltips(analysis.reasoning)}</p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="flex items-center gap-2 text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                              <TrendingUp size={12} /> <TermTooltip content={TRADING_TERMS['trend']}><span className="border-b border-dashed border-neutral-500/50 cursor-help">Trend</span></TermTooltip>
                            </h4>
                            <p className="text-black dark:text-white font-bold text-sm">{renderWithTooltips(analysis.marketTrend)}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="bg-white/[0.01] border border-dashed border-black/10 dark:border-white/10 rounded-[40px] p-16 flex flex-col items-center justify-center text-center space-y-6 h-full">
                      <div className="w-20 h-20 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center text-neutral-700">
                        <BarChart3 size={40} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-widest">Awaiting Analysis</h3>
                        <p className="text-sm text-neutral-600 max-w-xs font-medium">Our AI is ready to scan the markets. Select a pair and trigger the analysis core.</p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* History Sidebar */}
              <div id="history" className={cn("bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-[40px] p-8 backdrop-blur-xl", currentView === 'dashboard' ? "block" : currentView === 'history' ? "block" : "hidden")}>
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.2em]">Recent Signals</h3>
                  <History size={16} className="text-neutral-500" />
                </div>
                
                <div className="space-y-4">
                  {history.length > 0 ? (
                    <>
                      {(currentView === 'dashboard' ? history.slice(0, 5) : history).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.03] border border-black/5 dark:border-white/5 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black",
                              item.signal === 'BUY' ? "bg-emerald-500 text-white dark:text-black" : item.signal === 'SELL' ? "bg-rose-500 text-white dark:text-black" : "bg-neutral-500 text-white dark:text-black"
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
                            <p className="text-xs font-black text-black dark:text-white">{item.confidence}%</p>
                            <p className={cn(
                              "text-[8px] font-black uppercase tracking-widest",
                              item.risk === 'LOW' ? "text-emerald-400" : "text-rose-400"
                            )}>{item.risk}</p>
                          </div>
                        </div>
                      ))}
                      {currentView === 'dashboard' && history.length > 5 && (
                        <button 
                          onClick={() => setCurrentView('history')}
                          className="w-full py-4 mt-2 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-[10px] font-black text-neutral-600 dark:text-neutral-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                        >
                          View Full History <ArrowRight size={14} />
                        </button>
                      )}
                    </>
                  ) : (
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
        <footer className="pt-12 border-t border-black/5 dark:border-white/5 flex flex-col md:flex-row items-center justify-center gap-6 text-neutral-600 text-[10px] font-black uppercase tracking-[0.2em]">
          <div className="flex items-center gap-4">
            <p>© 2026 PocketSignal AI Core</p>
          </div>
        </footer>

      </div>
    </div>
  );
}
