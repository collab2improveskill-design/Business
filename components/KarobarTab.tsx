
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Plus, X, User, Phone, MapPin, UserPlus, Mic, Loader, Trash2, ShoppingCart, CheckCircle } from 'lucide-react';
import { translations } from '../translations';
import type { KhataCustomer, EditableBillItem } from '../types';
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
                recognitionRef.current.start();
                setIsListening(true);
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
    
    // Using Custom Hooks for cleaner logic
    const { items: billItems, addItem, addItems, updateItem, removeItem, clear, total: billTotal } = useBillingState();
    const { isListening, isProcessing, error: voiceError, toggleListening, setError } = useVoiceBilling(language, inventory, addItems);

    const previousDue = useMemo(() => {
        if (!customer) return 0;
        return customer.transactions.reduce((balance, txn) => {
            return txn.type === 'debit' ? balance + txn.amount : balance - txn.amount;
        }, 0);
    }, [customer]);

    const grandTotal = previousDue + billTotal;

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            clear();
            setError(null);
            setIsPaymentModalOpen(false);
        }
    }, [isOpen, clear, setError]);

    const handleAddItemsToLedger = () => {
        if (!customer || billItems.length === 0) return;
        const result = handleAddItemsToKhata(customer.id, billItems);
        if(result.success) {
            clear();
        } else {
            setError(result.error || "Failed to add items.");
        }
    };

    const handleQuickCash = () => {
        if (!customer || grandTotal <= 0) return;
        if (window.confirm(t.confirm_quick_cash.replace('{amount}', grandTotal.toFixed(2)))) {
            const result = handleKhataSettlement(customer.id, billItems, grandTotal, 'cash');
            if (result.success) {
                onShowSuccess(t.quick_cash_success.replace('{amount}', grandTotal.toFixed(2)).replace('{name}', customer.name));
                onClose(); 
            } else {
                setError(result.error || "Failed to process quick cash.");
            }
        }
    };

    const handleConfirmPayment = (amountPaid: number, paymentMethod: 'cash' | 'qr') => {
        if(!customer) return;
        const result = handleKhataSettlement(customer.id, billItems, amountPaid, paymentMethod);
        if(result.success) {
            setIsPaymentModalOpen(false);
            onClose();
        } else {
            setError(result.error || "Failed to process payment.");
            setIsPaymentModalOpen(false);
        }
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
            <KhataPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onConfirmPayment={handleConfirmPayment}
                grandTotal={grandTotal}
                todaysBillTotal={billTotal}
                language={language}
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

                        <button 
                            onClick={handleAddItemsToLedger}
                            disabled={billItems.length === 0}
                            className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-purple-700 transition-colors shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed mb-6"
                        >
                            {t.confirm_bill}
                        </button>

                        <h3 className="font-bold text-lg mb-2">{t.transaction_history}</h3>
                        <div className="space-y-2">
                            {/* Robust Sorting: Newest First */}
                            {customer.transactions.slice().sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(txn => (
                                 <div key={txn.id} className={`group p-3 rounded-lg flex justify-between items-center ${txn.type === 'debit' ? 'bg-red-50' : 'bg-green-50'}`}>
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">{txn.description}</p>
                                        <p className="text-xs text-gray-500">{formatDateTime(txn.date, language)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className={`font-bold text-sm ${txn.type === 'debit' ? 'text-red-600' : 'text-green-700'}`}>
                                            {txn.type === 'debit' ? '+' : '-'} रू {txn.amount.toFixed(2)}
                                        </p>
                                        <button 
                                            onClick={() => { if (window.confirm(t.confirm_delete_txn_desc)) deleteKhataTransaction(customer.id, txn.id); }} 
                                            className="text-gray-400 hover:text-red-600 p-3 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
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
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-white p-4 border-t-2 shadow-lg rounded-t-xl z-10">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-lg font-bold text-gray-800">{t.grand_total}</span>
                            <span className="text-2xl font-extrabold text-purple-600">रू {grandTotal.toFixed(2)}</span>
                        </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setIsPaymentModalOpen(true)}
                                disabled={grandTotal <= 0}
                                className="col-span-1 w-full py-3 rounded-lg text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:bg-gray-300"
                            >
                                {t.receive_payment}
                            </button>
                             <button 
                                onClick={handleQuickCash}
                                disabled={grandTotal <= 0}
                                className="col-span-1 w-full py-3 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:bg-gray-300"
                            >
                                {t.quick_cash}
                            </button>
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
                                <p className={`font-bold ${customer.balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                                    रू {customer.balance.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-500">{customer.balance > 0 ? t.due : t.paid}</p>
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
