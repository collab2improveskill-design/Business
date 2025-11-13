import { GoogleGenAI, Type } from "@google/genai";
import type { ParsedBill, ParsedInventoryItem, ParsedKhataTransaction } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const billParsingSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      description: "List of items to be billed.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Name of the item.",
          },
          quantity: {
            type: Type.NUMBER,
            description: "Quantity of the item.",
          },
          unit: {
            type: Type.STRING,
            description: "Unit of the item (e.g., kg, packet, liter).",
          },
          price: {
            type: Type.NUMBER,
            description: "Estimated price per unit of the item in Rupees."
          }
        },
        required: ["name", "quantity", "unit"],
      },
    },
    customerName: {
      type: Type.STRING,
      description: "The name of the customer if mentioned, otherwise defaults to 'Guest Customer'."
    }
  },
  required: ["items"],
};


export const parseBillingFromVoice = async (text: string, language: 'ne' | 'en'): Promise<ParsedBill> => {
  try {
    const prompt = language === 'ne'
      ? `Parse the following text from a Nepali Kirana store owner and convert it into a billing list of all items mentioned. The text is likely in Nepali, English, or a mix (Romanized Nepali). Estimate a reasonable price in Rupees for each item. Text: "${text}"`
      : `Parse the following text from a store owner and convert it into a billing list of all items mentioned. The text is in English. Estimate a reasonable price in Rupees for each item. Text: "${text}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: billParsingSchema,
      },
    });

    const jsonString = response.text.trim();
    const parsedData = JSON.parse(jsonString);
    
    if (!parsedData.items || !Array.isArray(parsedData.items)) {
        throw new Error("Invalid response format from API: missing items array.");
    }

    return parsedData as ParsedBill;

  } catch (error) {
    console.error("Error parsing billing from voice:", error);
    throw new Error("Failed to understand the items. Please try again.");
  }
};


const inventoryParsingSchema = {
    type: Type.ARRAY,
    description: "List of items from the purchase bill.",
    items: {
        type: Type.OBJECT,
        properties: {
            name: {
                type: Type.STRING,
                description: "Name of the purchased item. Be as specific as possible.",
            },
            quantity: {
                type: Type.NUMBER,
                description: "Quantity of the item purchased.",
            },
            unit: {
                type: Type.STRING,
                description: "Unit of the item (e.g., kg, packet, liter, piece).",
            },
            price: {
                type: Type.NUMBER,
                description: "Price per unit of the item in Rupees."
            }
        },
        required: ["name", "quantity", "unit", "price"],
    },
};

export const parseInventoryFromImage = async (base64ImageData: string, language: 'ne' | 'en'): Promise<Omit<ParsedInventoryItem, 'id'>[]> => {
    try {
        const prompt = language === 'ne'
            ? "यो किराना पसलको खरिद बिल हो। यसबाट प्रत्येक सामानको नाम, मात्रा, एकाइ, र प्रति एकाइ मूल्य निकालेर JSON array को रूपमा सूची बनाउनुहोस्।"
            : "This is a purchase bill from a Kirana store. Extract each item's name, quantity, unit, and price per unit from it and format it as a JSON array.";
        
        const imagePart = {
            inlineData: {
                mimeType: 'image/jpeg',
                data: base64ImageData,
            },
        };

        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [textPart, imagePart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: inventoryParsingSchema,
            },
        });
        
        const jsonString = response.text.trim();
        const parsedData = JSON.parse(jsonString);

        if (!Array.isArray(parsedData)) {
            throw new Error("Invalid response format from API: expected an array.");
        }
        
        return parsedData as Omit<ParsedInventoryItem, 'id'>[];

    } catch (error) {
        console.error("Error parsing inventory from image:", error);
        throw new Error("Failed to read the bill image. Please ensure it's clear and try again.");
    }
};

const khataTransactionParsingSchema = {
    type: Type.OBJECT,
    properties: {
        description: {
            type: Type.STRING,
            description: "A brief description of the items sold on credit. e.g., '2kg Sugar, 1L Oil'",
        },
        amount: {
            type: Type.NUMBER,
            description: "The total estimated price of all items in Rupees.",
        },
    },
    required: ["description", "amount"],
};

export const parseKhataTransactionFromVoice = async (text: string, language: 'ne' | 'en'): Promise<ParsedKhataTransaction> => {
    try {
        const prompt = language === 'ne'
            ? `यो नेपाली किराना पसलको उधारो कारोबार हो। दिइएको टेक्स्टबाट सामानको विवरण र कुल अनुमानित मूल्य निकाल्नुहोस्। टेक्स्ट: "${text}"`
            : `This is a credit transaction for a Kirana store. Extract the item description and the total estimated price from the given text. Text: "${text}"`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: khataTransactionParsingSchema,
            },
        });

        const jsonString = response.text.trim();
        const parsedData = JSON.parse(jsonString);

        if (!parsedData.description || typeof parsedData.amount !== 'number') {
            throw new Error("Invalid response format from API.");
        }

        return parsedData as ParsedKhataTransaction;

    } catch (error) {
        console.error("Error parsing Khata transaction from voice:", error);
        throw new Error("Failed to understand the transaction. Please try again.");
    }
};
