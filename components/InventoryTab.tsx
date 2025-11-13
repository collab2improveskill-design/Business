import React, { useState, useEffect } from 'react';
import { Plus, Search, UploadCloud, X, Loader, Trash2, Edit, ScanLine, PlusCircle, LineChart, Mic } from 'lucide-react';
import { INITIAL_INVENTORY_ITEMS } from '../constants';
import type { InventoryItem, ParsedInventoryItem } from '../types';
import { translations } from '../translations';
import { parseInventoryFromImage } from '../services/geminiService';

interface InventoryTabProps {
  language: 'ne' | 'en';
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

const generateId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const formatDate = (dateString: string, lang: 'ne' | 'en') => {
    return new Date(dateString).toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-US', {
        month: 'short', day: 'numeric'
    });
};


// --- AddItemChoiceModal ---
const AddItemChoiceModal: React.FC<{ isOpen: boolean, onClose: () => void, onScan: () => void, onManual: () => void, language: 'ne' | 'en' }> = ({ isOpen, onClose, onScan, onManual, language }) => {
    if (!isOpen) return null;
    const t = translations[language];

    const handleScan = () => {
        onClose();
        onScan();
    };

    const handleManual = () => {
        onClose();
        onManual();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end">
            <div className="bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold">{t.add_item_choice_title}</h2>
                    <button onClick={onClose}><X/></button>
                </div>
                <p className="text-gray-500 mb-6">{t.add_item_choice_desc}</p>
                <div className="space-y-4">
                    <button onClick={handleScan} className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <ScanLine className="w-8 h-8 text-purple-600" />
                        <div>
                            <p className="font-semibold text-left">{t.scan_bill_button}</p>
                            <p className="text-sm text-gray-500 text-left">{t.upload_desc}</p>
                        </div>
                    </button>
                    <button onClick={handleManual} className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <Edit className="w-8 h-8 text-purple-600" />
                        <div>
                            <p className="font-semibold text-left">{t.add_manually_button}</p>
                            <p className="text-sm text-gray-500 text-left">{t.manual_entry_desc}</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Price History Chart ---
const PriceHistoryChart: React.FC<{ data: { price: number; date: string }[], language: 'ne' | 'en' }> = ({ data, language }) => {
    const width = 300;
    const height = 150;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const parsedData = data.map(d => ({ ...d, date: new Date(d.date) })).sort((a,b) => a.date.getTime() - b.date.getTime());

    const minPrice = Math.min(...parsedData.map(d => d.price));
    const maxPrice = Math.max(...parsedData.map(d => d.price));
    const minDate = parsedData[0].date;
    const maxDate = parsedData[parsedData.length - 1].date;

    const xScale = (date: Date) => {
        if (maxDate.getTime() === minDate.getTime()) return innerWidth / 2;
        return ((date.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * innerWidth;
    };
    
    const yScale = (price: number) => {
        if (maxPrice === minPrice) return innerHeight / 2;
        return innerHeight - ((price - minPrice) / (maxPrice - minPrice)) * innerHeight;
    };

    const linePath = parsedData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(d.date)} ${yScale(d.price)}`).join(' ');

    return (
        <svg width={width} height={height} className="w-full">
            <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Y-Axis Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map(tick => (
                    <line key={tick} x1={0} x2={innerWidth} y1={innerHeight * tick} y2={innerHeight * tick} stroke="#e5e7eb" strokeWidth="0.5" />
                ))}
                {/* Path */}
                <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2" />
                {/* Points */}
                {parsedData.map((d, i) => (
                    <circle key={i} cx={xScale(d.date)} cy={yScale(d.price)} r="3" fill="#8b5cf6" />
                ))}
                {/* Y-Axis Labels */}
                <text x={-5} y={0} dy="0.32em" fontSize="10" textAnchor="end" fill="#6b7280">{maxPrice.toFixed(0)}</text>
                <text x={-5} y={innerHeight} dy="0.32em" fontSize="10" textAnchor="end" fill="#6b7280">{minPrice.toFixed(0)}</text>
                {/* X-Axis Labels */}
                <text x={xScale(minDate)} y={innerHeight + 15} fontSize="10" textAnchor="middle" fill="#6b7280">{formatDate(minDate.toISOString(), language)}</text>
                <text x={xScale(maxDate)} y={innerHeight + 15} fontSize="10" textAnchor="middle" fill="#6b7280">{formatDate(maxDate.toISOString(), language)}</text>
            </g>
        </svg>
    );
};


// --- PriceHistoryModal ---
const PriceHistoryModal: React.FC<{ item: InventoryItem | null, isOpen: boolean, onClose: () => void, language: 'ne' | 'en' }> = ({ item, isOpen, onClose, language }) => {
    if (!isOpen || !item) return null;
    const t = translations[language];
    const chartData = [...item.priceHistory, { price: item.price, date: item.lastUpdated }];

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-5 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{t.price_history_title}</h2>
                    <button onClick={onClose}><X/></button>
                </div>
                <p className="text-center font-semibold text-gray-700 mb-2">{item.name}</p>
                {chartData.length < 2 ? (
                    <div className="h-[150px] flex items-center justify-center text-gray-500">{t.no_price_history}</div>
                ) : (
                    <PriceHistoryChart data={chartData} language={language} />
                )}
            </div>
        </div>
    );
};


// --- ManualAddItemModal ---
const ManualAddItemModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (item: Omit<ParsedInventoryItem, 'id'>) => void, language: 'ne' | 'en' }> = ({ isOpen, onClose, onSave, language }) => {
    const [item, setItem] = useState({ name: '', quantity: '', unit: '', price: '' });
    const t = translations[language];
    
    if (!isOpen) return null;

    const handleSave = () => {
        const newItem = {
            name: item.name,
            quantity: parseFloat(item.quantity) || 0,
            unit: item.unit,
            price: parseFloat(item.price) || 0,
        };
        if (newItem.name && newItem.quantity > 0) {
            onSave(newItem);
            setItem({ name: '', quantity: '', unit: '', price: '' });
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end">
            <div className="bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{t.manual_entry_title}</h2>
                    <button onClick={onClose}><X/></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-600">{t.item_name}</label>
                        <input type="text" value={item.name} onChange={e => setItem({...item, name: e.target.value})} className="w-full mt-1 p-2 border rounded-md" />
                    </div>
                     <div className="grid grid-cols-3 gap-2">
                        <div>
                           <label className="text-sm font-medium text-gray-600">{t.stock}</label>
                           <input type="number" value={item.quantity} onChange={e => setItem({...item, quantity: e.target.value})} className="w-full mt-1 p-2 border rounded-md" />
                        </div>
                        <div>
                           <label className="text-sm font-medium text-gray-600">{t.unit}</label>
                           <input type="text" value={item.unit} onChange={e => setItem({...item, unit: e.target.value})} className="w-full mt-1 p-2 border rounded-md" />
                        </div>
                         <div>
                           <label className="text-sm font-medium text-gray-600">{t.price}</label>
                           <input type="number" value={item.price} onChange={e => setItem({...item, price: e.target.value})} className="w-full mt-1 p-2 border rounded-md" />
                        </div>
                    </div>
                </div>
                <button onClick={handleSave} className="w-full mt-6 bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors">
                    {t.save_item_button}
                </button>
            </div>
        </div>
    );
};


// --- ScanBillModal ---
const ScanBillModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (items: ParsedInventoryItem[]) => void, language: 'ne' | 'en' }> = ({ isOpen, onClose, onSave, language }) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parsedItems, setParsedItems] = useState<ParsedInventoryItem[]>([]);
    const t = translations[language];

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setError(null);
            setParsedItems([]);
        }
    };

    const processImage = async () => {
        if (!imageFile) return;
        setIsProcessing(true);
        setError(null);
        try {
            const base64 = await fileToBase64(imageFile);
            const results = await parseInventoryFromImage(base64, language);
            setParsedItems(results.map(item => ({...item, id: generateId()})));
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleItemChange = (id: string, field: keyof Omit<ParsedInventoryItem, 'id'>, value: string | number) => {
        setParsedItems(items => items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleRemoveItem = (id: string) => {
        setParsedItems(items => items.filter(item => item.id !== id));
    };

    const handleSave = () => {
        onSave(parsedItems);
        handleClose();
    };

    const handleClose = () => {
        setImageFile(null);
        setImagePreview(null);
        setIsProcessing(false);
        setError(null);
        setParsedItems([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end">
            <div className="bg-white w-full max-w-md rounded-t-2xl p-5 h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{t.scan_bill_button}</h2>
                    <button onClick={handleClose}><X/></button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {!imagePreview ? (
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                            <UploadCloud className="w-10 h-10 text-gray-400 mb-2"/>
                            <span className="font-semibold text-gray-600">{t.upload_bill}</span>
                            <span className="text-sm text-gray-500">{t.upload_desc}</span>
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                        </label>
                    ) : (
                        <div className="mb-4">
                            <img src={imagePreview} alt="Bill preview" className="rounded-lg max-h-48 w-auto mx-auto"/>
                        </div>
                    )}

                    {imageFile && !isProcessing && parsedItems.length === 0 && (
                        // Fix: Used `scan_bill_button` translation key which exists for both languages.
                        <button onClick={processImage} className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors mt-4">{t.scan_bill_button}</button>
                    )}
                    
                    {isProcessing && (
                         <div className="flex items-center justify-center gap-2 text-gray-600 p-4">
                            <Loader className="w-6 h-6 animate-spin" />
                            <span>{t.processing_image}</span>
                        </div>
                    )}
                    {error && <p className="text-red-500 text-center p-2">{error}</p>}
                    
                    {parsedItems.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-bold text-lg">{t.edit_parsed_items}</h3>
                            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-500 px-1">
                                <div className="col-span-4">{t.item_name}</div>
                                <div className="col-span-2 text-center">{t.quantity}</div>
                                <div className="col-span-2">{t.unit}</div>
                                <div className="col-span-3 text-center">{t.price}</div>
                            </div>
                            {parsedItems.map((item) => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                                    <input type="text" value={item.name} onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} className="col-span-4 p-2 border rounded-md text-sm" />
                                    <input type="number" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))} className="col-span-2 p-2 border rounded-md text-sm text-center" />
                                    <input type="text" value={item.unit} onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)} className="col-span-2 p-2 border rounded-md text-sm" />
                                    <input type="number" value={item.price} onChange={(e) => handleItemChange(item.id, 'price', Number(e.target.value))} className="col-span-3 p-2 border rounded-md text-sm text-center" />
                                    <button onClick={() => handleRemoveItem(item.id)} className="col-span-1 flex justify-center items-center text-red-400 hover:text-red-600">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                 {parsedItems.length > 0 && (
                    <button onClick={handleSave} className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors">
                        {t.save_to_inventory}
                    </button>
                 )}
            </div>
        </div>
    );
};


// --- Main InventoryTab Component ---
const InventoryTab: React.FC<InventoryTabProps> = ({ language }) => {
    const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY_ITEMS);
    const [searchTerm, setSearchTerm] = useState('');
    const [modal, setModal] = useState<'scan' | 'manual' | 'history' | 'choice' | null>(null);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isVoiceSearching, setIsVoiceSearching] = useState(false);

    const t = translations[language];

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;

    useEffect(() => {
        if (!recognition) return;

        recognition.lang = language === 'ne' ? 'ne-NP' : 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setSearchTerm(transcript);
        };

        recognition.onend = () => {
            setIsVoiceSearching(false);
        };
        
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsVoiceSearching(false);
        };
        
        return () => {
          if (recognition) {
            recognition.stop();
          }
        }
    }, [language, recognition]);

    const handleVoiceSearch = () => {
        if (!recognition) {
            alert("Speech recognition is not supported in your browser.");
            return;
        }
        if (isVoiceSearching) {
            recognition.stop();
        } else {
            setSearchTerm('');
            recognition.start();
            setIsVoiceSearching(true);
        }
    };


    const filteredInventory = inventory.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const updateInventory = (newItems: Omit<ParsedInventoryItem, 'id'>[]) => {
      setInventory(prevInventory => {
        const updatedInventory = [...prevInventory];
        const now = new Date().toISOString();

        newItems.forEach(newItem => {
          const existingItemIndex = updatedInventory.findIndex(
            invItem => invItem.name.toLowerCase() === newItem.name.toLowerCase()
          );

          if (existingItemIndex > -1) {
            const existingItem = updatedInventory[existingItemIndex];
            const priceChanged = existingItem.price !== newItem.price;
            updatedInventory[existingItemIndex] = {
              ...existingItem,
              stock: existingItem.stock + newItem.quantity,
              price: newItem.price,
              lastUpdated: now,
              priceHistory: priceChanged && existingItem.price > 0
                ? [...existingItem.priceHistory, { price: existingItem.price, date: existingItem.lastUpdated }] 
                : existingItem.priceHistory,
            };
          } else {
            updatedInventory.push({
              id: generateId(),
              name: newItem.name,
              stock: newItem.quantity,
              unit: newItem.unit,
              price: newItem.price,
              lastUpdated: now,
              priceHistory: [],
            });
          }
        });
        return updatedInventory.sort((a,b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
      });
    };

    const handleSaveFromScan = (scannedItems: ParsedInventoryItem[]) => {
        updateInventory(scannedItems);
    };

    const handleSaveManualItem = (manualItem: Omit<ParsedInventoryItem, 'id'>) => {
        updateInventory([manualItem]);
    };

    const handleOpenHistory = (item: InventoryItem) => {
        setSelectedItem(item);
        setModal('history');
    };

    const renderPriceChange = (item: InventoryItem) => {
        const lastHistory = item.priceHistory.length > 0 ? item.priceHistory[item.priceHistory.length - 1] : null;
        if (!lastHistory || lastHistory.price === item.price) return null;

        const change = item.price - lastHistory.price;
        if (change > 0) {
            return <span className="text-xs text-red-500 ml-2">(▲ रु.{change.toFixed(2)})</span>;
        }
        if (change < 0) {
            return <span className="text-xs text-green-500 ml-2">(▼ रु.{Math.abs(change).toFixed(2)})</span>;
        }
        return <span className="text-xs text-gray-400 ml-2">({t.no_change})</span>;
    };
    
  return (
    <>
      <AddItemChoiceModal
        isOpen={modal === 'choice'}
        onClose={() => setModal(null)}
        onScan={() => setModal('scan')}
        onManual={() => setModal('manual')}
        language={language}
      />
      <ScanBillModal 
        isOpen={modal === 'scan'} 
        onClose={() => setModal(null)} 
        onSave={handleSaveFromScan}
        language={language}
      />
      <ManualAddItemModal
        isOpen={modal === 'manual'}
        onClose={() => setModal(null)}
        onSave={handleSaveManualItem}
        language={language}
      />
      <PriceHistoryModal
        isOpen={modal === 'history'}
        onClose={() => { setModal(null); setSelectedItem(null); }}
        item={selectedItem}
        language={language}
      />
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">{t.inventory_management}</h1>
          <div className="flex items-center gap-2">
             <button onClick={() => setModal('choice')} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium flex items-center gap-2 shadow-md hover:bg-purple-700 transition">
                <Plus className="w-5 h-5" />
                {t.add_item_button}
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-2 shadow-sm">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder={t.search_items} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-12 py-3 border border-gray-200 bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button 
                onClick={handleVoiceSearch} 
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 transition-colors"
                aria-label="Search with voice"
            >
                <Mic className={`w-5 h-5 ${isVoiceSearching ? 'text-purple-600 animate-pulse' : 'text-gray-500'}`} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h3 className="font-bold text-gray-800">{t.all_items}</h3>
          </div>
          <div className="divide-y">
              {filteredInventory.length > 0 ? filteredInventory.map((item) => (
              <div key={item.id} onClick={() => handleOpenHistory(item)} className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-sm text-gray-600">
                      रु.{item.price.toFixed(2)}
                      {renderPriceChange(item)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{t.remaining} <span className="font-bold">{item.stock} {item.unit}</span> &bull; {t.last_updated}: {formatDate(item.lastUpdated, language)}</p>
                  </div>
                  <LineChart className="w-5 h-5 text-gray-400" />
              </div>
              )) : (
                  <p className="p-4 text-center text-gray-500">{t.no_items_found}</p>
              )}
          </div>
        </div>
      </div>
    </>
  );
};

export default InventoryTab;