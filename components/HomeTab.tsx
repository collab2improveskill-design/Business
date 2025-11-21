
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Settings, Mic, Bell, Plus, ChevronRight, AlertCircle, X, Loader, Trash2, DollarSign, QrCode, BookUser, Zap } from 'lucide-react';
import { getQuickStats } from '../constants';
import { AI_SUGGESTIONS } from '../constants';
import type { UnifiedTransaction, EditableBillItem, InventoryItem, PaymentContext } from '../types';
import { parseBillingFromVoice } from '../services/geminiService';
import { translations } from '../translations';
import { generateId, findInventoryItem, formatDateTime } from '../utils';
import ConfirmationModal from './ConfirmationModal';
import { useKirana } from '../context/KiranaContext';

interface HomeTabProps {
  onInitiatePayment: (billItems: EditableBillItem[], totalAmount: number, context: PaymentContext) => void;
  onNavigateToInventory: (itemId: string) => void;
  onQuickAddStock: (item: InventoryItem) => void;
}

const HomeTab: React.FC<HomeTabProps> = ({ onInitiatePayment, onNavigateToInventory, onQuickAddStock }) => {
  const { 
      language, toggleLanguage, 
      inventory, 
      unifiedRecentTransactions, deleteTransaction, deleteKhataTransaction, lowStockItems 
  } = useKirana();

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const [billItems, setBillItems] = useState<EditableBillItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  
  const [showCancelConfirm, setShowCancelConfirm] = useState<UnifiedTransaction | null>(null);
  
  const recognitionRef = useRef<any>(null);
  
  const inventoryRef = useRef(inventory);
  useEffect(() => {
      inventoryRef.current = inventory;
  }, [inventory]);

  const t = translations[language];
  const QUICK_STATS = getQuickStats(language);

  // IMPROVED: Data Integrity & Sanitization (Consistent with KarobarTab)
  const processVoiceCommand = useCallback(async (transcript: string) => {
    if (!transcript) return;
    setIsProcessing(true);
    setApiError(null);
    try {
      const result = await parseBillingFromVoice(transcript, language);
      
      const newEditableItems: EditableBillItem[] = result.items.map(item => {
          const inventoryItem = findInventoryItem(item.name, inventoryRef.current);
          
          // SANITIZATION: Prevent NaN/Infinity
          const parsedPrice = parseFloat(String(item.price));
          const safePrice = Number.isFinite(parsedPrice) 
                ? parsedPrice 
                : (inventoryItem?.price || 0);
                
          const parsedQty = parseFloat(String(item.quantity));
          const safeQty = Number.isFinite(parsedQty) 
                ? parsedQty 
                : 1;

          return {
              id: generateId(),
              inventoryId: inventoryItem?.id,
              name: inventoryItem?.name || item.name || '',
              quantity: String(safeQty),
              unit: inventoryItem?.unit || item.unit || '',
              price: String(safePrice),
          };
      });
      
      setBillItems(prevItems => [...prevItems, ...newEditableItems]);

      if (result.customerName && result.customerName.toLowerCase() !== 'guest customer' && result.customerName.toLowerCase() !== 'अतिथि ग्राहक') {
          setCustomerName(result.customerName);
      } else if (!customerName) {
          setCustomerName(t.guest_customer);
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "An unknown error occurred.");
    } finally {
      setIsProcessing(false);
    }
  }, [language, t.guest_customer, customerName]);

  const processVoiceCommandRef = useRef(processVoiceCommand);
  useEffect(() => {
    processVoiceCommandRef.current = processVoiceCommand;
  }, [processVoiceCommand]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'ne' ? 'ne-NP' : 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let final_transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final_transcript += event.results[i][0].transcript;
        }
      }
      if (final_transcript.trim()) {
        processVoiceCommandRef.current(final_transcript.trim());
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') return;
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
          setIsListening(false);
      }
    };

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
        }
        recognitionRef.current = null;
      }
    };
  }, [language]);

  const handleListen = () => {
    if (!recognitionRef.current) {
        alert("Speech recognition is not supported in your browser.");
        return;
    }
    
    try {
      if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
      } else {
        setBillItems([]);
        setCustomerName('');
        setApiError(null);
        recognitionRef.current.start();
        setIsListening(true);
      }
    } catch (e) {
      console.error("Error toggling speech recognition:", e);
      setIsListening(false);
    }
  };
  
  const handleItemChange = (index: number, field: keyof Omit<EditableBillItem, 'id'| 'inventoryId'>, value: string) => {
    const updatedItems = [...billItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setBillItems(updatedItems);
  };

  const handleRemoveItem = (id: string) => {
    setBillItems(billItems.filter(item => item.id !== id));
  };

  const handleAddItem = () => {
    setBillItems([
      ...billItems,
      { id: generateId(), name: '', quantity: '1', unit: '', price: '0' }
    ]);
  };
  
  const totalBillAmount = useMemo(() => {
    return billItems.reduce((sum, item) => {
        const price = parseFloat(item.price) || 0;
        const quantity = parseFloat(item.quantity) || 0;
        return sum + (price * quantity);
    }, 0);
  }, [billItems]);


  const handleConfirmBill = () => {
    if (billItems.length === 0) return;
    setApiError(null);
    onInitiatePayment(billItems, totalBillAmount, { type: 'home', customerName: customerName || t.guest_customer });
    setBillItems([]);
    setCustomerName('');
  };
  
  const handleCancelTransaction = (transaction: UnifiedTransaction) => {
    if (transaction.originalType === 'transaction') {
        deleteTransaction(transaction.id);
    } else if (transaction.originalType === 'khata' && transaction.customerId) {
        deleteKhataTransaction(transaction.customerId, transaction.id);
    }
    setShowCancelConfirm(null);
  };
  
  const paymentStatusInfo = useMemo(() => ({
      cash: { text: t.paid, color: 'text-green-600', icon: <DollarSign className="w-3 h-3" /> },
      qr: { text: t.online, color: 'text-sky-600', icon: <QrCode className="w-3 h-3" /> },
      credit: { text: t.due, color: 'text-red-600', icon: <BookUser className="w-3 h-3" /> },
  }), [t]);


  return (
    <>
    <ConfirmationModal
        isOpen={!!showCancelConfirm}
        onClose={() => setShowCancelConfirm(null)}
        onConfirm={() => handleCancelTransaction(showCancelConfirm!)}
        title={t.confirm_cancel_sale_title}
        message={t.confirm_cancel_sale_desc}
        language={language}
    />
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t.greeting}</h1>
          <p className="text-sm text-gray-500">{t.greeting_subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={toggleLanguage} className="p-2 bg-white rounded-lg shadow-sm text-xs font-bold text-gray-600 w-10 h-9 flex items-center justify-center">
                {language === 'ne' ? 'EN' : 'NE'}
            </button>
          <button className="p-2 bg-white rounded-lg shadow-sm relative">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>
          <button className="p-2 bg-white rounded-lg shadow-sm">
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </header>

      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 shadow-lg text-white">
        <h2 className="text-xl font-bold">{t.voice_billing_title}</h2>
        <p className="text-white/80 text-sm mb-4 mt-1">{t.voice_billing_desc}</p>
        <button 
          onClick={handleListen}
          disabled={isProcessing}
          className={`w-full py-3.5 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${
            isListening
              ? 'bg-red-500 text-white shadow-md' 
              : isProcessing 
              ? 'bg-white/20 text-white'
              : 'bg-white text-purple-600 hover:bg-gray-100 shadow-md'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader className="w-6 h-6 animate-spin" />
              <span>{t.processing}</span>
            </>
          ) : isListening ? (
            <>
              <Mic className="w-6 h-6" />
              <span>{t.stop_listening}</span>
            </>
          ) : (
            <>
              <Mic className="w-6 h-6" />
              <span>{t.start_speaking}</span>
            </>
          )}
        </button>
      </div>
      
      {apiError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
          <p className="font-bold">{t.error}</p>
          <p>{apiError}</p>
        </div>
      )}

      {billItems.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-purple-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-gray-800">{t.edit_bill}</h3>
                <button onClick={() => setBillItems([])} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="mb-4">
                <label className="text-xs font-medium text-gray-500">{t.customer_name}</label>
                <input 
                    type="text" 
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-md mt-1"
                />
            </div>

            <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-500 px-2">
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
                        <button onClick={() => handleRemoveItem(item.id)} className="col-span-1 flex justify-center items-center text-red-400 hover:text-red-600 p-2">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            <button onClick={handleAddItem} className="mt-3 text-sm font-medium text-purple-600 flex items-center gap-1">
                <Plus className="w-4 h-4"/> {t.add_item}
            </button>

            <div className="border-t mt-4 pt-3 flex justify-between items-center">
                <span className="text-gray-800 font-bold text-lg">{t.total}</span>
                <span className="text-purple-600 font-extrabold text-xl">रू {totalBillAmount.toFixed(2)}</span>
            </div>
            <button 
                onClick={handleConfirmBill}
                className="w-full mt-4 bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors">
                {t.confirm_bill}
            </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {QUICK_STATS.map((stat, idx) => {
            const Icon = stat.icon;
            return (
          <div key={idx} className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-3">
            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center text-white shrink-0`}>
                <Icon className="w-5 h-5"/>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
              <p className="text-lg font-bold text-gray-800">{stat.value}</p>
              {stat.change && (
                <p className={`text-xs mt-1 ${stat.color.includes('green') ? 'text-green-600' : 'text-gray-500'}`}>{stat.change}</p>
              )}
            </div>
          </div>
        )})}
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
        <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-blue-800">{t.ai_suggestions}</h3>
        </div>
        {AI_SUGGESTIONS.map((suggestion, idx) => (
          <div key={idx} className="flex items-center gap-3 mb-2 last:mb-0 cursor-pointer hover:bg-blue-100/50 p-1 rounded-md">
            <span className="text-2xl">{suggestion.icon}</span>
            <p className="text-sm text-gray-700 flex-1">{suggestion.text}</p>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            {t.low_stock_alert}
          </h3>
          <button className="text-sm text-purple-600 font-medium">{t.view_all}</button>
        </div>
        <div className="space-y-3">
          {lowStockItems.length > 0 ? lowStockItems.slice(0,3).map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div
                onClick={() => onNavigateToInventory(item.id)}
                className="cursor-pointer group"
              >
                <p className="text-sm font-medium text-gray-800 group-hover:text-purple-600 transition-colors">{item.name}</p>
                <p className="text-xs text-red-600">{t.remaining} {item.stock} {item.unit}</p>
              </div>
              <button
                onClick={() => onQuickAddStock(item)}
                className="px-3 py-1 bg-purple-500 text-white text-xs rounded-lg font-medium flex items-center gap-1 hover:bg-purple-600"
              >
                <Plus className="w-3 h-3" />
                {t.quick_add_stock}
              </button>
            </div>
          )) : <p className="text-sm text-gray-500 text-center py-4">{t.no_low_stock_items}</p>
        }
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">{t.recent_sales}</h3>
          <button className="text-sm text-purple-600 font-medium">{t.view_all}</button>
        </div>
        <div className="space-y-1">
          {unifiedRecentTransactions.length > 0 ? unifiedRecentTransactions.map((txn) => {
            const status = paymentStatusInfo[txn.type] || paymentStatusInfo.cash; // Fallback for safety
            return (
                <div key={`${txn.originalType}-${txn.id}`} className="group flex items-center justify-between p-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {txn.customerName ? txn.customerName.charAt(0) : '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{txn.customerName || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDateTime(txn.date, language)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                        <p className="text-sm font-bold text-gray-800">रू {txn.amount.toFixed(2)}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 ${status.color}`}>
                            {status.icon}
                            <span className="text-xs font-semibold">{status.text}</span>
                        </div>
                    </div>
                    {/* MOBILE UX: Always visible button, padding for touch target */}
                    <button 
                        onClick={() => setShowCancelConfirm(txn)} 
                        className="text-gray-400 hover:text-red-600 transition-colors self-start p-3"
                    >
                        <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
            )
          }) : (
            <p className="text-center py-4 text-sm text-gray-500">{t.no_sales_history}</p>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default HomeTab;
