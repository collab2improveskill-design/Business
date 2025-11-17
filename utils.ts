import type { InventoryItem } from './types';

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
 * Formats an ISO date string into a readable date and time string (e.g., "Jun 20, 10:45 AM").
 * @param isoDate - The ISO date string to format.
 * @param lang - The current language ('ne' | 'en').
 * @returns A formatted date-time string.
 */
export const formatDateTime = (isoDate: string, lang: 'ne' | 'en'): string => {
    const date = new Date(isoDate);
    const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    };
    return date.toLocaleString(lang === 'ne' ? 'ne-NP' : 'en-US', options);
};