import type { LucideIcon } from 'lucide-react';

export interface Tab {
  id: string;
  icon: LucideIcon;
  label: string;
}

export interface QuickStat {
  label: string;
  value: string;
  change: string;
  color: string;
  icon: LucideIcon;
}

export interface LowStockItem {
  name: string;
  stock: number;
  unit: string;
}

// Transaction for a cash or QR sale (Home Tab)
export interface Transaction {
  id: string;
  customerName: string;
  amount: number;
  date: string; // ISO Date string
  items: Pick<EditableBillItem, 'inventoryId' | 'quantity' | 'name'>[];
  paymentMethod: 'cash' | 'qr';
  khataCustomerId?: string; // Link to the khata customer if it's a settlement payment
}

export interface AiSuggestion {
  text: string;
  icon: string;
}

export interface InventoryItem {
  id:string;
  name: string;
  stock: number;
  unit: string;
  price: number; // This is the SELLING price
  lastUpdated: string; // ISO Date string
  category: string;
  lowStockThreshold: number;
  purchasePriceHistory: {
    price: number; // This is the PURCHASE price
    date: string; // ISO Date string
    quantity: number; // The quantity bought in this transaction
  }[];
}

// Type for items parsed from an uploaded bill image by AI
export interface ParsedBillItemFromImage {
  id: string; // Add a temporary ID for list rendering
  name: string;
  quantity: number;
  unit: string;
  price: number; // This is the PURCHASE price from the bill
  suggestedCategory: string;
}


export interface ParsedBillItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price?: number; // Optional price per unit
}

export interface ParsedBill {
  items: Omit<ParsedBillItem, 'id'>[];
  customerName?: string;
}

export interface KhataTransaction {
  id: string;
  date: string; // ISO date string
  description: string;
  amount: number;
  type: 'debit' | 'credit'; // debit = customer owes more, credit = customer paid
  items: Pick<EditableBillItem, 'inventoryId' | 'quantity' | 'name'>[];
}

export interface KhataCustomer {
  id: string;
  name: string;
  phone: string;
  address: string;
  pan?: string;
  citizenship?: string;
  transactions: KhataTransaction[];
}

export interface ParsedKhataTransaction {
  description: string;
  amount: number;
}

// Shared type for bill editing UI
export interface EditableBillItem {
  id: string; // Temporary UI ID
  inventoryId?: string; // ID of the master inventory, if matched
  name: string;
  quantity: string;
  unit: string;
  price: string;
}

// A unified type for displaying all transactions in one list
export interface UnifiedTransaction {
  id: string; // Original transaction ID
  type: 'cash' | 'qr' | 'credit';
  customerName: string;
  amount: number;
  date: string; // ISO Date string
  description: string;
  // FIX: Added 'items' property to allow filtering by item category in AnalyticsTab.
  items: Pick<EditableBillItem, 'inventoryId' | 'quantity' | 'name'>[];
  // For deletion purposes
  originalType: 'transaction' | 'khata';
  customerId?: string; // Only for khata transactions
}