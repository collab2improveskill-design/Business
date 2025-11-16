
import type { InventoryItem } from './types';
import { translations } from './translations';

/**
 * Generates a unique ID string for list items.
 */
export const generateId = (): string => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Finds a matching inventory item from a given name string with fallback logic.
 * @param name - The name of the item to search for (e.g., from voice input).
 * @param inventory - The array of all inventory items.
 * @returns The matched InventoryItem or undefined.
 */
export const findInventoryItem = (name: string, inventory: InventoryItem[]): InventoryItem | undefined => {
    const normalizedName = name.toLowerCase().trim();
    // A more robust search can handle pluralization or variations.
    // Example: "sugar" should match "sugar (1 kg)"
    const baseName = normalizedName.split(/[\s(]/)[0].trim();

    // 1. Prefer exact match
    const exactMatch = inventory.find(i => i.name.toLowerCase().trim() === normalizedName);
    if (exactMatch) return exactMatch;

    // 2. Match just the name part, ignoring unit/size in brackets
    const nameOnlyMatch = inventory.find(i => i.name.toLowerCase().trim().split('(')[0].trim() === normalizedName);
    if (nameOnlyMatch) return nameOnlyMatch;
    
    // 3. Fallback to partial match on the base name (e.g., 'dal' matches 'sunaulo dal')
    const partialMatch = inventory.find(i => i.name.toLowerCase().trim().includes(baseName));
    if (partialMatch) return partialMatch;

    return undefined;
};


/**
 * Formats an ISO date string into a relative time string (e.g., "5 min ago").
 * @param isoDate - The ISO date string to format.
 * @param lang - The current language ('ne' | 'en').
 * @param t - The translation object for the current language.
 * @returns A formatted relative time string.
 */
export const formatRelativeTime = (isoDate: string, lang: 'ne' | 'en', t: typeof translations.ne): string => {
    const now = new Date();
    const saleDate = new Date(isoDate);
    const diffInSeconds = Math.floor((now.getTime() - saleDate.getTime()) / 1000);

    if (diffInSeconds < 60) return t.moments_ago;
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return t.minutes_ago.replace('{minutes}', diffInMinutes.toString());

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return t.hours_ago.replace('{hours}', diffInHours.toString());
    
    const diffInDays = Math.floor(diffInHours / 24);
    return t.days_ago.replace('{days}', diffInDays.toString());
};
