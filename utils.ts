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
    // Note: To fully support Bikram Sambat (BS), a specialized library is typically required.
    // Standard JS Intl uses Gregorian with locale strings. 
    return date.toLocaleString(lang === 'ne' ? 'ne-NP' : 'en-US', options);
};

/**
 * Formats an ISO date string into a relative time string (e.g., "2 days ago").
 * @param isoDate - The ISO date string to format.
 * @param t - The translation object for the current language.
 * @returns A formatted relative time string.
 */
export const formatRelativeTime = (isoDate: string, t: any): string => {
    const date = new Date(isoDate);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    let interval = seconds / 86400; // days
    if (interval > 7) {
        return date.toLocaleDateString(t.home_tab === 'गृहपृष्ठ' ? 'ne-NP' : 'en-US', { day: 'numeric', month: 'short' });
    }
     if (interval > 1) {
        return t.days_ago.replace('{days}', Math.floor(interval));
    }
    interval = seconds / 3600; // hours
    if (interval > 1) {
        return t.hours_ago.replace('{hours}', Math.floor(interval));
    }
    interval = seconds / 60; // minutes
    if (interval > 1) {
        return t.minutes_ago.replace('{minutes}', Math.floor(interval));
    }
    return t.moments_ago;
};

/**
 * Share text content using the native Web Share API if available, 
 * or falls back to clipboard copy.
 */
export const shareContent = async (text: string): Promise<boolean> => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Order List',
                text: text,
            });
            return true;
        } catch (error) {
            console.error('Error sharing:', error);
            // User cancelled share is a common error, we treat it as handled.
            return false; 
        }
    } else {
        try {
            await navigator.clipboard.writeText(text);
            return true; // Indicates copied to clipboard
        } catch (err) {
            console.error('Failed to copy text: ', err);
            return false;
        }
    }
};