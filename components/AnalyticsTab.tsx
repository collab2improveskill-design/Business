import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, PieChart, Clock, AlertCircle, X, Wallet, QrCode, BookOpen, Trash2, Sparkles, ArrowDownLeft, CheckCheck, ArrowUp, ArrowDown } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Line
} from 'recharts';
import { translations } from '../translations';
import type { UnifiedTransaction } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { useKirana } from '../context/KiranaContext';
import { formatDateTime } from '../utils';

// --- Constants & Configuration ---
const COLORS = {
    cash: '#10b981',  // Emerald-500
    qr: '#3b82f6',    // Blue-500
    credit: '#ef4444', // Red-500
    total: '#3b82f6'  // Blue-500
};

const COLORS_HOVER = {
    cash: '#059669',
    qr: '#2563eb',
    credit: '#dc2626'
};

const NAVIGATION_LIMIT_DAYS = 30;
const MAX_CUSTOM_RANGE_DAYS = 30;
const DAILY_GOAL = 15000;
// Threshold for "High Density" charts. If data points > this, we hide dots to clean up UI.
const DENSITY_THRESHOLD = 50; 

// --- Local Translations ---
const LOCAL_TEXT = {
   ne: {
       insight_title: "दैनिक सारांश",
       actual_money_in: "हातमा आएको पैसा",
       credit_sales: "आजको खुद उधारो",
       total_sales: "कुल बिक्री",
       money_in_hand: "नगद + अनलाइन",
       end_shift: "दिन समाप्त",
       payment_distribution: "पैसाको स्रोत",
       recent_txn: "हालको कारोबार",
       cash: "नगद",
       qr: "QR",
       credit: "उधारो",
       last_7_days: "पछिल्लो ७ दिन",
       last_14_days: "पछिल्लो १४ दिन",
       last_28_days: "पछिल्लो २८ दिन",
       custom_range: "कस्टम मिति",
       today: "आज",
       yesterday: "हिजो",
       no_data_day: "आजको लागि कुनै बिक्री छैन",
       loading: "डाटा लोड हुँदैछ...",
       apply: "लागु गर्नुहोस्",
       cancel: "रद्द गर्नुहोस्",
       start_date: "सुरु मिति",
       end_date: "अन्त्य मिति",
       invalid_range: "अमान्य मिति दायरा",
       range_limit_error: "३० दिन भन्दा बढीको दायरा छनोट गर्न मिल्दैन",
       retry: "पुन: प्रयास गर्नुहोस्",
       total: "जम्मा",
       revenue_progress: "कुल आम्दानी (Revenue)",
       payment_split: "भुक्तानी विवरण (Split)",
       goal_progress: "दैनिक लक्ष्य",
       goal_of: "दैनिक लक्ष्य:",
       on_track: "प्रगति",
       money_in_desc: "(CASH + QR)",
       credit_desc: "(NET CREDIT ADDED)",
       total_cash_in: "कुल नगद प्राप्त",
       debt_repayment_received: "ऋण भुक्तानी प्राप्त",
       balance: "बाँकी रकम",
       credit_alert: "उधारो अलर्ट",
       credit_alert_desc: "तपाईंले आज रू {credit} को उधारो दिनुभयो तर असुली रू ० छ। पुराना बाँकी उठाउन जोड दिनुहोस्।",
       view_outstanding: "बाँकी हेर्नुहोस्"
   },
   en: {
       insight_title: "Daily Insight",
       actual_money_in: "ACTUAL MONEY IN",
       credit_sales: "NET CREDIT ADDED",
       total_sales: "Total Sales",
       money_in_hand: "Cash + Online",
       end_shift: "End Shift",
       payment_distribution: "Payment Distribution",
       recent_txn: "Recent Transactions",
       cash: "Cash",
       qr: "Online/QR",
       credit: "Credit",
       last_7_days: "Last 7 Days",
       last_14_days: "Last 14 Days",
       last_28_days: "Last 28 Days",
       custom_range: "Custom Range",
       today: "Today",
       yesterday: "Yesterday",
       no_data_day: "No sales recorded for this day",
       loading: "Loading data...",
       apply: "Apply",
       cancel: "Cancel",
       start_date: "Start Date",
       end_date: "End Date",
       invalid_range: "Invalid date range",
       range_limit_error: "Range cannot exceed 30 days",
       retry: "Retry",
       total: "Total",
       revenue_progress: "Revenue Progress",
       payment_split: "Payment Split",
       goal_progress: "Daily Goal",
       goal_of: "Goal:",
       on_track: "of daily goal",
       money_in_desc: "(CASH + QR)",
       credit_desc: "(NET CREDIT ADDED)",
       total_cash_in: "Total Cash In",
       debt_repayment_received: "Debt Repayment Received",
       balance: "Remaining Balance",
       credit_alert: "Credit Alert",
       credit_alert_desc: "You gave रू {credit} credit today but collected रू 0. Consider collecting old debts.",
       view_outstanding: "View Outstanding Credits →"
   }
};

// --- Helper Components ---
const SkeletonLoader = () => (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
        <div className="h-10 bg-gray-200 rounded-lg w-full max-w-[200px]"></div>
        <div className="h-32 bg-gray-200 rounded-2xl w-full"></div>
        <div className="h-48 bg-gray-200 rounded-2xl w-full"></div>
        <div className="h-64 bg-gray-200 rounded-2xl w-full"></div>
    </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // Fix: Convert the raw timestamp (label) into a readable time string
        const dateLabel = new Date(label);
        const formattedLabel = dateLabel.getHours() === 0 && dateLabel.getMinutes() === 0 
            ? dateLabel.toLocaleDateString([], { month: 'short', day: 'numeric' }) // Show Date if midnight
            : dateLabel.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); // Show 24h Time (e.g., 16:00)

      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 z-50">
          <p className="font-semibold text-sm mb-2 text-gray-700">{formattedLabel}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs font-medium flex items-center gap-2" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
              {entry.name}: रू {Number(entry.value).toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
};

const CustomRangeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onApply: (start: Date, end: Date) => void;
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
                    <p>रू {hoveredSlice.amount.toLocaleString()}</p>
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


const AnalyticsTab: React.FC = () => {
    const { language, deleteTransaction, deleteKhataTransaction, transactions, khataCustomers } = useKirana();
    const t = translations[language];
    const localT = LOCAL_TEXT[language] || LOCAL_TEXT['en'];

    const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({ start: new Date(), end: new Date() });
    const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
    const [isCustomRangeOpen, setIsCustomRangeOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<UnifiedTransaction | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [chartView, setChartView] = useState<'cumulative' | 'split'>('cumulative');
    
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
    };

    const handleCustomRangeApply = (start: Date, end: Date) => {
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);
        setDateRange({ start, end });
        setIsCustomRangeOpen(false);
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
            
            // Normalize Payment Method Type
            const normalizedType = (txn.paymentMethod || 'cash').toLowerCase();

            return {
                id: txn.id,
                type: normalizedType as 'cash' | 'qr',
                customerName: txn.customerName,
                amount: Number(txn.amount) || 0,
                date: txn.date,
                description: isKhataPayment && txn.items.length === 0 ? 'Payment Received' : txn.items.map(i => `${i.name} (Qty: ${i.quantity})`).join(', '),
                items: txn.items,
                originalType: 'transaction',
                customerId: txn.khataCustomerId,
                isKhataPayment: isKhataPayment,
                totalAmount: (isKhataPayment && !isSplitPayment) ? 0 : (Number(txn.amount) || 0), 
                paidAmount: Number(txn.amount) || 0,
                source: (isKhataPayment && !isSplitPayment) ? 'recovery' : 'sales',
                meta: txn.meta
            };
        });

        // 2. Credit Sales (Khata Bills)
        const creditTxns: UnifiedTransaction[] = khataCustomers.flatMap(cust =>
            cust.transactions
                .filter(txn => txn.type === 'debit')
                .map((txn): UnifiedTransaction | null => {
                    const amount = Number(txn.amount) || 0;
                    const immediate = Number(txn.immediatePayment) || 0;
                    const remaining = amount - immediate;
                    
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
        let totalCash = 0;
        let totalQr = 0;
        let totalCreditVolume = 0; 
        const customerBuckets: Record<string, { creditIssued: number, payment: number }> = {};

        filteredTransactions.forEach(txn => {
            const total = Number(txn.totalAmount) || 0;
            const paid = Number(txn.paidAmount) || 0;
            const type = (txn.type || '').toLowerCase();
            
            if (txn.source === 'sales') {
                totalSales += total;
                if (type === 'cash') totalCash += total;
                else if (type === 'qr') totalQr += total;
                else if (type === 'credit') totalCreditVolume += total;
            }
            
            // "Money In" strictly tracks what was received (Cash flow)
            moneyInHand += paid;

            if (txn.customerId) {
                if (!customerBuckets[txn.customerId]) customerBuckets[txn.customerId] = { creditIssued: 0, payment: 0 };
                if (txn.source === 'sales' && type === 'credit') customerBuckets[txn.customerId].creditIssued += total;
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
        };
    }, [filteredTransactions]);

    // --- Chart Data Transformation (Cumulative & Split) ---
    const cumulativeChartData = useMemo(() => {
        // Sort Ascending for Accumulation
        const sortedTxns = [...filteredTransactions]
            .filter(txn => txn.source === 'sales') // Only chart sales events
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let cumulativeCash = 0;
        let cumulativeQr = 0;
        let cumulativeCredit = 0;
        let cumulativeTotal = 0;

        const dataPoints = [];
        
        // Start point (Anchor to 00:00 of Start Date)
        const rangeStart = new Date(dateRange.start);
        rangeStart.setHours(0, 0, 0, 0);
        
        // Push initial 0 point at start of day
        dataPoints.push({
            time: rangeStart.getTime(),
            timeLabel: isSingleDay 
                ? rangeStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                : rangeStart.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            cash: 0,
            qr: 0,
            credit: 0,
            total: 0
        });

        // ✅ FIX: Add horizontal plateau BEFORE each transaction point
        sortedTxns.forEach((txn, index) => {
            const amount = Number(txn.totalAmount) || 0;
            const type = (txn.type || '').toLowerCase();
            const txnTime = new Date(txn.date).getTime();

            // Push a point 1ms BEFORE transaction with PREVIOUS values (creates horizontal line)
            // This ensures proper stepping even with sparse data or type="stepAfter" quirks
            if (index > 0 || cumulativeTotal > 0) {
                dataPoints.push({
                    time: txnTime - 1,
                    timeLabel: isSingleDay 
                        ? new Date(txnTime - 1).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                        : new Date(txnTime - 1).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                    cash: cumulativeCash,
                    qr: cumulativeQr,
                    credit: cumulativeCredit,
                    total: cumulativeTotal
                });
            }

            // Update cumulative values
            if (type === 'cash') cumulativeCash += amount;
            else if (type === 'qr') cumulativeQr += amount;
            else if (type === 'credit') cumulativeCredit += amount;
            
            cumulativeTotal += amount;

            // Push the actual transaction point with NEW values (creates vertical step)
            dataPoints.push({
                time: txnTime,
                timeLabel: isSingleDay 
                    ? new Date(txnTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : new Date(txnTime).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                cash: cumulativeCash,
                qr: cumulativeQr,
                credit: cumulativeCredit,
                total: cumulativeTotal
            });
        });

        // Extend line to end of view window
        const now = new Date();
        const rangeEnd = new Date(dateRange.end);
        const effectiveEnd = (rangeEnd > now && isToday) ? now : rangeEnd;
        
        const lastPointTime = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].time : 0;

        // Only add end point if it's meaningfully later than last transaction
        if (effectiveEnd.getTime() > lastPointTime + 1000) { // At least 1 second gap
            dataPoints.push({
                time: effectiveEnd.getTime(),
                timeLabel: isSingleDay 
                    ? effectiveEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : effectiveEnd.toLocaleDateString([], { month: 'short', day: 'numeric' }),
                cash: cumulativeCash,
                qr: cumulativeQr,
                credit: cumulativeCredit,
                total: cumulativeTotal
            });
        }

        return dataPoints;
    }, [filteredTransactions, dateRange, isSingleDay, isToday]);

    // --- Hybrid Rendering System ---
    const isHighDensity = cumulativeChartData.length > DENSITY_THRESHOLD;

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

    const goalProgressPercent = Math.min(100, (financialSummary.totalSales / DAILY_GOAL) * 100).toFixed(0);
    const showCreditAlert = financialSummary.credit > 0 && financialSummary.debtRecovered === 0;

    const announcementText = useMemo(() => isLoading ? localT.loading : `Showing data for ${dateLabel}`, [isLoading, dateLabel, localT]);

    if (loadError) return <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6"><AlertCircle className="w-12 h-12 text-red-500 mb-4" /><h3 className="text-lg font-bold text-gray-800 mb-2">Failed to load data</h3><p className="text-gray-500 mb-4">Something went wrong while processing your analytics.</p><button onClick={() => setDatePreset('today')} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 flex items-center gap-2"><Clock className="w-4 h-4"/> {localT.retry}</button></div>;

    return (
        <div className="space-y-6 pb-24">
            <div className="sr-only" aria-live="polite">{announcementText}</div>
            <ConfirmationModal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} title={t.confirm_delete_txn_title} message={t.confirm_delete_txn_desc} language={language} />
            <CustomRangeModal isOpen={isCustomRangeOpen} onClose={() => setIsCustomRangeOpen(false)} onApply={handleCustomRangeApply} localT={LOCAL_TEXT.en} />

            {/* Header: Title and Date Filter */}
            <div className="flex items-center justify-between mb-6">
                <div>
                     <h1 className="text-2xl font-bold text-gray-800">{t.analytics_tab}</h1>
                     <div className="text-sm text-gray-600 mt-1">{localT.today} • {localT.end_shift}</div>
                </div>
                
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
                    
                    {/* Key Metrics - Gradient Cards */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl shadow-sm border border-green-200">
                            <div className="text-[10px] text-gray-600 mb-1 uppercase font-bold tracking-wide">{localT.actual_money_in}</div>
                            <div className="text-[10px] text-gray-500 mb-2">{localT.money_in_desc}</div>
                            <div className="text-2xl font-bold text-green-700">रू {financialSummary.moneyInHand.toLocaleString()}</div>
                        </div>
                        <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl shadow-sm border border-red-200">
                            <div className="text-[10px] text-gray-600 mb-1 uppercase font-bold tracking-wide">{localT.credit_sales}</div>
                             <div className="text-[10px] text-gray-500 mb-2">{localT.credit_desc}</div>
                            <div className="text-2xl font-bold text-red-600">रू {financialSummary.credit.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Goal Progress - New! */}
                    {isToday && (
                        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-gray-700">{localT.total_sales}</span>
                                <span className="text-2xl font-bold text-blue-600">रू {financialSummary.totalSales.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
                                <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${goalProgressPercent}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>{goalProgressPercent}% {localT.on_track}</span>
                                <span>{localT.goal_of} रू {DAILY_GOAL.toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    {/* Chart Toggle View */}
                    <div className="bg-white rounded-xl shadow-sm p-1 mb-4 flex gap-1 border border-gray-100">
                        <button
                            onClick={() => setChartView('cumulative')}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                chartView === 'cumulative' 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            {localT.revenue_progress}
                        </button>
                        <button
                            onClick={() => setChartView('split')}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                chartView === 'split' 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            {localT.payment_split}
                        </button>
                    </div>

                    {/* Main Recharts Section */}
                    <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
                         {chartView === 'cumulative' ? (
                             <>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-base font-semibold text-gray-800">{localT.revenue_progress}</h2>
                                    <div className="flex items-center gap-1 text-xs">
                                        <TrendingUp className="w-4 h-4 text-green-600" />
                                        <span className="text-green-600 font-medium">On Track</span>
                                    </div>
                                </div>
                                <div className="h-[280px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={cumulativeChartData}>
                                            <defs>
                                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                                            <XAxis 
                                                dataKey="time" 
                                                type="number" 
                                                domain={[dateRange.start.getTime(), dateRange.end.getTime()]} 
                                                tickFormatter={(unix) => isSingleDay 
                                                    ? new Date(unix).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
                                                    : new Date(unix).toLocaleDateString([], { day:'numeric', month:'short' })}
                                                tick={{ fontSize: 11, fill: '#9ca3af' }}
                                                stroke="#9ca3af"
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                            />
                                            <YAxis 
                                                tick={{ fontSize: 11, fill: '#9ca3af' }}
                                                stroke="#9ca3af"
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(val) => `रू ${val}`}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area 
                                                type="stepAfter" 
                                                dataKey="total" 
                                                stroke="#3b82f6" 
                                                strokeWidth={isHighDensity ? 3 : 2} 
                                                fill="url(#colorTotal)"
                                                name={localT.total}
                                                animationDuration={1000}
                                                activeDot={{ r: 6 }}
                                                connectNulls={true}
                                                dot={isHighDensity ? false : { fill: '#3b82f6', r: 4, strokeWidth: 0 }}
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey={() => DAILY_GOAL} 
                                                stroke="#94a3b8" 
                                                strokeDasharray="5 5" 
                                                strokeWidth={2}
                                                dot={false}
                                                name="Daily Goal"
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-4 text-xs text-gray-500 text-center bg-blue-50/50 p-2 rounded-lg">
                                  💡 Cumulative revenue shows your progress toward daily goal
                                </div>
                             </>
                         ) : (
                             <>
                                <h2 className="text-base font-semibold text-gray-800 mb-4">{localT.payment_split}</h2>
                                <div className="h-[280px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={cumulativeChartData}>
                                            <defs>
                                                <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                                                </linearGradient>
                                                <linearGradient id="colorQr" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                                </linearGradient>
                                                <linearGradient id="colorCredit" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6}/>
                                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                                            <XAxis 
                                                dataKey="time" 
                                                type="number" 
                                                domain={[dateRange.start.getTime(), dateRange.end.getTime()]} 
                                                tickFormatter={(unix) => isSingleDay 
                                                    ? new Date(unix).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
                                                    : new Date(unix).toLocaleDateString([], { day:'numeric', month:'short' })}
                                                tick={{ fontSize: 11, fill: '#9ca3af' }}
                                                stroke="#9ca3af"
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                            />
                                            <YAxis 
                                                tick={{ fontSize: 11, fill: '#9ca3af' }}
                                                stroke="#9ca3af"
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(val) => `रू ${val}`}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area 
                                                type="stepAfter" 
                                                dataKey="cash" 
                                                stackId="1" 
                                                stroke="#10b981" 
                                                strokeWidth={isHighDensity ? 3 : 2} 
                                                fill="url(#colorCash)"
                                                name={localT.cash}
                                                animationDuration={1000}
                                                activeDot={{ r: 6 }}
                                                connectNulls={true}
                                                dot={isHighDensity ? false : { fill: '#10b981', r: 3, strokeWidth: 0 }}
                                            />
                                            <Area 
                                                type="stepAfter" 
                                                dataKey="qr" 
                                                stackId="1" 
                                                stroke="#3b82f6" 
                                                strokeWidth={isHighDensity ? 3 : 2} 
                                                fill="url(#colorQr)"
                                                name={localT.qr}
                                                animationDuration={1000}
                                                activeDot={{ r: 6 }}
                                                connectNulls={true}
                                                dot={isHighDensity ? false : { fill: '#3b82f6', r: 3, strokeWidth: 0 }}
                                            />
                                            <Area 
                                                type="stepAfter" 
                                                dataKey="credit" 
                                                stackId="1" 
                                                stroke="#ef4444" 
                                                strokeWidth={isHighDensity ? 3 : 2} 
                                                fill="url(#colorCredit)"
                                                name={localT.credit}
                                                animationDuration={1000}
                                                activeDot={{ r: 6 }}
                                                connectNulls={true}
                                                dot={isHighDensity ? false : { fill: '#ef4444', r: 3, strokeWidth: 0 }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-4 flex justify-center gap-6 text-xs border-t border-gray-50 pt-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span className="text-gray-600">{localT.cash}: रू {financialSummary.totalCash.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                    <span className="text-gray-600">{localT.qr}: रू {financialSummary.totalQr.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <span className="text-gray-600">{localT.credit}: रू {financialSummary.totalCreditVolume.toLocaleString()}</span>
                                  </div>
                                </div>
                             </>
                         )}
                    </div>
                    
                    {/* Credit Alert Section - Logic Based */}
                    {showCreditAlert && (
                         <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border-l-4 border-red-500 mb-6 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-sm text-gray-800 mb-1">{localT.credit_alert}</h3>
                                <p className="text-xs text-gray-600 mb-2">
                                    {localT.credit_alert_desc.replace('{credit}', financialSummary.credit.toLocaleString())}
                                </p>
                                <button className="text-xs font-medium text-red-600 hover:text-red-700">
                                    {localT.view_outstanding}
                                </button>
                            </div>
                        </div>
                    )}


                    {/* Payment Distribution Breakdown Donut */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><PieChart className="w-5 h-5 text-purple-600" /> {localT.payment_distribution}</h3>
                        <div className="flex items-center justify-between">
                            <PaymentDonutChart 
                                data={[
                                    { type: 'cash', amount: financialSummary.totalCash }, 
                                    { type: 'qr', amount: financialSummary.totalQr },
                                    { type: 'credit', amount: financialSummary.totalCreditVolume }
                                ]} 
                                localT={localT}
                            />
                            <div className="flex-1 pl-6 space-y-3 border-l border-gray-100">
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span><span className="text-gray-600">{localT.cash}</span></div>
                                    <span className="font-bold text-gray-800">रू {financialSummary.totalCash.toFixed(0)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span><span className="text-gray-600">{localT.qr}</span></div>
                                    <span className="font-bold text-gray-800">रू {financialSummary.totalQr.toFixed(0)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="text-gray-600">{localT.credit}</span></div>
                                    <span className="font-bold text-gray-800">रू {financialSummary.totalCreditVolume.toFixed(0)}</span>
                                </div>
                            </div>
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
                                                          <span>रू {paid.toFixed(0)}</span>
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
                                                     <div className="flex justify-between font-extrabold text-gray-800"><span>{localT.total_cash_in}</span><span>रू {paid.toFixed(0)}</span></div>
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
                                                    <span className={`font-extrabold text-lg ${theme.amountColor}`}>रू {displayAmount.toFixed(0)}</span>
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