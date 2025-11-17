import { Home, Package, FileText, TrendingUp, Users, DollarSign, Archive, UserCheck, AlertTriangle } from 'lucide-react';
import type { Tab, QuickStat, LowStockItem, Transaction, AiSuggestion, InventoryItem, KhataCustomer } from './types';
import { translations } from './translations';

export const getTabs = (lang: 'ne' | 'en'): Tab[] => [
  { id: 'home', icon: Home, label: translations[lang].home_tab },
  { id: 'inventory', icon: Package, label: translations[lang].inventory_tab },
  { id: 'billing', icon: FileText, label: translations[lang].billing_tab },
  { id: 'analytics', icon: TrendingUp, label: translations[lang].analytics_tab },
  { id: 'customers', icon: Users, label: translations[lang].customers_tab },
];

export const getQuickStats = (lang: 'ne' | 'en'): QuickStat[] => [
  { label: translations[lang].todays_sales, value: 'रू 12,450', change: '+8%', color: 'bg-green-500', icon: DollarSign },
  { label: translations[lang].stock_value, value: 'रू 2,45,000', change: '', color: 'bg-blue-500', icon: Archive },
  { label: translations[lang].due_amount, value: 'रू 15,200', change: `5 ${translations[lang].people}`, color: 'bg-orange-500', icon: UserCheck },
  { label: translations[lang].low_stock, value: `12 ${translations[lang].items}`, change: '', color: 'bg-red-500', icon: AlertTriangle },
];


export const INITIAL_LOW_STOCK_ITEMS: LowStockItem[] = [
  { name: 'सुनको दाल (१ के.जी)', stock: 2, unit: 'प्याकेट' },
  { name: 'बासमती चामल', stock: 5, unit: 'के.जी' },
  { name: 'नेपाली चिया', stock: 8, unit: 'प्याकेट' },
];

export const INITIAL_KHATA_CUSTOMERS: KhataCustomer[] = [
    {
        id: 'khata-1',
        name: 'विष्णु शर्मा',
        phone: '9841234567',
        address: 'नयाँ बानेश्वर, काठमाडौं',
        pan: '123456789',
        transactions: [
            { id: 'txn-1', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), description: 'चिनी (2 के.जी), तेल (1 लि.)', amount: 360, type: 'debit', items: [] },
            { id: 'txn-2', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), description: 'भुक्तानी प्राप्त भयो', amount: 300, type: 'credit', items: [] },
            { id: 'txn-3', date: new Date().toISOString(), description: 'चामल (5 के.जी)', amount: 900, type: 'debit', items: [] },
        ]
    },
    {
        id: 'khata-2',
        name: 'लक्ष्मी थापा',
        phone: '9808765432',
        address: 'पाटन, ललितपुर',
        transactions: [
            { id: 'txn-4', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), description: 'दाल, चियापत्ती, बिस्कुट', amount: 550, type: 'debit', items: [] },
        ]
    }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const AI_SUGGESTIONS: AiSuggestion[] = [
  { text: 'तिहार आउँदैछ - दीप र मालाको stock बढाउनुहोस्', icon: '🪔' },
  { text: 'यो हप्ता दूधको माग बढेको छ', icon: '🥛' },
];

export const CATEGORIES = ['Grocery', 'Beverage', 'Snack', 'Household', 'Personal Care', 'Other'];

const now = new Date();
const oneMonthAgo = new Date(new Date().setMonth(now.getMonth() - 1));
const twoMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 2));


export const INITIAL_INVENTORY_ITEMS: InventoryItem[] = [
    { 
        id: 'item-1',
        name: 'बासमती चामल (१ के.जी)', 
        stock: 25, 
        unit: 'के.जी', 
        price: 180,
        lastUpdated: now.toISOString(),
        category: 'Grocery',
        lowStockThreshold: 10,
        purchasePriceHistory: [{ price: 165, date: oneMonthAgo.toISOString(), quantity: 50 }]
    },
    { 
        id: 'item-2',
        name: 'सुनको दाल (१ के.जी)', 
        stock: 8, 
        unit: 'प्याकेट', 
        price: 210,
        lastUpdated: now.toISOString(),
        category: 'Grocery',
        lowStockThreshold: 10,
        purchasePriceHistory: [{ price: 190, date: now.toISOString(), quantity: 15 }]
    },
    { 
        id: 'item-3',
        name: 'नेपाली चिया', 
        stock: 42, 
        unit: 'प्याकेट', 
        price: 90,
        lastUpdated: oneMonthAgo.toISOString(),
        category: 'Beverage',
        lowStockThreshold: 20,
        purchasePriceHistory: [
            { price: 80, date: twoMonthsAgo.toISOString(), quantity: 50 },
            { price: 82, date: oneMonthAgo.toISOString(), quantity: 50 }
        ]
    },
    { 
        id: 'item-4',
        name: 'तोरीको तेल (१ लि.)', 
        stock: 30, 
        unit: 'लि.', 
        price: 250,
        lastUpdated: now.toISOString(),
        category: 'Household',
        lowStockThreshold: 12,
        purchasePriceHistory: [{ price: 230, date: now.toISOString(), quantity: 40 }]
    },
    { 
        id: 'item-5',
        name: 'चिनी (१ के.जी)', 
        stock: 50, 
        unit: 'के.जी', 
        price: 110,
        lastUpdated: oneMonthAgo.toISOString(),
        category: 'Grocery',
        lowStockThreshold: 25,
        purchasePriceHistory: [{ price: 95, date: oneMonthAgo.toISOString(), quantity: 100 }]
    }
];