import React from 'react';
import { translations } from '../translations';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    language: 'ne' | 'en';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, language }) => {
    if (!isOpen) return null;
    const t = translations[language];

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                <h2 className="text-xl font-bold mb-2">{title}</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">{t.no}</button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600">{t.yes}</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;