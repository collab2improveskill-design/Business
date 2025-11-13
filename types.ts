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

export interface Transaction {
  id: number;
  name: string;
  amount: number;
  time: string;
  paid: boolean;
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
  price: number;
  lastUpdated: string; // ISO Date string
  priceHistory: {
    price: number;
    date: string; // ISO Date string
  }[];
}

// Type for items parsed from an uploaded bill image by AI
export interface ParsedInventoryItem {
  id: string; // Add a temporary ID for list rendering
  name: string;
  quantity: number;
  unit: string;
  price: number;
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
  id: string;
  name: string;
  quantity: string;
  unit: string;
  price: string;
}