
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Search, UploadCloud, X, Loader, Trash2, Edit, ScanLine, PlusCircle, LineChart, Mic, Tag, AlertTriangle, ChevronDown, Bell, CheckCircle, MessageCircle, ShoppingCart, Send, Copy, Share2, ClipboardCheck, Package, MoreVertical, Pencil } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import type { InventoryItem, ParsedBillItemFromImage } from '../types';
import { translations } from '../translations';
import { parseInventoryFromImage } from '../services/geminiService';
import { CATEGORIES } from '../constants';
import { generateId, shareContent } from '../utils';
import { useKirana } from '../context/KiranaContext';
import { compressAndConvertToBase64 } from '../utils/imageCompression';
import QuickAddStockModal from './QuickAddStockModal';
import ConfirmationModal from './ConfirmationModal';


// A new type for items being reviewed after a scan
type ReviewableItem = ParsedBillItemFromImage & {
    sellingPrice: number;
    isNew: boolean;
    category: string;
    lowStockThreshold: number;
    isSelected: boolean;
};

const formatDate = (dateString: string, lang: 'ne' | 'en') => {
    return new Date(dateString).toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
};


// --- AddItemChoiceModal ---
const AddItemChoiceModal: React.FC<{ isOpen: boolean, onClose: () => void, onScan: () => void, onManual: () => void, language: 'ne' | 'en' }> = ({ isOpen, onClose, onScan, onManual, language }) => {
    if (!isOpen) return null;
    const t = translations[language];

    const handleScan = () => {
        onClose();
        onScan();
    };

    const handleManual = () => {
        onClose();
        onManual();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end animate-in slide-in-from-bottom-5">
            <div className="bg-white w-full max-w-md rounded-t-3xl p-6 flex flex-col shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">{t.add_item_choice_title}</h2>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X className="w-5 h-5"/></button>
                </div>
                <p className="text-gray-500 mb-6 text-sm">{t.add_item_choice_desc}</p>
                <div className="space-y-4">
                    <button onClick={handleScan} className="w-full flex items-center gap-4 p-5 border border-purple-100 bg-purple-50/50 rounded-2xl hover:bg-purple-100 transition-colors group">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-purple-600 group-hover:scale-110 transition-transform">
                            <ScanLine className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold text-left text-gray-800">{t.scan_bill_button}</p>
                            <p className="text-xs text-gray-500 text-left mt-0.5">{t.upload_desc}</p>
                        </div>
                    </button>
                    <button onClick={handleManual} className="w-full flex items-center gap-4 p-5 border border-gray-100 bg-gray-50/50 rounded-2xl hover:bg-gray-100 transition-colors group">
                         <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-600 group-hover:scale-110 transition-transform">
                            <Edit className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold text-left text-gray-800">{t.add_manually_button}</p>
                            <p className="text-xs text-gray-500 text-left mt-0.5">{t.manual_entry_desc}</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Crash-Proof Tooltip ---
const CustomTooltip = ({ active, payload, label, language }: any) => {
    // 1. Safety First: Logic check
    if (!active || !payload || !payload.length) return null;

    // Only access data after validation
    const dataPoint = payload[0].payload;
    const price = payload[0].value;

    return (
        <div className="bg-white p-3 border border-purple-100 rounded-xl shadow-xl z-50 min-w-[120px]">
            <p className="text-xs text-gray-500 mb-1 font-medium">{formatDate(dataPoint.date, language)}</p>
            <p className="text-lg font-bold text-purple-600 leading-none">
                रू {Number(price).toFixed(0)}
            </p>
            {dataPoint.quantity && (
                 <p className="text-[10px] text-gray-500 mt-1 bg-gray-100 inline-block px-1.5 py-0.5 rounded">
                    Qty: {dataPoint.quantity}
                 </p>
            )}
            {dataPoint.supplier && (
                 <p className="text-[10px] text-gray-400 mt-1 truncate max-w-[150px]">
                    {dataPoint.supplier}
                 </p>
            )}
        </div>
    );
};

// --- Robust PriceHistoryChart ---
const PriceHistoryChart: React.FC<{ data: { price: number; date: string; quantity?: number; supplier?: string }[], language: 'ne' | 'en' }> = ({ data, language }) => {
    // 1. Safety First: Data Validation
    if (!data || data.length === 0) {
        return <div className="text-gray-400 text-sm text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 mt-4 flex flex-col items-center gap-2">
            <LineChart className="w-8 h-8 opacity-20" />
            No price history available
        </div>;
    }

    // Prepare sorted data
    const chartData = useMemo(() => {
        return [...data].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [data]);

    // 2. Safe Domain Calculation: Helper variable (Prompt Requirement)
    const yDomain = (chartData && chartData.length === 1) ? ['dataMin - 10', 'dataMax + 10'] : ['auto', 'auto'];

    return (
        // 3. Responsive Safety: Fixed height container
        <div className="h-[250px] w-full mt-4 bg-white rounded-2xl border border-gray-100 p-2 shadow-sm relative overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis 
                        dataKey="date" 
                        tickFormatter={(str) => {
                             const d = new Date(str);
                             return d.toLocaleDateString(language === 'ne' ? 'ne-NP' : 'en-US', { month: 'short', day: 'numeric' });
                        }}
                        tick={{fontSize: 10, fill: '#9ca3af', fontWeight: 500}}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={30}
                        dy={10}
                    />
                    <YAxis 
                        domain={yDomain as any}
                        tick={{fontSize: 10, fill: '#9ca3af', fontWeight: 500}}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip 
                        content={<CustomTooltip language={language} />} 
                        cursor={{ stroke: '#8b5cf6', strokeWidth: 1, strokeDasharray: '4 4' }} 
                    />
                    <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#8b5cf6" 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill="url(#colorPrice)" 
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#8b5cf6' }}
                        animationDuration={1000}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};


// --- InventoryCard (Redesigned & Z-Index Fixed) ---
const InventoryCard: React.FC<{ 
    item: InventoryItem; 
    onClick: () => void; 
    onQuickAdd: () => void;
    onEdit: () => void;
    onDelete: () => void;
    language: 'ne' | 'en'; 
}> = ({ item, onClick, onQuickAdd, onEdit, onDelete, language }) => {
    const t = translations[language];
    const isLowStock = item.stock <= item.lowStockThreshold;
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div 
            onClick={onClick}
            // Z-Index fix: Boost z-index when menu is open so it floats above subsequent cards.
            // Removed transform (scale) to prevent 'fixed' backdrop from being trapped.
            className={`relative bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 transition-shadow cursor-pointer hover:shadow-md hover:border-purple-100 ${showMenu ? 'z-30 ring-1 ring-purple-100' : ''}`}
        >
            {/* Left Side: Avatar */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 shadow-sm ${isLowStock ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {item.name.charAt(0).toUpperCase()}
            </div>

            {/* Middle Section: Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="font-bold text-gray-900 truncate text-base leading-tight">{item.name}</h3>
                <span className="text-xs text-gray-400 font-medium mt-0.5 truncate max-w-[120px]">
                    {item.category}
                </span>
            </div>

            {/* Right Section: Price & Stock Badge */}
            <div className="flex flex-col items-end mr-1">
                <p className="font-bold text-gray-900 text-lg leading-tight">रू {item.price}</p>
                <div className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {isLowStock && <AlertTriangle className="w-3 h-3"/>}
                    {t.stock}: {item.stock} {item.unit}
                </div>
            </div>

            {/* Far Right: Three Dot Menu */}
            <div className="relative ml-1">
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    className="p-2 -mr-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                    <MoreVertical className="w-5 h-5" />
                </button>

                {/* Dropdown Menu */}
                {showMenu && (
                    <>
                        {/* Backdrop to close menu */}
                        <div 
                            className="fixed inset-0 z-40 cursor-default" 
                            onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
                        />
                        <div className="absolute right-0 top-8 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                             <button 
                                onClick={(e) => { e.stopPropagation(); onQuickAdd(); setShowMenu(false); }}
                                className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2 transition-colors"
                            >
                                <PlusCircle className="w-4 h-4" />
                                {t.quick_add_stock}
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }}
                                className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors border-t border-gray-50"
                            >
                                <Pencil className="w-4 h-4" />
                                Edit Details
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                                className="w-full text-left px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors border-t border-gray-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Item
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};


// --- PriceHistoryModal ---
const PriceHistoryModal: React.FC<{ item: InventoryItem | null, isOpen: boolean, onClose: () => void, language: 'ne' | 'en' }> = ({ item, isOpen, onClose, language }) => {
    if (!isOpen || !item) return null;
    const t = translations[language];
    const chartData = item.purchasePriceHistory;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 flex flex-col max-h-[90vh] shadow-2xl">
                <div className="flex justify-between items-center mb-1">
                    <h2 className="text-xl font-bold text-gray-800">{t.price_history_title}</h2>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X className="w-5 h-5"/></button>
                </div>
                <p className="text-sm font-medium text-purple-600 mb-4">{item.name}</p>
                
                {/* Robust Chart Component */}
                <PriceHistoryChart data={chartData} language={language} />
                
                <h3 className="font-bold text-gray-800 text-lg mt-6 mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5 text-gray-400" />
                    {t.purchase_log}
                </h3>
                <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50/50">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-100 sticky top-0">
                      <tr>
                        <th scope="col" className="px-3 py-3">{t.purchase_date}</th>
                        <th scope="col" className="px-3 py-3 text-center">{t.qty_bought}</th>
                        <th scope="col" className="px-3 py-3 text-right">{t.price_paid_per_unit}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {item.purchasePriceHistory.length === 0 ? (
                           <tr>
                                <td colSpan={3} className="px-3 py-8 text-center text-gray-400 text-xs">{t.no_price_history}</td>
                           </tr>
                      ) : (
                          item.purchasePriceHistory.slice().reverse().map((record, index) => (
                            <tr key={index} className="bg-white hover:bg-purple-50 transition-colors">
                              <td className="px-3 py-3 font-medium text-gray-600">
                                  {formatDate(record.date, language)}
                                  {record.supplier && <div className="text-[10px] text-gray-400 font-normal">{record.supplier}</div>}
                              </td>
                              <td className="px-3 py-3 text-center text-gray-600">{record.quantity}</td>
                              <td className="px-3 py-3 text-right font-bold text-gray-800">रू {record.price.toFixed(0)}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
            </div>
        </div>
    );
};


// --- ManualAddItemModal ---
const ManualAddItemModal: React.FC<{ 
    isOpen: boolean, 
    onClose: () => void, 
    onSave: (item: Omit<ParsedBillItemFromImage, 'id'> & { lowStockThreshold: number, id?: string, sellingPrice: number }) => void, 
    language: 'ne' | 'en',
    initialItem?: InventoryItem | null
}> = ({ isOpen, onClose, onSave, language, initialItem }) => {
    // Separate sellingPrice (MRP) from costPrice (Purchase)
    const [item, setItem] = useState({ 
        name: '', 
        quantity: '', 
        unit: '', 
        sellingPrice: '', 
        costPrice: '',
        lowStockThreshold: '10',
        category: 'Grocery' 
    });
    
    const t = translations[language];
    
    useEffect(() => {
        if (isOpen) {
            if (initialItem) {
                setItem({
                    name: initialItem.name,
                    quantity: initialItem.stock.toString(), // For editing, show current stock
                    unit: initialItem.unit,
                    sellingPrice: initialItem.price.toString(), // Map item.price to Selling Price
                    costPrice: '', // We don't preload cost price history here usually
                    lowStockThreshold: initialItem.lowStockThreshold.toString(),
                    category: initialItem.category
                });
            } else {
                setItem({ 
                    name: '', 
                    quantity: '', 
                    unit: '', 
                    sellingPrice: '', 
                    costPrice: '',
                    lowStockThreshold: '10',
                    category: 'Grocery'
                });
            }
        }
    }, [isOpen, initialItem]);
    
    if (!isOpen) return null;

    const handleSave = () => {
        const newItem = {
            id: initialItem?.id, // Pass ID if editing
            name: item.name,
            quantity: parseFloat(item.quantity) || 0,
            unit: item.unit,
            price: parseFloat(item.costPrice) || 0, // This is purchase price (cost)
            sellingPrice: parseFloat(item.sellingPrice) || 0, // Explicit Selling Price
            suggestedCategory: item.category || 'Other',
            lowStockThreshold: parseFloat(item.lowStockThreshold) || 5,
        };

        if (newItem.name) {
            onSave(newItem);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end animate-in slide-in-from-bottom-5">
            <div className="bg-white w-full max-w-md rounded-t-3xl p-6 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">{initialItem ? 'Edit Item' : t.manual_entry_title}</h2>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X className="w-5 h-5"/></button>
                </div>
                <div className="space-y-5">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">{t.item_name}</label>
                        <input type="text" value={item.name} onChange={e => setItem({...item, name: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all font-semibold" placeholder={t.add_item_placeholder} autoFocus />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">
                               {initialItem ? t.current + ' ' + t.stock : t.stock}
                           </label>
                           <input type="number" value={item.quantity} onChange={e => setItem({...item, quantity: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all font-semibold" placeholder="0" />
                        </div>
                        <div>
                           <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">{t.unit}</label>
                           <input type="text" value={item.unit} onChange={e => setItem({...item, unit: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all font-semibold" placeholder="pcs, kg..." />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">{t.selling_price}</label>
                           <input type="number" value={item.sellingPrice} onChange={e => setItem({...item, sellingPrice: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all font-semibold" placeholder="0.00" />
                        </div>
                        <div>
                           <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">{t.purchase_price} <span className="text-[10px] font-normal text-gray-400">(Optional)</span></label>
                           <input type="number" value={item.costPrice} onChange={e => setItem({...item, costPrice: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all font-semibold" placeholder="0.00" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">{t.category}</label>
                            <select value={item.category} onChange={e => setItem({...item, category: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all font-semibold text-sm">
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                                {t.low_stock_threshold} <AlertTriangle className="w-3 h-3 text-orange-500" />
                            </label>
                            <input type="number" value={item.lowStockThreshold} onChange={e => setItem({...item, lowStockThreshold: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all font-semibold" placeholder="10" />
                        </div>
                    </div>
                </div>
                <button onClick={handleSave} className="w-full mt-8 bg-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-purple-700 active:scale-[0.98] transition-all shadow-lg shadow-purple-200">
                    {initialItem ? 'Update Item' : t.save_item_button}
                </button>
            </div>
        </div>
    );
};


// --- ScanBillModal ---
const ScanBillModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (items: ReviewableItem[]) => void, language: 'ne' | 'en', inventory: InventoryItem[] }> = ({ isOpen, onClose, onSave, language, inventory }) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reviewItems, setReviewItems] = useState<ReviewableItem[]>([]);
    const t = translations[language];

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setError(null);
            setReviewItems([]);
        }
    };

    const processImage = async () => {
        if (!imageFile) return;
        setIsProcessing(true);
        setError(null);
        
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            // Use the new compression utility
            const base64 = await compressAndConvertToBase64(imageFile);
            const results = await parseInventoryFromImage(base64, language);
            const itemsToReview: ReviewableItem[] = results.map(pItem => {
                const existing = inventory.find(i => i.name.toLowerCase() === pItem.name.toLowerCase());
                if (existing) {
                    return { ...pItem, id: generateId(), isNew: false, sellingPrice: existing.price, category: existing.category, lowStockThreshold: existing.lowStockThreshold, isSelected: true };
                } else {
                    return { ...pItem, id: generateId(), isNew: true, sellingPrice: Math.ceil(pItem.price * 1.15), category: pItem.suggestedCategory || 'Other', lowStockThreshold: 10, isSelected: true };
                }
            });
            setReviewItems(itemsToReview);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleItemChange = (id: string, field: keyof ReviewableItem, value: string | number | boolean) => {
        setReviewItems(items => items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };
    
    const handleSelectAll = (checked: boolean) => {
        setReviewItems(items => items.map(item => ({ ...item, isSelected: checked })));
    };
    
    const handleApplyMargin = () => {
        setReviewItems(items => items.map(item => item.isSelected ? { ...item, sellingPrice: Math.ceil(item.price * 1.15) } : item));
    };

    const handleAssignCategory = (category: string) => {
        setReviewItems(items => items.map(item => item.isSelected ? { ...item, category } : item));
    };

    const handleSave = () => {
        onSave(reviewItems);
        handleClose();
    };

    const handleClose = () => {
        setImageFile(null);
        setImagePreview(null);
        setIsProcessing(false);
        setError(null);
        setReviewItems([]);
        onClose();
    };

    if (!isOpen) return null;
    const allSelected = reviewItems.every(i => i.isSelected);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end">
            <div className="bg-white w-full max-w-md rounded-t-3xl p-5 h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{t.scan_bill_button}</h2>
                    <button onClick={handleClose}><X/></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4">
                    {!imagePreview && (
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                            <UploadCloud className="w-10 h-10 text-gray-400 mb-2"/>
                            <span className="font-semibold text-gray-600">{t.upload_bill}</span>
                            <span className="text-sm text-gray-500">{t.upload_desc}</span>
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                        </label>
                    )}

                    {imagePreview && (
                        <div className="mb-4 text-center">
                            <img src={imagePreview} alt="Bill preview" className="rounded-xl max-h-40 w-auto mx-auto shadow-md"/>
                            <button onClick={() => {setImagePreview(null); setImageFile(null); setReviewItems([])}} className="text-xs text-red-500 mt-2 font-medium bg-red-50 px-3 py-1 rounded-full">{t.cancel}</button>
                        </div>
                    )}


                    {imageFile && !isProcessing && reviewItems.length === 0 && (
                        <button onClick={processImage} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors mt-4 shadow-lg shadow-purple-200">{t.scan_bill_button}</button>
                    )}
                    
                    {isProcessing && (
                         <div className="flex flex-col items-center justify-center gap-2 text-gray-600 p-8">
                            <Loader className="w-8 h-8 animate-spin text-purple-600" />
                            <span className="font-medium animate-pulse">{t.processing_image}</span>
                        </div>
                    )}
                    {error && <p className="text-red-500 bg-red-50 p-3 rounded-lg text-center text-sm">{error}</p>}
                    
                    {reviewItems.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-lg">{t.edit_parsed_items}</h3>
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">{reviewItems.length} items</span>
                            </div>
                            
                            <div className="bg-gray-50 p-3 rounded-xl space-y-3">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={allSelected} onChange={e => handleSelectAll(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                                    <label className="text-sm font-medium text-gray-700">{t.select_all}</label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={handleApplyMargin} className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg shadow-sm font-medium hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors">{t.apply_margin}</button>
                                    <button onClick={() => handleAssignCategory('Grocery')} className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg shadow-sm font-medium hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors">{t.assign_category} 'Grocery'</button>
                                </div>
                            </div>
                            {reviewItems.map((item) => (
                                <div key={item.id} className="grid grid-cols-12 gap-3 items-start p-3 border border-gray-100 rounded-xl bg-white shadow-sm">
                                    <input type="checkbox" checked={item.isSelected} onChange={e => handleItemChange(item.id, 'isSelected', e.target.checked)} className="col-span-1 mt-3 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"/>
                                    <div className="col-span-11 space-y-2">
                                        <div className="relative">
                                            <input type="text" value={item.name} onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold text-gray-800" />
                                            {item.isNew && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">{t.new_item}</span>}
                                        </div>
                                        <div className="grid grid-cols-5 gap-2">
                                            <div className="col-span-1">
                                                 <label className="text-[10px] text-gray-400 block mb-0.5">{t.quantity}</label>
                                                 <input type="number" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm text-center font-semibold" />
                                            </div>
                                            <div className="col-span-2">
                                                 <label className="text-[10px] text-gray-400 block mb-0.5">{t.purchase_price}</label>
                                                 <input type="number" value={item.price} onChange={(e) => handleItemChange(item.id, 'price', Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm text-center text-gray-600" />
                                            </div>
                                            <div className="col-span-2">
                                                 <label className="text-[10px] text-purple-600 block mb-0.5 font-bold">{t.selling_price}</label>
                                                 <input type="number" value={item.sellingPrice} onChange={(e) => handleItemChange(item.id, 'sellingPrice', Number(e.target.value))} className="w-full p-2 border border-purple-200 bg-purple-50 rounded-lg text-sm text-center font-bold text-purple-700" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <select value={item.category} onChange={e => handleItemChange(item.id, 'category', e.target.value)} className="w-full p-2 border rounded-lg text-xs bg-gray-50 text-gray-600">
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <input type="number" value={item.lowStockThreshold} onChange={e => handleItemChange(item.id, 'lowStockThreshold', Number(e.target.value))} className="w-full p-2 border rounded-lg text-xs" placeholder={t.low_stock_threshold}/>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                 {reviewItems.length > 0 && (
                    <button onClick={handleSave} className="w-full mt-4 bg-green-600 text-white py-4 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200">
                        {t.save_to_inventory}
                    </button>
                 )}
            </div>
        </div>
    );
};


// --- Draft Order Modal ---
const DraftOrderModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    items: InventoryItem[];
    language: 'ne' | 'en';
}> = ({ isOpen, onClose, items, language }) => {
    const t = translations[language];
    const [draftText, setDraftText] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);

    // Generate text when items or language changes
    useEffect(() => {
        if (isOpen && items.length > 0) {
            const header = t.order_list_header;
            // Use smart name or empty if not set
            const shopName = ""; 
            
            const list = items.map(item => {
                const need = Math.max(0, item.lowStockThreshold - item.stock);
                // "- *Sunko Dal* - Need 12 Pkt (Stock: 8)"
                return `- *${item.name}* - ${t.need} ${need} ${item.unit} (${t.stock}: ${item.stock})`;
            }).join('\n');

            setDraftText(`${header}\n\n${list}\n\n${shopName}`);
        }
    }, [isOpen, items, language, t]);

    if (!isOpen) return null;

    const handleShare = async () => {
        await shareContent(draftText);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(draftText);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex justify-center items-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Send className="w-5 h-5 text-purple-600" />
                        {t.draft_order_title}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5"/></button>
                </div>
                
                <p className="text-sm text-gray-500 mb-2">{t.edit_before_share}</p>
                
                <textarea 
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    className="w-full flex-1 min-h-[200px] p-4 border border-gray-300 rounded-xl font-mono text-sm bg-white text-gray-800 focus:ring-2 focus:ring-purple-500 outline-none resize-none shadow-sm"
                    spellCheck={false}
                />

                <div className="flex gap-3 mt-4">
                    <button 
                        onClick={handleCopy}
                        className="flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                         {copySuccess ? <ClipboardCheck className="w-5 h-5 text-green-600"/> : <Copy className="w-5 h-5"/>}
                         {copySuccess ? t.order_copied : t.copy_text}
                    </button>
                    <button 
                        onClick={handleShare}
                        className="flex-1 py-3 rounded-xl font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Share2 className="w-5 h-5" />
                        {t.share_order}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- New Low Stock Card Component ---
const LowStockCard: React.FC<{ 
    item: InventoryItem; 
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
    onUpdateQty: (item: InventoryItem) => void; 
    language: 'ne' | 'en'; 
}> = ({ item, isSelected, onToggleSelect, onUpdateQty, language }) => {
    const t = translations[language];
    
    // Reverse Logic: Bar represents stock level. If low, it should look critical.
    const percentage = Math.min(100, (item.stock / item.lowStockThreshold) * 100);
    const isCritical = item.stock === 0;

    return (
        <div 
            onClick={() => onToggleSelect(item.id)}
            className={`bg-white rounded-xl p-4 shadow-sm border border-l-4 border-l-red-500 flex items-center gap-3 relative overflow-hidden transition-all active:scale-[0.99] cursor-pointer ${isSelected ? 'ring-2 ring-purple-500 bg-purple-50/50' : 'border-gray-100'}`}
        >
            {/* Checkbox */}
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
            </div>

            {/* Content */}
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-gray-800 text-base leading-tight">{item.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{t.current}: {item.stock} {item.unit} • {t.target}: {item.lowStockThreshold}</p>
                    </div>
                </div>

                {/* Progress Bar (Visual Urgency) */}
                <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${percentage < 30 ? 'bg-red-600' : (percentage < 60 ? 'bg-orange-500' : 'bg-yellow-500')}`} 
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>

            {/* Quick Update Button (Keep only this action, updated Icon) */}
            <button 
                onClick={(e) => { e.stopPropagation(); onUpdateQty(item); }}
                className="p-2 rounded-full bg-gray-100 text-purple-600 hover:bg-purple-100 transition-colors shrink-0"
                aria-label={t.quick_add_stock}
            >
                <Package className="w-5 h-5" />
            </button>
        </div>
    );
};


// --- Main InventoryTab Component ---
const InventoryTab: React.FC = () => {
    const { language, inventory, setInventory, addStock } = useKirana();
    const [searchTerm, setSearchTerm] = useState('');
    const [modal, setModal] = useState<'scan' | 'manual' | 'history' | 'choice' | 'draft_order' | null>(null);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isVoiceSearching, setIsVoiceSearching] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'stock' | 'category', direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
    
    // Quick Add Modal State local to this tab
    const [quickAddItem, setQuickAddItem] = useState<InventoryItem | null>(null);

    // Edit Item State
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

    // Toggle State for View Mode
    const [viewMode, setViewMode] = useState<'all' | 'low_stock'>('all');

    // Selection State for Bulk Order
    const [selectedLowStockIds, setSelectedLowStockIds] = useState<Set<string>>(new Set());

    const t = translations[language];
    
    const recognitionRef = useRef<any>(null);
    
    // Calculate Low Stock Count
    const lowStockCount = useMemo(() => inventory.filter(i => i.stock <= i.lowStockThreshold).length, [inventory]);

    // Combined effect for lifecycle management and listener attachment to safe-guard against instance mismatch
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = language === 'ne' ? 'ne-NP' : 'en-US';
            recognition.continuous = false;
            recognition.interimResults = false;
            recognitionRef.current = recognition;

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setSearchTerm(transcript);
            };
    
            recognition.onend = () => setIsVoiceSearching(false);
            recognition.onerror = (event: any) => {
                // Fix: Ignore 'aborted' error which happens on stop/cleanup
                if (event.error === 'aborted') return; 
                console.error('Speech recognition error:', event.error); 
                setIsVoiceSearching(false); 
            };
        }
        
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch(e) {
                    // Ignore
                }
                recognitionRef.current = null;
            }
        };
    }, [language]);

    const uniqueCategories = useMemo(() => ['all', ...Array.from(new Set(inventory.map(item => item.category)))], [inventory]);

    const handleVoiceSearch = () => {
        if (!recognitionRef.current) { alert("Speech recognition is not supported in your browser."); return; }
        
        try {
            if (isVoiceSearching) { 
                recognitionRef.current.stop(); 
                setIsVoiceSearching(false);
            } else { 
                setSearchTerm(''); 
                try {
                    recognitionRef.current.start(); 
                    setIsVoiceSearching(true); 
                } catch (err: any) {
                    if (err.name === 'InvalidStateError' || err.message?.includes('already started')) {
                         setIsVoiceSearching(true);
                    } else {
                        throw err;
                    }
                }
            }
        } catch(e) {
            console.error("Error toggling speech recognition:", e);
            setIsVoiceSearching(false);
        }
    };

    const sortedAndFilteredInventory = useMemo(() => {
        let items = [...inventory];

        // 1. Filter by View Mode (All vs Low Stock)
        if (viewMode === 'low_stock') {
            items = items.filter(item => item.stock <= item.lowStockThreshold);
        }

        if (categoryFilter !== 'all') {
            items = items.filter(item => item.category === categoryFilter);
        }

        if (searchTerm) {
            items = items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        if (sortConfig !== null) {
            items.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return items;
    }, [inventory, searchTerm, sortConfig, categoryFilter, viewMode]);
    
    const requestSort = (key: 'name' | 'stock' | 'category') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const updateInventory = (newItems: (Omit<ParsedBillItemFromImage, 'id'> | ReviewableItem & { id?: string, sellingPrice?: number })[], mode: 'accumulate' | 'overwrite' = 'accumulate') => {
      setInventory(prevInventory => {
        const updatedInventory = [...prevInventory];
        const now = new Date().toISOString();

        newItems.forEach(newItem => {
          // Explicitly handle lowStockThreshold priority
          const category = 'category' in newItem ? newItem.category : (newItem as any).suggestedCategory || 'Other';
          const lowStockThreshold = 'lowStockThreshold' in newItem ? newItem.lowStockThreshold : (newItem as any).lowStockThreshold || 10;
          
          let existingItemIndex = -1;
          
          if ('id' in newItem && newItem.id) {
               existingItemIndex = updatedInventory.findIndex(i => i.id === newItem.id);
          }
          
          if (existingItemIndex === -1) {
              existingItemIndex = updatedInventory.findIndex(
                invItem => invItem.name.toLowerCase() === newItem.name.toLowerCase()
              );
          }

          // Use provided selling price or calculate it (only for new items or accumulation if not provided)
          const sellingPrice = 'sellingPrice' in newItem ? newItem.sellingPrice : Math.ceil(newItem.price * 1.15);

          if (existingItemIndex > -1) {
            const existingItem = updatedInventory[existingItemIndex];
            
            if (mode === 'overwrite') {
                 // OVERWRITE MODE: Explicitly replace values (used for Editing)
                 updatedInventory[existingItemIndex] = {
                    ...existingItem,
                    name: newItem.name,
                    unit: newItem.unit,
                    price: sellingPrice || existingItem.price,
                    category: category,
                    lowStockThreshold: lowStockThreshold,
                    stock: newItem.quantity, // Set stock absolutely
                    lastUpdated: now,
                 };
            } else {
                // ACCUMULATE MODE: Add to existing (used for Scanning/Adding Stock)
                updatedInventory[existingItemIndex] = {
                  ...existingItem,
                  name: newItem.name,
                  stock: existingItem.stock + newItem.quantity,
                  unit: newItem.unit, 
                  price: sellingPrice || existingItem.price,
                  category,
                  lowStockThreshold,
                  lastUpdated: now,
                  purchasePriceHistory: newItem.quantity > 0 
                    ? [...existingItem.purchasePriceHistory, { price: newItem.price, date: now, quantity: newItem.quantity }] 
                    : existingItem.purchasePriceHistory
                };
            }
          } else {
            updatedInventory.push({
              id: generateId(),
              name: newItem.name,
              stock: newItem.quantity,
              unit: newItem.unit,
              price: sellingPrice || 0,
              category,
              lowStockThreshold,
              lastUpdated: now,
              purchasePriceHistory: [{ price: newItem.price, date: now, quantity: newItem.quantity }],
            });
          }
        });
        return updatedInventory.sort((a,b) => a.name.localeCompare(b.name));
      });
    };

    const handleSaveFromScan = (scannedItems: ReviewableItem[]) => { updateInventory(scannedItems, 'accumulate'); };
    
    const handleSaveManualItem = (manualItem: Omit<ParsedBillItemFromImage, 'id'> & { lowStockThreshold: number, id?: string, sellingPrice: number }) => { 
        if (manualItem.id) {
            // If ID exists, it's an edit -> Overwrite
            updateInventory([manualItem], 'overwrite');
        } else {
            // New Item -> Accumulate (adds new)
            updateInventory([manualItem], 'accumulate');
        }
    };
    
    const handleOpenHistory = (item: InventoryItem) => { setSelectedItem(item); setModal('history'); };

    const handleQuickAddStockConfirm = (itemId: string, quantity: number, price?: number, supplier?: string, sellingPrice?: number) => {
        const item = inventory.find(i => i.id === itemId);
        if(item) {
            addStock([{ inventoryId: itemId, quantity, name: item.name, price, supplier, sellingPrice }]);
        }
    };
    
    const confirmDelete = () => {
        if(itemToDelete) {
            setInventory(prev => prev.filter(i => i.id !== itemToDelete.id));
            setItemToDelete(null);
        }
    };

    const handleDeleteInventoryItem = (item: InventoryItem) => {
        setItemToDelete(item);
    };
    
    const handleEditInventoryItem = (item: InventoryItem) => {
        setEditingItem(item);
        setModal('manual');
    };

    const toggleLowStockSelection = (id: string) => {
        setSelectedLowStockIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    // Get selected items objects for the draft modal
    const selectedLowStockItems = useMemo(() => {
        return inventory.filter(item => selectedLowStockIds.has(item.id));
    }, [inventory, selectedLowStockIds]);
    
  return (
    <>
      <ConfirmationModal 
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Item?"
        message={`Are you sure you want to delete "${itemToDelete?.name}"? This action cannot be undone.`}
        language={language}
      />
      <AddItemChoiceModal isOpen={modal === 'choice'} onClose={() => setModal(null)} onScan={() => setModal('scan')} onManual={() => { setEditingItem(null); setModal('manual'); }} language={language} />
      <ScanBillModal isOpen={modal === 'scan'} onClose={() => setModal(null)} onSave={handleSaveFromScan} language={language} inventory={inventory} />
      <ManualAddItemModal 
        isOpen={modal === 'manual'} 
        onClose={() => { setModal(null); setEditingItem(null); }} 
        onSave={handleSaveManualItem} 
        language={language}
        initialItem={editingItem}
      />
      <PriceHistoryModal isOpen={modal === 'history'} onClose={() => { setModal(null); setSelectedItem(null); }} item={selectedItem} language={language} />
      <DraftOrderModal 
        isOpen={modal === 'draft_order'} 
        onClose={() => setModal(null)} 
        items={selectedLowStockItems} 
        language={language}
      />
      
      <QuickAddStockModal
            isOpen={!!quickAddItem}
            onClose={() => setQuickAddItem(null)}
            onConfirm={handleQuickAddStockConfirm}
            item={quickAddItem}
            language={language}
            onViewHistory={() => {
                const item = quickAddItem;
                setQuickAddItem(null);
                setSelectedItem(item);
                setModal('history');
            }}
        />

      <div className="space-y-6 pb-24">
        <h1 className="text-2xl font-bold text-gray-800 px-1">{t.inventory_management}</h1>
        
        {/* Sticky Header Wrapper for Search and Tabs */}
        <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-sm pt-2 pb-4 -mx-4 px-4 space-y-4 shadow-sm border-b border-gray-200">
             {/* Toggle Control - Segmented Style */}
            <div className="bg-gray-200/50 p-1.5 rounded-2xl flex relative">
                <button
                    onClick={() => setViewMode('all')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 relative z-10 ${
                        viewMode === 'all' 
                            ? 'bg-white text-purple-700 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    {t.all_inventory_tab}
                </button>
                <button
                    onClick={() => setViewMode('low_stock')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 relative z-10 flex items-center justify-center gap-2 ${
                        viewMode === 'low_stock' 
                            ? 'bg-white text-red-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    {t.low_stock_tab}
                    {lowStockCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[1.2rem] flex items-center justify-center shadow-sm">
                            {lowStockCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Search Bar with Clear Button */}
            <div className="bg-white rounded-2xl p-2 shadow-sm space-y-2 border border-gray-100 relative group focus-within:ring-2 ring-purple-100 transition-all">
                <div className="relative flex items-center">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder={t.search_items} 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="w-full pl-10 pr-12 py-3 bg-transparent border-none rounded-lg focus:outline-none text-gray-800 font-medium placeholder-gray-400"
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')} 
                            className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-gray-500 bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                    <button onClick={handleVoiceSearch} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-gray-100 transition-colors" aria-label="Search with voice">
                        <Mic className={`w-5 h-5 ${isVoiceSearching ? 'text-purple-600 animate-pulse' : 'text-gray-400'}`} />
                    </button>
                </div>
                {searchTerm && (
                     <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="p-2 border border-gray-200 bg-gray-50 rounded-lg text-xs font-semibold text-gray-600 outline-none">
                            {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat === 'all' ? t.all_items : cat}</option>)}
                        </select>
                    </div>
                )}
            </div>
        </div>

        {viewMode === 'low_stock' ? (
            // CARD View for Low Stock with Selection
            <div className="grid grid-cols-1 gap-3 animate-in slide-in-from-bottom-2 fade-in duration-300">
                 {sortedAndFilteredInventory.length > 0 ? sortedAndFilteredInventory.map(item => (
                     <LowStockCard 
                        key={item.id} 
                        item={item} 
                        isSelected={selectedLowStockIds.has(item.id)}
                        onToggleSelect={toggleLowStockSelection}
                        onUpdateQty={(i) => setQuickAddItem(i)} 
                        language={language} 
                    />
                 )) : (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 mt-4">
                        <CheckCircle className="w-16 h-16 text-green-100 fill-green-500 mb-4" />
                        <p className="text-lg font-bold text-gray-800">All Good!</p>
                        <p className="text-sm">{t.no_low_stock_items}</p>
                    </div>
                 )}
            </div>
        ) : (
            // NEW: Professional Card List View
            <div className="space-y-3 animate-in slide-in-from-bottom-2 fade-in duration-300 pb-20">
                {sortedAndFilteredInventory.length > 0 ? sortedAndFilteredInventory.map((item) => (
                    <InventoryCard 
                        key={item.id}
                        item={item}
                        onClick={() => handleOpenHistory(item)}
                        onQuickAdd={() => setQuickAddItem(item)}
                        onEdit={() => handleEditInventoryItem(item)}
                        onDelete={() => handleDeleteInventoryItem(item)}
                        language={language}
                    />
                )) : (
                    <div className="p-10 text-center text-gray-400 flex flex-col items-center mt-8">
                        <Package className="w-16 h-16 text-gray-200 mb-4" />
                        <p className="font-medium">{t.no_items_found}</p>
                    </div>
                )}
            </div>
        )}
      </div>
      
      {/* Conditionally render FABs based on view mode */}
      
      {/* FAB for All Inventory: Add New Item */}
      {viewMode === 'all' && (
        <button 
            onClick={() => setModal('choice')} 
            className={`fixed bottom-24 right-6 bg-gray-900 text-white rounded-2xl p-4 shadow-xl shadow-purple-900/20 hover:scale-105 active:scale-95 transition-all duration-300 z-30 group`}
            aria-label="Add Item"
        >
            <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}

      {/* FAB for Low Stock: Draft Order (Only when items selected) */}
      {viewMode === 'low_stock' && selectedLowStockIds.size > 0 && (
         <button 
            onClick={() => setModal('draft_order')} 
            className={`fixed bottom-24 right-6 bg-green-600 text-white rounded-full px-6 py-4 shadow-xl hover:bg-green-700 transition-all duration-300 transform hover:scale-105 z-30 flex items-center gap-2 font-bold animate-in zoom-in`}
        >
            <Send className="w-5 h-5" />
            <span>{t.draft_order} ({selectedLowStockIds.size})</span>
        </button>
      )}
    </>
  );
};

export default InventoryTab;
