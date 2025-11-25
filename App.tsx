




import React, { useState } from 'react';
import { getTabs } from './constants';
import type { InventoryItem, EditableBillItem, PaymentContext } from './types';
import HomeTab from './components/HomeTab';
import InventoryTab from './components/InventoryTab';
import PlaceholderTab from './components/PlaceholderTab';
import KarobarTab from './components/KarobarTab';
import QuickAddStockModal from './components/QuickAddStockModal';
import PaymentSelectionModal from './components/PaymentSelectionModal';
import CreateKhataModal from './components/CreateKhataModal';
import AnalyticsTab from './components/AnalyticsTab';
import { useKirana } from './context/KiranaContext';
import { runSelfDiagnostic } from './utils/diagnostics';

// Expose diagnostics to window for manual testing
(window as any).runDiagnostics = runSelfDiagnostic;

const MainLayout: React.FC = () => {
  const { 
      language, 
      inventory, addStock, 
      handleConfirmSale, addNewKhataCustomer,
      khataCustomers
  } = useKirana();

  const [activeTab, setActiveTab] = useState('home');
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

  const handleQuickAddStock = (itemId: string, quantity: number, price?: number, supplier?: string, sellingPrice?: number) => {
    const item = inventory.find(i => i.id === itemId);
    if(item) {
        addStock([{ inventoryId: itemId, quantity, name: item.name, price, supplier, sellingPrice }]);
    }
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

  const TABS = getTabs(language);

  const renderContent = () => {
    switch(activeTab) {
      case 'home': 
        return <HomeTab 
                    onInitiatePayment={handleInitiatePayment}
                    onNavigateToInventory={() => setActiveTab('inventory')}
                    onQuickAddStock={(item) => setQuickAddItem(item)}
                />;
      case 'inventory': 
        return <InventoryTab />;
      case 'karobar':
        return <KarobarTab onOpenCreateKhata={() => setCreateKhataModalOpen(true)} />;
      case 'analytics':
        return <AnalyticsTab />;
      case 'customers':
        return <PlaceholderTab pageName={TABS.find(t => t.id === activeTab)?.label || ''} language={language} />;
      default: 
        return <PlaceholderTab pageName={TABS.find(t => t.id === activeTab)?.label || ''} language={language} />;
    }
  };

  return (
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
            onOpenCreateKhata={() => setCreateKhataModalOpen(true)}
            billItems={paymentModalState.billItems}
            khataCustomers={khataCustomers}
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
  );
};

const App: React.FC = () => {
    return <MainLayout />;
};

export default App;