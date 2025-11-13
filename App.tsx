import React, { useState } from 'react';
import { getTabs } from './constants';
import { INITIAL_TRANSACTIONS } from './constants';
import type { Transaction } from './types';
import HomeTab from './components/HomeTab';
import InventoryTab from './components/InventoryTab';
import PlaceholderTab from './components/PlaceholderTab';
import KarobarTab from './components/KarobarTab';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [language, setLanguage] = useState<'ne' | 'en'>('ne');

  const addTransaction = (name: string, amount: number) => {
    const newTransaction: Transaction = {
      id: Date.now(),
      name,
      amount,
      time: language === 'ne' ? 'भर्खरै' : 'Just now',
      paid: true,
    };
    setTransactions(prev => [newTransaction, ...prev]);
  };

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'ne' ? 'en' : 'ne'));
  };

  const TABS = getTabs(language);

  const renderContent = () => {
    switch(activeTab) {
      case 'home': 
        return <HomeTab transactions={transactions} addTransaction={addTransaction} language={language} toggleLanguage={toggleLanguage} />;
      case 'inventory': 
        return <InventoryTab language={language} />;
      case 'billing':
        return <KarobarTab language={language} />;
      default: 
        return <PlaceholderTab pageName={TABS.find(t => t.id === activeTab)?.label || ''} language={language} />;
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen flex flex-col font-sans">
      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 pb-24">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg max-w-md mx-auto">
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

export default App;