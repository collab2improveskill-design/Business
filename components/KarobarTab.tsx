

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Plus, X, User, Phone, MapPin, UserPlus, Mic, Loader, Trash2, ShoppingCart, CheckCircle, BookPlus, Wallet, Check, Coins, ArrowUpRight, ArrowDownLeft, CheckCheck, Clock, AlertCircle, Sparkles, PartyPopper, ArrowUp, ArrowDown } from 'lucide-react';
import { translations } from '../translations';
import type { KhataCustomer, EditableBillItem, KhataTransaction } from '../types';
import { parseBillingFromVoice } from '../services/geminiService';
import { generateId, findInventoryItem, formatDateTime } from '../utils';
import SelectKhataScreen from './SelectKhataScreen';
import KhataPaymentModal from './KhataPaymentModal';
import { useKirana } from '../context/KiranaContext';

// --- Custom Hook: Billing State Management ---
const useBillingState = () => {
    const [items, setItems] = useState<EditableBillItem[]>([]);

    const addItem = useCallback((item: EditableBillItem) => {
        setItems(prev => [...prev, item]);
    }, []);

    const addItems = useCallback((newItems: EditableBillItem[]) => {
        setItems(prev => [...prev, ...newItems]);
    }, []);

    const updateItem = useCallback((index: number, field: keyof EditableBillItem, value: string) => {
        setItems(prev => {
            const newItems = [...prev];
            newItems[index] = { ...newItems[index], [field]: value };
            return newItems;
        });
    }, []);

    const removeItem = useCallback((index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    }, []);

    const clear = useCallback(() => setItems([]), []);

    const total = useMemo(() => {
        return items.reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            const quantity = parseFloat(item.quantity) || 0;
            return sum + (price * quantity);
        }, 0);
    }, [items]);

    return { items, addItem, addItems, updateItem, removeItem, clear, total };
};

// --- Custom Hook: Voice Recognition ---
const useVoiceBilling = (language: 'ne' | 'en', inventory: any, onItemsParsed: (items: EditableBillItem[]) => void) => {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const t = translations[language];

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.lang = language === 'ne' ? 'ne-NP' : 'en-US';
            recognition.interimResults = true;
            recognitionRef.current = recognition;
        }
        return () => {
            if (recognitionRef.current) try { recognitionRef.current.abort(); } catch(e) {}
        };
    }, [language]);

    const processTranscript = useCallback(async (transcript: string) => {
        if (!transcript.trim()) return;
        setIsProcessing(true);
        setError(null);
        try {
            const result = await parseBillingFromVoice(transcript, language);
            const newItems = result.items.map(item => {
                const inventoryItem = findInventoryItem(item.name, inventory);
                const parsedPrice = parseFloat(String(item.price));
                const parsedQty = parseFloat(String(item.quantity));
                
                return {
                    id: generateId(),
                    inventoryId: inventoryItem?.id,
                    name: inventoryItem?.name || item.name || 'Unknown',
                    quantity: String(Number.isFinite(parsedQty) ? parsedQty : 1),
                    unit: inventoryItem?.unit || item.unit || 'pcs',
                    price: String(Number.isFinite(parsedPrice) ? parsedPrice : (inventoryItem?.price || 0)),
                };
            });
            onItemsParsed(newItems);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Voice parsing failed");
        } finally {
            setIsProcessing(false);
        }
    }, [language, inventory, onItemsParsed]);

    useEffect(() => {
        const recognition = recognitionRef.current;
        if (!recognition) return;

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            }
            if (finalTranscript) processTranscript(finalTranscript);
        };

        recognition.onerror = (event: any) => {
            // Filter out harmless errors
            if (event.error === 'no-speech' || event.error === 'aborted') {
                if (event.error === 'no-speech') setIsListening(false);
                return;
            }
            setIsListening(false);
            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                setError(t.microphone_permission_denied);
            } else {
                setError(`Voice Error: ${event.error}`);
            }
        };
        
        recognition.onend = () => setIsListening(false);

        return () => {
            recognition.onresult = null;
            recognition.onerror = null;
            recognition.onend = null;
        };
    }, [processTranscript, t.microphone_permission_denied]);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Speech recognition not supported.");
            return;
        }
        try {
            if (isListening) {
                recognitionRef.current.stop();
                setIsListening(false);
            } else {
                setError(null);
                try {
                    recognitionRef.current.start();
                    setIsListening(true);
                } catch (err: any) {
                     if (err.name === 'InvalidStateError' || err.message?.includes('already started')) {
                         setIsListening(true);
                    } else {
                        throw err;
                    }
                }
            }
        } catch (e) {
            console.error(e);
            setIsListening(false);
        }
    };

    return { isListening, isProcessing, error, toggleListening, setError };
};

// --- Sub-Component: Bill Editor ---
const BillEditor: React.FC<{
    items: EditableBillItem[];
    onUpdate: (idx: number, field: keyof EditableBillItem, val: string) => void;
    onRemove: (idx: number) => void;
    onAddManual: () => void;
    t: any;
}> = React.memo(({ items, onUpdate, onRemove, onAddManual, t }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-800 text-lg">{t.edit_bill}</h3>
            </div>
            
            <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-bold mb-2 px-1">
                <div className="col-span-5">{t.item_name}</div>
                <div className="col-span-2 text-center">{t.quantity}</div>
                <div className="col-span-2">{t.unit}</div>
                <div className="col-span-2 text-center">{t.price}</div>
                <div className="col-span-1"></div>
            </div>

            <div className="space-y-2 mb-4">
                {items.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                            <input 
                                type="text" 
                                value={item.name} 
                                onChange={(e) => onUpdate(idx, 'name', e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded-md text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                                placeholder="Item"
                            />
                        </div>
                        <div className="col-span-2">
                            <input 
                                type="number" 
                                value={item.quantity}
                                onChange={(e) => onUpdate(idx, 'quantity', e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded-md text-sm text-center focus:border-purple-500 outline-none"
                            />
                        </div>
                        <div className="col-span-2">
                            <input 
                                type="text" 
                                value={item.unit}
                                onChange={(e) => onUpdate(idx, 'unit', e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded-md text-sm focus:border-purple-500 outline-none"
                            />
                        </div>
                        <div className="col-span-2">
                            <input 
                                type="number" 
                                value={item.price}
                                onChange={(e) => onUpdate(idx, 'price', e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded-md text-sm text-center focus:border-purple-500 outline-none"
                            />
                        </div>
                        <button onClick={() => onRemove(idx)} className="col-span-1 flex justify-center text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4"/>
                        </button>
                    </div>
                ))}
            </div>

            <button onClick={onAddManual} className="text-purple-600 text-sm font-bold flex items-center gap-1 mb-4 hover:text-purple-700">
                <Plus className="w-4 h-4"/> {t.add_item}
            </button>
        </div>
    );
});

// --- Sub-Component: Customer Header ---
const CustomerHeader: React.FC<{ customer: KhataCustomer; previousDue: number; billTotal: number; t: any }> = ({ customer, previousDue, billTotal, t }) => (
    <>
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-lg font-bold text-gray-800 flex items-center gap-2"><User className="w-5 h-5 text-purple-600"/>{customer.name}</p>
            <p className="text-sm text-gray-600 flex items-center gap-2 mt-2"><Phone className="w-4 h-4 text-gray-500"/>{customer.phone}</p>
            <p className="text-sm text-gray-600 flex items-center gap-2 mt-1"><MapPin className="w-4 h-4 text-gray-500"/>{customer.address}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-xs text-red-800 font-medium">{t.previous_due}</p>
                <p className="text-xl font-bold text-red-600">रू {previousDue.toFixed(2)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                 <p className="text-xs text-blue-800 font-medium">{t.current_bill}</p>
                 <p className="text-xl font-bold text-blue-600">रू {billTotal.toFixed(2)}</p>
            </div>
        </div>
    </>
);

// --- Main Modal Component ---
const KhataDetailModal: React.FC<{
    customer: KhataCustomer | null;
    isOpen: boolean;
    onClose: () => void;
    onShowSuccess: (message: string) => void;
}> = ({ customer, isOpen, onClose, onShowSuccess }) => {
    const { language, inventory, deleteKhataTransaction, handleAddItemsToKhata, handleKhataSettlement } = useKirana();
    const t = translations[language];
    
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [showThankYou, setShowThankYou] = useState(false);
    
    // --- Confirmation Flow State ---
    const [isConfirmed, setIsConfirmed] = useState(false);
    
    // Using Custom Hooks for cleaner logic
    const { items: billItems, addItem, addItems, updateItem, removeItem, clear, total: billTotal } = useBillingState();
    const { isListening, isProcessing, error: voiceError, toggleListening, setError } = useVoiceBilling(language, inventory, addItems);

    // Validation
    const isBillValid = useMemo(() => {
        if (billItems.length === 0) return false;
        return billItems.every(item => item.name && item.name.trim().length > 0 && parseFloat(item.quantity) > 0 && parseFloat(item.price) >= 0);
    }, [billItems]);

    // Calculate real-time total due based on the algorithm (Requirement 1)
    // We do NOT trust the meta. We recalculate.
    const transactionsWithBalance = useMemo(() => {
        if (!customer) return [];

        // 1. Sort Chronologically (Oldest First)
        const sorted = [...customer.transactions].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        let runningBalance = 0;

        // 2. Calculate Running Balance
        const calculated = sorted.map(txn => {
            const previousBalance = runningBalance;
            
            if (txn.type === 'debit') {
                // Sale: Debt Increases
                runningBalance += txn.amount;
            } else {
                // Payment: Debt Decreases
                runningBalance -= txn.amount;
            }

            return {
                ...txn,
                calcPrev: previousBalance,
                calcNew: runningBalance
            };
        });

        // 3. Reverse for Display (Newest First)
        return calculated.reverse();
    }, [customer]);

    const previousDue = transactionsWithBalance.length > 0 ? transactionsWithBalance[0].calcNew : 0;
    const grandTotal = previousDue + billTotal;

    // Logic to determine if "Receive Payment" in footer should be enabled
    const isPaymentEnabled = useMemo(() => {
        if (billItems.length > 0) {
            return isConfirmed;
        }
        return previousDue > 0;
    }, [billItems.length, isConfirmed, previousDue]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            clear();
            setError(null);
            setIsPaymentModalOpen(false);
            setIsConfirmed(false);
            setShowThankYou(false);
        }
    }, [isOpen, clear, setError]);

    // Auto-reset confirmation if user modifies bill after confirming (Safety)
    useEffect(() => {
        if (isConfirmed) setIsConfirmed(false);
    }, [billItems]);

    const handleAddItemsToLedger = () => {
        if (!customer || billItems.length === 0) return;
        const result = handleAddItemsToKhata(customer.id, billItems);
        if(result.success) {
            clear();
            setIsConfirmed(false);
            onShowSuccess(t.save_khata);
        } else {
            setError(result.error || "Failed to add items.");
        }
    };

    const handleConfirmPayment = (amountPaid: number, paymentMethod: 'cash' | 'qr') => {
        if(!customer) return;
        // Pass current calculated grandTotal as override to ensure exact match in history if needed
        const result = handleKhataSettlement(customer.id, billItems, amountPaid, paymentMethod, grandTotal);
        
        if(result.success) {
            setIsPaymentModalOpen(false);
            if (amountPaid >= grandTotal - 0.1) {
                setShowThankYou(true);
            } else {
                onClose();
            }
        } else {
            setError(result.error || "Failed to process payment.");
            setIsPaymentModalOpen(false);
        }
    };
    
    const handleCloseThankYou = () => {
        setShowThankYou(false);
        onClose();
    };

    const handleSafeClose = () => {
        if (billItems.length > 0 && window.confirm(t.confirm_discard_bill)) {
            onClose();
        } else if (billItems.length === 0) {
            onClose();
        }
    };

    if (!isOpen || !customer) return null;

    return (
        <>
             {/* Thank You Modal */}
             {showThankYou && (
                <div className="fixed inset-0 bg-black/80 z-[70] flex justify-center items-center p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center relative overflow-hidden shadow-2xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-blue-50 opacity-50 pointer-events-none" />
                        <div className="relative z-10">
                             <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                                <PartyPopper className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="text-3xl font-black text-gray-800 mb-2">Thank You!</h2>
                            <p className="text-gray-600 mb-8 text-lg">Payment received successfully.</p>
                             <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8">
                                <p className="text-sm text-green-800 font-medium">Remaining Due</p>
                                <p className="text-2xl font-bold text-green-600">Rs. 0</p>
                            </div>
                            <button 
                                onClick={handleCloseThankYou}
                                className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <KhataPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onConfirmPayment={handleConfirmPayment}
                grandTotal={grandTotal}
                todaysBillTotal={billTotal}
                language={language}
                defaultSelection={isConfirmed ? 'today' : 'grand'}
            />
            <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end">
                <div className="bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col h-[95vh] relative">
                     <div className="flex justify-between items-center mb-4 pb-3 border-b">
                        <h2 className="text-xl font-bold">{t.khata_detail_title}</h2>
                        <button onClick={handleSafeClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pb-56">
                        <CustomerHeader customer={customer} previousDue={previousDue} billTotal={billTotal} t={t} />
                        
                        <BillEditor 
                            items={billItems} 
                            onUpdate={updateItem} 
                            onRemove={removeItem} 
                            onAddManual={() => addItem({id: generateId(), name: '', quantity: '1', unit: 'pcs', price: '0'})}
                            t={t}
                        />

                        <div className="flex justify-between items-center border-t pt-3 mb-4">
                            <span className="font-bold text-gray-800 text-lg">Total:</span>
                            <span className="font-extrabold text-purple-600 text-xl">रू {billTotal.toFixed(2)}</span>
                        </div>

                        {/* --- Two-Stage Confirmation UI (Billing Only) --- */}
                        <div className="space-y-3 mb-6">
                            {/* Stage 1: Confirm Bill */}
                            {!isConfirmed && (
                                <button 
                                    onClick={() => setIsConfirmed(true)}
                                    disabled={!isBillValid}
                                    className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-purple-700 transition-all shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Check className="w-5 h-5" />
                                    {t.confirm_bill}
                                </button>
                            )}
                            
                            {isConfirmed && (
                                <p className="text-center text-xs text-gray-500 animate-pulse">
                                    Bill locked. Select "Add to Khata" or "Receive Payment" below to proceed.
                                </p>
                            )}
                        </div>

                        <h3 className="font-bold text-lg mb-2">{t.transaction_history}</h3>
                        <div className="space-y-2">
                            {/* Bank Statement Style Transaction List */}
                            {transactionsWithBalance.map(txn => {
                                const isPayment = txn.type === 'credit';

                                return (
                                    <div key={txn.id} className="group p-3 rounded-xl flex justify-between items-start bg-white border border-gray-100 mb-2 shadow-sm hover:shadow-md transition-all">
                                        {/* Left Side: Context */}
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isPayment ? 'bg-green-100' : 'bg-red-50'}`}>
                                                 {isPayment ? <ArrowDown className="w-4 h-4 text-green-600" /> : <ArrowUp className="w-4 h-4 text-red-500" />}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2">
                                                    {txn.description || (isPayment ? t.payment_received_desc : 'Goods Purchased')}
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-medium mt-1">
                                                    {formatDateTime(txn.date, language)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right Side: Financials */}
                                        <div className="flex items-start gap-2 pl-2">
                                            <div className="text-right whitespace-nowrap">
                                                <p className={`font-bold text-sm ${isPayment ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isPayment ? '-' : '+'} रू {txn.amount.toFixed(0)}
                                                </p>
                                                <p className="text-[11px] font-bold text-gray-400 mt-0.5">
                                                    Bal: {txn.calcNew.toFixed(0)}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); if (window.confirm(t.confirm_delete_txn_desc)) deleteKhataTransaction(customer.id, txn.id); }} 
                                                className="text-gray-300 hover:text-red-500 p-1 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Voice FAB */}
                    <button 
                        onClick={toggleListening}
                        className={`absolute bottom-24 right-6 p-4 rounded-full shadow-xl transition-transform hover:scale-105 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-br from-purple-600 to-indigo-600'} text-white z-20`}
                    >
                        {isProcessing ? <Loader className="w-6 h-6 animate-spin"/> : <Mic className="w-6 h-6"/>}
                    </button>

                    {voiceError && (
                        <div className="absolute bottom-56 left-4 right-4 bg-red-100 border-red-500 text-red-700 p-2 rounded-lg text-sm z-10" role="alert">
                            <p>{voiceError}</p>
                        </div>
                    )}
                    
                    {/* Static Footer for Total and Payment */}
                    <div className="absolute bottom-0 left-0 right-0 bg-white p-4 border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] rounded-t-xl z-10">
                        <div className="flex flex-col gap-3">
                            {/* Total Row */}
                            <div className="flex justify-between items-end">
                                 <div>
                                    <span className="text-xs text-gray-500 uppercase font-bold block">{t.grand_total}</span>
                                    <div className="flex items-center gap-2">
                                        <p className="text-2xl font-extrabold text-gray-800">रू {grandTotal.toFixed(2)}</p>
                                        {isConfirmed && <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-xs font-bold">Locked</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons Row */}
                            <div className="flex gap-3">
                                {isConfirmed && (
                                    <button 
                                        onClick={handleAddItemsToLedger}
                                        className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <BookPlus className="w-5 h-5" />
                                        {t.add_to_khata}
                                    </button>
                                )}
                                
                                <button 
                                    onClick={() => setIsPaymentModalOpen(true)}
                                    disabled={!isPaymentEnabled}
                                    className={`bg-blue-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isConfirmed ? 'flex-1' : 'w-full'}`}
                                >
                                    <Coins className="w-5 h-5" />
                                    {t.receive_payment}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- KhataListView: Stable WhatsApp Style Selection ---
const KhataListView: React.FC<{
    onSelectCustomer: (customer: KhataCustomer) => void;
    onOpenSelectKhata: () => void;
    onToggleSelection: (customerId: string) => void;
    selectedIds: Set<string>;
    isSelectionMode: boolean;
}> = React.memo(({ onSelectCustomer, onOpenSelectKhata, onToggleSelection, selectedIds, isSelectionMode }) => {
    const { language, khataCustomers } = useKirana();
    const t = translations[language];
    
    // Stable Long Press Logic
    const longPressTimer = useRef<any>(null);
    const isLongPressActive = useRef(false);

    const handleTouchStart = (customerId: string) => {
        if (isSelectionMode) return;
        isLongPressActive.current = false;
        longPressTimer.current = setTimeout(() => {
            isLongPressActive.current = true;
            if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
            onToggleSelection(customerId);
        }, 500);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleClick = (customer: KhataCustomer) => {
        if (isLongPressActive.current) {
            isLongPressActive.current = false;
            return; // Prevent ghost clicks after long press
        }
        
        if (isSelectionMode) {
            onToggleSelection(customer.id);
        } else {
            onSelectCustomer(customer);
        }
    };

    const customersWithBalance = useMemo(() => {
        return khataCustomers.map(customer => {
            const balance = customer.transactions.reduce((acc, txn) => {
                return txn.type === 'debit' ? acc + txn.amount : acc - txn.amount;
            }, 0);
            return { ...customer, balance };
        });
    }, [khataCustomers]);
    
    return (
        <div className="relative pb-20">
            {customersWithBalance.length === 0 ? (
                 <div className="text-center p-16 text-gray-500 bg-white rounded-xl shadow-sm">
                    <p>{t.no_khatas}</p>
                </div>
            ) : (
                <div className="space-y-3 select-none">
                    {customersWithBalance.map(customer => {
                        const isSelected = selectedIds.has(customer.id);
                        const isAdvance = customer.balance < 0;
                        const isSettled = customer.balance === 0;

                        return (
                         <div 
                            key={customer.id} 
                            onMouseDown={() => handleTouchStart(customer.id)}
                            onMouseUp={handleTouchEnd}
                            onMouseLeave={handleTouchEnd}
                            onTouchStart={() => handleTouchStart(customer.id)}
                            onTouchEnd={handleTouchEnd}
                            onTouchMove={handleTouchEnd} // Cancel long press on scroll
                            onClick={() => handleClick(customer)} 
                            className={`rounded-xl p-4 shadow-sm flex items-center justify-between cursor-pointer transition-all duration-200 ${
                                isSelected ? 'bg-purple-100 border-2 border-purple-500 transform scale-[0.98]' : 'bg-white hover:bg-gray-50 border-2 border-transparent'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                {isSelected ? (
                                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white animate-in zoom-in duration-200">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                                        {customer.name.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <p className="font-bold text-gray-800">{customer.name}</p>
                                    <p className="text-sm text-gray-500">{customer.address}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`font-bold ${isSettled ? 'text-green-600' : (isAdvance ? 'text-blue-600' : 'text-red-600')}`}>
                                    रू {Math.abs(customer.balance).toFixed(2)}
                                </p>
                                <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${isSettled ? 'bg-green-100 text-green-700' : (isAdvance ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700')}`}>
                                    {isSettled ? t.settled : (isAdvance ? t.advance : t.due)}
                                </div>
                            </div>
                        </div>
                        )
                    })}
                </div>
            )}
            
            {!isSelectionMode && (
                <button
                    onClick={onOpenSelectKhata}
                    className="fixed bottom-24 right-6 bg-purple-600 text-white rounded-full p-4 shadow-lg hover:bg-purple-700 transition-transform hover:scale-110"
                    aria-label={t.add_new_khata}
                >
                    <UserPlus className="w-6 h-6" />
                </button>
            )}
        </div>
    );
});

interface KarobarTabProps {
    onOpenCreateKhata: () => void;
}

const KarobarTab: React.FC<KarobarTabProps> = ({ onOpenCreateKhata }) => {
    const { language, khataCustomers, setKhataCustomers } = useKirana();
    const [selectedCustomer, setSelectedCustomer] = useState<KhataCustomer | null>(null);
    const [isSelectingKhata, setIsSelectingKhata] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    
    // Selection State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    const t = translations[language];
    
    useEffect(() => {
        if(successMessage) {
            const timer = setTimeout(() => setSuccessMessage(''), 4000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            
            if (newSet.size === 0) setIsSelectionMode(false);
            else setIsSelectionMode(true);
            
            return newSet;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    }, []);

    const handleBulkDelete = () => {
        const customersToDelete = khataCustomers.filter(c => selectedIds.has(c.id));
        
        let totalDebt = 0;
        customersToDelete.forEach(c => {
             const balance = c.transactions.reduce((acc, txn) => {
                return txn.type === 'debit' ? acc + txn.amount : acc - txn.amount;
            }, 0);
            if (balance > 0) totalDebt += balance;
        });

        const warningMsg = totalDebt > 0 
            ? t.delete_customer_warning.replace('{amount}', totalDebt.toFixed(2))
            : t.confirm_delete_txn_desc;

        if (window.confirm(warningMsg)) {
             setKhataCustomers(prev => prev.filter(c => !selectedIds.has(c.id)));
             clearSelection();
             setSuccessMessage("Customers deleted successfully");
        }
    };

    const currentlySelectedCustomer = useMemo(() => {
        return selectedCustomer ? khataCustomers.find(c => c.id === selectedCustomer.id) || null : null;
    }, [khataCustomers, selectedCustomer]);

    return (
        <div className="space-y-6">
            {successMessage && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 max-w-md w-full px-4 z-[100]">
                    <div className="bg-green-600 text-white text-sm font-semibold px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
                         <CheckCircle className="w-5 h-5"/>
                        {successMessage}
                    </div>
                </div>
            )}
            
            <SelectKhataScreen
                isOpen={isSelectingKhata}
                onClose={() => setIsSelectingKhata(false)}
                customers={khataCustomers}
                onSelectCustomer={(c) => { setIsSelectingKhata(false); setSelectedCustomer(c); }}
                onAddNew={() => { setIsSelectingKhata(false); onOpenCreateKhata(); }}
                language={language}
            />
            
            <KhataDetailModal
                isOpen={!!selectedCustomer}
                onClose={() => setSelectedCustomer(null)}
                customer={currentlySelectedCustomer}
                onShowSuccess={setSuccessMessage}
            />
            
            <header className={`flex items-center justify-between h-14 transition-colors duration-300 ${isSelectionMode ? 'bg-purple-600 text-white -mx-4 px-4 rounded-b-xl shadow-md sticky top-0 z-40' : ''}`}>
                {isSelectionMode ? (
                    <>
                        <div className="flex items-center gap-3">
                            <button onClick={clearSelection}><X className="w-6 h-6" /></button>
                            <span className="font-bold text-lg">{selectedIds.size} {t.selected}</span>
                        </div>
                        <button onClick={handleBulkDelete} className="p-2 hover:bg-purple-700 rounded-full">
                            <Trash2 className="w-6 h-6" />
                        </button>
                    </>
                ) : (
                    <h1 className="text-2xl font-bold text-gray-800">{t.karobar_tab}</h1>
                )}
            </header>
            
            <KhataListView 
                onSelectCustomer={setSelectedCustomer}
                onOpenSelectKhata={() => setIsSelectingKhata(true)}
                onToggleSelection={toggleSelection}
                selectedIds={selectedIds}
                isSelectionMode={isSelectionMode}
            />
        </div>
    );
};

export default KarobarTab;