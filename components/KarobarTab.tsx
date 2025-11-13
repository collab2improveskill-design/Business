import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, AlertCircle, X, User, Phone, MapPin, Hash, UserPlus, Mic, Loader, Check, Trash2 } from 'lucide-react';
import { translations } from '../translations';
import { INITIAL_LOW_STOCK_ITEMS, INITIAL_KHATA_CUSTOMERS } from '../constants';
import type { LowStockItem, KhataCustomer, KhataTransaction, EditableBillItem } from '../types';
import { parseBillingFromVoice } from '../services/geminiService';


interface KarobarTabProps {
    language: 'ne' | 'en';
}

interface ToggleOption {
    label: string;
    value: string;
}

const generateId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const ToggleSwitch: React.FC<{ options: ToggleOption[]; value: string; onChange: (value: string) => void; }> = ({ options, value, onChange }) => {
    const activeIndex = options.findIndex(opt => opt.value === value);

    return (
        <div className="relative flex w-full p-1 bg-black rounded-full border border-gray-700">
            {/* Sliding background */}
            <div
                className="absolute top-1 bottom-1 w-1/2 bg-slate-700 rounded-full shadow-inner transition-transform duration-300 ease-out"
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
                        activeIndex === index ? 'text-white' : 'text-gray-400'
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
}> = ({ customer, isOpen, onClose, language, onAddTransaction }) => {
    const t = translations[language];

    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [billItems, setBillItems] = useState<EditableBillItem[]>([]);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = useMemo(() => SpeechRecognition ? new SpeechRecognition() : null, [SpeechRecognition]);

    const currentBalance = useMemo(() => {
        if (!customer) return 0;
        return customer.transactions.reduce((balance, txn) => {
            return txn.type === 'debit' ? balance + txn.amount : balance - txn.amount;
        }, 0);
    }, [customer]);

    const processVoiceCommand = useCallback(async (transcript: string) => {
        if (!transcript || !customer) return;
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
            setBillItems(newEditableItems);
        } catch (error) {
            setApiError(error instanceof Error ? error.message : "An unknown error occurred.");
            setTimeout(() => setApiError(null), 3000);
        } finally {
            setIsProcessing(false);
        }
    }, [language, customer]);

    const handleListen = () => {
        if (!recognition) {
            alert("Speech recognition is not supported in your browser.");
            return;
        }
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    };
    
    useEffect(() => {
        if (!recognition) return;
        recognition.lang = language === 'ne' ? 'ne-NP' : 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
            const final_transcript = event.results[0][0].transcript;
            if (final_transcript.trim()) {
                processVoiceCommand(final_transcript.trim());
            }
        };

        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };
    }, [recognition, language, processVoiceCommand]);

    useEffect(() => {
        if (!isOpen) {
            setBillItems([]);
            setApiError(null);
            if (recognition && isListening) {
              recognition.stop();
            }
            setIsListening(false);
            setIsProcessing(false);
        }
    }, [isOpen, recognition, isListening]);
    
    if (!isOpen || !customer) return null;

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString(language === 'ne' ? 'ne-NP' : 'en-US');
    
    const totalBillAmount = useMemo(() => {
        return billItems.reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            const quantity = parseFloat(item.quantity) || 0;
            return sum + (price * quantity);
        }, 0);
    }, [billItems]);

    const handleItemChange = (index: number, field: keyof Omit<EditableBillItem, 'id'>, value: string) => {
        const updatedItems = [...billItems];
        updatedItems[index] = { ...updatedItems[index], [field]: value };
        setBillItems(updatedItems);
    };

    const handleRemoveItem = (id: string) => {
        setBillItems(billItems.filter(item => item.id !== id));
    };

    const handleAddItem = () => {
        setBillItems([...billItems, { id: generateId(), name: '', quantity: '1', unit: '', price: '0' }]);
    };
    
    const handleSaveTransaction = () => {
        if (billItems.length === 0) return;

        const description = billItems
            .map(item => `${item.name} (${item.quantity} ${item.unit})`)
            .join(', ');

        onAddTransaction(customer.id, {
            description: description,
            amount: totalBillAmount,
            type: 'debit',
        });
        setBillItems([]);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end">
            <div className="bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col h-[90vh] relative">
                 <div className="flex justify-between items-center mb-4 pb-3 border-b">
                    <h2 className="text-xl font-bold">{t.khata_detail_title}</h2>
                    <button onClick={onClose}><X /></button>
                </div>
                <div className={`flex-1 overflow-y-auto transition-all duration-300 ${billItems.length > 0 ? 'pb-80' : 'pb-24'}`}>
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
                                    <p className="text-xs text-gray-500">{formatDate(txn.date)}</p>
                                </div>
                                <p className={`font-bold text-sm ${txn.type === 'debit' ? 'text-red-600' : 'text-green-700'}`}>
                                    {txn.type === 'debit' ? '+' : '-'} रु. {txn.amount.toFixed(2)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {billItems.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white p-4 border-t-2 border-purple-200 shadow-lg rounded-t-xl max-h-[50vh] flex flex-col">
                         <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-lg text-gray-800">{t.edit_bill}</h3>
                            <button onClick={() => setBillItems([])} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-500 px-2 sticky top-0 bg-white py-1">
                                <div className="col-span-5">{t.item_name}</div>
                                <div className="col-span-2 text-center">{t.quantity}</div>
                                <div className="col-span-2">{t.unit}</div>
                                <div className="col-span-2 text-center">{t.price}</div>
                                <div className="col-span-1"></div>
                            </div>
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
                        <button onClick={handleAddItem} className="mt-2 text-sm font-medium text-purple-600 flex items-center gap-1">
                            <Plus className="w-4 h-4"/> {t.add_item}
                        </button>
                        <div className="border-t mt-3 pt-3 flex justify-between items-center">
                            <span className="text-gray-800 font-bold text-lg">{t.total}</span>
                            <span className="text-purple-600 font-extrabold text-xl">रु. {totalBillAmount.toFixed(2)}</span>
                        </div>
                        <button onClick={handleSaveTransaction} className="w-full mt-3 bg-purple-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2">
                             <Check className="w-5 h-5" /> {t.save_transaction}
                        </button>
                    </div>
                )}
                
                {apiError && <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm">{apiError}</div>}
                
                <button
                    onClick={handleListen}
                    disabled={isProcessing || billItems.length > 0}
                    className={`absolute bottom-24 right-6 text-white rounded-full p-4 shadow-lg transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center
                    ${isListening ? 'bg-red-500 animate-pulse' : isProcessing ? 'bg-yellow-500' : 'bg-purple-600'}`}
                    aria-label={t.add_transaction_voice}
                >
                    {isProcessing ? <Loader className="w-6 h-6 animate-spin"/> : <Mic className="w-6 h-6" />}
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


const KarobarTab: React.FC<KarobarTabProps> = ({ language }) => {
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
        
        const updatedCustomers = khataCustomers.map(cust => {
            if (cust.id === customerId) {
                const updatedTransactions = [...cust.transactions, newTransaction];
                return { ...cust, transactions: updatedTransactions };
            }
            return cust;
        });
        setKhataCustomers(updatedCustomers);

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