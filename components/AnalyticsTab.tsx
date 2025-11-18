import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { DollarSign, QrCode, BookUser, Search, ChevronLeft, ChevronRight, Calendar, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { translations } from '../translations';
import type { KhataCustomer, UnifiedTransaction, Transaction, InventoryItem } from '../types';
import { formatDateTime } from '../utils';
import ConfirmationModal from './ConfirmationModal';

type ChartDataPoint = {
    date: string;
    cash: number;
    qr: number;
    credit: number;
};

type TooltipData = {
    visible: boolean;
    x: number;
    y: number;
    transaction: UnifiedTransaction;
};

// --- SalesLineChart Component ---
const SalesLineChart: React.FC<{
    data: ChartDataPoint[];
    transactions: UnifiedTransaction[];
    dateRange: { start: Date; end: Date };
    onDotHover: (data: TooltipData | null) => void;
}> = ({ data, transactions, dateRange, onDotHover }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const width = 320;
    const height = 180;
    const margin = { top: 10, right: 10, bottom: 30, left: 10 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (data.length < 2) {
        return <div style={{ height: `${height}px` }} className="flex items-center justify-center text-gray-400">Not enough data to display a chart.</div>;
    }

    const yMax = useMemo(() => {
        const maxVal = Math.max(...data.flatMap(d => [d.cash, d.qr, d.credit]), ...transactions.map(t => t.amount));
        return maxVal === 0 ? 1000 : Math.ceil(maxVal / 1000) * 1000;
    }, [data, transactions]);

    const timeStart = useMemo(() => new Date(dateRange.start).setHours(5, 0, 0, 0), [dateRange.start]);
    const timeEnd = useMemo(() => new Date(dateRange.start).setHours(22, 0, 0, 0), [dateRange.start]);
    const isMultiDay = dateToYMD(dateRange.start) !== dateToYMD(dateRange.end);
    
    const xScale = useCallback((date: Date) => {
        if(isMultiDay) {
            const range = dateRange.end.getTime() - dateRange.start.getTime();
            if (range === 0) return 0;
            return ((date.getTime() - dateRange.start.getTime()) / range) * innerWidth;
        }
        const range = timeEnd - timeStart;
        return ((date.getTime() - timeStart) / range) * innerWidth;
    }, [dateRange, timeStart, timeEnd, innerWidth, isMultiDay]);

    const yScale = useCallback((value: number) => innerHeight - (Math.max(0, value) / yMax) * innerHeight, [innerHeight, yMax]);

    const createSmoothPath = (key: 'cash' | 'qr' | 'credit', tension = 0.4) => {
        const points = data.map(d => ({ x: xScale(new Date(d.date)), y: yScale(d[key]) }));
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = i > 0 ? points[i - 1] : points[i];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = i < points.length - 2 ? points[i + 2] : p2;
            const cp1x = p1.x + (p2.x - p0.x) / 6 * tension * 3;
            const cp1y = Math.min(innerHeight, Math.max(0, p1.y + (p2.y - p0.y) / 6 * tension * 3));
            const cp2x = p2.x - (p3.x - p1.x) / 6 * tension * 3;
            const cp2y = Math.min(innerHeight, Math.max(0, p2.y - (p3.y - p1.y) / 6 * tension * 3));
            d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)},${cp2x.toFixed(2)},${cp2y.toFixed(2)},${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
        }
        return d;
    };
    
    const series: { key: 'cash' | 'qr' | 'credit'; color: string; }[] = [
        { key: 'cash', color: '#28A745' },
        { key: 'qr', color: '#17A2B8' },
        { key: 'credit', color: '#DC3545' },
    ];

    const handleMouseOver = (e: React.MouseEvent, txn: UnifiedTransaction) => {
        if (!svgRef.current) return;
        const svgRect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - svgRect.left;
        const y = e.clientY - svgRect.top;
        onDotHover({ visible: true, x, y, transaction: txn });
    };

    return (
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${width} ${height}`}>
            <g transform={`translate(${margin.left},${margin.top})`}>
                 <line x1="0" y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="black" strokeWidth="1" />
                <g className="text-xs text-gray-500">
                    {data.map((d, i) => {
                        const showLabel = isMultiDay 
                            ? (i % Math.ceil(data.length / 5) === 0) || i === data.length - 1
                            : i % 3 === 0; // Show labels for 5am, 8am, 11am, etc.
                        if (!showLabel) return null;
                        
                        const date = new Date(d.date);
                        const label = isMultiDay
                            ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).toLowerCase();

                        return (
                            <text key={i} x={xScale(date)} y={innerHeight + 15} textAnchor="middle" fill="#6b7280" fontSize="10">
                                {label}
                            </text>
                        );
                    })}
                </g>
                {series.map(s => (
                    <g key={s.key}>
                        <path d={`${createSmoothPath(s.key)} L ${xScale(new Date(data[data.length-1].date))},${innerHeight} L ${xScale(new Date(data[0].date))},${innerHeight} Z`} fill={s.color} fillOpacity="0.1" />
                        <path d={createSmoothPath(s.key)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                ))}
                 {transactions.map(txn => {
                    const seriesColor = series.find(s => s.key === txn.type)?.color || '#808080';
                    const txnDate = new Date(txn.date);
                    return (
                        <circle
                            key={txn.id}
                            cx={xScale(txnDate)}
                            cy={yScale(txn.amount)}
                            r="3.5"
                            fill={seriesColor}
                            stroke="white"
                            strokeWidth="1.5"
                            onMouseOver={(e) => handleMouseOver(e, txn)}
                            onMouseOut={() => onDotHover(null)}
                            className="cursor-pointer"
                        />
                    );
                })}
            </g>
        </svg>
    );
};

const dateToYMD = (date: Date) => date.toISOString().split('T')[0];

interface AnalyticsTabProps {
    language: 'ne' | 'en';
    inventory: InventoryItem[];
    transactions: Transaction[];
    khataCustomers: KhataCustomer[];
    onDeleteTransaction: (transactionId: string) => void;
    onDeleteKhataTransaction: (customerId: string, transactionId: string) => void;
}

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ language, inventory, transactions, khataCustomers, onDeleteTransaction, onDeleteKhataTransaction }) => {
    const t = translations[language];
    const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({ start: new Date(), end: new Date() });
    const [dateRangeLabel, setDateRangeLabel] = useState('Today');
    const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
    const dateFilterRef = useRef<HTMLDivElement>(null);

    const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'cash' | 'qr' | 'credit'>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<UnifiedTransaction | null>(null);
    const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
                setIsDateFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unifiedTransactions = useMemo((): UnifiedTransaction[] => {
        const cashAndQrSales = transactions.map(txn => ({ ...txn, type: txn.paymentMethod as 'cash' | 'qr', originalType: 'transaction' as const, description: txn.items.map(i => i.name).join(', ') }));
        const creditSales = khataCustomers.flatMap(cust =>
            cust.transactions.filter(txn => txn.type === 'debit').map(txn => ({ ...txn, type: 'credit' as const, customerName: cust.name, originalType: 'khata' as const, customerId: cust.id }))
        );
        return [...cashAndQrSales, ...creditSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, khataCustomers]);

    const inventoryCategoryMap = useMemo(() => new Map(inventory.map(i => [i.id, i.category])), [inventory]);
    const uniqueCategories = useMemo(() => ['all', ...Array.from(new Set(inventory.map(item => item.category)))], [inventory]);

    const filteredTransactions = useMemo(() => {
        const startOfDay = new Date(dateRange.start);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateRange.end);
        endOfDay.setHours(23, 59, 59, 999);
        const lowercasedTerm = searchTerm.toLowerCase();

        return unifiedTransactions.filter(txn => {
            const txnDate = new Date(txn.date);
            if (!(txnDate >= startOfDay && txnDate <= endOfDay)) return false;
            if (paymentTypeFilter !== 'all' && txn.type !== paymentTypeFilter) return false;
            if (selectedCategory !== 'all' && !txn.items.some(item => item.inventoryId && inventoryCategoryMap.get(item.inventoryId) === selectedCategory)) return false;
            if (searchTerm && !(txn.customerName.toLowerCase().includes(lowercasedTerm) || txn.description.toLowerCase().includes(lowercasedTerm))) return false;
            return true;
        });
    }, [unifiedTransactions, dateRange, paymentTypeFilter, selectedCategory, searchTerm, inventoryCategoryMap]);
    
     const { dailyInsight } = useMemo(() => {
        const today = new Date();
        const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
        const endOfToday = new Date(); endOfToday.setHours(23,59,59,999);
        
        const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
        const startOfYesterday = new Date(yesterday); startOfYesterday.setHours(0,0,0,0);
        const endOfYesterday = new Date(yesterday); endOfYesterday.setHours(23,59,59,999);
        
        const todaysSales = unifiedTransactions
            .filter(t => new Date(t.date) >= startOfToday && new Date(t.date) <= endOfToday)
            .reduce((sum, t) => sum + t.amount, 0);

        const yesterdaysSales = unifiedTransactions
            .filter(t => new Date(t.date) >= startOfYesterday && new Date(t.date) <= endOfYesterday)
            .reduce((sum, t) => sum + t.amount, 0);
        
        if (yesterdaysSales === 0) return { dailyInsight: null };

        const percentageChange = ((todaysSales - yesterdaysSales) / yesterdaysSales) * 100;
        return { 
            dailyInsight: {
                percentage: Math.round(percentageChange),
                isPositive: percentageChange >= 0
            }
        };
    }, [unifiedTransactions]);

    const { totals, chartData } = useMemo(() => {
        const totals = { cash: 0, qr: 0, credit: 0, all: 0 };
        filteredTransactions.forEach(txn => {
            totals[txn.type] += txn.amount;
            totals.all += txn.amount;
        });

        const diffDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) { // HOURLY AGGREGATION
            const buckets = Array.from({ length: 18 }, (_, i) => ({
                date: new Date(dateRange.start).setHours(5 + i, 0, 0, 0),
                cash: 0, qr: 0, credit: 0,
            }));
            filteredTransactions.forEach(txn => {
                const hour = new Date(txn.date).getHours();
                const bucketIndex = hour - 5;
                if (bucketIndex >= 0 && bucketIndex < 18) {
                    buckets[bucketIndex][txn.type] += txn.amount;
                }
            });
            const chartDataPoints = buckets.map(b => ({ ...b, date: new Date(b.date).toISOString() }));
            return { totals, chartData: chartDataPoints };
        } else { // DAILY AGGREGATION
            const aggregated: Map<string, { cash: number; qr: number; credit: number }> = new Map();
            for (let i = 0; i < diffDays; i++) {
                const d = new Date(dateRange.start);
                d.setDate(d.getDate() + i);
                aggregated.set(dateToYMD(d), { cash: 0, qr: 0, credit: 0 });
            }
            
            filteredTransactions.forEach(txn => {
                const dateKey = dateToYMD(new Date(txn.date));
                if (aggregated.has(dateKey)) {
                    const dayData = aggregated.get(dateKey)!;
                    dayData[txn.type] += txn.amount;
                }
            });
            const chartDataPoints = Array.from(aggregated.entries()).map(([date, values]) => ({ date, ...values }));
            return { totals, chartData: chartDataPoints };
        }
    }, [filteredTransactions, dateRange]);
    
    const isNextDisabled = useMemo(() => dateToYMD(dateRange.end) === dateToYMD(new Date()), [dateRange]);
    const isMultiDayView = useMemo(() => dateToYMD(dateRange.start) !== dateToYMD(dateRange.end), [dateRange]);

    const setDatePreset = (preset: 'today' | 'yesterday' | '7d' | '14d' | '28d') => {
        const end = new Date();
        const start = new Date();
        let label = 'Today';
        
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);

        switch (preset) {
            case 'yesterday':
                start.setDate(start.getDate() - 1);
                end.setDate(end.getDate() - 1);
                label = 'Yesterday';
                break;
            case '7d':
                start.setDate(start.getDate() - 6);
                label = 'Last 7 days';
                break;
            case '14d':
                start.setDate(start.getDate() - 13);
                label = 'Last 14 days';
                break;
            case '28d':
                start.setDate(start.getDate() - 27);
                label = 'Last 28 days';
                break;
        }
        setDateRange({ start, end });
        setDateRangeLabel(label);
        setIsDateFilterOpen(false);
    };

    const handleDateNav = useCallback((direction: 'prev' | 'next') => {
        if (direction === 'next' && isNextDisabled) return;
        const newStartDate = new Date(dateRange.start);
        newStartDate.setDate(newStartDate.getDate() + (direction === 'next' ? 1 : -1));
        const newEndDate = new Date(newStartDate);
        
        const today = new Date(); today.setHours(0,0,0,0);
        const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);

        setDateRange({ start: newStartDate, end: newEndDate });

        if (dateToYMD(newStartDate) === dateToYMD(today)) setDateRangeLabel('Today');
        else if (dateToYMD(newStartDate) === dateToYMD(yesterday)) setDateRangeLabel('Yesterday');
        else setDateRangeLabel(newStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    }, [dateRange.start, isNextDisabled]);

    const handleDelete = () => {
        if (!confirmDelete) return;
        if (confirmDelete.originalType === 'transaction') onDeleteTransaction(confirmDelete.id);
        else if (confirmDelete.originalType === 'khata' && confirmDelete.customerId) onDeleteKhataTransaction(confirmDelete.customerId, confirmDelete.id);
        setConfirmDelete(null);
    };

    const paymentTypeFilters = [
        { id: 'all', label: t.filter_all },
        { id: 'cash', label: t.filter_cash },
        { id: 'qr', label: t.filter_qr },
        { id: 'credit', label: t.filter_credit },
    ];
    
    const paymentStatusInfo = {
      cash: { text: t.filter_cash, color: 'bg-green-100 text-green-700' },
      qr: { text: 'QR/Online', color: 'bg-blue-100 text-blue-700' },
      credit: { text: t.due, color: 'bg-red-100 text-red-700' },
    };

    return (
        <div className="space-y-4 relative">
            <ConfirmationModal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} title={t.confirm_delete_txn_title} message={t.confirm_delete_txn_desc} language={language} />

            {new Date().getHours() >= 20 && dailyInsight && (
                <div className={`p-3 rounded-xl flex items-center gap-3 shadow-sm border ${dailyInsight.isPositive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    {dailyInsight.isPositive ? <ArrowUp className="w-5 h-5 text-green-600"/> : <ArrowDown className="w-5 h-5 text-red-600"/>}
                    <p className={`text-sm font-medium ${dailyInsight.isPositive ? 'text-green-800' : 'text-red-800'}`}>
                        Great job! Sales are <span className="font-bold">{Math.abs(dailyInsight.percentage)}% {dailyInsight.isPositive ? 'higher' : 'lower'}</span> than yesterday.
                    </p>
                </div>
            )}

            <div className="bg-white rounded-xl p-3 shadow-sm border space-y-3">
                <div className="flex items-center gap-2">
                     <div className="relative flex-1" ref={dateFilterRef}>
                         <div className="flex items-center justify-between bg-gray-50 border rounded-lg p-1">
                            <button onClick={() => handleDateNav('prev')} disabled={isMultiDayView} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-5 h-5 text-gray-600"/></button>
                            <button onClick={() => setIsDateFilterOpen(p => !p)} className="flex items-center gap-1.5 text-sm font-semibold text-purple-700">
                               <Calendar className="w-4 h-4" />
                               <span>{dateRangeLabel}</span>
                            </button>
                            <button onClick={() => handleDateNav('next')} disabled={isNextDisabled || isMultiDayView} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-5 h-5 text-gray-600"/></button>
                         </div>
                         {isDateFilterOpen && (
                             <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border z-10 p-2 space-y-1">
                                {['Today', 'Yesterday', 'Last 7 days', 'Last 14 days', 'Last 28 days'].map((label, i) => (
                                     <button key={label} onClick={() => setDatePreset(['today', 'yesterday', '7d', '14d', '28d'][i] as any)} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100">{label}</button>
                                 ))}
                                 <div className="border-t my-1"></div>
                                 <button className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 flex items-center gap-2 text-gray-600">
                                    <Calendar className="w-4 h-4" /> Choose date range
                                 </button>
                             </div>
                         )}
                    </div>
                     <div className="relative flex-1">
                        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full h-full appearance-none p-2 border bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                            {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>)}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>
                <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder={`${t.search_items} or customer`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                </div>
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-1">
                    {paymentTypeFilters.map(filter => (
                        <button key={filter.id} onClick={() => setPaymentTypeFilter(filter.id as any)} className={`flex-1 py-1.5 px-2 text-sm font-semibold rounded-md transition-colors ${paymentTypeFilter === filter.id ? 'bg-purple-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}>
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>
           
            <div className="bg-white rounded-xl p-4 shadow-sm text-gray-800 border relative">
                <SalesLineChart data={chartData} transactions={filteredTransactions} dateRange={dateRange} onDotHover={setTooltipData} />
                 {tooltipData?.visible && (
                    <div className="absolute bg-black/80 text-white p-2 rounded-lg text-xs shadow-lg pointer-events-none" style={{ left: `${tooltipData.x}px`, top: `${tooltipData.y}px`, transform: 'translate(-50%, -110%)' }}>
                        <p className="font-bold">{tooltipData.transaction.customerName} - रू{tooltipData.transaction.amount.toFixed(2)}</p>
                        <p className="text-white/80">{tooltipData.transaction.description}</p>
                        <p className="text-white/60">{new Date(tooltipData.transaction.date).toLocaleTimeString(language, { hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                 )}
                 <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center text-center px-2">
                        <div>
                            <div className="flex items-center justify-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div><span className="text-xs text-gray-500">Cash</span></div>
                            <p className="font-bold text-base text-gray-800 mt-1">रू{totals.cash.toFixed(0)}</p>
                        </div>
                        <div>
                           <div className="flex items-center justify-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-sky-500"></div><span className="text-xs text-gray-500">QR/Online</span></div>
                            <p className="font-bold text-base text-gray-800 mt-1">रू{totals.qr.toFixed(0)}</p>
                        </div>
                        <div>
                            <div className="flex items-center justify-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><span className="text-xs text-gray-500">Credit</span></div>
                            <p className="font-bold text-base text-gray-800 mt-1">रू{totals.credit.toFixed(0)}</p>
                        </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg flex items-center justify-between mt-4 border">
                         <span className="text-sm font-bold text-gray-800">Total Sales</span>
                         <p className="text-xl font-extrabold text-purple-600">रू {totals.all.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                {filteredTransactions.length === 0 ? (
                    <div className="text-center p-10 text-gray-500 bg-white rounded-xl shadow-sm border">
                        <p>{t.no_sales_history}</p>
                    </div>
                ) : (
                    filteredTransactions.map(txn => {
                        const status = paymentStatusInfo[txn.type];
                        return (
                        <div key={`${txn.originalType}-${txn.id}`} className="group bg-white rounded-xl p-3 shadow-sm flex items-center justify-between border">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                                    {txn.customerName.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-gray-800">{txn.customerName}</p>
                                    <p className="text-xs text-gray-500 truncate max-w-xs">{formatDateTime(txn.date, language)}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-gray-800">रू {txn.amount.toFixed(2)}</p>
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${status.color} mt-1 inline-block`}>{status.text}</span>
                            </div>
                        </div>
                    )})
                )}
            </div>
        </div>
    );
};

export default AnalyticsTab;
