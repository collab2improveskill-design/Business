
import React, { useState, useEffect } from 'react';
import { X, DollarSign, QrCode } from 'lucide-react';
import { translations } from '../translations';

interface KhataPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirmPayment: (amountPaid: number, paymentMethod: 'cash' | 'qr') => void;
    grandTotal: number;
    todaysBillTotal: number;
    language: 'ne' | 'en';
    defaultSelection?: 'today' | 'grand';
}

type ChipSelection = 'today' | 'grand' | 'custom';

const KhataPaymentModal: React.FC<KhataPaymentModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirmPayment, 
    grandTotal, 
    todaysBillTotal, 
    language,
    defaultSelection = 'grand'
}) => {
    const [amountToPay, setAmountToPay] = useState(grandTotal.toFixed(2));
    const [selectedChip, setSelectedChip] = useState<ChipSelection>('grand');
    const [selectedMethod, setSelectedMethod] = useState<'cash' | 'qr' | null>(null);
    const t = translations[language];

    useEffect(() => {
        if (isOpen) {
            // Smart selection logic:
            // If default is 'today' AND todaysBillTotal > 0, select 'today'
            // Otherwise fall back to 'grand'
            const initialSelection = (defaultSelection === 'today' && todaysBillTotal > 0) ? 'today' : 'grand';
            
            setSelectedChip(initialSelection);
            if (initialSelection === 'today') {
                setAmountToPay(todaysBillTotal.toFixed(2));
            } else {
                setAmountToPay(grandTotal.toFixed(2));
            }
            setSelectedMethod(null);
        }
    }, [isOpen, defaultSelection, todaysBillTotal, grandTotal]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!selectedMethod) return;
        const amount = parseFloat(amountToPay);
        if (!isNaN(amount) && amount > 0) {
            onConfirmPayment(amount, selectedMethod);
        } else {
            alert(language === 'ne' ? 'कृपया मान्य रकम प्रविष्ट गर्नुहोस्।' : 'Please enter a valid amount.');
        }
    };

    const handleChipClick = (chip: 'grand' | 'today') => {
        setSelectedChip(chip);
        if (chip === 'grand') {
            setAmountToPay(grandTotal.toFixed(2));
        } else {
            setAmountToPay(todaysBillTotal.toFixed(2));
        }
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAmountToPay(e.target.value);
        setSelectedChip('custom');
    };

    const chipStyle = (isActive: boolean) => 
        `px-3 py-2 text-sm font-semibold rounded-lg border-2 transition-colors ${
        isActive ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`;

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex justify-center items-end">
            <div className="bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{t.receive_payment}</h2>
                    <button onClick={onClose}><X /></button>
                </div>
                
                <div className="mb-4">
                    <label className="text-sm font-medium text-gray-600 mb-2 block">{t.select_amount_to_pay}</label>
                    <div className="flex gap-2">
                        {todaysBillTotal > 0 && (
                            <button onClick={() => handleChipClick('today')} className={chipStyle(selectedChip === 'today')}>
                                {t.pay_todays_bill.replace('{amount}', todaysBillTotal.toFixed(0))}
                            </button>
                        )}
                         <button onClick={() => handleChipClick('grand')} className={chipStyle(selectedChip === 'grand')}>
                            {t.pay_grand_total.replace('{amount}', grandTotal.toFixed(0))}
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="text-sm font-medium text-gray-600">Enter Amount</label>
                    <input
                        type="number"
                        value={amountToPay}
                        onChange={handleAmountChange}
                        className="w-full mt-1 p-3 text-2xl font-bold border-2 rounded-md text-center focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        autoFocus
                    />
                </div>
                
                <div className="mb-6">
                    <label className="text-sm font-medium text-gray-600 mb-2 block">{t.payment_method}</label>
                     <div className="grid grid-cols-2 gap-3">
                         <button onClick={() => setSelectedMethod('cash')} className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg ${selectedMethod === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                            <DollarSign className="w-6 h-6 text-green-600" />
                            <span className="font-semibold">{t.pay_by_cash}</span>
                         </button>
                         <button onClick={() => setSelectedMethod('qr')} className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg ${selectedMethod === 'qr' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                            <QrCode className="w-6 h-6 text-blue-600" />
                            <span className="font-semibold">{t.pay_by_qr}</span>
                         </button>
                     </div>
                </div>

                <button 
                    onClick={handleConfirm}
                    disabled={!selectedMethod || parseFloat(amountToPay) <= 0}
                    className="w-full py-3.5 rounded-lg font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed">
                    {t.confirm_payment}
                </button>
            </div>
        </div>
    );
};

export default KhataPaymentModal;
