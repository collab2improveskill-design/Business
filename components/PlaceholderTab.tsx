import React from 'react';
import { Package } from 'lucide-react';
import { translations } from '../translations';

interface PlaceholderTabProps {
    pageName: string;
    language: 'ne' | 'en';
}

const PlaceholderTab: React.FC<PlaceholderTabProps> = ({ pageName, language }) => {
    const t = translations[language];
    return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 pt-24">
            <Package className="w-16 h-16 mb-4 text-gray-300" />
            <h2 className="text-xl font-bold text-gray-500 mb-1">{pageName}</h2>
            <p className="text-center">{t.under_construction}</p>
        </div>
    );
};

export default PlaceholderTab;
