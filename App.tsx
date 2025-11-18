import React, { useState, useEffect, useMemo } from 'react';
import { getTabs, INITIAL_TRANSACTIONS, INITIAL_INVENTORY_ITEMS, INITIAL_KHATA_CUSTOMERS } from './constants';
import type { Transaction, InventoryItem, EditableBillItem, KhataCustomer, KhataTransaction, UnifiedTransaction } from './types';
import HomeTab from './components/HomeTab';
import InventoryTab from './components/InventoryTab';
import PlaceholderTab from './components/PlaceholderTab';
import KarobarTab from './components/KarobarTab';
import ErrorBoundary from './components/ErrorBoundary';
import QuickAddStockModal from './components/QuickAddStockModal';
import PaymentSelectionModal from './components/PaymentSelectionModal';
import CreateKhataModal from './components/CreateKhataModal';
import { translations } from './translations';
import AnalyticsTab from './components/AnalyticsTab';

// Custom hook for persisting state to localStorage
function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
}

type PaymentContext = { type: 'home'; customerName: string } | { type: 'khata'; customerId: string; customerName: string };

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [language, setLanguage] = usePersistentState<'ne' | 'en'>('kirana-language', 'ne');
  const [inventory, setInventory] = usePersistentState<InventoryItem[]>('kirana-inventory', INITIAL_INVENTORY_ITEMS);
  const [transactions, setTransactions] = usePersistentState<Transaction[]>('kirana-transactions', INITIAL_TRANSACTIONS);
  const [khataCustomers, setKhataCustomers] = usePersistentState<KhataCustomer[]>('kirana-khatas', INITIAL_KHATA_CUSTOMERS);
  
  const [quickAddItem, setQuickAddItem] = useState<InventoryItem | null>(null);
  const [createKhataModalOpen, setCreateKhataModalOpen] = useState(false);

  const [paymentModalState, setPaymentModalState] = useState<{
    isOpen: boolean;
    billItems: EditableBillItem[];
    totalAmount: number;
    context: PaymentContext | null;
  }>({
    isOpen: false,
    billItems: [],
    totalAmount: 0,
    context: null,
  });

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'ne' ? 'en' : 'ne'));
  };

  const addStock = (items: { inventoryId?: string; quantity: string | number, name: string }[]) => {
    setInventory(currentInventory => {
      const inventoryMap = new Map<string, InventoryItem>(currentInventory.map(i => [i.id, { ...i }]));
      items.forEach(itemToAdd => {
        if (itemToAdd.inventoryId && inventoryMap.has(itemToAdd.inventoryId)) {
          const itemToUpdate = inventoryMap.get(itemToAdd.inventoryId)!;
          const quantity = typeof itemToAdd.quantity === 'string' ? parseFloat(itemToAdd.quantity) : itemToAdd.quantity;
          itemToUpdate.stock += quantity || 0;
          itemToUpdate.lastUpdated = new Date().toISOString();
          inventoryMap.set(itemToAdd.inventoryId, itemToUpdate);
        }
      });
      return Array.from(inventoryMap.values());
    });
  };
  
  const handleQuickAddStock = (itemId: string, quantity: number) => {
    const item = inventory.find(i => i.id === itemId);
    if(item) {
        addStock([{ inventoryId: itemId, quantity, name: item.name }]);
    }
  };

  const handleNavigateToInventory = (itemId: string) => {
    setActiveTab('inventory');
  };
  
  const lowStockItems = useMemo((): InventoryItem[] => {
    return inventory
      .filter(item => item.stock <= item.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock); // Show lowest first
  }, [inventory]);

  const deductStock = (soldItems: EditableBillItem[]): { success: boolean, error?: string } => {
    let error: string | undefined;
    const inventoryMap = new Map<string, InventoryItem>(inventory.map(i => [i.id, { ...i }]));

    for (const soldItem of soldItems) {
      if (soldItem.inventoryId && inventoryMap.has(soldItem.inventoryId)) {
        const itemInStock = inventoryMap.get(soldItem.inventoryId)!;
        const quantityToSell = parseFloat(soldItem.quantity) || 0;
        if (itemInStock.stock < quantityToSell) {
          error = `Insufficient stock for ${itemInStock.name}. Only ${itemInStock.stock} available.`;
          return { success: false, error };
        }
      }
    }
    
    setInventory(currentInventory => {
      const newInventoryMap = new Map<string, InventoryItem>(currentInventory.map(i => [i.id, { ...i }]));
       soldItems.forEach(soldItem => {
        if (soldItem.inventoryId && newInventoryMap.has(soldItem.inventoryId)) {
          const itemToUpdate = newInventoryMap.get(soldItem.inventoryId)!;
          const quantitySold = parseFloat(soldItem.quantity) || 0;
          itemToUpdate.stock = Math.max(0, itemToUpdate.stock - quantitySold);
          itemToUpdate.lastUpdated = new Date().toISOString();
          newInventoryMap.set(soldItem.inventoryId, itemToUpdate);
        }
      });
      return Array.from(newInventoryMap.values());
    });
    
    return { success: true };
  };
  
  const handleConfirmSale = (
    billItems: EditableBillItem[],
    customerName: string,
    totalAmount: number,
    paymentMethod: 'cash' | 'qr' | 'credit',
    customerId?: string
  ): { success: boolean, error?: string } => {
      
      const stockDeductionResult = deductStock(billItems);
      if (!stockDeductionResult.success) {
          return stockDeductionResult;
      }
      
      const saleItems = billItems.map(item => ({ inventoryId: item.inventoryId, quantity: item.quantity, name: item.name }));

      if (paymentMethod === 'cash' || paymentMethod === 'qr') {
          const newTransaction: Transaction = {
              id: `txn-${Date.now()}`,
              customerName,
              amount: totalAmount,
              date: new Date().toISOString(),
              items: saleItems,
              paymentMethod: paymentMethod,
          };
          setTransactions(prev => [newTransaction, ...prev]);
      } else if (paymentMethod === 'credit' && customerId) {
          const description = billItems.map(item => `${item.name} (${item.quantity} ${item.unit})`).join(', ');
          const newKhataTransaction: KhataTransaction = {
              id: `k-txn-${Date.now()}`,
              date: new Date().toISOString(),
              description,
              amount: totalAmount,
              type: 'debit',
              items: saleItems,
          };
          setKhataCustomers(prev => prev.map(cust => 
              cust.id === customerId 
                  ? { ...cust, transactions: [newKhataTransaction, ...cust.transactions] }
                  : cust
          ));
      }
      
      return { success: true };
  };

  const handleAddItemsToKhata = (customerId: string, billItems: EditableBillItem[]): { success: boolean, error?: string } => {
      const totalAmount = billItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0), 0);
      return handleConfirmSale(billItems, '', totalAmount, 'credit', customerId);
  };

  const handleKhataSettlement = (
    customerId: string,
    billItems: EditableBillItem[],
    amountPaid: number,
    paymentMethod: 'cash' | 'qr'
  ): { success: boolean, error?: string } => {
    const t = translations[language];
    // 1. Deduct stock for new items
    const stockDeductionResult = deductStock(billItems);
    if (!stockDeductionResult.success) {
      return stockDeductionResult;
    }

    // 2. Update Khata records
    setKhataCustomers(prevCustomers => {
        return prevCustomers.map(cust => {
            if (cust.id === customerId) {
                const newTransactions: KhataTransaction[] = [];
                const billTotal = billItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0), 0);

                // Add debit for today's bill if it exists
                if (billItems.length > 0) {
                    const description = billItems.map(item => `${item.name} (${item.quantity} ${item.unit})`).join(', ');
                    newTransactions.push({
                        id: `k-txn-${Date.now()}`,
                        date: new Date().toISOString(),
                        description,
                        amount: billTotal,
                        type: 'debit',
                        items: billItems.map(item => ({ inventoryId: item.inventoryId, quantity: item.quantity, name: item.name }))
                    });
                }
                
                // Add credit for payment received
                newTransactions.push({
                    id: `k-txn-${Date.now() + 1}`,
                    date: new Date().toISOString(),
                    description: t.payment_received_desc,
                    amount: amountPaid,
                    type: 'credit',
                    items: []
                });

                return { ...cust, transactions: [...newTransactions, ...cust.transactions] };
            }
            return cust;
        });
    });
    
    // 3. Add to main sales transaction list
    const customer = khataCustomers.find(c => c.id === customerId);
    const newSaleTransaction: Transaction = {
      id: `txn-${Date.now()}`,
      customerName: customer?.name || 'Unknown Khata',
      amount: amountPaid,
      date: new Date().toISOString(),
      items: billItems.map(item => ({ inventoryId: item.inventoryId, quantity: item.quantity, name: item.name })),
      paymentMethod: paymentMethod,
      khataCustomerId: customerId,
    };
    setTransactions(prev => [newSaleTransaction, ...prev]);

    return { success: true };
  };

  const handleInitiatePayment = (
    billItems: EditableBillItem[],
    totalAmount: number,
    context: PaymentContext
  ) => {
    setPaymentModalState({
      isOpen: true,
      billItems,
      totalAmount,
      context,
    });
  };

  const closePaymentModal = () => {
    setPaymentModalState({ isOpen: false, billItems: [], totalAmount: 0, context: null });
  };
  
  const deleteTransaction = (transactionId: string) => {
      const transactionToDelete = transactions.find(t => t.id === transactionId);
      if (transactionToDelete) {
          addStock(transactionToDelete.items);
          setTransactions(prev => prev.filter(t => t.id !== transactionId));
      }
  };

  const deleteKhataTransaction = (customerId: string, transactionId: string) => {
      let transactionToDelete: KhataTransaction | undefined;
      setKhataCustomers(prev => prev.map(cust => {
          if (cust.id === customerId) {
              transactionToDelete = cust.transactions.find(t => t.id === transactionId);
              if (transactionToDelete) {
                  return { ...cust, transactions: cust.transactions.filter(t => t.id !== transactionId) };
              }
          }
          return cust;
      }));

      if (transactionToDelete?.items) {
          addStock(transactionToDelete.items);
      }
  };
  
  const addNewKhataCustomer = (customerData: Omit<KhataCustomer, 'id' | 'transactions'>) => {
    const newCustomer: KhataCustomer = {
        id: `khata-${Date.now()}`,
        transactions: [],
        ...customerData
    };
    setKhataCustomers(prev => [newCustomer, ...prev]);
    return newCustomer;
  };

    const unifiedRecentTransactions = useMemo((): UnifiedTransaction[] => {
        const cashAndQrSales: UnifiedTransaction[] = transactions.map(txn => ({
            id: txn.id,
            type: txn.paymentMethod,
            customerName: txn.customerName,
            amount: txn.amount,
            date: txn.date,
            description: txn.items.map(i => `${i.name} (Qty: ${i.quantity})`).join(', '),
            items: txn.items,
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
                    items: txn.items,
                    originalType: 'khata',
                    customerId: cust.id
                }))
        );

        return [...cashAndQrSales, ...creditSales]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    }, [transactions, khataCustomers]);

    const handleDeleteUnifiedTransaction = (txn: UnifiedTransaction) => {
        if (txn.originalType === 'transaction') {
            deleteTransaction(txn.id);
        } else if (txn.originalType === 'khata' && txn.customerId) {
            deleteKhataTransaction(txn.customerId, txn.id);
        }
    };


  const TABS = getTabs(language);

  const renderContent = () => {
    switch(activeTab) {
      case 'home': 
        return <HomeTab 
                    recentSales={unifiedRecentTransactions}
                    language={language}
                    toggleLanguage={toggleLanguage} 
                    inventory={inventory} 
                    onInitiatePayment={handleInitiatePayment}
                    onDeleteSale={handleDeleteUnifiedTransaction}
                    lowStockItems={lowStockItems.slice(0, 3)}
                    onNavigateToInventory={handleNavigateToInventory}
                    onQuickAddStock={(item) => setQuickAddItem(item)}
                />;
      case 'inventory': 
        return <InventoryTab language={language} inventory={inventory} setInventory={setInventory} />;
      case 'karobar':
        return <KarobarTab 
                    language={language} 
                    inventory={inventory}
                    khataCustomers={khataCustomers}
                    onDeleteKhataTransaction={deleteKhataTransaction}
                    onOpenCreateKhata={() => setCreateKhataModalOpen(true)}
                    onAddItemsToKhata={handleAddItemsToKhata}
                    onKhataSettlement={handleKhataSettlement}
                />;
      case 'analytics':
        return <AnalyticsTab
                  language={language}
                  inventory={inventory}
                  transactions={transactions}
                  khataCustomers={khataCustomers}
                  onDeleteTransaction={deleteTransaction}
                  onDeleteKhataTransaction={deleteKhataTransaction}
                />;
      case 'customers':
        return <PlaceholderTab pageName={TABS.find(t => t.id === activeTab)?.label || ''} language={language} />;
      default: 
        return <PlaceholderTab pageName={TABS.find(t => t.id === activeTab)?.label || ''} language={language} />;
    }
  };

  return (
    <ErrorBoundary>
        <div className="max-w-md mx-auto bg-gray-50 min-h-screen flex flex-col font-sans">
        <QuickAddStockModal
            isOpen={!!quickAddItem}
            onClose={() => setQuickAddItem(null)}
            onConfirm={handleQuickAddStock}
            item={quickAddItem}
            language={language}
        />
        <PaymentSelectionModal
            isOpen={paymentModalState.isOpen}
            onClose={closePaymentModal}
            billTotal={paymentModalState.totalAmount}
            context={paymentModalState.context}
            onFinalizeSale={handleConfirmSale}
            language={language}
            khataCustomers={khataCustomers}
            onOpenCreateKhata={() => setCreateKhataModalOpen(true)}
            billItems={paymentModalState.billItems}
        />
        <CreateKhataModal
            isOpen={createKhataModalOpen}
            onClose={() => setCreateKhataModalOpen(false)}
            onSave={addNewKhataCustomer}
            language={language}
        />

        <main className="flex-1 overflow-auto p-4 pb-24">
            {renderContent()}
        </main>

        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg max-w-md mx-auto print:hidden">
            <nav className="flex justify-around items-center py-2">
            {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all w-1/5 ${
                    isActive 
                        ? 'text-purple-600' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <Icon className={`w-6 h-6 mb-1 transition-transform ${isActive ? 'scale-110' : ''}`} />
                    <span className="text-xs font-medium">{tab.label}</span>
                    {isActive && (
                    <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-1"></div>
                    )}
                </button>
                );
            })}
            </nav>
        </footer>
        </div>
    </ErrorBoundary>
  );
};

export default App;