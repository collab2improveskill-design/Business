
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
    addStock: (items: { inventoryId?: string; quantity: string | number, name: string, price?: number, supplier?: string, sellingPrice?: number }[]) => void;
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
    const addStock = (items: { inventoryId?: string; quantity: string | number, name: string, price?: number, supplier?: string, sellingPrice?: number }[]) => {
        setInventory(currentInventory => {
            const inventoryMap = new Map<string, InventoryItem>(currentInventory.map(i => [i.id, { ...i }]));
            items.forEach(itemToAdd => {
                if (itemToAdd.inventoryId && inventoryMap.has(itemToAdd.inventoryId)) {
                    const itemToUpdate = inventoryMap.get(itemToAdd.inventoryId)!;
                    const quantity = typeof itemToAdd.quantity === 'string' ? parseFloat(itemToAdd.quantity) : itemToAdd.quantity;
                    itemToUpdate.stock += quantity || 0;
                    itemToUpdate.lastUpdated = new Date().toISOString();
                    
                    // Update Selling Price (MRP) if provided and valid
                    if (itemToAdd.sellingPrice !== undefined && itemToAdd.sellingPrice > 0) {
                        itemToUpdate.price = itemToAdd.sellingPrice;
                    }
                    
                    // Logic to add to purchase history if cost price is provided
                    if (itemToAdd.price) {
                        itemToUpdate.purchasePriceHistory = [
                            ...itemToUpdate.purchasePriceHistory,
                            {
                                price: itemToAdd.price, // This is Cost Price
                                date: new Date().toISOString(),
                                quantity: quantity || 0,
                                supplier: itemToAdd.supplier
                            }
                        ];
                    }

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
                immediatePayment: 0
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

        const safeFloat = (n: any) => { const f = parseFloat(n); return isNaN(f) ? 0 : f; };
        
        // --- 1. Calculate Exact Components ---
        const billTotal = safeFloat(billItems.reduce((sum, item) => sum + (safeFloat(item.price) * safeFloat(item.quantity)), 0));
        const paidTotal = safeFloat(amountPaid);

        // How much of the payment covers the NEW bill?
        const cashComponent = Math.min(paidTotal, billTotal);
        
        // How much of the bill is left as credit?
        const creditComponent = Math.max(0, billTotal - paidTotal);
        
        // How much of the payment is surplus (Recovery of OLD debt)?
        const recoveryComponent = Math.max(0, paidTotal - billTotal);

        // Flags
        const isSystemPayment = billItems.length > 0 && paidTotal > 0;
        const now = new Date();
        const billDate = now.toISOString();
        // Payment happens 1s later to keep order
        const paymentDate = new Date(now.getTime() + 1000).toISOString();
        const commonId = `txn-${Date.now()}`;

        let metaData: { previousDue?: number; remainingDue?: number; isSplitPayment?: boolean } = {};

        const billDescription = billItems.map(item => `${item.name} (${item.quantity} ${item.unit})`).join(', ');

        // --- 2. Update Khata (Ledger) ---
        setKhataCustomers(prevCustomers => {
            return prevCustomers.map(cust => {
                if (cust.id === customerId) {
                    const newTransactions: KhataTransaction[] = [];
                    
                    // Calculate snapshot for meta (optional but good for history)
                    let currentBalance = previousDueOverride ?? cust.transactions.reduce((acc, txn) =>
                        txn.type === 'debit' ? acc + txn.amount : acc - txn.amount
                    , 0);

                    // A. Debit Transaction (The Bill)
                    if (billItems.length > 0) {
                        const balanceAfterBill = currentBalance + billTotal;
                        
                        newTransactions.push({
                            id: `k-txn-${Date.now()}`,
                            date: billDate,
                            description: billDescription,
                            amount: billTotal,
                            type: 'debit',
                            items: billItems.map(item => ({ inventoryId: item.inventoryId, quantity: item.quantity, name: item.name })),
                            // CRITICAL: Record exactly how much was paid IMMEDIATELY against THIS bill
                            immediatePayment: cashComponent
                        });
                        
                        metaData = {
                            previousDue: balanceAfterBill,
                            remainingDue: balanceAfterBill - paidTotal,
                            isSplitPayment: isSystemPayment
                        };
                    }

                    // B. Credit Transaction (The Payment)
                    if (paidTotal > 0.01) {
                        newTransactions.push({
                            id: `k-txn-${Date.now() + 1}`,
                            date: paymentDate,
                            description: t.payment_received_desc,
                            amount: paidTotal,
                            type: 'credit',
                            items: [],
                            isAutoGenerated: isSystemPayment, 
                            meta: metaData
                        });
                    }

                    return { ...cust, transactions: [...newTransactions, ...cust.transactions] };
                }
                return cust;
            });
        });

        // --- 3. Update Global Transactions (Cash Flow) ---
        
        setTransactions(prev => {
            const newGlobalTxns: Transaction[] = [];
            const customer = khataCustomers.find(c => c.id === customerId);
            const customerName = customer?.name || 'Unknown';

            // ENTRY 1: The Cash Sale part (covers the bill)
            if (cashComponent > 0.01) {
                // If there is NO credit left (Full Payment), it's just a regular sale.
                // If there IS credit left, it's a "Part Payment".
                const splitType = creditComponent > 0.01 ? 'part_payment' : 'full_payment';
                
                newGlobalTxns.push({
                    id: `${commonId}-A`,
                    customerName: customerName,
                    amount: cashComponent,
                    date: now.toISOString(),
                    // IMPORTANT: We include the description in the global transaction so it appears fully populated in the Home list
                    // but we keep items empty to prevent stock double-deduction if we ever re-process transactions
                    items: [], 
                    paymentMethod,
                    khataCustomerId: customerId,
                    meta: { 
                        ...metaData, 
                        isSplitPayment: true,
                        splitType: splitType
                    } 
                });
                // Note: We use a hack in the UnifiedTransaction builder to inject the description if items are empty
            }

            // ENTRY 2: The Recovery part (Surplus payment)
            if (recoveryComponent > 0.01) {
                newGlobalTxns.push({
                    id: `${commonId}-B`,
                    customerName: customerName,
                    amount: recoveryComponent,
                    date: now.toISOString(),
                    items: [],
                    paymentMethod,
                    khataCustomerId: customerId,
                    meta: { 
                        ...metaData, 
                        isSplitPayment: false,
                        splitType: 'pre_due' // This represents paying off old debt
                    }
                });
            }
            
            // ENTRY 3: Pure Debt Payment (No Bill, just paying old debt)
            if (billItems.length === 0 && paidTotal > 0.01) {
                 newGlobalTxns.push({
                    id: commonId,
                    customerName: customerName,
                    amount: paidTotal,
                    date: now.toISOString(),
                    items: [],
                    paymentMethod,
                    khataCustomerId: customerId,
                    meta: { 
                        ...metaData, 
                        isSplitPayment: false,
                        splitType: 'debt_recovery'
                    }
                });
            }

            return [...newGlobalTxns.reverse(), ...prev]; 
        });

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
        const t = translations[language]; 
        
        // 1. Get ALL Global Transactions (Cash Sales + Khata Payments + Split Payments)
        // These represent MONEY COMING IN (Green Cards).
        const globalTransactions: UnifiedTransaction[] = transactions
            .map(txn => {
                const isKhataPayment = !!txn.khataCustomerId;
                const splitType = txn.meta?.splitType;
                
                // Dynamic Naming based on current Language
                let displayName = txn.customerName;
                if (splitType === 'part_payment') displayName = `${txn.customerName} (${t.part_payment})`;
                else if (splitType === 'pre_due') displayName = `${txn.customerName} (${t.pre_due})`;
                else if (splitType === 'debt_recovery') displayName = `${txn.customerName} (${t.debt_recovered})`;

                // If items are empty (because we moved logic to GlobalTxn in split payment),
                // we try to infer a description.
                let description = txn.items.length > 0 
                     ? txn.items.map(i => `${i.name} (Qty: ${i.quantity})`).join(', ')
                     : (isKhataPayment && txn.items.length === 0 ? t.payment_received_desc : '');
                     
                // Specific fix for "Paid Sale" looking empty
                if (splitType === 'full_payment' && !description) description = "Items sold (See Khata)";

                return {
                    id: txn.id,
                    type: txn.paymentMethod as 'cash' | 'qr',
                    customerName: displayName,
                    amount: txn.amount, 
                    date: txn.date,
                    description,
                    items: txn.items,
                    originalType: 'transaction',
                    customerId: txn.khataCustomerId,
                    isKhataPayment: isKhataPayment,
                    
                    // Analytics Fields
                    totalAmount: (isKhataPayment && splitType !== 'part_payment' && splitType !== 'full_payment') ? 0 : txn.amount, 
                    paidAmount: txn.amount,
                    source: (splitType === 'pre_due' || splitType === 'debt_recovery') ? 'recovery' : 'sales',
                    meta: txn.meta
                };
            });

        // 2. Get Khata DEBIT Transactions (The Unpaid Bills)
        // These represent MONEY OWED (Red Cards).
        const creditTransactions: UnifiedTransaction[] = [];
        
        khataCustomers.forEach(cust => {
             cust.transactions.forEach(txn => {
                 if (txn.type === 'debit') {
                     const amount = txn.amount || 0;
                     const immediatePayment = txn.immediatePayment || 0;
                     const remainingCredit = amount - immediatePayment;
                     
                     // REMAINDER LOGIC:
                     // We only show a "Credit Sale" card for the amount that is *actually* still due.
                     // If the bill was 100 and they paid 40:
                     // - Global Txn shows 40 (Paid)
                     // - This Credit Txn shows 60 (Due)
                     // If bill was 100 and they paid 100:
                     // - Global Txn shows 100 (Paid)
                     // - This Credit Txn is HIDDEN (0 Due).
                     
                     if (remainingCredit > 0.01) {
                         // Copy the item description from the Khata transaction
                         // Note: We append " (Due)" to hint this is the remainder
                         creditTransactions.push({
                            id: txn.id,
                            type: 'credit',
                            customerName: `${cust.name} (${t.credit_sale})`, 
                            amount: remainingCredit, // SHOW ONLY THE UNPAID PORTION
                            date: txn.date,
                            description: txn.description,
                            items: txn.items,
                            originalType: 'khata',
                            customerId: cust.id,
                            paidAmount: 0, 
                            totalAmount: remainingCredit,
                            meta: { ...txn.meta },
                            isKhataPayment: false,
                            source: 'sales'
                        });
                     }
                 }
             });
        });

        // Merge, Sort by Date Descending, then Slice
        return [...globalTransactions, ...creditTransactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 30);
    }, [transactions, khataCustomers, language]);

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
