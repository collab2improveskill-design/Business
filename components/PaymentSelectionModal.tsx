import React, { useState } from 'react';
import { X, DollarSign, QrCode, BookUser, UserPlus } from 'lucide-react';
import { translations } from '../translations';
import type { KhataCustomer, EditableBillItem } from '../types';

type PaymentContext = { type: 'home'; customerName: string } | { type: 'khata'; customerId: string; customerName: string } | null;

interface PaymentSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    billTotal: number;
    context: PaymentContext;
    language: 'ne' | 'en';
    onFinalizeSale: (
        billItems: EditableBillItem[],
        customerName: string,
        totalAmount: number,
        paymentMethod: 'cash' | 'qr' | 'credit',
        customerId?: string
    ) => { success: boolean, error?: string };
    khataCustomers: KhataCustomer[];
    onOpenCreateKhata: () => void;
    billItems: EditableBillItem[];
}

const PaymentSelectionModal: React.FC<PaymentSelectionModalProps> = ({
    isOpen,
    onClose,
    billTotal,
    context,
    language,
    onFinalizeSale,
    khataCustomers,
    onOpenCreateKhata,
    billItems
}) => {
    const t = translations[language];
    const [showCustomerSelection, setShowCustomerSelection] = useState(false);
    const [saleError, setSaleError] = useState<string | null>(null);

    if (!isOpen || !context) return null;

    const handleFinalize = (paymentMethod: 'cash' | 'qr' | 'credit', customerId?: string) => {
        setSaleError(null);
        const customerName = context.type === 'home' ? context.customerName : khataCustomers.find(c => c.id === customerId)?.name || 'Unknown';
        
        const result = onFinalizeSale(
            billItems,
            customerName,
            billTotal,
            paymentMethod,
            customerId
        );
        
        if (result.success) {
            onClose();
            setShowCustomerSelection(false);
        } else {
            setSaleError(result.error || 'An unknown error occurred.');
        }
    };

    const handleCreditPayment = () => {
        if (context.type === 'khata') {
            handleFinalize('credit', context.customerId);
        } else {
            setShowCustomerSelection(true);
        }
    };

    const handleSelectCustomerForCredit = (customerId: string) => {
        handleFinalize('credit', customerId);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end">
            <div className="bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold">{showCustomerSelection ? t.select_customer : t.select_payment_method}</h2>
                    <button onClick={onClose}><X /></button>
                </div>
                
                {saleError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-md my-2 text-sm" role="alert">
                        <p className="font-bold">{t.error}</p>
                        <p>{saleError}</p>
                    </div>
                 )}

                {!showCustomerSelection && (
                    <>
                        <p className="text-center text-gray-500 mb-4">{t.total}</p>
                        <p className="text-center text-4xl font-extrabold text-purple-600 mb-6">रु. {billTotal.toFixed(2)}</p>
                        <div className="space-y-3">
                            <button onClick={() => handleFinalize('cash')} className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                                <DollarSign className="w-8 h-8 text-green-600" />
                                <p className="font-semibold text-left text-lg">{t.pay_by_cash}</p>
                            </button>
                            <button onClick={() => handleFinalize('qr')} className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                                <QrCode className="w-8 h-8 text-blue-600" />
                                <p className="font-semibold text-left text-lg">{t.pay_by_qr}</p>
                            </button>
                            <button onClick={handleCreditPayment} className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                                <BookUser className="w-8 h-8 text-orange-600" />
                                <p className="font-semibold text-left text-lg">{t.pay_on_credit}</p>
                            </button>
                        </div>
                    </>
                )}

                {showCustomerSelection && (
                    <div className="max-h-80 overflow-y-auto space-y-2 mt-4">
                        {khataCustomers.map(customer => (
                            <div key={customer.id} onClick={() => handleSelectCustomerForCredit(customer.id)} className="bg-white rounded-xl p-3 border flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors">
                                <div>
                                    <p className="font-bold text-gray-800">{customer.name}</p>
                                    <p className="text-sm text-gray-500">{customer.address}</p>
                                </div>
                            </div>
                        ))}
                         <button onClick={onOpenCreateKhata} className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg hover:bg-gray-50 text-purple-600 font-semibold transition-colors mt-2">
                            <UserPlus className="w-5 h-5"/>
                            {t.or_create_new}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentSelectionModal;
