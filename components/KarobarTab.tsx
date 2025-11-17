import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, X, User, Phone, MapPin, Hash, UserPlus, Mic, Loader, Trash2, Square, DollarSign, QrCode, BookUser } from 'lucide-react';
import { translations } from '../translations';
import type { KhataCustomer, EditableBillItem, InventoryItem, UnifiedTransaction, Transaction } from '../types';
import { parseBillingFromVoice } from '../services/geminiService';
import { generateId, findInventoryItem, formatDateTime } from '../utils';
import CreateKhataModal from './CreateKhataModal';
import ConfirmationModal from './ConfirmationModal';

type PaymentContext = { type: 'home'; customerName: string } | { type: 'khata'; customerId: string; customerName: string };

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

interface KarobarTabProps {
    language: 'ne' | 'en';
    inventory: InventoryItem[];
    khataCustomers: KhataCustomer[];
    transactions: Transaction[];
    onInitiatePayment: (billItems: EditableBillItem[], totalAmount: number, context: PaymentContext) => void;
    onDeleteTransaction: (transactionId: string) => void;
    onDeleteKhataTransaction: (customerId: string, transactionId: string) => void;
    onAddNewKhataCustomer: (customer: Omit<KhataCustomer, 'id' | 'transactions'>) => KhataCustomer;
}

interface ToggleOption {
    label: string;
    value: string;
}

const ToggleSwitch: React.FC<{ options: ToggleOption[]; value: string; onChange: (value: string) => void; }> = ({ options, value, onChange }) => {
    const activeIndex = options.findIndex(opt => opt.value === value);

    return (
        <div className="relative flex w-full p-1 bg-gray-200 rounded-full">
            <div
                className="absolute top-1 bottom-1 w-1/2 bg-purple-600 rounded-full shadow-md transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${activeIndex * 100}%)` }}
            />
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

// --- KhataDetailModal ---
const KhataDetailModal: React.FC<{
    customer: KhataCustomer | null;
    isOpen: boolean;
    onClose: () => void;
    language: 'ne' | 'en';
    inventory: InventoryItem[];
    onInitiatePayment: (billItems: EditableBillItem[], totalAmount: number, context: PaymentContext) => void;
    onDeleteKhataTransaction: (customerId: string, transactionId: string) => void;
}> = ({ customer, isOpen, onClose, language, inventory, onInitiatePayment, onDeleteKhataTransaction }) => {
    const t = translations[language];
    
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
    
    useEffect(() => {
        if (isOpen) {
            setBillItems([]);
            setApiError(null);
            setIsListening(false);
            setIsProcessing(false);
        } else {
             if (recognition) recognition.stop();
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
            const newEditableItems: EditableBillItem[] = result.items.map(item => {
                const inventoryItem = findInventoryItem(item.name, inventory);
                return {
                    id: generateId(),
                    inventoryId: inventoryItem?.id,
                    name: inventoryItem?.name || item.name || '',
                    quantity: String(item.quantity || 1),
                    unit: inventoryItem?.unit || item.unit || '',
                    price: String(inventoryItem?.price || item.price || 0),
                };
            });
            setBillItems(prevItems => [...prevItems, ...newEditableItems]);
        } catch (error) {
            setApiError(error instanceof Error ? error.message : "An unknown error occurred.");
        } finally {
            setIsProcessing(false);
        }
    }, [language, inventory]);

    useEffect(() => {
        if (!recognition || !isOpen) return;

        recognition.onresult = (event: any) => {
            let final_transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) final_transcript += event.results[i][0].transcript;
            }
            if (final_transcript.trim()) processVoiceCommand(final_transcript.trim());
        };

        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        return () => {
            if (recognition) {
                recognition.onresult = null;
                recognition.onend = null;
                recognition.onerror = null;
            }
        };
    }, [processVoiceCommand, isOpen]);

    const handleListen = () => {
        if (!recognition) return alert("Speech recognition is not supported in your browser.");
        if (isListening) recognition.stop();
        else {
            setApiError(null);
            recognition.start();
            setIsListening(true);
        }
    };

    const handleItemChange = (index: number, field: keyof Omit<EditableBillItem, 'id' | 'inventoryId'>, value: string) => {
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

    const handleConfirmBill = () => {
        if (billItems.length === 0 || !customer) return;
        setApiError(null);
        onInitiatePayment(billItems, totalBillAmount, { type: 'khata', customerId: customer.id, customerName: customer.name });
        onClose(); // Close this modal, payment modal will open
    };
    
    if (!isOpen || !customer) return null;

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
                        <p className={`text-3xl font-extrabold ${currentBalance > 0 ? 'text-red-600' : 'text-green-700'}`}>रू {Math.abs(currentBalance).toFixed(2)}</p>
                    </div>

                    <h3 className="font-bold text-lg mb-2">{t.transaction_history}</h3>
                    <div className="space-y-2">
                        {customer.transactions.slice().reverse().map(txn => (
                             <div key={txn.id} className={`group p-3 rounded-lg flex justify-between items-center ${txn.type === 'debit' ? 'bg-red-50' : 'bg-green-50'}`}>
                                <div>
                                    <p className="font-medium text-gray-800 text-sm">{txn.description}</p>
                                    <p className="text-xs text-gray-500">{formatDateTime(txn.date, language)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p className={`font-bold text-sm ${txn.type === 'debit' ? 'text-red-600' : 'text-green-700'}`}>
                                        {txn.type === 'debit' ? '+' : '-'} रू {txn.amount.toFixed(2)}
                                    </p>
                                    <button onClick={() => onDeleteKhataTransaction(customer.id, txn.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
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
                                    <input type="text" value={item.price} onChange={(e) => handleItemChange(idx, 'price', e.target.value)} className="col-span-2 p-2 border rounded-md text-sm text-center" />
                                    <button onClick={() => handleRemoveItem(item.id)} className="col-span-1 flex justify-center items-center text-red-400 hover:text-red-600">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="border-t mt-3 pt-3 flex justify-between items-center">
                            <span className="text-gray-800 font-bold text-lg">{t.total}</span>
                            <span className="text-purple-600 font-extrabold text-xl">रू {totalBillAmount.toFixed(2)}</span>
                        </div>
                        <button onClick={handleConfirmBill} className="w-full mt-3 bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors">
                            {t.confirm_bill}
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
    onAddNewCustomer: (customer: Omit<KhataCustomer, 'id' | 'transactions'>) => KhataCustomer;
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
                onSave={(customer) => {
                    const newCustomer = onAddNewCustomer(customer);
                    setCreateModalOpen(false);
                    return newCustomer;
                }}
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
                                    <p className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>रू {balance.toFixed(2)}</p>
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

// --- SalesHistoryView ---
const SalesHistoryView: React.FC<{
    language: 'ne' | 'en';
    transactions: Transaction[];
    khataCustomers: KhataCustomer[];
    onDeleteTransaction: (transactionId: string) => void;
    onDeleteKhataTransaction: (customerId: string, transactionId: string) => void;
}> = ({ language, transactions, khataCustomers, onDeleteTransaction, onDeleteKhataTransaction }) => {
    const t = translations[language];
    const [filter, setFilter] = useState<'all' | 'cash' | 'qr' | 'credit'>('all');
    const [confirmDelete, setConfirmDelete] = useState<UnifiedTransaction | null>(null);

    const unifiedTransactions = useMemo((): UnifiedTransaction[] => {
        const cashAndQrSales: UnifiedTransaction[] = transactions.map(txn => ({
            id: txn.id,
            type: txn.paymentMethod,
            customerName: txn.customerName,
            amount: txn.amount,
            date: txn.date,
            description: txn.items.map(i => i.name).join(', '),
            originalType: 'transaction'
        }));

        const creditSales: UnifiedTransaction[] = khataCustomers.flatMap(cust =>
            cust.transactions
                .filter(txn => txn.type === 'debit')
                .map(txn => ({
                    id: txn.id,
                    type: 'credit',
                    customerName: cust.name,
                    amount: txn.amount,
                    date: txn.date,
                    description: txn.description,
                    originalType: 'khata',
                    customerId: cust.id
                }))
        );

        return [...cashAndQrSales, ...creditSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, khataCustomers]);

    const filteredTransactions = useMemo(() => {
        if (filter === 'all') return unifiedTransactions;
        return unifiedTransactions.filter(txn => txn.type === filter);
    }, [filter, unifiedTransactions]);

    const handleDelete = () => {
        if (!confirmDelete) return;
        if (confirmDelete.originalType === 'transaction') {
            onDeleteTransaction(confirmDelete.id);
        } else if (confirmDelete.originalType === 'khata' && confirmDelete.customerId) {
            onDeleteKhataTransaction(confirmDelete.customerId, confirmDelete.id);
        }
        setConfirmDelete(null);
    };

    const paymentIcons: { [key in 'cash' | 'qr' | 'credit']: React.ReactElement } = useMemo(() => ({
        cash: <DollarSign className="w-5 h-5 text-green-600" />,
        qr: <QrCode className="w-5 h-5 text-sky-600" />,
        credit: <BookUser className="w-5 h-5 text-red-600" />,
    }), []);
    
    const paymentStatusInfo = useMemo(() => ({
        cash: { text: t.paid, color: 'text-green-600', icon: <DollarSign className="w-3 h-3" /> },
        qr: { text: t.online, color: 'text-sky-600', icon: <QrCode className="w-3 h-3" /> },
        credit: { text: t.due, color: 'text-red-600', icon: <BookUser className="w-3 h-3" /> },
    }), [t]);


    const filterButtons = [
        { label: t.filter_all, value: 'all' },
        { label: t.filter_cash, value: 'cash' },
        { label: t.filter_qr, value: 'qr' },
        { label: t.filter_credit, value: 'credit' },
    ];

    return (
        <div className="space-y-4">
            <ConfirmationModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title={t.confirm_delete_txn_title}
                message={t.confirm_delete_txn_desc}
                language={language}
            />
            <div className="flex justify-around bg-gray-100 rounded-lg p-1">
                {filterButtons.map(btn => (
                    <button
                        key={btn.value}
                        onClick={() => setFilter(btn.value as any)}
                        className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                            filter === btn.value
                                ? 'bg-purple-600 text-white shadow'
                                : 'text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {btn.label}
                    </button>
                ))}
            </div>
            {filteredTransactions.length === 0 ? (
                <div className="text-center p-10 text-gray-500 bg-white rounded-xl shadow-sm">
                    <p>{t.no_sales_history}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredTransactions.map(txn => {
                        const status = paymentStatusInfo[txn.type];
                        return (
                            <div key={`${txn.originalType}-${txn.id}`} className="group bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                        {paymentIcons[txn.type]}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-800">{txn.customerName}</p>
                                        <p className="text-xs text-gray-500">{formatDateTime(txn.date, language)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                     <div className="text-right">
                                        <p className="font-bold text-gray-800">रू {txn.amount.toFixed(2)}</p>
                                        <div className={`flex items-center justify-end gap-1 mt-1 ${status.color}`}>
                                            {status.icon}
                                            <span className="text-xs font-semibold">{status.text}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setConfirmDelete(txn)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 self-start pt-1">
                                        <Trash2 className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

const KarobarTab: React.FC<KarobarTabProps> = (props) => {
    const { language, khataCustomers, onAddNewKhataCustomer } = props;
    const [activeView, setActiveView] = useState('khata');
    const [selectedCustomer, setSelectedCustomer] = useState<KhataCustomer | null>(null);
    const t = translations[language];

    const toggleOptions = [
        { label: t.khata_view, value: 'khata' },
        { label: t.sales_history_view, value: 'sales_history' }
    ];

    const handleSelectCustomer = (customer: KhataCustomer) => {
        setSelectedCustomer(customer);
    };

    const handleCloseDetailModal = () => {
        setSelectedCustomer(null);
    };
    
    // This is needed to get real-time updates in the modal
    const currentlySelectedCustomer = useMemo(() => {
        if (!selectedCustomer) return null;
        return khataCustomers.find(c => c.id === selectedCustomer.id) || null;
    }, [khataCustomers, selectedCustomer]);

    return (
        <div className="space-y-6">
            <KhataDetailModal
                isOpen={!!selectedCustomer}
                onClose={handleCloseDetailModal}
                customer={currentlySelectedCustomer}
                language={props.language}
                inventory={props.inventory}
                onInitiatePayment={props.onInitiatePayment}
                onDeleteKhataTransaction={props.onDeleteKhataTransaction}
            />
            <h1 className="text-2xl font-bold text-gray-800">{t.billing_tab}</h1>
            <ToggleSwitch options={toggleOptions} value={activeView} onChange={setActiveView} />

            {activeView === 'khata' && (
                <KhataListView 
                    language={language}
                    customers={khataCustomers}
                    onSelectCustomer={handleSelectCustomer}
                    onAddNewCustomer={onAddNewKhataCustomer}
                />
            )}

            {activeView === 'sales_history' && (
                 <SalesHistoryView {...props} />
            )}
        </div>
    );
};

export default KarobarTab;