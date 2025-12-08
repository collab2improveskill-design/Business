
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, ArrowDown, PieChart, Award, Clock, ZoomIn, Wallet, Loader2, X, AlertCircle, Info, Eye, EyeOff, ArrowUp, ArrowUpRight, CheckCheck, Trash2, QrCode, BookOpen, Trophy, Scale, Sparkles, ArrowDownLeft } from 'lucide-react';
import { translations } from '../translations';
import type { UnifiedTransaction } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { useKirana } from '../context/KiranaContext';
import { formatDateTime } from '../utils';

// --- Constants & Configuration ---
const COLORS = {
    cash: '#22c55e',  // Green-500
    qr: '#0ea5e9',    // Sky-500
    credit: '#ef4444' // Red-500
};

const COLORS_HOVER = {
    cash: '#16a34a',  // Green-600
    qr: '#0284c7',    // Sky-600
    credit: '#dc2626' // Red-600
};

const NAVIGATION_LIMIT_DAYS = 30;
const MAX_CUSTOM_RANGE_DAYS = 30;

// --- Local Translations ---
const LOCAL_TEXT = {
   ne: {
       insight_title: "दैनिक सारांश",
       actual_money_in: "हातमा आएको पैसा (CASH + QR)",
       credit_sales: "आजको खुद उधारो (NET CREDIT)",
       total_sales: "कुल बिक्री",
       money_in_hand: "नगद + अनलाइन",
       top_seller: "धेरै बिकेको",
       end_shift: "दिन समाप्त",
       shift_ended: "सिफ्ट समाप्त",
       zoom_hint: "जुम गर्न स्लाइडर तान्नुहोस्",
       payment_distribution: "पैसाको स्रोत",
       recent_txn: "हालको कारोबार",
       cash: "नगद",
       qr: "QR",
       credit: "उधारो",
       sales_vs_prev: "हिजोको तुलनामा",
       up: "बढी",
       down: "कम",
       last_7_days: "पछिल्लो ७ दिन",
       last_14_days: "पछिल्लो १४ दिन",
       last_28_days: "पछिल्लो २८ दिन",
       custom_range: "कस्टम मिति",
       today: "आज",
       yesterday: "हिजो",
       no_data_day: "आजको लागि कुनै बिक्री छैन",
       no_data_range: "यो अवधिमा कुनै बिक्री छैन",
       loading: "डाटा लोड हुँदैछ...",
       apply: "लागु गर्नुहोस्",
       cancel: "रद्द गर्नुहोस्",
       start_date: "सुरु मिति",
       end_date: "अन्त्य मिति",
       invalid_range: "अमान्य मिति दायरा",
       range_limit_error: "३० दिन भन्दा बढीको दायरा छनोट गर्न मिल्दैन",
       retry: "पुन: प्रयास गर्नुहोस्",
       view_table: "डाटा तालिका हेर्नुहोस्",
       hide_table: "तालिका लुकाउनुहोस्",
       time: "समय",
       date: "मिति",
       total: "जम्मा",
       top_products_title: "धेरै बिक्री हुने सामानहरू",
       rank: "क्रम",
       product_name: "सामानको नाम",
       quantity_sold: "बिक्री मात्रा",
       from_sales: "बिक्रीबाट",
       from_recovery: "उधारो असुली",
       source_breakdown: "स्रोत विवरण",
       balance: "बाँकी रकम",
       debt_recovered: "उधारो असुली",
       cumulative_trend: "संचयी प्रवृत्ति (Cumulative Trend)",
       sales_pulse: "बिक्री पल्स (Sales Pulse)"
   },
   en: {
       insight_title: "Daily Insight",
       actual_money_in: "ACTUAL MONEY IN (CASH + QR)",
       credit_sales: "NET CREDIT ADDED",
       total_sales: "Total Sales",
       money_in_hand: "Cash + Online",
       top_seller: "Top Selling Product",
       end_shift: "End Shift",
       shift_ended: "Shift Ended",
       zoom_hint: "Drag slider to zoom",
       payment_distribution: "Payment Distribution",
       recent_txn: "Recent Transactions",
       cash: "Cash",
       qr: "Online/QR",
       credit: "Credit",
       sales_vs_prev: "vs Yesterday",
       up: "Up",
       down: "Down",
       last_7_days: "Last 7 Days",
       last_14_days: "Last 14 Days",
       last_28_days: "Last 28 Days",
       custom_range: "Custom Range",
       today: "Today",
       yesterday: "Yesterday",
       no_data_day: "No sales recorded for this day",
       no_data_range: "No sales recorded in this period",
       loading: "Loading data...",
       apply: "Apply",
       cancel: "Cancel",
       start_date: "Start Date",
       end_date: "End Date",
       invalid_range: "Invalid date range",
       range_limit_error: "Range cannot exceed 30 days",
       retry: "Retry",
       view_table: "View Data Table",
       hide_table: "Hide Data Table",
       time: "Time",
       date: "Date",
       total: "Total",
       top_products_title: "Top Selling Products",
       rank: "Rank",
       product_name: "Product Name",
       quantity_sold: "Qty Sold",
       from_sales: "From Sales",
       from_recovery: "From Debt Recovery",
       source_breakdown: "Source Breakdown",
       balance: "Remaining Balance",
       debt_recovered: "Debt Recovered",
       cumulative_trend: "Cumulative Trend",
       sales_pulse: "Sales Pulse"
   }
};

// --- Types ---
type MultiLinePoint = {
    timestamp: number;
    label: string;
    valCash: number;
    valQr: number;
    valCredit: number;
    total: number;
};

type TooltipData = {
    visible: boolean;
    x: number;
    y: number;
    point: MultiLinePoint;
};

type TopProduct = {
    name: string;
    qty: number;
};

// --- Helper Components ---
const SkeletonLoader = () => (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
        <div className="h-10 bg-gray-200 rounded-lg w-full max-w-[200px]"></div>
        <div className="h-48 bg-gray-200 rounded-2xl w-full"></div>
        <div className="h-64 bg-gray-200 rounded-2xl w-full"></div>
        <div className="h-40 bg-gray-200 rounded-2xl w-full"></div>
    </div>
);

const TopProductsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    products: TopProduct[];
    localT: typeof LOCAL_TEXT.en;
}> = ({ isOpen, onClose, products, localT }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex justify-center items-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        {localT.top_products_title}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr>
                                <th className="px-3 py-2 text-left w-12">#</th>
                                <th className="px-3 py-2 text-left">{localT.product_name}</th>
                                <th className="px-3 py-2 text-right">{localT.quantity_sold}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {products.map((p, idx) => (
                                <tr key={idx} className={idx < 3 ? 'bg-yellow-50/30' : ''}>
                                    <td className="px-3 py-3 font-bold text-gray-400">
                                        {idx + 1}
                                        {idx === 0 && <span className="ml-1">🥇</span>}
                                        {idx === 1 && <span className="ml-1">🥈</span>}
                                        {idx === 2 && <span className="ml-1">🥉</span>}
                                    </td>
                                    <td className="px-3 py-3 font-medium text-gray-800">{p.name}</td>
                                    <td className="px-3 py-3 text-right font-bold text-purple-600">{p.qty}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const CustomRangeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onApply: (start: Date, end: Date) => void;
    language: 'ne' | 'en';
    localT: typeof LOCAL_TEXT.en;
}> = ({ isOpen, onClose, onApply, localT }) => {
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setStart('');
            setEnd('');
            setError(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        setError(null);
        if (!start || !end) { setError(localT.invalid_range); return; }

        const sDate = new Date(start);
        const eDate = new Date(end);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) { setError(localT.invalid_range); return; }
        if (sDate > eDate) { setError(localT.invalid_range); return; }
        if (eDate > today) { setError(localT.invalid_range); return; }

        const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays > MAX_CUSTOM_RANGE_DAYS) { setError(localT.range_limit_error); return; }

        onApply(sDate, eDate);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">{localT.custom_range}</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                {error && (<div className="bg-red-50 text-red-600 text-xs p-2 rounded mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> {error}</div>)}
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium text-gray-600 mb-1">{localT.start_date}</label><input type="date" value={start} max={new Date().toISOString().split('T')[0]} onChange={(e) => setStart(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" /></div>
                    <div><label className="block text-sm font-medium text-gray-600 mb-1">{localT.end_date}</label><input type="date" value={end} max={new Date().toISOString().split('T')[0]} onChange={(e) => setEnd(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" /></div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">{localT.cancel}</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700">{localT.apply}</button>
                </div>
            </div>
        </div>
    );
};

// 1. Brush Slider (Time Scaled)
const BrushSlider: React.FC<{
    range: [number, number];
    onChange: (newRange: [number, number]) => void;
    data: MultiLinePoint[];
}> = ({ range, onChange, data }) => {
    if (!data || data.length === 0) return null;
    
    // For visual shape
    const maxTotal = Math.max(...data.map(d => Math.max(d.valCash, d.valQr, d.valCredit))) || 1;
    const safeMax = isFinite(maxTotal) && maxTotal > 0 ? maxTotal : 1;

    const minTime = data[0].timestamp;
    const maxTime = data[data.length - 1].timestamp;
    const timeRange = maxTime - minTime || 1;

    const points = data.map((d) => {
        const x = ((d.timestamp - minTime) / timeRange) * 100;
        const y = 100 - ((d.total || 0) / safeMax) * 100;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: 0 | 1) => {
        const val = Number(e.target.value) || 0;
        const newRange = [...range] as [number, number];
        newRange[index] = val;
        
        if (index === 0 && val > newRange[1] - 5) newRange[0] = newRange[1] - 5;
        if (index === 1 && val < newRange[0] + 5) newRange[1] = newRange[0] + 5;
        onChange(newRange);
    };

    return (
        <div className="relative h-10 w-full mt-4 bg-gray-50 rounded-lg border overflow-hidden select-none touch-none">
            <div className="absolute inset-0 p-1 opacity-30">
                 <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                    <polyline points={points} fill="none" stroke="#8b5cf6" strokeWidth="2" />
                    <polygon points={`0,100 ${points} 100,100`} fill="#8b5cf6" opacity="0.2" />
                 </svg>
            </div>
            <div className="absolute top-0 bottom-0 bg-purple-500/10 border-x border-purple-500/30" style={{ left: `${range[0]}%`, width: `${range[1] - range[0]}%` }} />
            <input type="range" min="0" max="100" value={range[0]} onChange={(e) => handleChange(e, 0)} className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20" aria-label="Zoom start" />
            <input type="range" min="0" max="100" value={range[1]} onChange={(e) => handleChange(e, 1)} className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20" aria-label="Zoom end" />
        </div>
    );
};

// 2. Interactive Payment Distribution Donut Chart
const PaymentDonutChart: React.FC<{ data: { type: 'cash' | 'qr' | 'credit'; amount: number }[], localT: typeof LOCAL_TEXT.en }> = ({ data, localT }) => {
    const total = data.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const [hoveredSlice, setHoveredSlice] = useState<{ type: string; amount: number; percentage: number } | null>(null);
    let accumulatedAngle = 0;
    const enhancedData = data.map(d => ({ ...d, percentage: total > 0 ? (d.amount / total) * 100 : 0 }));
    
    const MAP = {
        cash: { color: COLORS.cash, hover: COLORS_HOVER.cash, label: localT.cash },
        qr: { color: COLORS.qr, hover: COLORS_HOVER.qr, label: localT.qr },
        credit: { color: COLORS.credit, hover: COLORS_HOVER.credit, label: localT.credit }
    };

    if (total <= 0) return <div className="h-32 flex items-center justify-center text-gray-400 text-xs border-2 border-dashed rounded-full aspect-square mx-auto bg-gray-50">No Data</div>;

    return (
        <div className="relative w-32 h-32 mx-auto group">
            {hoveredSlice && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none whitespace-nowrap shadow-lg">
                    <p className="font-bold">{MAP[hoveredSlice.type as keyof typeof MAP].label}</p>
                    <p>Rs.{hoveredSlice.amount.toLocaleString()}</p>
                    <p className="text-gray-400">{hoveredSlice.percentage.toFixed(1)}%</p>
                </div>
            )}
            <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full overflow-visible">
                {enhancedData.map((slice) => {
                    if (slice.amount <= 0) return null;
                    const angle = (slice.amount / total) * 360;
                    const typeKey = slice.type as keyof typeof MAP;
                    if (angle >= 359.9) return <circle key={slice.type} cx="50" cy="50" r="50" fill={MAP[typeKey].color} onMouseEnter={() => setHoveredSlice(slice)} onMouseLeave={() => setHoveredSlice(null)} />;
                    
                    const largeArcFlag = angle > 180 ? 1 : 0;
                    const startX = 50 + 50 * Math.cos((Math.PI * accumulatedAngle) / 180);
                    const startY = 50 + 50 * Math.sin((Math.PI * accumulatedAngle) / 180);
                    const endX = 50 + 50 * Math.cos((Math.PI * (accumulatedAngle + angle)) / 180);
                    const endY = 50 + 50 * Math.sin((Math.PI * (accumulatedAngle + angle)) / 180);
                    const pathData = `M 50 50 L ${startX} ${startY} A 50 50 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
                    accumulatedAngle += angle;

                    return <path key={slice.type} d={pathData} fill={hoveredSlice?.type === slice.type ? MAP[typeKey].hover : MAP[typeKey].color} stroke="white" strokeWidth="2" className="transition-colors duration-200 cursor-pointer" onMouseEnter={() => setHoveredSlice(slice)} onMouseLeave={() => setHoveredSlice(null)} />;
                })}
                <circle cx="50" cy="50" r="35" fill="white" className="pointer-events-none" />
            </svg>
            {!hoveredSlice && <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none"><span className="text-[10px] text-gray-500 font-medium uppercase">Total</span><span className="text-xs font-bold text-gray-800">{(total/1000).toFixed(1)}k</span></div>}
        </div>
    );
};

// 3. Main Multi-Line Chart (HYBRID HEARTBEAT / MOUNTAIN)
const MultiLineChart: React.FC<{
    data: MultiLinePoint[];
    viewWindow: [number, number];
    noDataMessage: string;
    mode: 'day' | 'range';
    localT: typeof LOCAL_TEXT.en;
}> = ({ data, viewWindow, noDataMessage, mode, localT }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const [focusedSeries, setFocusedSeries] = useState<'all' | 'cash' | 'qr' | 'credit'>('all');
    const [showTable, setShowTable] = useState(false);

    const width = 320;
    const height = 200;
    const margin = { top: 20, right: 10, bottom: 30, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const safeData = useMemo(() => {
        if (!data || data.length === 0) return [{timestamp: Date.now(), label: '', valCash:0, valQr:0, valCredit:0, total:0}];
        return data;
    }, [data]);
    
    const fullMinTime = safeData[0].timestamp;
    const fullMaxTime = safeData[safeData.length - 1].timestamp;
    const fullTimeRange = fullMaxTime - fullMinTime || 1;

    const visibleMinTime = fullMinTime + (fullTimeRange * (viewWindow[0] / 100));
    const visibleMaxTime = fullMinTime + (fullTimeRange * (viewWindow[1] / 100));
    const visibleTimeRange = visibleMaxTime - visibleMinTime || 1;

    const visibleData = safeData.filter(d => d.timestamp >= visibleMinTime && d.timestamp <= visibleMaxTime);
    
    const isEmpty = visibleData.every(d => d.total === 0 && d.valCash === 0 && d.valQr === 0 && d.valCredit === 0);
    
    const maxVal = Math.max(...visibleData.map(d => Math.max(d.valCash, d.valQr, d.valCredit))) || 0;
    const yMax = (isFinite(maxVal) && maxVal > 0) ? maxVal * 1.1 : 100;

    const xScale = (timestamp: number) => ((timestamp - visibleMinTime) / visibleTimeRange) * innerWidth;
    const yScale = (val: number) => innerHeight - ((val || 0) / yMax) * innerHeight;

    const createPath = (key: 'valCash' | 'valQr' | 'valCredit') => {
        let points = visibleData;
        
        // 1. FILTERING LOGIC (Pulse Effect for Cash/QR)
        if (mode === 'day' && (key === 'valCash' || key === 'valQr')) {
            points = visibleData.filter(d => d[key] > 0);
        }

        if (points.length === 0) return '';

        // 2. PATH CONSTRUCTION LOGIC
        return points.map((d, i) => {
            const x = xScale(d.timestamp);
            const y = yScale(d[key]);
            const safeX = isFinite(x) ? x.toFixed(1) : '0';
            const safeY = isFinite(y) ? y.toFixed(1) : innerHeight.toString();

            if (i === 0) return `M ${safeX} ${safeY}`;

            // STEP INTERPOLATION FOR CREDIT (Red Line)
            // It holds the previous value horizontally, then jumps vertically
            if (key === 'valCredit') {
                const prev = points[i-1];
                const prevY = yScale(prev[key]);
                const safePrevY = isFinite(prevY) ? prevY.toFixed(1) : innerHeight.toString();
                // Draw horizontal line to new X, but at OLD Y. Then vertical to NEW Y.
                // This creates the "Step-After" look.
                return `L ${safeX} ${safePrevY} L ${safeX} ${safeY}`;
            }

            // DIRECT LINE FOR CASH/QR (Pulse)
            return `L ${safeX} ${safeY}`;
        }).join(' ');
    };
    
    const createAreaPath = (key: 'valCash' | 'valQr' | 'valCredit') => {
        const linePath = createPath(key);
        if (!linePath) return '';
        
        const points = visibleData; 
        // For credit area, we need to match the step logic down to the axis
        const lastPoint = points[points.length - 1];
        const lastX = isFinite(xScale(lastPoint.timestamp)) ? xScale(lastPoint.timestamp).toFixed(1) : innerWidth;
        const firstX = isFinite(xScale(points[0].timestamp)) ? xScale(points[0].timestamp).toFixed(1) : '0';
        
        return `${linePath} L ${lastX} ${innerHeight} L ${firstX} ${innerHeight} Z`;
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!svgRef.current || visibleData.length === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - margin.left;
        const clickedTime = (mouseX / innerWidth) * visibleTimeRange + visibleMinTime;
        const closest = visibleData.reduce((prev, curr) => (Math.abs(curr.timestamp - clickedTime) < Math.abs(prev.timestamp - clickedTime) ? curr : prev));

        if (closest) {
             setTooltip({
                 visible: true,
                 x: xScale(closest.timestamp) + margin.left,
                 y: margin.top,
                 point: closest
             });
        } else {
            setTooltip(null);
        }
    };

    const toggleFocus = (series: 'cash' | 'qr' | 'credit') => {
        setFocusedSeries(focusedSeries === series ? 'all' : series);
    };

    const getOpacity = (series: 'cash' | 'qr' | 'credit') => {
        if (focusedSeries === 'all') return 1;
        return focusedSeries === series ? 1 : 0.1;
    };

    const xTicks = useMemo(() => {
        const count = 5;
        const step = visibleTimeRange / (count - 1);
        return Array.from({length: count}, (_, i) => visibleMinTime + step * i);
    }, [visibleMinTime, visibleTimeRange]);

    const formatTick = (timestamp: number) => {
        const date = new Date(timestamp);
        if (mode === 'day') return date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        return date.toLocaleDateString([], {month:'short', day:'numeric'});
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
                 <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{mode === 'day' ? localT.sales_pulse : localT.cumulative_trend}</h4>
                 <div className="flex flex-wrap justify-end items-center gap-2 text-xs">
                    <button onClick={() => toggleFocus('cash')} className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all border ${focusedSeries === 'cash' ? 'bg-green-50 border-green-200 ring-1 ring-green-300' : 'border-transparent hover:bg-gray-50'}`} style={{opacity: getOpacity('cash') < 1 ? 0.4 : 1}}>
                        <span className="w-2 h-2 rounded-full shadow-sm" style={{backgroundColor: COLORS.cash}}></span>
                        <span className="font-medium text-gray-700">{localT.cash}</span>
                    </button>
                    <button onClick={() => toggleFocus('qr')} className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all border ${focusedSeries === 'qr' ? 'bg-sky-50 border-sky-200 ring-1 ring-sky-300' : 'border-transparent hover:bg-gray-50'}`} style={{opacity: getOpacity('qr') < 1 ? 0.4 : 1}}>
                        <span className="w-2 h-2 rounded-full shadow-sm" style={{backgroundColor: COLORS.qr}}></span>
                        <span className="font-medium text-gray-700">{localT.qr}</span>
                    </button>
                    <button onClick={() => toggleFocus('credit')} className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all border ${focusedSeries === 'credit' ? 'bg-red-50 border-red-200 ring-1 ring-red-300' : 'border-transparent hover:bg-gray-50'}`} style={{opacity: getOpacity('credit') < 1 ? 0.4 : 1}}>
                        <span className="w-2 h-2 rounded-full shadow-sm" style={{backgroundColor: COLORS.credit}}></span>
                        <span className="font-medium text-gray-700">{localT.credit}</span>
                    </button>
                </div>
            </div>

            <div className="relative bg-white">
                <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto touch-none select-none cursor-crosshair" onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} aria-label="Sales Trend Chart" role="img">
                     <defs>
                        <linearGradient id="gradCredit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={COLORS.credit} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={COLORS.credit} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <g transform={`translate(${margin.left},${margin.top})`}>
                        <line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} stroke="#e5e7eb" />
                        <line x1={0} x2={0} y1={0} y2={innerHeight} stroke="#e5e7eb" />
                        
                        {[0, 0.5, 1].map(t => {
                            const val = yMax * t;
                            const y = innerHeight - (innerHeight * t);
                            return <text key={t} x={-10} y={y} dy="0.32em" textAnchor="end" fontSize="10" fill="#9ca3af">{val >= 1000 ? `${(val/1000).toFixed(1)}k` : val.toFixed(0)}</text>
                        })}

                        {xTicks.map((tick, i) => {
                            const x = xScale(tick);
                            let anchor: "start" | "middle" | "end" = 'middle';
                            if (i === 0) anchor = 'start';
                            if (i === xTicks.length - 1) anchor = 'end';
                            return <text key={i} x={isFinite(x) ? x : 0} y={innerHeight + 20} textAnchor={anchor} fontSize="10" fill="#9ca3af">{formatTick(tick)}</text>;
                        })}

                        {/* RED SERIES (Mountain/Risk) - Area Filled */}
                        {/* Uses Step Interpolation Logic */}
                        <path d={createAreaPath('valCredit')} fill="url(#gradCredit)" stroke="none" opacity={getOpacity('credit')} style={{transition: 'opacity 0.3s'}} />
                        <path d={createPath('valCredit')} fill="none" stroke={COLORS.credit} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={getOpacity('credit')} style={{transition: 'opacity 0.3s'}}/>

                        {/* GREEN/BLUE SERIES (Pulse/Heartbeat) - Lines Only, No Area */}
                        {/* Important: These use the filtered path logic to skip 0s */}
                        <path d={createPath('valQr')} fill="none" stroke={COLORS.qr} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={getOpacity('qr')} style={{transition: 'opacity 0.3s'}}/>
                        <path d={createPath('valCash')} fill="none" stroke={COLORS.cash} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={getOpacity('cash')} style={{transition: 'opacity 0.3s'}}/>
                        
                        {/* Data Points (Circles) to make single sales visible */}
                        {mode === 'day' && visibleData.map((d, i) => {
                             if (d.valCash > 0 && (focusedSeries === 'all' || focusedSeries === 'cash')) 
                                return <circle key={`c-${i}`} cx={xScale(d.timestamp)} cy={yScale(d.valCash)} r="2" fill="white" stroke={COLORS.cash} strokeWidth="2" opacity={getOpacity('cash')} />;
                             return null;
                        })}
                        {mode === 'day' && visibleData.map((d, i) => {
                             if (d.valQr > 0 && (focusedSeries === 'all' || focusedSeries === 'qr')) 
                                return <circle key={`q-${i}`} cx={xScale(d.timestamp)} cy={yScale(d.valQr)} r="2" fill="white" stroke={COLORS.qr} strokeWidth="2" opacity={getOpacity('qr')} />;
                             return null;
                        })}

                         {tooltip && <line x1={tooltip.x - margin.left} x2={tooltip.x - margin.left} y1={0} y2={innerHeight} stroke="#cbd5e1" strokeDasharray="4 2" />}
                         {tooltip && <circle cx={tooltip.x - margin.left} cy={yScale(tooltip.point.valCash)} r="4" fill="white" stroke={COLORS.cash} strokeWidth="2" />}
                         {tooltip && <circle cx={tooltip.x - margin.left} cy={yScale(tooltip.point.valQr)} r="4" fill="white" stroke={COLORS.qr} strokeWidth="2" />}
                         {tooltip && <circle cx={tooltip.x - margin.left} cy={yScale(tooltip.point.valCredit)} r="4" fill="white" stroke={COLORS.credit} strokeWidth="2" />}
                    </g>
                </svg>
                
                {isEmpty && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[1px] pointer-events-none z-10">
                        <div className="bg-white/90 px-4 py-2 rounded-full shadow-md border border-gray-100 flex items-center gap-2">
                             <TrendingUp className="w-4 h-4 text-gray-400" />
                             <span className="text-xs font-bold text-gray-500">{noDataMessage}</span>
                        </div>
                    </div>
                )}

                {tooltip && (
                    <div className="absolute pointer-events-none bg-white text-gray-800 text-xs rounded-lg p-3 shadow-xl z-50 w-48 space-y-1.5 border border-gray-200 transition-transform duration-75" style={{ top: 0, left: tooltip.x, transform: tooltip.x > (width/2) ? 'translate(-105%, 0)' : 'translate(5%, 0)' }}>
                        <div className="font-bold border-b border-gray-100 pb-1 mb-1 flex items-center gap-1 text-gray-500"><Clock className="w-3 h-3"/> {tooltip.point.label}</div>
                        {(focusedSeries === 'all' || focusedSeries === 'cash') && <div className="flex justify-between items-center"><span className="flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500"></span> {localT.cash}</span><span className="font-mono font-bold">Rs.{tooltip.point.valCash.toFixed(0)}</span></div>}
                        {(focusedSeries === 'all' || focusedSeries === 'qr') && <div className="flex justify-between items-center"><span className="flex items-center gap-1 text-sky-600"><span className="w-2 h-2 rounded-full bg-sky-500"></span> {localT.qr}</span><span className="font-mono font-bold">Rs.{tooltip.point.valQr.toFixed(0)}</span></div>}
                        {(focusedSeries === 'all' || focusedSeries === 'credit') && <div className="flex justify-between items-center"><span className="flex items-center gap-1 text-red-600"><span className="w-2 h-2 rounded-full bg-red-500"></span> {localT.credit}</span><span className="font-mono font-bold">Rs.{tooltip.point.valCredit.toFixed(0)}</span></div>}
                    </div>
                )}
            </div>
            
            <div className="flex justify-center">
                 <button onClick={() => setShowTable(!showTable)} className="text-xs text-purple-600 font-semibold flex items-center gap-2 hover:bg-purple-50 px-3 py-1.5 rounded-md transition-colors">
                    {showTable ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showTable ? localT.hide_table : localT.view_table}
                 </button>
            </div>

            {showTable && (
                <div className="overflow-x-auto border rounded-lg shadow-sm max-h-60">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">{mode === 'day' ? localT.time : localT.date}</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-green-600 uppercase">{localT.cash}</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-sky-600 uppercase">{localT.qr}</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-red-600 uppercase">{localT.credit} (Risk)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {safeData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 font-medium">{row.label}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-gray-600">{row.valCash.toFixed(0)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-gray-600">{row.valQr.toFixed(0)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-gray-600">{row.valCredit.toFixed(0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const AnalyticsTab: React.FC = () => {
    const { language, deleteTransaction, deleteKhataTransaction, transactions, khataCustomers, unifiedRecentTransactions } = useKirana();
    const t = translations[language];
    const localT = LOCAL_TEXT[language] || LOCAL_TEXT['en'];

    const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({ start: new Date(), end: new Date() });
    const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
    const [isCustomRangeOpen, setIsCustomRangeOpen] = useState(false);
    const [viewWindow, setViewWindow] = useState<[number, number]>([0, 100]);
    const [confirmDelete, setConfirmDelete] = useState<UnifiedTransaction | null>(null);
    const [isShiftEnded, setIsShiftEnded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [showTopProducts, setShowTopProducts] = useState(false);
    
    const dateFilterRef = useRef<HTMLDivElement>(null);

    const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
    const isSingleDay = useMemo(() => dateRange.start.toDateString() === dateRange.end.toDateString(), [dateRange]);
    const isToday = useMemo(() => dateRange.start.toDateString() === today.toDateString(), [dateRange, today]);

    useEffect(() => {
        setIsLoading(true);
        setLoadError(false);
        const timer = setTimeout(() => {
            setIsLoading(false);
            if (Math.random() > 0.999) setLoadError(true);
        }, 400);
        return () => clearTimeout(timer);
    }, [dateRange]);

    const pastLimitDate = useMemo(() => {
        const d = new Date(today);
        d.setDate(today.getDate() - NAVIGATION_LIMIT_DAYS);
        return d;
    }, [today]);

    const isFutureDisabled = dateRange.end >= new Date(new Date().setHours(0,0,0,0));
    const isPastDisabled = dateRange.start <= pastLimitDate;

    const handleDateNav = (dir: 'prev' | 'next') => {
        const currentRefDate = dir === 'next' ? dateRange.end : dateRange.start;
        const targetDate = new Date(currentRefDate);
        targetDate.setDate(targetDate.getDate() + (dir === 'next' ? 1 : -1));
        
        const targetStart = new Date(targetDate); targetStart.setHours(0,0,0,0);
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        if (targetStart > todayStart) return; 
        if (targetStart < pastLimitDate) return;

        const newStart = new Date(targetStart);
        const newEnd = new Date(targetStart);
        newEnd.setHours(23, 59, 59, 999);

        setDateRange({ start: newStart, end: newEnd });
        setViewWindow([0, 100]);
    };

    const setDatePreset = (preset: 'today' | '7d' | '14d' | '28d' | 'custom') => {
        if (preset === 'custom') {
            setIsDateFilterOpen(false);
            setIsCustomRangeOpen(true);
            return;
        }

        const end = new Date(today);
        const start = new Date(today);
        
        if (preset === '7d') start.setDate(start.getDate() - 6);
        if (preset === '14d') start.setDate(start.getDate() - 13);
        if (preset === '28d') start.setDate(start.getDate() - 27);
        
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);
        
        setDateRange({ start, end });
        setIsDateFilterOpen(false);
        setViewWindow([0, 100]);
    };

    const handleCustomRangeApply = (start: Date, end: Date) => {
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);
        setDateRange({ start, end });
        setIsCustomRangeOpen(false);
        setViewWindow([0, 100]);
    };

    const dateLabel = useMemo(() => {
        if (isToday && isSingleDay) return localT.today;
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        if (dateRange.start.toDateString() === yesterday.toDateString() && isSingleDay) return localT.yesterday;
        
        const locale = language === 'ne' ? 'ne-NP' : 'en-US';
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        
        if (isSingleDay) return dateRange.start.toLocaleDateString(locale, options);
        
        const startStr = dateRange.start.toLocaleDateString(locale, options);
        const endStr = dateRange.end.toLocaleDateString(locale, options);
        return `${startStr} - ${endStr}`;
    }, [dateRange, isToday, isSingleDay, language, localT, today]);

    const mobileDateLabel = useMemo(() => {
        if (isToday && isSingleDay) return localT.today;
        if (isSingleDay) return dateLabel;
        return `${dateRange.start.getDate()}/${dateRange.start.getMonth()+1} - ${dateRange.end.getDate()}/${dateRange.end.getMonth()+1}`;
    }, [dateLabel, isSingleDay, isToday, dateRange, language, localT]);

    // --- Filter Transactions for Date Range ---
    const filteredTransactions = useMemo(() => {
        const startOfDay = new Date(dateRange.start); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateRange.end); endOfDay.setHours(23, 59, 59, 999);

        // 1. Global Transactions (Cash Sales + Khata Payments)
        const globalTxns: UnifiedTransaction[] = transactions.map(txn => {
            const isKhataPayment = !!txn.khataCustomerId;
            const isSplitPayment = txn.meta?.isSplitPayment;

            return {
                id: txn.id,
                type: txn.paymentMethod as 'cash' | 'qr',
                customerName: txn.customerName,
                amount: txn.amount,
                date: txn.date,
                description: isKhataPayment && txn.items.length === 0 ? 'Payment Received' : txn.items.map(i => `${i.name} (Qty: ${i.quantity})`).join(', '),
                items: txn.items,
                originalType: 'transaction',
                customerId: txn.khataCustomerId,
                isKhataPayment: isKhataPayment,
                // Logic Fix: If it is a split payment (cash part of a bill), treat it as 'sales' source and count its amount towards sales volume
                totalAmount: (isKhataPayment && !isSplitPayment) ? 0 : txn.amount, 
                paidAmount: txn.amount,
                source: (isKhataPayment && !isSplitPayment) ? 'recovery' : 'sales',
                meta: txn.meta
            };
        });

        // 2. Credit Sales (Khata Bills) - REMAINDER LOGIC
        const creditTxns: UnifiedTransaction[] = khataCustomers.flatMap(cust =>
            cust.transactions
                .filter(txn => txn.type === 'debit')
                .map(txn => {
                    const immediate = txn.immediatePayment || 0;
                    const remaining = txn.amount - immediate;
                    
                    if (remaining < 0.01) return null;

                    return {
                        id: txn.id,
                        type: 'credit' as const,
                        customerName: cust.name,
                        amount: remaining, 
                        date: txn.date,
                        description: txn.description,
                        items: txn.items,
                        originalType: 'khata' as const,
                        customerId: cust.id,
                        paidAmount: 0, 
                        totalAmount: remaining, 
                        meta: { ...txn.meta, remainingDue: (txn.meta?.previousDue || 0) - immediate },
                        isKhataPayment: false,
                        source: 'sales' as const
                    };
                })
                .filter((t): t is UnifiedTransaction => t !== null)
        );

        const all = [...globalTxns, ...creditTxns];
        
        return all.filter(txn => {
            const txnDate = new Date(txn.date);
            return txnDate >= startOfDay && txnDate <= endOfDay;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    }, [transactions, khataCustomers, dateRange]);


    // --- Financial Calculations ---
    const financialSummary = useMemo(() => {
        let moneyInHand = 0;
        let totalSales = 0;
        let totalMarketCredit = 0;
        let totalCash = 0;
        let totalQr = 0;
        let totalCreditVolume = 0; 
        const customerBuckets: Record<string, { creditIssued: number, payment: number }> = {};

        khataCustomers.forEach(cust => {
             const balance = cust.transactions.reduce((acc, txn) => {
                return txn.type === 'debit' ? acc + txn.amount : acc - txn.amount;
            }, 0);
            totalMarketCredit += balance;
        });

        filteredTransactions.forEach(txn => {
            const total = Number(txn.totalAmount) || 0;
            const paid = Number(txn.paidAmount) || 0;
            
            if (txn.source === 'sales') totalSales += total;
            moneyInHand += paid;

            if (txn.type === 'cash') totalCash += paid;
            if (txn.type === 'qr') totalQr += paid;
            if (txn.source === 'sales' && txn.type === 'credit') totalCreditVolume += total;

            if (txn.customerId) {
                if (!customerBuckets[txn.customerId]) customerBuckets[txn.customerId] = { creditIssued: 0, payment: 0 };
                if (txn.source === 'sales' && txn.type === 'credit') customerBuckets[txn.customerId].creditIssued += total;
                if (txn.source === 'recovery') customerBuckets[txn.customerId].payment += paid;
            }
        });

        let netCreditAdded = 0;
        let debtRecovered = 0;

        Object.values(customerBuckets).forEach(bucket => {
            const net = bucket.creditIssued - bucket.payment;
            if (net > 0) netCreditAdded += net;
            else debtRecovered += Math.abs(net);
        });

        return {
            totalCash, totalQr, totalCreditVolume, 
            credit: netCreditAdded,
            debtRecovered,
            moneyInHand,
            totalSales,
            totalMarketCredit,
        };
    }, [filteredTransactions, khataCustomers]);

    // --- Top Products ---
    const topProducts = useMemo(() => {
        const productMap = new Map<string, number>();
        filteredTransactions.forEach(txn => {
            if (txn.isKhataPayment && !txn.meta?.isSplitPayment) return;
            if (txn.source === 'sales') {
                txn.items.forEach(item => {
                    const qty = parseFloat(String(item.quantity)) || 0;
                    if (item.name) productMap.set(item.name, (productMap.get(item.name) || 0) + qty);
                });
            }
        });
        return Array.from(productMap.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
    }, [filteredTransactions]);

    const chartData = useMemo((): MultiLinePoint[] => {
        const sortedTxns = [...filteredTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runCash = 0;
        let runQr = 0;
        let runCredit = 0; // Cumulative net credit risk

        const points: MultiLinePoint[] = [];
        const startTime = new Date(dateRange.start);
        startTime.setHours(0,0,0,0);
        
        points.push({
            timestamp: startTime.getTime(),
            label: isSingleDay ? startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : startTime.toLocaleDateString([], {month:'short', day:'numeric'}),
            valCash: 0, valQr: 0, valCredit: 0, total: 0
        });

        if (isSingleDay) {
             sortedTxns.forEach(txn => {
                const paid = Number(txn.paidAmount) || 0;
                const total = Number(txn.totalAmount) || 0;
                const time = new Date(txn.date).getTime();
                
                // Update Running Cumulative Values (Only for Credit)
                if (txn.source === 'sales' && txn.type === 'credit') runCredit += total;
                if (txn.source === 'recovery') runCredit -= paid;
                
                // Cash/QR = Transaction Pulse (Actual Amount)
                const currentCash = (txn.type === 'cash') ? paid : 0;
                const currentQr = (txn.type === 'qr') ? paid : 0;
                
                // Credit = Mountain (Cumulative)
                const visualCredit = Math.max(0, runCredit);

                points.push({
                    timestamp: time,
                    label: new Date(txn.date).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}),
                    valCash: currentCash,
                    valQr: currentQr,
                    valCredit: visualCredit, 
                    total: currentCash + currentQr + visualCredit
                });
             });
             
             const now = new Date();
             if (isToday && points[points.length-1].timestamp < now.getTime()) {
                  points.push({
                    timestamp: now.getTime(),
                    label: now.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}),
                    valCash: 0, valQr: 0,
                    valCredit: Math.max(0, runCredit),
                    total: Math.max(0, runCredit)
                });
             }
             return points;
        } else {
            // Daily Granularity for Range
            const end = new Date(dateRange.end); end.setHours(23,59,59,999);
            let cursor = new Date(dateRange.start); cursor.setHours(0,0,0,0);
            
            while (cursor <= end) {
                 const dateKey = cursor.toDateString();
                 const dayTxns = sortedTxns.filter(t => new Date(t.date).toDateString() === dateKey);
                 
                 let dayCash = 0;
                 let dayQr = 0;
                 
                 dayTxns.forEach(txn => {
                     const paid = Number(txn.paidAmount) || 0;
                     const total = Number(txn.totalAmount) || 0;
                     if (txn.type === 'cash') dayCash += paid;
                     else if (txn.type === 'qr') dayQr += paid;
                     
                     if (txn.source === 'sales' && txn.type === 'credit') runCredit += total;
                     if (txn.source === 'recovery') runCredit -= paid;
                 });

                 points.push({
                     timestamp: cursor.getTime(),
                     label: cursor.toLocaleDateString(language === 'ne' ? 'ne-NP' : 'en-US', {month:'short', day:'numeric'}),
                     valCash: dayCash,
                     valQr: dayQr,
                     valCredit: Math.max(0, runCredit),
                     total: dayCash + dayQr + Math.max(0, runCredit),
                 });
                 cursor.setDate(cursor.getDate() + 1);
            }
            return points;
        }
    }, [filteredTransactions, dateRange, isSingleDay, language, isToday]);

    const calculateHistoricalBalance = (txn: UnifiedTransaction) => {
        if (!txn.customerId) return 0;
        const customer = khataCustomers.find(c => c.id === txn.customerId);
        if (!customer) return 0;
        const currentTxnTime = new Date(txn.date).getTime();
        let bal = customer.transactions.reduce((acc, t) => {
            const tTime = new Date(t.date).getTime();
            if (tTime <= currentTxnTime) return t.type === 'debit' ? acc + t.amount : acc - t.amount;
            return acc;
        }, 0);
        
        const isCreditSale = txn.type === 'credit' && txn.source === 'sales';
        if (!isCreditSale) {
             const paidAmt = txn.paidAmount || txn.amount;
             bal -= paidAmt;
             if (txn.id.endsWith('-B')) {
                 const debitTxn = customer.transactions.find(t => t.type === 'debit' && new Date(t.date).getTime() === currentTxnTime);
                 if (debitTxn?.immediatePayment) bal -= debitTxn.immediatePayment;
             }
        }
        return bal;
    };

    const handleDelete = () => {
        if (!confirmDelete) return;
        if (confirmDelete.originalType === 'transaction') deleteTransaction(confirmDelete.id);
        else if (confirmDelete.customerId) deleteKhataTransaction(confirmDelete.customerId, confirmDelete.id);
        setConfirmDelete(null);
    };

    const announcementText = useMemo(() => isLoading ? localT.loading : `Showing data for ${dateLabel}`, [isLoading, dateLabel, localT]);

    if (loadError) return <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6"><AlertCircle className="w-12 h-12 text-red-500 mb-4" /><h3 className="text-lg font-bold text-gray-800 mb-2">Failed to load data</h3><p className="text-gray-500 mb-4">Something went wrong while processing your analytics.</p><button onClick={() => setDatePreset('today')} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 flex items-center gap-2"><Clock className="w-4 h-4"/> {localT.retry}</button></div>;

    return (
        <div className="space-y-6 pb-24">
            <div className="sr-only" aria-live="polite">{announcementText}</div>
            <ConfirmationModal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} title={t.confirm_delete_txn_title} message={t.confirm_delete_txn_desc} language={language} />
            <CustomRangeModal isOpen={isCustomRangeOpen} onClose={() => setIsCustomRangeOpen(false)} onApply={handleCustomRangeApply} language={language} localT={LOCAL_TEXT.en} />
            <TopProductsModal isOpen={showTopProducts} onClose={() => setShowTopProducts(false)} products={topProducts} localT={localT} />

            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800">{t.analytics_tab}</h1>
                <div className="relative" ref={dateFilterRef}>
                     <div className="flex items-center bg-white border rounded-lg shadow-sm p-1">
                        <button onClick={() => handleDateNav('prev')} disabled={isPastDisabled} aria-label="Previous period" className={`p-1.5 rounded-md transition-colors ${isPastDisabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'}`}><ChevronLeft className="w-5 h-5"/></button>
                        <button onClick={() => setIsDateFilterOpen(!isDateFilterOpen)} className="px-2 md:px-3 py-1 text-sm font-bold text-gray-700 flex items-center gap-2 min-w-[90px] justify-center"><Calendar className="w-4 h-4 text-purple-600"/> <span className="hidden md:inline">{dateLabel}</span><span className="inline md:hidden">{mobileDateLabel}</span></button>
                        <button onClick={() => handleDateNav('next')} disabled={isFutureDisabled} aria-label="Next period" className={`p-1.5 rounded-md transition-colors ${isFutureDisabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'}`}><ChevronRight className="w-5 h-5"/></button>
                     </div>
                     {isDateFilterOpen && (
                         <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border z-20 py-1 animate-in fade-in zoom-in duration-100">
                             <button onClick={() => setDatePreset('today')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-50 text-gray-700">{localT.today}</button>
                             <button onClick={() => setDatePreset('7d')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-50 text-gray-700">{localT.last_7_days}</button>
                             <button onClick={() => setDatePreset('14d')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-50 text-gray-700">{localT.last_14_days}</button>
                             <button onClick={() => setDatePreset('28d')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-50 text-gray-700">{localT.last_28_days}</button>
                             <div className="border-t my-1"></div>
                             <button onClick={() => setDatePreset('custom')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-50 text-purple-700 font-semibold">{localT.custom_range}</button>
                         </div>
                     )}
                </div>
            </div>

            {isLoading ? <SkeletonLoader /> : (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-600" /> {localT.insight_title}</h3>
                            {isToday && (
                                <button onClick={() => setIsShiftEnded(!isShiftEnded)} className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${isShiftEnded ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'}`}><Clock className="w-3 h-3"/> {isShiftEnded ? localT.shift_ended : localT.end_shift}</button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide mb-1 break-words">{localT.actual_money_in}</p>
                                <p className="text-2xl font-extrabold text-emerald-600">Rs.{financialSummary.moneyInHand.toFixed(0)}</p>
                            </div>
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 relative overflow-hidden">
                                <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wide mb-2">{localT.credit_sales}</p>
                                <p className="text-2xl font-extrabold text-red-600">Rs.{financialSummary.credit.toFixed(0)}</p>
                                {financialSummary.debtRecovered > 0 && (
                                    <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 bg-white/60 px-2 py-1 rounded-lg w-fit">
                                        <ArrowDownLeft className="w-3 h-3" />
                                        {localT.debt_recovered}: Rs.{financialSummary.debtRecovered.toFixed(0)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wide flex items-center gap-1"><Scale className="w-3 h-3" /> {localT.total_market_credit}</p>
                                <span className="text-[10px] text-blue-500 font-medium">({localT.market_credit_desc})</span>
                            </div>
                            <p className="text-2xl font-extrabold text-blue-600">Rs.{financialSummary.totalMarketCredit.toFixed(0)}</p>
                        </div>
                        {topProducts.length > 0 && (
                            <div onClick={() => setShowTopProducts(true)} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 shrink-0"><Trophy className="w-5 h-5" /></div>
                                    <div className="min-w-0"><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-0.5">{localT.top_seller}</p><p className="font-bold text-gray-800 text-sm truncate">{topProducts[0].name}</p></div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0"><span className="text-xs font-bold text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">{topProducts[0].qty} units</span><ChevronRight className="w-4 h-4 text-gray-400" /></div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                         <div className="flex flex-wrap justify-between items-center mb-4 gap-2"><div className="text-xs text-gray-400 flex items-center gap-1 ml-auto"><ZoomIn className="w-3 h-3" /> {localT.zoom_hint}</div></div>
                        <MultiLineChart data={chartData} viewWindow={viewWindow} noDataMessage={isSingleDay ? localT.no_data_day : localT.no_data_range} mode={isSingleDay ? 'day' : 'range'} localT={localT}/>
                        <BrushSlider data={chartData} range={viewWindow} onChange={setViewWindow} />
                    </div>

                    {/* Payment Distribution Breakdown Chart */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><PieChart className="w-5 h-5 text-purple-600" /> {localT.payment_distribution}</h3>
                        <div className="flex items-center justify-between">
                            <PaymentDonutChart 
                                data={[
                                    { type: 'cash', amount: financialSummary.totalCash }, 
                                    { type: 'qr', amount: financialSummary.totalQr },
                                    { type: 'credit', amount: Math.max(0, financialSummary.credit) }
                                ]} 
                                localT={localT}
                            />
                            <div className="flex-1 pl-6 space-y-3 border-l border-gray-100">
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span><span className="text-gray-600">{localT.cash}</span></div>
                                    <span className="font-bold text-gray-800">Rs.{financialSummary.totalCash.toFixed(0)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-sky-500"></span><span className="text-gray-600">{localT.qr}</span></div>
                                    <span className="font-bold text-gray-800">Rs.{financialSummary.totalQr.toFixed(0)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="text-gray-600">{localT.credit}</span></div>
                                    <span className="font-bold text-gray-800">Rs.{Math.max(0, financialSummary.credit).toFixed(0)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                            <div className="p-3 bg-gray-50 rounded-xl text-center"><p className="text-[10px] uppercase font-bold text-gray-500 mb-1">{localT.total_sales}</p><p className="text-lg font-extrabold text-gray-900">Rs.{financialSummary.totalSales.toFixed(0)}</p></div>
                            <div className="p-3 bg-purple-50 rounded-xl text-center border border-purple-100"><p className="text-[10px] uppercase font-bold text-purple-700 mb-1">{localT.actual_money_in}</p><p className="text-lg font-extrabold text-purple-700">Rs.{financialSummary.moneyInHand.toFixed(0)}</p></div>
                        </div>
                    </div>

                    {isSingleDay && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1"><h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-purple-600"/> {localT.recent_txn}</h3><span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">{filteredTransactions.length} Entries</span></div>
                            <div className="space-y-3">
                                {filteredTransactions.length > 0 ? filteredTransactions.map(txn => {
                                    
                                    const total = Number(txn.totalAmount) || 0;
                                    const paid = Number(txn.paidAmount) || 0;
                                    const isCreditSale = txn.type === 'credit' && txn.source === 'sales';
                                    
                                    const isDebtPayment = txn.source === 'recovery';
                                    const remainingDue = txn.meta?.remainingDue || 0;
                                    const isAdvance = remainingDue < 0;

                                    if (isAdvance && isDebtPayment) {
                                         const advanceAmount = Math.abs(remainingDue);
                                         return (
                                            <div 
                                                key={txn.id} 
                                                className="group relative bg-white rounded-2xl p-4 border border-purple-200 shadow-[0_2px_10px_-3px_rgba(126,34,206,0.15)] hover:shadow-lg transition-all duration-300"
                                            >
                                                 <div className="flex justify-between items-start mb-2">
                                                     <div>
                                                         <h4 className="font-bold text-gray-800">{txn.customerName}</h4>
                                                         <span className="text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded-full inline-block mt-1 flex items-center gap-1 w-fit">
                                                             <Sparkles className="w-3 h-3 text-yellow-300" /> ADVANCE
                                                         </span>
                                                     </div>
                                                     <div className="text-right">
                                                         <p className="text-xs text-gray-500">{formatDateTime(txn.date, language)}</p>
                                                     </div>
                                                 </div>
                                                 
                                                 <div className="space-y-2 text-sm">
                                                     <div className="flex justify-between font-extrabold text-gray-800">
                                                          <span>{localT.total_cash_in}</span>
                                                          <span>Rs. {paid.toFixed(0)}</span>
                                                     </div>
                                                 </div>
                                                 <button 
                                                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(txn); }}
                                                    className="absolute top-2 right-2 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                         );
                                    }

                                    if (isDebtPayment) {
                                        const historicalBalance = calculateHistoricalBalance(txn);
                                        return (
                                            <div key={txn.id} className="group relative bg-white rounded-2xl p-4 border border-blue-100 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-300">
                                                 <div className="flex justify-between items-start mb-2">
                                                     <div>
                                                         <h4 className="font-bold text-gray-800">{txn.customerName}</h4>
                                                         <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1">{localT.debt_repayment_received}</span>
                                                         {txn.customerId && <p className={`text-[10px] font-medium mt-1 ${historicalBalance < 0 ? 'text-blue-500' : (historicalBalance > 0 ? 'text-red-500' : 'text-green-600')}`}>{localT.balance}: {Math.abs(historicalBalance).toFixed(0)}</p>}
                                                     </div>
                                                     <div className="text-right"><p className="text-xs text-gray-500">{formatDateTime(txn.date, language)}</p></div>
                                                 </div>
                                                 <div className="space-y-2 text-sm">
                                                     <div className="flex justify-between font-extrabold text-gray-800"><span>{localT.total_cash_in}</span><span>Rs. {paid.toFixed(0)}</span></div>
                                                 </div>
                                                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(txn); }} className="absolute top-2 right-2 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        );
                                    }
                                    
                                    const isQr = txn.type === 'qr';
                                    let theme = { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', amountColor: 'text-emerald-700', icon: Wallet };

                                    if (isQr) { theme = { ...theme, iconBg: 'bg-sky-100', iconColor: 'text-sky-600', amountColor: 'text-sky-700', icon: QrCode }; }
                                    else if (isCreditSale) { theme = { ...theme, iconBg: 'bg-rose-100', iconColor: 'text-rose-600', amountColor: 'text-rose-700', icon: BookOpen }; }

                                    const Icon = theme.icon;
                                    const historicalBalance = calculateHistoricalBalance(txn);
                                    const currentBalanceStatus = historicalBalance < 0 ? 'advance' : (historicalBalance > 0 ? 'due' : 'settled');
                                    const displayAmount = isCreditSale ? total : paid;

                                    return (
                                        <div key={txn.id} className="group relative bg-white rounded-2xl p-4 border border-gray-100 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] hover:shadow-lg hover:border-purple-100 hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-2xl ${theme.iconBg} flex items-center justify-center shrink-0 shadow-inner`}><Icon className={`w-6 h-6 ${theme.iconColor}`} /></div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div>
                                                        <h4 className="font-bold text-gray-800 text-base truncate pr-2">{txn.customerName}</h4>
                                                        {txn.customerId && <p className={`text-[10px] font-medium ${currentBalanceStatus === 'advance' ? 'text-blue-500' : (currentBalanceStatus === 'due' ? 'text-red-500' : 'text-green-600')}`}>{localT.balance}: {Math.abs(historicalBalance).toFixed(0)}</p>}
                                                    </div>
                                                    <span className={`font-extrabold text-lg ${theme.amountColor}`}>Rs. {displayAmount.toFixed(0)}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium"><span>{formatDateTime(txn.date, language).split(',')[1]?.trim() || formatDateTime(txn.date, language)}</span></div>
                                                        <p className="text-[10px] text-gray-400 font-medium mt-0.5 truncate max-w-[150px]">{txn.description}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {isCreditSale && <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-bold border border-red-100">CREDIT SALE</span>}
                                                        {!isCreditSale && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-md font-bold border border-green-100 flex items-center gap-1"><CheckCheck className="w-3 h-3" /> PAID</span>}
                                                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(txn); }} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="flex flex-col items-center justify-center py-12 px-4 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 text-center">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4"><Clock className="w-8 h-8 text-gray-300" /></div>
                                        <p className="text-gray-500 font-medium">{localT.no_data_day}</p>
                                        <p className="text-xs text-gray-400 mt-1">Transactions will appear here once you start selling.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AnalyticsTab;
