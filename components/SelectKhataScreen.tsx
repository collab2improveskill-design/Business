

import React, { useState, useMemo } from 'react';
import { X, Search, UserPlus, Clock } from 'lucide-react';
import type { KhataCustomer } from '../types';
import { translations } from '../translations';
import { formatRelativeTime } from '../utils';

interface SelectKhataScreenProps {
    isOpen: boolean;
    onClose: () => void;
    customers: KhataCustomer[];
    onSelectCustomer: (customer: KhataCustomer) => void;
    onAddNew: () => void;
    language: 'ne' | 'en';
}

const calculateBalance = (customer: KhataCustomer): number => {
    return customer.transactions.reduce((balance, txn) => {
        return txn.type === 'debit' ? balance + txn.amount : balance - txn.amount;
    }, 0);
};

const getLastTransactionDate = (customer: KhataCustomer): string | null => {
    if (customer.transactions.length === 0) {
        return null;
    }
    // Find the latest date just in case the array is not sorted
    return customer.transactions.reduce((latest, current) => 
        new Date(current.date) > new Date(latest.date) ? current : latest
    ).date;
};

const SelectKhataScreen: React.FC<SelectKhataScreenProps> = ({ isOpen, onClose, customers, onSelectCustomer, onAddNew, language }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const t = translations[language];

    const filteredCustomers = useMemo(() => {
        if (!searchTerm) return customers;
        const lowercasedTerm = searchTerm.toLowerCase();
        return customers.filter(customer => 
            customer.name.toLowerCase().includes(lowercasedTerm) ||
            customer.phone.includes(lowercasedTerm)
        );
    }, [searchTerm, customers]);

    if (!isOpen) return null;

    const renderEmptyState = () => {
        if (customers.length === 0) {
            return (
                <div className="text-center p-10 text-gray-500">
                    <p>{t.no_customers_yet}</p>
                </div>
            );
        }
        if (filteredCustomers.length === 0) {
            return (
                <div className="text-center p-10 text-gray-500">
                     <p>{t.no_customers_found}</p>
                </div>
            );
        }
        return null;
    };


    return (
        <div className="fixed inset-0 bg-white z-40 flex flex-col">
            <header className="flex items-center justify-between p-4 border-b">
                <h2 className="text-xl font-bold text-gray-800">{t.select_khata_title}</h2>
                <button onClick={onClose}><X className="w-6 h-6 text-gray-600" /></button>
            </header>
            
            <div className="p-4">
                <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t.search_customers}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        autoFocus
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <ul className="divide-y">
                    <li>
                        <button onClick={onAddNew} className="flex items-center w-full gap-4 p-4 text-left hover:bg-gray-50 active:bg-purple-50 transition-colors">
                            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                                <UserPlus className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-semibold text-purple-600">{t.add_new_khata}</span>
                        </button>
                    </li>
                    {filteredCustomers.map(customer => {
                        const balance = calculateBalance(customer);
                        const lastTxnDate = getLastTransactionDate(customer);
                        const isAdvance = balance < 0;
                        const isSettled = balance === 0;

                        return (
                            <li key={customer.id}>
                                <button onClick={() => onSelectCustomer(customer)} className="flex items-center w-full gap-4 p-4 text-left hover:bg-gray-50 active:bg-purple-50 transition-colors">
                                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 shrink-0">
                                        {customer.name.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800">{customer.name}</p>
                                        <p className="text-sm text-gray-500">{customer.phone}</p>
                                        {lastTxnDate ? (
                                             <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                                <Clock className="w-3 h-3"/>
                                                {t.last_transaction} {formatRelativeTime(lastTxnDate, t)}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                                <Clock className="w-3 h-3"/>
                                                {t.no_transactions_yet}
                                            </p>
                                        )}
                                    </div>
                                     <div className="text-right">
                                        <p className={`font-bold ${isSettled ? 'text-green-600' : (isAdvance ? 'text-blue-600' : 'text-red-600')}`}>
                                            रू {Math.abs(balance).toFixed(2)}
                                        </p>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isSettled ? 'bg-green-100 text-green-700' : (isAdvance ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700')}`}>
                                            {isSettled ? t.settled : (isAdvance ? t.advance : t.due)}
                                        </span>
                                    </div>
                                </button>
                            </li>
                        )
                    })}
                </ul>
                {renderEmptyState()}
            </div>
        </div>
    );
};

export default SelectKhataScreen;