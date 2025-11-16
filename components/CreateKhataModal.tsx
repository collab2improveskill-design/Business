import React, { useState } from 'react';
import { X } from 'lucide-react';
import { translations } from '../translations';
import type { KhataCustomer } from '../types';

interface CreateKhataModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (customer: Omit<KhataCustomer, 'id' | 'transactions'>) => KhataCustomer;
    language: 'ne' | 'en';
}

const CreateKhataModal: React.FC<CreateKhataModalProps> = ({ isOpen, onClose, onSave, language }) => {
    const t = translations[language];
    const [customer, setCustomer] = useState({ name: '', phone: '', address: '', pan: '', citizenship: '' });

    if (!isOpen) return null;

    const handleSave = () => {
        if (customer.name && customer.phone && customer.address) {
            onSave(customer);
            setCustomer({ name: '', phone: '', address: '', pan: '', citizenship: '' });
            onClose();
        } else {
            alert(language === 'ne' ? 'कृपया पूरा नाम, फोन नम्बर, र ठेगाना भर्नुहोस्।' : 'Please fill in Full Name, Phone Number, and Address.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end">
            <div className="bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col h-[90vh]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{t.create_khata_title}</h2>
                    <button onClick={onClose}><X /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-600">{t.full_name}</label>
                        <input type="text" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} className="w-full mt-1 p-2 border rounded-md" required />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600">{t.whatsapp_phone}</label>
                        <input type="tel" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} className="w-full mt-1 p-2 border rounded-md" required />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600">{t.address}</label>
                        <input type="text" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} className="w-full mt-1 p-2 border rounded-md" required />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600">{t.pan_number}</label>
                        <input type="text" value={customer.pan} onChange={e => setCustomer({ ...customer, pan: e.target.value })} className="w-full mt-1 p-2 border rounded-md" />
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-600">{t.citizenship_number}</label>
                        <input type="text" value={customer.citizenship} onChange={e => setCustomer({ ...customer, citizenship: e.target.value })} className="w-full mt-1 p-2 border rounded-md" />
                    </div>
                </div>
                <button onClick={handleSave} className="w-full mt-4 bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors">
                    {t.save_khata}
                </button>
            </div>
        </div>
    );
};

export default CreateKhataModal;
