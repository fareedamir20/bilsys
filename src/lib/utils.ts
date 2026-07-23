import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTimeDMY(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPDFDateTime(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const datePart = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const dayPart = date.toLocaleDateString('en-US', { weekday: 'long' });
  const timePart = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  return `${datePart} ${dayPart} ${timePart}`;
}

export function formatDateDMY(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const wordValues: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

const multipliers: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  crore: 10000000,
  million: 1000000,
  billion: 1000000000
};

export function extractOcrData(text: string) {
  let extractedTransactionRef = "";
  let extractedAmount = "";
  let extractedDate = "";
  let extractedTime = "";

  // Ref: Look for TID, Trx ID, Ref, Reference, ID, or standalone 11+ digit numbers
  const refMatch = text.match(/(?:TID|Trx ID|Transaction ID|Ref|Reference|Ref No|ID)[\s:.-]*([A-Za-z0-9]{8,20})/i) || text.match(/\b([0-9]{11,15})\b/);
  if (refMatch) extractedTransactionRef = refMatch[1].trim();

  // Amount: Rs, PKR, Amount, or just large numbers before/after Rs
  const amountMatch = text.match(/(?:Rs\.?|PKR|Amount|Transfer|Total)[\s:.-]*([0-9,]+(?:\.[0-9]{1,2})?)/i) || text.match(/([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:Rs\.?|PKR)/i);
  if (amountMatch) {
      extractedAmount = amountMatch[1].replace(/,/g, '');
  } else {
      // Fallback to words
      const amountWordsMatch = text.match(/(?:Rupees|Amount in words|Sum of|Amount)[\s:.-]*([A-Za-z\s]+?)(?:only|\/-|\n|$)/i);
      if (amountWordsMatch) {
          const words = amountWordsMatch[1].trim();
          if (words.length > 3) {
              let val = parseWordsToNumber(words);
              if (val !== null) {
                  extractedAmount = val.toString();
              }
          }
      }
  }

  // Date: DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, DD Mon YYYY, Mon DD YYYY
  const dateMatch = text.match(/\b(\d{4})[\s/.-]+(\d{1,2})[\s/.-]+(\d{1,2})\b/) ||
                    text.match(/\b(\d{1,2})[\s/.-]+(\d{1,2})[\s/.-]+(\d{2,4})\b/) || 
                    text.match(/\b(\d{1,2})[\s/.-]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,.-]*(\d{2,4})\b/i) || 
                    text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,.-]+(\d{1,2})[\s,.-]+(\d{2,4})\b/i);

  if (dateMatch) {
      let year = 2024, month = 1, day = 1;
      if (isNaN(Number(dateMatch[1])) || isNaN(Number(dateMatch[2]))) {
          const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
          let monthStr = "";
          if (isNaN(Number(dateMatch[1]))) {
              monthStr = dateMatch[1].toLowerCase().substring(0, 3);
              day = parseInt(dateMatch[2]);
              year = parseInt(dateMatch[3]);
          } else {
              day = parseInt(dateMatch[1]);
              monthStr = dateMatch[2].toLowerCase().substring(0, 3);
              year = parseInt(dateMatch[3]);
          }
          month = months[monthStr] || 1;
      } else {
          let p1 = parseInt(dateMatch[1]);
          let p2 = parseInt(dateMatch[2]);
          let p3 = parseInt(dateMatch[3]);
          if (p1 > 1000) { year = p1; month = p2; day = p3; }
          else if (p3 > 1000) { year = p3; month = p2; day = p1; }
          else { year = 2000 + p3; month = p2; day = p1; }
          if (month > 12) { let tmp = month; month = day; day = tmp; }
      }
      if (year < 100) year += 2000;
      extractedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  // Time: HH:MM, HH:MM:SS, HH:MM AM/PM
  const timeMatch = text.match(/(?:Time|At)[\s:.-]*(\d{1,2})[:.;,|-](\d{2})(?:[:.;,|-]\d{2})?(?:\s*(AM|PM|am|pm))?/i) || 
                    text.match(/(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM|am|pm))?/i) ||
                    text.match(/(\d{1,2})[:.;,|-](\d{2})(?:[:.;,|-]\d{2})?\s*(AM|PM|am|pm)/i) ||
                    text.match(/(\d{1,2});(\d{2})(?:;\d{2})?(?:\s*(AM|PM|am|pm))?/i);
  if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      let mins = timeMatch[2];
      let ampm = timeMatch[3] ? timeMatch[3].toUpperCase() : null;
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      extractedTime = `${hours.toString().padStart(2, '0')}:${mins.padStart(2, '0')}`;
  }

  return {
    extractedTransactionRef,
    extractedAmount,
    extractedDate,
    extractedTime
  };
}
export function parseWordsToNumber(text: string): number | null {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  let total = 0;
  let current = 0;
  let foundNumber = false;
  
  for (const word of words) {
    if (wordValues[word] !== undefined) {
      current += wordValues[word];
      foundNumber = true;
    } else if (multipliers[word] !== undefined) {
      if (current === 0) current = 1;
      if (word === 'hundred') {
        current *= multipliers[word];
      } else {
        total += current * multipliers[word];
        current = 0;
      }
      foundNumber = true;
    }
  }
  
  total += current;
  return foundNumber ? total : null;
}
