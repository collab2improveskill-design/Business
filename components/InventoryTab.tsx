
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, UploadCloud, X, Loader, Trash2, Edit, ScanLine, PlusCircle, LineChart, Mic, Tag, AlertTriangle, ChevronDown } from 'lucide-react';
import type { InventoryItem, ParsedBillItemFromImage } from '../types';
import { translations } from '../translations';
import { parseInventoryFromImage } from '../services/geminiService';
import { CATEGORIES } from '../constants';
import { generateId } from '../utils';


interface InventoryTabProps {
  language: 'ne' | 'en';
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
}

// A new type for items being reviewed after a scan
type ReviewableItem = ParsedBillItemFromImage & {
    sellingPrice: number;
    isNew: boolean;
    category: string;
    lowStockThreshold: number;
    isSelected: boolean;
};


const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

const formatDate = (dateString: string, lang: 'ne' | 'en') => {
    return new Date(dateString).toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
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
    if (parsedData.length === 0) return null;

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
                <text x={xScale(minDate)} y={innerHeight + 15} fontSize="10" textAnchor="middle" fill="#6b7280">{new Date(minDate).toLocaleDateString(language, {month: 'short', day: '2-digit'})}</text>
                {maxDate.getTime() !== minDate.getTime() && <text x={xScale(maxDate)} y={innerHeight + 15} fontSize="10" textAnchor="middle" fill="#6b7280">{new Date(maxDate).toLocaleDateString(language, {month: 'short', day: '2-digit'})}</text>}
            </g>
        </svg>
    );
};


// --- PriceHistoryModal ---
const PriceHistoryModal: React.FC<{ item: InventoryItem | null, isOpen: boolean, onClose: () => void, language: 'ne' | 'en' }> = ({ item, isOpen, onClose, language }) => {
    if (!isOpen || !item) return null;
    const t = translations[language];
    const chartData = item.purchasePriceHistory;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl p-5 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{t.price_history_title}</h2>
                    <button onClick={onClose}><X/></button>
                </div>
                <p className="text-center font-semibold text-gray-700 mb-2">{item.name}</p>
                {chartData.length < 1 ? (
                    <div className="h-[150px] flex items-center justify-center text-gray-500">{t.no_price_history}</div>
                ) : (
                    <PriceHistoryChart data={chartData} language={language} />
                )}
                
                <h3 className="font-bold text-lg mt-4 mb-2">{t.purchase_log}</h3>
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                      <tr>
                        <th scope="col" className="px-2 py-2">{t.purchase_date}</th>
                        <th scope="col" className="px-2 py-2 text-center">{t.qty_bought}</th>
                        <th scope="col" className="px-2 py-2 text-right">{t.price_paid_per_unit}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.purchasePriceHistory.slice().reverse().map((record, index) => (
                        <tr key={index} className="bg-white border-b last:border-0">
                          <td className="px-2 py-2">{formatDate(record.date, language)}</td>
                          <td className="px-2 py-2 text-center">{record.quantity}</td>
                          <td className="px-2 py-2 text-right">रू {record.price.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>
        </div>
    );
};


// --- ManualAddItemModal ---
const ManualAddItemModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (item: Omit<ParsedBillItemFromImage, 'id'>) => void, language: 'ne' | 'en' }> = ({ isOpen, onClose, onSave, language }) => {
    const [item, setItem] = useState({ name: '', quantity: '', unit: '', price: '' });
    const t = translations[language];
    
    if (!isOpen) return null;

    const handleSave = () => {
        const newItem = {
            name: item.name,
            quantity: parseFloat(item.quantity) || 0,
            unit: item.unit,
            price: parseFloat(item.price) || 0, // This is purchase price
            suggestedCategory: 'Other',
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
                           <label className="text-sm font-medium text-gray-600">{t.purchase_price}</label>
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
const ScanBillModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (items: ReviewableItem[]) => void, language: 'ne' | 'en', inventory: InventoryItem[] }> = ({ isOpen, onClose, onSave, language, inventory }) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reviewItems, setReviewItems] = useState<ReviewableItem[]>([]);
    const t = translations[language];

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setError(null);
            setReviewItems([]);
        }
    };

    const processImage = async () => {
        if (!imageFile) return;
        setIsProcessing(true);
        setError(null);
        try {
            const base64 = await fileToBase64(imageFile);
            const results = await parseInventoryFromImage(base64, language);
            const itemsToReview: ReviewableItem[] = results.map(pItem => {
                const existing = inventory.find(i => i.name.toLowerCase() === pItem.name.toLowerCase());
                if (existing) {
                    return { ...pItem, id: generateId(), isNew: false, sellingPrice: existing.price, category: existing.category, lowStockThreshold: existing.lowStockThreshold, isSelected: true };
                } else {
                    return { ...pItem, id: generateId(), isNew: true, sellingPrice: Math.ceil(pItem.price * 1.15), category: pItem.suggestedCategory || 'Other', lowStockThreshold: 10, isSelected: true };
                }
            });
            setReviewItems(itemsToReview);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleItemChange = (id: string, field: keyof ReviewableItem, value: string | number | boolean) => {
        setReviewItems(items => items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };
    
    const handleSelectAll = (checked: boolean) => {
        setReviewItems(items => items.map(item => ({ ...item, isSelected: checked })));
    };
    
    const handleApplyMargin = () => {
        setReviewItems(items => items.map(item => item.isSelected ? { ...item, sellingPrice: Math.ceil(item.price * 1.15) } : item));
    };

    const handleAssignCategory = (category: string) => {
        setReviewItems(items => items.map(item => item.isSelected ? { ...item, category } : item));
    };

    const handleSave = () => {
        onSave(reviewItems);
        handleClose();
    };

    const handleClose = () => {
        setImageFile(null);
        setImagePreview(null);
        setIsProcessing(false);
        setError(null);
        setReviewItems([]);
        onClose();
    };

    if (!isOpen) return null;
    const allSelected = reviewItems.every(i => i.isSelected);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end">
            <div className="bg-white w-full max-w-md rounded-t-2xl p-5 h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{t.scan_bill_button}</h2>
                    <button onClick={handleClose}><X/></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4">
                    {!imagePreview && (
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                            <UploadCloud className="w-10 h-10 text-gray-400 mb-2"/>
                            <span className="font-semibold text-gray-600">{t.upload_bill}</span>
                            <span className="text-sm text-gray-500">{t.upload_desc}</span>
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                        </label>
                    )}

                    {imagePreview && (
                        <div className="mb-4 text-center">
                            <img src={imagePreview} alt="Bill preview" className="rounded-lg max-h-40 w-auto mx-auto"/>
                            <button onClick={() => {setImagePreview(null); setImageFile(null); setReviewItems([])}} className="text-xs text-red-500 mt-2">{t.cancel}</button>
                        </div>
                    )}


                    {imageFile && !isProcessing && reviewItems.length === 0 && (
                        <button onClick={processImage} className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors mt-4">{t.scan_bill_button}</button>
                    )}
                    
                    {isProcessing && (
                         <div className="flex items-center justify-center gap-2 text-gray-600 p-4">
                            <Loader className="w-6 h-6 animate-spin" />
                            <span>{t.processing_image}</span>
                        </div>
                    )}
                    {error && <p className="text-red-500 text-center p-2">{error}</p>}
                    
                    {reviewItems.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-bold text-lg">{t.edit_parsed_items}</h3>
                            <div className="bg-gray-50 p-2 rounded-lg space-y-2">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={allSelected} onChange={e => handleSelectAll(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                                    <label className="text-sm font-medium">{t.select_all}</label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={handleApplyMargin} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-md">{t.apply_margin}</button>
                                    <button onClick={() => handleAssignCategory('Grocery')} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-md">{t.assign_category} 'Grocery'</button>
                                </div>
                            </div>
                            {reviewItems.map((item) => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-start p-2 border rounded-lg">
                                    <input type="checkbox" checked={item.isSelected} onChange={e => handleItemChange(item.id, 'isSelected', e.target.checked)} className="col-span-1 mt-2 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"/>
                                    <div className="col-span-11 space-y-2">
                                        <input type="text" value={item.name} onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} className="w-full p-2 border rounded-md text-sm font-semibold" />
                                        {item.isNew && <span className="text-xs text-green-600 font-semibold ml-1">{t.new_item}</span>}
                                        <div className="grid grid-cols-5 gap-2">
                                            <input type="number" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))} className="col-span-1 p-2 border rounded-md text-sm text-center" title={t.quantity} />
                                            <input type="number" value={item.price} onChange={(e) => handleItemChange(item.id, 'price', Number(e.target.value))} className="col-span-2 p-2 border rounded-md text-sm text-center" title={t.purchase_price} />
                                            <input type="number" value={item.sellingPrice} onChange={(e) => handleItemChange(item.id, 'sellingPrice', Number(e.target.value))} className="col-span-2 p-2 border rounded-md text-sm text-center bg-purple-50" title={t.selling_price} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <select value={item.category} onChange={e => handleItemChange(item.id, 'category', e.target.value)} className="w-full p-2 border rounded-md text-sm">
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <input type="number" value={item.lowStockThreshold} onChange={e => handleItemChange(item.id, 'lowStockThreshold', Number(e.target.value))} className="w-full p-2 border rounded-md text-sm" placeholder={t.low_stock_threshold}/>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                 {reviewItems.length > 0 && (
                    <button onClick={handleSave} className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors">
                        {t.save_to_inventory}
                    </button>
                 )}
            </div>
        </div>
    );
};


// --- Main InventoryTab Component ---
const InventoryTab: React.FC<InventoryTabProps> = ({ language, inventory, setInventory }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [modal, setModal] = useState<'scan' | 'manual' | 'history' | 'choice' | null>(null);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isVoiceSearching, setIsVoiceSearching] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'stock' | 'category', direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    const t = translations[language];

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;
    
    const uniqueCategories = useMemo(() => ['all', ...Array.from(new Set(inventory.map(item => item.category)))], [inventory]);

    useEffect(() => {
        if (!recognition) return;

        recognition.lang = language === 'ne' ? 'ne-NP' : 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setSearchTerm(transcript);
        };

        recognition.onend = () => setIsVoiceSearching(false);
        recognition.onerror = (event: any) => { console.error('Speech recognition error:', event.error); setIsVoiceSearching(false); };
        
        return () => { if (recognition) { recognition.stop(); recognition.onresult = null; recognition.onend = null; recognition.onerror = null; } }
    }, [language, recognition]);

    const handleVoiceSearch = () => {
        if (!recognition) { alert("Speech recognition is not supported in your browser."); return; }
        if (isVoiceSearching) { recognition.stop(); } else { setSearchTerm(''); recognition.start(); setIsVoiceSearching(true); }
    };

    const sortedAndFilteredInventory = useMemo(() => {
        let items = [...inventory];

        if (categoryFilter !== 'all') {
            items = items.filter(item => item.category === categoryFilter);
        }

        if (searchTerm) {
            items = items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        if (sortConfig !== null) {
            items.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return items;
    }, [inventory, searchTerm, sortConfig, categoryFilter]);
    
    const requestSort = (key: 'name' | 'stock' | 'category') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const updateInventory = (newItems: (Omit<ParsedBillItemFromImage, 'id'> | ReviewableItem)[]) => {
      setInventory(prevInventory => {
        const updatedInventory = [...prevInventory];
        const now = new Date().toISOString();

        newItems.forEach(newItem => {
          const { category, lowStockThreshold } = 'category' in newItem ? newItem : { category: 'Other', lowStockThreshold: 10 };

          const existingItemIndex = updatedInventory.findIndex(
            invItem => invItem.name.toLowerCase() === newItem.name.toLowerCase()
          );

          const sellingPrice = 'sellingPrice' in newItem ? newItem.sellingPrice : Math.ceil(newItem.price * 1.15);

          if (existingItemIndex > -1) {
            const existingItem = updatedInventory[existingItemIndex];
            updatedInventory[existingItemIndex] = {
              ...existingItem,
              stock: existingItem.stock + newItem.quantity,
              price: sellingPrice,
              category,
              lowStockThreshold,
              lastUpdated: now,
              purchasePriceHistory: [...existingItem.purchasePriceHistory, { price: newItem.price, date: now, quantity: newItem.quantity }]
            };
          } else {
            updatedInventory.push({
              id: generateId(),
              name: newItem.name,
              stock: newItem.quantity,
              unit: newItem.unit,
              price: sellingPrice,
              category,
              lowStockThreshold,
              lastUpdated: now,
              purchasePriceHistory: [{ price: newItem.price, date: now, quantity: newItem.quantity }],
            });
          }
        });
        return updatedInventory.sort((a,b) => a.name.localeCompare(b.name));
      });
    };

    const handleSaveFromScan = (scannedItems: ReviewableItem[]) => { updateInventory(scannedItems); };
    const handleSaveManualItem = (manualItem: Omit<ParsedBillItemFromImage, 'id'>) => { updateInventory([manualItem]); };
    const handleOpenHistory = (item: InventoryItem) => { setSelectedItem(item); setModal('history'); };
    
  return (
    <>
      <AddItemChoiceModal isOpen={modal === 'choice'} onClose={() => setModal(null)} onScan={() => setModal('scan')} onManual={() => setModal('manual')} language={language} />
      <ScanBillModal isOpen={modal === 'scan'} onClose={() => setModal(null)} onSave={handleSaveFromScan} language={language} inventory={inventory} />
      <ManualAddItemModal isOpen={modal === 'manual'} onClose={() => setModal(null)} onSave={handleSaveManualItem} language={language} />
      <PriceHistoryModal isOpen={modal === 'history'} onClose={() => { setModal(null); setSelectedItem(null); }} item={selectedItem} language={language} />
      
      <div className="space-y-6 pb-20">
        <h1 className="text-2xl font-bold text-gray-800">{t.inventory_management}</h1>
        
        <div className="bg-white rounded-xl p-2 shadow-sm space-y-2">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder={t.search_items} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-12 py-3 border border-gray-200 bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"/>
            <button onClick={handleVoiceSearch} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 transition-colors" aria-label="Search with voice">
                <Mic className={`w-5 h-5 ${isVoiceSearching ? 'text-purple-600 animate-pulse' : 'text-gray-500'}`} />
            </button>
          </div>
          <div className="flex gap-2">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full p-2 border border-gray-200 bg-gray-50 rounded-lg text-sm">
                {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat === 'all' ? t.all_items : cat}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 grid grid-cols-5 gap-2 bg-gray-50 border-b text-xs font-bold text-gray-500">
            <button onClick={() => requestSort('name')} className="col-span-3 text-left flex items-center">{t.item_name} <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig?.key === 'name' && sortConfig.direction === 'desc' ? 'rotate-180': ''}`}/></button>
            <button onClick={() => requestSort('stock')} className="col-span-1 text-right flex items-center justify-end">{t.stock} <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig?.key === 'stock' && sortConfig.direction === 'desc' ? 'rotate-180': ''}`}/></button>
            <button onClick={() => requestSort('category')} className="col-span-1 text-right flex items-center justify-end">{t.category} <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig?.key === 'category' && sortConfig.direction === 'desc' ? 'rotate-180': ''}`}/></button>
          </div>
          <div className="divide-y">
              {sortedAndFilteredInventory.length > 0 ? sortedAndFilteredInventory.map((item) => (
              <div key={item.id} onClick={() => handleOpenHistory(item)} className="p-4 grid grid-cols-5 gap-2 hover:bg-gray-50 cursor-pointer">
                  <div className="col-span-3">
                    <p className="font-medium text-gray-800 flex items-center gap-2">
                        {item.stock <= item.lowStockThreshold && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                        {item.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-purple-600"/> {t.selling_price}: रू{item.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="col-span-1 text-right">
                    <p className="font-bold text-sm">{item.stock} <span className="font-normal text-xs">{item.unit}</span></p>
                  </div>
                   <div className="col-span-1 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{item.category}</span>
                  </div>
              </div>
              )) : (
                  <p className="p-4 text-center text-gray-500">{t.no_items_found}</p>
              )}
          </div>
        </div>
      </div>
      
      <button onClick={() => setModal('choice')} className="fixed bottom-24 right-6 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" aria-label={t.add_item_button}>
        <Plus className="w-6 h-6" />
      </button>
    </>
  );
};

export default InventoryTab;