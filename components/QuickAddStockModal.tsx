import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import type { InventoryItem } from '../types';
import { translations } from '../translations';

interface QuickAddStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (itemId: string, quantity: number) => void;
    item: InventoryItem | null;
    language: 'ne' | 'en';
}

const QuickAddStockModal: React.FC<QuickAddStockModalProps> = ({ isOpen, onClose, onConfirm, item, language }) => {
    const [quantity, setQuantity] = useState('');
    const t = translations[language];

    // Reset quantity when modal opens for a new item
    useEffect(() => {
        if (isOpen) {
            setQuantity('');
        }
    }, [isOpen]);

    if (!isOpen || !item) return null;

    const handleConfirm = () => {
        const numQuantity = parseFloat(quantity);
        if (!isNaN(numQuantity) && numQuantity > 0) {
            onConfirm(item.id, numQuantity);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{t.quick_add_stock}</h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-500 hover:text-gray-800" /></button>
                </div>
                <p className="text-gray-600 mb-4 font-medium">{item.name}</p>
                <div>
                    <label className="text-sm font-medium text-gray-600">{t.quantity}</label>
                    <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full mt-1 p-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder={`${t.quantity} to add`}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                    />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">{t.cancel}</button>
                    <button onClick={handleConfirm} className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 flex items-center gap-1 disabled:opacity-50" disabled={!quantity || parseFloat(quantity) <= 0}>
                        <Plus className="w-4 h-4" /> {t.add_item}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickAddStockModal;
