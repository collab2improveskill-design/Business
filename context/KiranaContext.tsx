
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { INITIAL_INVENTORY_ITEMS, INITIAL_TRANSACTIONS, INITIAL_KHATA_CUSTOMERS } from '../constants';
import { translations } from '../translations';
import type { InventoryItem, Transaction, KhataCustomer, EditableBillItem, KhataTransaction, UnifiedTransaction } from '../types';

// --- Types ---
interface KiranaContextType {
    language: 'ne' | 'en';
    setLanguage: (lang: 'ne' | 'en') => void;
    toggleLanguage: () => void;
    inventory: InventoryItem[];
    setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    transactions: Transaction[];
    khataCustomers: KhataCustomer[];
    setKhataCustomers: React.Dispatch<React.SetStateAction<KhataCustomer[]>>;
    
    // Actions
    addStock: (items: { inventoryId?: string; quantity: string | number, name: string }[]) => void;
    handleConfirmSale: (billItems: EditableBillItem[], customerName: string, totalAmount: number, paymentMethod: 'cash' | 'qr' | 'credit', customerId?: string) => { success: boolean, error?: string };
    handleKhataSettlement: (customerId: string, billItems: EditableBillItem[], amountPaid: number, paymentMethod: 'cash' | 'qr', previousDueOverride?: number) => { success: boolean, error?: string };
    handleAddItemsToKhata: (customerId: string, billItems: EditableBillItem[]) => { success: boolean, error?: string };
    deleteTransaction: (transactionId: string) => void;
    deleteKhataTransaction: (customerId: string, transactionId: string) => void;
    addNewKhataCustomer: (customerData: Omit<KhataCustomer, 'id' | 'transactions'>) => KhataCustomer;
    
    // Computed
    lowStockItems: InventoryItem[];
    unifiedRecentTransactions: UnifiedTransaction[];
}

const KiranaContext = createContext<KiranaContextType | undefined>(undefined);

// --- Persistence Hook with Security Validation ---
function usePersistentState<T>(key: string, initialValue: T, validator?: (val: any) => boolean): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            if (item) {
                const parsed = JSON.parse(item);
                if (validator && !validator(parsed)) {
                    console.warn(`Validation failed for ${key}, using initial value.`);
                    return initialValue;
                }
                return parsed;
            }
            return initialValue;
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

// --- Provider Component ---
export const KiranaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = usePersistentState<'ne' | 'en'>(
        'kirana-language', 
        'ne', 
        (val) => val === 'ne' || val === 'en'
    );
    
    const [inventory, setInventory] = usePersistentState<InventoryItem[]>(
        'kirana-inventory', 
        INITIAL_INVENTORY_ITEMS,
        (val) => Array.isArray(val) && val.every((item: any) => item.id && item.name)
    );
    
    const [transactions, setTransactions] = usePersistentState<Transaction[]>(
        'kirana-transactions', 
        INITIAL_TRANSACTIONS,
        (val) => Array.isArray(val)
    );
    
    const [khataCustomers, setKhataCustomers] = usePersistentState<KhataCustomer[]>(
        'kirana-khatas', 
        INITIAL_KHATA_CUSTOMERS,
        (val) => Array.isArray(val)
    );

    const toggleLanguage = () => setLanguage(prev => (prev === 'ne' ? 'en' : 'ne'));

    // --- Logic ---
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

    const deductStock = (soldItems: EditableBillItem[]): { success: boolean, error?: string } => {
        let error: string | undefined;
        const inventoryMap = new Map<string, InventoryItem>(inventory.map(i => [i.id, { ...i }]));

        // Check stock
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

        // Update stock
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
        if (!stockDeductionResult.success) return stockDeductionResult;

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

    const handleKhataSettlement = (
        customerId: string,
        billItems: EditableBillItem[],
        amountPaid: number,
        paymentMethod: 'cash' | 'qr',
        previousDueOverride?: number
    ): { success: boolean, error?: string } => {
        const t = translations[language];
        const stockDeductionResult = deductStock(billItems);
        if (!stockDeductionResult.success) return stockDeductionResult;

        setKhataCustomers(prevCustomers => {
            return prevCustomers.map(cust => {
                if (cust.id === customerId) {
                    const newTransactions: KhataTransaction[] = [];
                    const billTotal = billItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0), 0);

                    // Capture current time base to ensure ordering
                    const now = new Date();
                    const billDate = now.toISOString();
                    // Add 1 second to payment date so it is strictly "after" the bill in time sorting
                    const paymentDate = new Date(now.getTime() + 1000).toISOString();
                    
                    // Calculate balance snapshot
                    // If previousDueOverride is passed, use it (useful for UI consistency), otherwise recalculate from history
                    let currentBalance = previousDueOverride ?? cust.transactions.reduce((acc, txn) =>
                        txn.type === 'debit' ? acc + txn.amount : acc - txn.amount
                    , 0);

                    let balanceAfterBill = currentBalance;

                    if (billItems.length > 0) {
                        balanceAfterBill += billTotal;
                        const description = billItems.map(item => `${item.name} (${item.quantity} ${item.unit})`).join(', ');
                        newTransactions.push({
                            id: `k-txn-${Date.now()}`,
                            date: billDate,
                            description,
                            amount: billTotal,
                            type: 'debit',
                            items: billItems.map(item => ({ inventoryId: item.inventoryId, quantity: item.quantity, name: item.name }))
                        });
                    }
                    
                    const remainingDue = balanceAfterBill - amountPaid;

                    newTransactions.push({
                        id: `k-txn-${Date.now() + 1}`,
                        date: paymentDate,
                        description: t.payment_received_desc,
                        amount: amountPaid,
                        type: 'credit',
                        items: [],
                        meta: {
                            previousDue: balanceAfterBill,
                            remainingDue: remainingDue
                        }
                    });

                    return { ...cust, transactions: [...newTransactions, ...cust.transactions] };
                }
                return cust;
            });
        });

        // Create a mirror transaction in the main sales record for analytics
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

    const handleAddItemsToKhata = (customerId: string, billItems: EditableBillItem[]): { success: boolean, error?: string } => {
        const totalAmount = billItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0), 0);
        return handleConfirmSale(billItems, '', totalAmount, 'credit', customerId);
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

    // --- Computed Values ---
    const lowStockItems = useMemo(() => {
        return inventory
            .filter(item => item.stock <= item.lowStockThreshold)
            .sort((a, b) => a.stock - b.stock);
    }, [inventory]);

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

    const value = {
        language, setLanguage, toggleLanguage,
        inventory, setInventory,
        transactions, khataCustomers, setKhataCustomers,
        addStock, handleConfirmSale, handleKhataSettlement, handleAddItemsToKhata,
        deleteTransaction, deleteKhataTransaction, addNewKhataCustomer,
        lowStockItems, unifiedRecentTransactions
    };

    return (
        <KiranaContext.Provider value={value}>
            {children}
        </KiranaContext.Provider>
    );
};

export const useKirana = () => {
    const context = useContext(KiranaContext);
    if (context === undefined) {
        throw new Error('useKirana must be used within a KiranaProvider');
    }
    return context;
};
