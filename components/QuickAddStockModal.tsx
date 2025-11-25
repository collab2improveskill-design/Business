
import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, TrendingUp, TrendingDown, LineChart, Calculator } from 'lucide-react';
import type { InventoryItem } from '../types';
import { translations } from '../translations';

interface QuickAddStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (itemId: string, quantity: number, price?: number, supplier?: string, sellingPrice?: number) => void;
    item: InventoryItem | null;
    language: 'ne' | 'en';
    onViewHistory?: () => void;
}

const QuickAddStockModal: React.FC<QuickAddStockModalProps> = ({ isOpen, onClose, onConfirm, item, language, onViewHistory }) => {
    const [quantity, setQuantity] = useState('');
    const [buyingPrice, setBuyingPrice] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');
    const [supplier, setSupplier] = useState('');
    const t = translations[language];

    // Reset fields when modal opens for a new item
    useEffect(() => {
        if (isOpen && item) {
            setQuantity('');
            setBuyingPrice('');
            setSupplier('');
            setSellingPrice(item.price ? item.price.toString() : '');
        }
    }, [isOpen, item]);

    // Derived Logic for Price Context
    const lastPurchase = useMemo(() => {
        if (!item || !item.purchasePriceHistory || item.purchasePriceHistory.length === 0) return null;
        return item.purchasePriceHistory[item.purchasePriceHistory.length - 1];
    }, [item]);

    const priceTrend = useMemo(() => {
        if (!lastPurchase || !buyingPrice) return null;
        const current = parseFloat(buyingPrice);
        const last = lastPurchase.price;
        if (isNaN(current) || current <= 0) return null;
        
        if (current > last) return 'up';
        if (current < last) return 'down';
        return 'same';
    }, [buyingPrice, lastPurchase]);
    
    // Profit Margin Calculation
    const marginStats = useMemo(() => {
        const buy = parseFloat(buyingPrice);
        const sell = parseFloat(sellingPrice);
        
        if (isNaN(buy) || isNaN(sell) || buy === 0) return null;
        
        const profit = sell - buy;
        const marginPercent = (profit / buy) * 100;
        
        return { profit, marginPercent };
    }, [buyingPrice, sellingPrice]);

    if (!isOpen || !item) return null;

    const handleConfirm = () => {
        const numQuantity = parseFloat(quantity);
        const numPrice = parseFloat(buyingPrice);
        const numSellingPrice = parseFloat(sellingPrice);
        
        if (!isNaN(numQuantity) && numQuantity > 0) {
            onConfirm(
                item.id, 
                numQuantity, 
                !isNaN(numPrice) && numPrice > 0 ? numPrice : undefined,
                supplier.trim() || undefined,
                !isNaN(numSellingPrice) && numSellingPrice > 0 ? numSellingPrice : undefined
            );
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{t.quick_add_stock}</h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-500 hover:text-gray-800" /></button>
                </div>
                <p className="text-gray-600 mb-6 font-medium text-lg border-b pb-2">{item.name}</p>
                
                <div className="space-y-5">
                    {/* Quantity Input */}
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">{t.quantity}</label>
                        <div className="relative">
                             <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg font-semibold"
                                placeholder={`${t.quantity}`}
                                autoFocus
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">{item.unit}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         {/* Buying Price Input */}
                        <div>
                            <div className="mb-1">
                                <label className="text-sm font-bold text-gray-700 block">{t.purchase_price}</label>
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={buyingPrice}
                                    onChange={(e) => setBuyingPrice(e.target.value)}
                                    className={`w-full p-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-semibold transition-colors ${priceTrend === 'up' ? 'border-red-200 bg-red-50 text-red-700' : (priceTrend === 'down' ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200')}`}
                                    placeholder="₹ 0"
                                />
                                {priceTrend && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        {priceTrend === 'up' ? <TrendingUp className="w-4 h-4 text-red-500"/> : (priceTrend === 'down' ? <TrendingDown className="w-4 h-4 text-green-500"/> : null)}
                                    </div>
                                )}
                            </div>
                             {lastPurchase && (
                                <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                    Last: ₹{lastPurchase.price}
                                    {onViewHistory && (
                                        <button onClick={onViewHistory} className="ml-0.5 text-purple-600">
                                            <LineChart className="w-3 h-3"/>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {/* Selling Price Input */}
                        <div>
                             <div className="mb-1">
                                <label className="text-sm font-bold text-gray-700 block">{t.selling_price_new}</label>
                            </div>
                            <input
                                type="number"
                                value={sellingPrice}
                                onChange={(e) => setSellingPrice(e.target.value)}
                                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-semibold text-gray-800"
                                placeholder="₹ 0"
                            />
                             {item.price > 0 && (
                                <div className="text-[10px] text-gray-500 mt-1">
                                    {t.current_mrp}: ₹{item.price}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Smart Profit Margin Display */}
                    {marginStats && (
                        <div className={`p-3 rounded-xl border flex items-center justify-between ${marginStats.profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-2">
                                <Calculator className={`w-5 h-5 ${marginStats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                                <span className={`text-sm font-bold ${marginStats.profit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                                    {marginStats.profit >= 0 ? t.margin : t.loss}
                                </span>
                            </div>
                            <div className="text-right">
                                <p className={`font-bold text-lg leading-none ${marginStats.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    ₹ {marginStats.profit.toFixed(1)}
                                </p>
                                <p className={`text-xs font-semibold ${marginStats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {marginStats.marginPercent.toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Supplier Input */}
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">{t.supplier}</label>
                        <input
                            type="text"
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder={t.supplier_placeholder}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <button onClick={onClose} className="px-5 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors">{t.cancel}</button>
                    <button onClick={handleConfirm} className="flex-1 px-5 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:shadow-none transition-all" disabled={!quantity || parseFloat(quantity) <= 0}>
                        <Plus className="w-5 h-5" /> {t.add_item}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickAddStockModal;
