import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, AlertCircle, X, User, Phone, MapPin, Hash, UserPlus, Mic, Loader, Trash2, Square } from 'lucide-react';
import { translations } from '../translations';
import { INITIAL_LOW_STOCK_ITEMS, INITIAL_KHATA_CUSTOMERS } from '../constants';
import type { LowStockItem, KhataCustomer, KhataTransaction, EditableBillItem } from '../types';
import { parseBillingFromVoice } from '../services/geminiService';

const generateId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

interface KarobarTabProps {
    language: 'ne' | 'en';
    addTransaction: (name: string, amount: number) => void;
}

interface ToggleOption {
    label: string;
    value: string;
}

const ToggleSwitch: React.FC<{ options: ToggleOption[]; value: string; onChange: (value: string) => void; }> = ({ options, value, onChange }) => {
    const activeIndex = options.findIndex(opt => opt.value === value);

    return (
        <div className="relative flex w-full p-1 bg-gray-200 rounded-full">
            {/* Sliding background */}
            <div
                className="absolute top-1 bottom-1 w-1/2 bg-purple-600 rounded-full shadow-md transition-transform duration-300 ease-out"
                style={{
                    transform: `translateX(${activeIndex * 100}%)`,
                }}
            />

            {/* Buttons */}
            {options.map((option, index) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`relative z-10 flex-1 py-2 text-center text-sm font-semibold transition-colors duration-300 rounded-full ${
                        activeIndex === index ? 'text-white' : 'text-gray-600'
                    }`}
                    aria-pressed={activeIndex === index}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};

// --- CreateKhataModal ---
const CreateKhataModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (customer: Omit<KhataCustomer, 'id' | 'transactions'>) => void;
    language: 'ne' | 'en';
}> = ({ isOpen, onClose, onSave, language }) => {
    const t = translations[language];
    const [customer, setCustomer] = useState({ name: '', phone: '', address: '', pan: '', citizenship: '' });

    if (!isOpen) return null;

    const handleSave = () => {
        if (customer.name && customer.phone && customer.address) {
            onSave(customer);
            setCustomer({ name: '', phone: '', address: '', pan: '', citizenship: '' });
            onClose();
        } else {
            alert(language === 'ne' ? 'कृपया पूरा नाम, फोन नम्बर, र ठेगाना भर्नुहोस्।' : 'Please fill in Full Name, Phone Number, and Address.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end">
            <div className="bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col h-[90vh]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{t.create_khata_title}</h2>
                    <button onClick={onClose}><X /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-600">{t.full_name}</label>
                        <input type="text" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} className="w-full mt-1 p-2 border rounded-md" required />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600">{t.whatsapp_phone}</label>
                        <input type="tel" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} className="w-full mt-1 p-2 border rounded-md" required />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600">{t.address}</label>
                        <input type="text" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} className="w-full mt-1 p-2 border rounded-md" required />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600">{t.pan_number}</label>
                        <input type="text" value={customer.pan} onChange={e => setCustomer({ ...customer, pan: e.target.value })} className="w-full mt-1 p-2 border rounded-md" />
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-600">{t.citizenship_number}</label>
                        <input type="text" value={customer.citizenship} onChange={e => setCustomer({ ...customer, citizenship: e.target.value })} className="w-full mt-1 p-2 border rounded-md" />
                    </div>
                </div>
                <button onClick={handleSave} className="w-full mt-4 bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors">
                    {t.save_khata}
                </button>
            </div>
        </div>
    );
};


// --- KhataDetailModal ---
const KhataDetailModal: React.FC<{
    customer: KhataCustomer | null;
    isOpen: boolean;
    onClose: () => void;
    language: 'ne' | 'en';
    onAddTransaction: (customerId: string, transaction: Omit<KhataTransaction, 'id' | 'date'>) => void;
    addTransaction: (name: string, amount: number) => void;
}> = ({ customer, isOpen, onClose, language, onAddTransaction, addTransaction }) => {
    const t = translations[language];
    
    // Voice to Bill State
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [billItems, setBillItems] = useState<EditableBillItem[]>([]);

    const currentBalance = useMemo(() => {
        if (!customer) return 0;
        return customer.transactions.reduce((balance, txn) => {
            return txn.type === 'debit' ? balance + txn.amount : balance - txn.amount;
        }, 0);
    }, [customer]);
    
    // Reset bill state when modal opens or customer changes
    useEffect(() => {
        if (isOpen) {
            setBillItems([]);
            setApiError(null);
            setIsListening(false);
            setIsProcessing(false);
        } else {
             if (recognition) {
                recognition.stop();
            }
        }
    }, [isOpen]);
    
    if (recognition) {
        recognition.continuous = true;
        recognition.lang = language === 'ne' ? 'ne-NP' : 'en-US';
        recognition.interimResults = true;
    }

    const processVoiceCommand = useCallback(async (transcript: string) => {
        if (!transcript) return;
        setIsProcessing(true);
        setApiError(null);
        try {
            const result = await parseBillingFromVoice(transcript, language);
            const newEditableItems: EditableBillItem[] = result.items.map(item => ({
                id: generateId(),
                name: item.name || '',
                quantity: String(item.quantity || 1),
                unit: item.unit || '',
                price: String(item.price || 0),
            }));
            // CRITICAL FIX: Append new items to the existing list, don't overwrite.
            setBillItems(prevItems => [...prevItems, ...newEditableItems]);
        } catch (error) {
            setApiError(error instanceof Error ? error.message : "An unknown error occurred.");
        } finally {
            setIsProcessing(false);
        }
    }, [language]);

    useEffect(() => {
        if (!recognition || !isOpen) return;

        recognition.onresult = (event: any) => {
            let final_transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                }
            }
            if (final_transcript.trim()) {
                processVoiceCommand(final_transcript.trim());
            }
        };

        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        // Cleanup function to remove listeners
        return () => {
            if (recognition) {
                recognition.onresult = null;
                recognition.onend = null;
                recognition.onerror = null;
            }
        };
    }, [processVoiceCommand, isOpen]);

    const handleListen = () => {
        if (!recognition) {
            alert("Speech recognition is not supported in your browser.");
            return;
        }
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
            setIsListening(true);
        }
    };

    const handleItemChange = (index: number, field: keyof Omit<EditableBillItem, 'id'>, value: string) => {
        const updatedItems = [...billItems];
        updatedItems[index] = { ...updatedItems[index], [field]: value };
        setBillItems(updatedItems);
    };

    const handleRemoveItem = (id: string) => {
        setBillItems(billItems.filter(item => item.id !== id));
    };

    const totalBillAmount = useMemo(() => {
        return billItems.reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            const quantity = parseFloat(item.quantity) || 0;
            return sum + (price * quantity);
        }, 0);
    }, [billItems]);

    const confirmBill = () => {
        if (billItems.length === 0 || !customer) return;

        const description = billItems.map(item => `${item.name} (${item.quantity} ${item.unit})`).join(', ');

        onAddTransaction(customer.id, { description, amount: totalBillAmount, type: 'debit' });
        addTransaction(customer.name, totalBillAmount);
        
        setBillItems([]);
    };
    
    if (!isOpen || !customer) return null;

    const formatDateTime = (dateString: string) => {
        const options: Intl.DateTimeFormatOptions = {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        };
        return new Date(dateString).toLocaleString(language === 'ne' ? 'ne-NP' : 'en-US', options);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end">
            <div className="bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col h-[90vh] relative">
                 <div className="flex justify-between items-center mb-4 pb-3 border-b">
                    <h2 className="text-xl font-bold">{t.khata_detail_title}</h2>
                    <button onClick={onClose}><X /></button>
                </div>
                <div className="flex-1 overflow-y-auto pb-24">
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <p className="text-lg font-bold text-gray-800 flex items-center gap-2"><User className="w-5 h-5 text-purple-600"/>{customer.name}</p>
                        <p className="text-sm text-gray-600 flex items-center gap-2 mt-2"><Phone className="w-4 h-4 text-gray-500"/>{customer.phone}</p>
                        <p className="text-sm text-gray-600 flex items-center gap-2 mt-1"><MapPin className="w-4 h-4 text-gray-500"/>{customer.address}</p>
                        {customer.pan && <p className="text-sm text-gray-600 flex items-center gap-2 mt-1"><Hash className="w-4 h-4 text-gray-500"/>PAN: {customer.pan}</p>}
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 text-center">
                        <p className="text-sm text-purple-800 font-medium">{t.current_balance}</p>
                        <p className="text-3xl font-extrabold text-purple-700">रु. {currentBalance.toFixed(2)}</p>
                    </div>

                    <h3 className="font-bold text-lg mb-2">{t.transaction_history}</h3>
                    <div className="space-y-2">
                        {customer.transactions.slice().reverse().map(txn => (
                             <div key={txn.id} className={`p-3 rounded-lg flex justify-between items-center ${txn.type === 'debit' ? 'bg-red-50' : 'bg-green-50'}`}>
                                <div>
                                    <p className="font-medium text-gray-800 text-sm">{txn.description}</p>
                                    <p className="text-xs text-gray-500">{formatDateTime(txn.date)}</p>
                                </div>
                                <p className={`font-bold text-sm ${txn.type === 'debit' ? 'text-red-600' : 'text-green-700'}`}>
                                    {txn.type === 'debit' ? '+' : '-'} रु. {txn.amount.toFixed(2)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
                
                 {billItems.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white p-4 border-t-2 border-purple-200 shadow-lg rounded-t-xl">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-lg text-gray-800">{t.edit_bill}</h3>
                            <button onClick={() => setBillItems([])} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {billItems.map((item, idx) => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                                    <input type="text" value={item.name} onChange={(e) => handleItemChange(idx, 'name', e.target.value)} className="col-span-5 p-2 border rounded-md text-sm" />
                                    <input type="text" inputMode="decimal" value={item.quantity} onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} className="col-span-2 p-2 border rounded-md text-sm text-center" />
                                    <input type="text" value={item.unit} onChange={(e) => handleItemChange(idx, 'unit', e.target.value)} className="col-span-2 p-2 border rounded-md text-sm" />
                                    <input type="text" inputMode="decimal" value={item.price} onChange={(e) => handleItemChange(idx, 'price', e.target.value)} className="col-span-2 p-2 border rounded-md text-sm text-center" />
                                    <button onClick={() => handleRemoveItem(item.id)} className="col-span-1 flex justify-center items-center text-red-400 hover:text-red-600">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="border-t mt-3 pt-3 flex justify-between items-center">
                            <span className="text-gray-800 font-bold text-lg">{t.total}</span>
                            <span className="text-purple-600 font-extrabold text-xl">रु. {totalBillAmount.toFixed(2)}</span>
                        </div>
                        <button onClick={confirmBill} className="w-full mt-3 bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors">
                            {t.save_transaction}
                        </button>
                    </div>
                )}
                
                {apiError && (
                    <div className="absolute bottom-24 bg-red-100 border-red-500 text-red-700 p-2 rounded-lg mx-4 text-sm" role="alert">
                        <p>{apiError}</p>
                    </div>
                )}

                {isListening && (
                    <div className="absolute bottom-44 right-6 bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 shadow-lg">
                        {t.listening_hint}
                    </div>
                )}
                
                <button
                    onClick={handleListen}
                    disabled={isProcessing}
                    className={`absolute bottom-24 right-6 rounded-full p-4 shadow-lg transition-all transform hover:scale-105 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed ${
                        isListening ? 'bg-red-500 animate-pulse' : 'bg-purple-600'
                    }`}
                    aria-label={isListening ? t.stop_listening : t.add_transaction_voice}
                >
                    {isProcessing ? (
                        <Loader className="w-6 h-6 text-white animate-spin" />
                    ) : isListening ? (
                        <Square className="w-6 h-6 text-white" />
                    ) : (
                        <Mic className="w-6 h-6 text-white" />
                    )}
                </button>
            </div>
        </div>
    );
};

// --- KhataListView ---
const KhataListView: React.FC<{
    language: 'ne' | 'en';
    customers: KhataCustomer[];
    onSelectCustomer: (customer: KhataCustomer) => void;
    onAddNewCustomer: (customer: Omit<KhataCustomer, 'id' | 'transactions'>) => void;
}> = ({ language, customers, onSelectCustomer, onAddNewCustomer }) => {
    const t = translations[language];
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);

    const calculateBalance = (customer: KhataCustomer) => {
        return customer.transactions.reduce((balance, txn) => {
            return txn.type === 'debit' ? balance + txn.amount : balance - txn.amount;
        }, 0);
    };
    
    return (
        <div className="relative pb-20">
            <CreateKhataModal 
                isOpen={isCreateModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSave={onAddNewCustomer}
                language={language}
            />

            {customers.length === 0 ? (
                 <div className="text-center p-16 text-gray-500 bg-white rounded-xl shadow-sm">
                    <p>{t.no_khatas}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {customers.map(customer => {
                        const balance = calculateBalance(customer);
                        return (
                             <div key={customer.id} onClick={() => onSelectCustomer(customer)} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors">
                                <div>
                                    <p className="font-bold text-gray-800">{customer.name}</p>
                                    <p className="text-sm text-gray-500">{customer.address}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>रु. {balance.toFixed(2)}</p>
                                    <p className="text-xs text-gray-500">{balance > 0 ? t.due : t.paid}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
            
            <button
                onClick={() => setCreateModalOpen(true)}
                className="fixed bottom-24 right-6 bg-purple-600 text-white rounded-full p-4 shadow-lg hover:bg-purple-700 transition-transform hover:scale-105"
                aria-label={t.add_new_khata}
            >
                <UserPlus className="w-6 h-6" />
            </button>
        </div>
    );
};


const KarobarTab: React.FC<KarobarTabProps> = ({ language, addTransaction }) => {
    const [activeView, setActiveView] = useState('khata');
    const t = translations[language];
    
    const [khataCustomers, setKhataCustomers] = useState<KhataCustomer[]>(INITIAL_KHATA_CUSTOMERS);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<KhataCustomer | null>(null);

    const toggleOptions = [
        { label: t.khata_view, value: 'khata' },
        { label: t.low_stocks_view, value: 'low_stocks' }
    ];

    const handleSelectCustomer = (customer: KhataCustomer) => {
        setSelectedCustomer(customer);
        setDetailModalOpen(true);
    };

    const handleAddNewCustomer = (customerData: Omit<KhataCustomer, 'id' | 'transactions'>) => {
        const newCustomer: KhataCustomer = {
            id: `khata-${Date.now()}`,
            transactions: [],
            ...customerData
        };
        setKhataCustomers(prev => [newCustomer, ...prev]);
    };
    
    const handleAddTransaction = (customerId: string, transactionData: Omit<KhataTransaction, 'id' | 'date'>) => {
        const newTransaction: KhataTransaction = {
            id: `txn-${Date.now()}`,
            date: new Date().toISOString(),
            ...transactionData
        };
        
        // CRITICAL FIX: Ensure new transactions are appended, not overwriting.
        const updatedCustomers = khataCustomers.map(cust => {
            if (cust.id === customerId) {
                const updatedTransactions = [...cust.transactions, newTransaction];
                return { ...cust, transactions: updatedTransactions };
            }
            return cust;
        });
        setKhataCustomers(updatedCustomers);

        // Also update the currently selected customer in state to instantly reflect changes in the modal
        setSelectedCustomer(prev => {
            if(prev && prev.id === customerId) {
                return {...prev, transactions: [...prev.transactions, newTransaction]}
            }
            return prev
        });
    };


    return (
        <div className="space-y-6">
            <KhataDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                customer={selectedCustomer}
                language={language}
                onAddTransaction={handleAddTransaction}
                addTransaction={addTransaction}
            />
            <h1 className="text-2xl font-bold text-gray-800">{t.billing_tab}</h1>
            <ToggleSwitch options={toggleOptions} value={activeView} onChange={setActiveView} />

            {activeView === 'khata' && (
                <KhataListView 
                    language={language}
                    customers={khataCustomers}
                    onSelectCustomer={handleSelectCustomer}
                    onAddNewCustomer={handleAddNewCustomer}
                />
            )}

            {activeView === 'low_stocks' && (
                 <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            {t.low_stock_alert}
                        </h3>
                        <button className="text-sm text-purple-600 font-medium">{t.view_all}</button>
                    </div>
                    <div className="space-y-3">
                        {INITIAL_LOW_STOCK_ITEMS.map((item: LowStockItem, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <p className="text-sm font-medium text-gray-800">{item.name}</p>
                                <p className="text-xs text-red-600">{t.remaining} {item.stock} {item.unit}</p>
                            </div>
                            <button className="px-3 py-1 bg-purple-500 text-white text-xs rounded-lg font-medium flex items-center gap-1">
                                <Plus className="w-3 h-3" />
                                {t.order}
                            </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default KarobarTab;