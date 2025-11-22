
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

const KhataPaymentModal: React.FC<KhataPaymentModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirmPayment, 
    grandTotal, 
    todaysBillTotal, 
    language,
    defaultSelection
}) => {
    const [amountToPay, setAmountToPay] = useState('');
    const [selectedMethod, setSelectedMethod] = useState<'cash' | 'qr' | null>(null);
    const t = translations[language];

    // Determine Mode based on whether there is a current bill
    const isBillSettlementMode = todaysBillTotal > 0;
    
    // Set default amount based on mode when modal opens
    useEffect(() => {
        if (isOpen) {
            if (isBillSettlementMode) {
                // Scenario B: Default to paying the bill amount
                setAmountToPay(todaysBillTotal.toFixed(0));
            } else {
                // Scenario A: Default to paying the total due
                setAmountToPay(grandTotal.toFixed(0));
            }
            setSelectedMethod(null);
        }
    }, [isOpen, isBillSettlementMode, todaysBillTotal, grandTotal]);

    const payAmount = parseFloat(amountToPay) || 0;

    // --- Math Logic ---
    let mathDisplay = null;

    if (isBillSettlementMode) {
        // Scenario B: Bill Settlement
        // Logic: Current Bill - Payment = Added to Debt (or Advance)
        const balanceChange = todaysBillTotal - payAmount;
        const isSettled = Math.abs(balanceChange) < 1;
        const isAdvance = balanceChange < 0;

        mathDisplay = (
            <div className="flex items-center justify-between font-mono text-sm">
                <div className="flex flex-col items-center">
                    <span className="text-blue-600 font-bold">Rs {todaysBillTotal.toFixed(0)}</span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-tight">{t.current_bill}</span>
                </div>
                <span className="text-gray-400 font-bold pb-3">-</span>
                <div className="flex flex-col items-center">
                    <span className="text-green-600 font-bold">Rs {payAmount.toFixed(0)}</span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-tight">{t.paid}</span>
                </div>
                <span className="text-gray-400 font-bold pb-3">=</span>
                <div className="flex flex-col items-center">
                    <span className={`font-extrabold ${isSettled ? 'text-gray-400' : (isAdvance ? 'text-green-600' : 'text-red-600')}`}>
                        {isSettled ? '0' : (isAdvance ? Math.abs(balanceChange).toFixed(0) : balanceChange.toFixed(0))}
                    </span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-tight">
                        {isSettled ? t.math_bill_settled : (isAdvance ? t.math_advance : t.math_added_to_due)}
                    </span>
                </div>
            </div>
        );
    } else {
        // Scenario A: Old Debt Settlement
        // Logic: Total Due - Payment = New Balance
        const newBalance = grandTotal - payAmount;
        
        mathDisplay = (
            <div className="flex items-center justify-between font-mono text-sm">
                 <div className="flex flex-col items-center">
                    <span className="text-red-600 font-bold">Rs {grandTotal.toFixed(0)}</span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-tight">{t.previous_due}</span>
                 </div>
                 <span className="text-gray-400 font-bold pb-3">-</span>
                 <div className="flex flex-col items-center">
                    <span className="text-green-600 font-bold">Rs {payAmount.toFixed(0)}</span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-tight">{t.paid}</span>
                 </div>
                 <span className="text-gray-400 font-bold pb-3">=</span>
                 <div className="flex flex-col items-center">
                    <span className="font-extrabold text-gray-800">Rs {newBalance.toFixed(0)}</span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-tight">{t.math_new_balance}</span>
                 </div>
            </div>
        );
    }

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!selectedMethod) return;
        if (!isNaN(payAmount) && payAmount > 0) {
            onConfirmPayment(payAmount, selectedMethod);
        } else {
            alert(language === 'ne' ? 'कृपया मान्य रकम प्रविष्ट गर्नुहोस्।' : 'Please enter a valid amount.');
        }
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAmountToPay(e.target.value);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex justify-center items-end">
            <div className="bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{isBillSettlementMode ? t.settle_current_bill : t.pay_previous_due}</h2>
                    <button onClick={onClose}><X /></button>
                </div>
                
                <div className="mb-4">
                    <label className="text-sm font-medium text-gray-600">{t.enter_amount}</label>
                    <input
                        type="number"
                        value={amountToPay}
                        onChange={handleAmountChange}
                        className="w-full mt-1 p-3 text-2xl font-bold border-2 rounded-md text-center focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        autoFocus
                        placeholder="0"
                    />
                </div>

                {/* Dynamic Math Breakdown Section */}
                <div className={`mb-6 p-3 rounded-xl border border-dashed ${isBillSettlementMode ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-300'}`}>
                    {mathDisplay}
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
