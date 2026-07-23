import { describe, it, expect } from 'vitest';
import { formatDateTimeDMY, generateId, extractOcrData, parseWordsToNumber } from './utils';

describe('utils', () => {
  it('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).toBeDefined();
    expect(typeof id1).toBe('string');
    expect(id1).not.toBe(id2);
  });

  it('formats date time', () => {
    expect(typeof formatDateTimeDMY(new Date().toISOString())).toBe('string');
  });

  describe('parseWordsToNumber', () => {
    it('parses valid word combinations', () => {
      expect(parseWordsToNumber('one hundred and fifty')).toBe(150);
      expect(parseWordsToNumber('one thousand two hundred')).toBe(1200);
      expect(parseWordsToNumber('fifteen thousand')).toBe(15000);
    });

    it('returns null for invalid inputs', () => {
      expect(parseWordsToNumber('not a number')).toBe(null);
      expect(parseWordsToNumber('')).toBe(null);
    });
  });

  describe('extractOcrData', () => {
    it('extracts reference number', () => {
      const data1 = extractOcrData('Transaction ID: 1234567890');
      expect(data1.extractedTransactionRef).toBe('1234567890');

      const data2 = extractOcrData('Ref No 9876543210ABC');
      expect(data2.extractedTransactionRef).toBe('9876543210ABC');

      const data3 = extractOcrData('Just a number 123456789012 in the middle');
      expect(data3.extractedTransactionRef).toBe('123456789012');
    });

    it('extracts amount in digits', () => {
      const data1 = extractOcrData('Amount: Rs 15,000.50');
      expect(data1.extractedAmount).toBe('15000.50');

      const data2 = extractOcrData('Transfer 2000 PKR');
      expect(data2.extractedAmount).toBe('2000');

      const data3 = extractOcrData('Total: 500');
      expect(data3.extractedAmount).toBe('500');
    });

    it('extracts amount in words', () => {
      const data = extractOcrData('Amount in words: Fifteen Thousand only');
      expect(data.extractedAmount).toBe('15000');
    });

    it('extracts date', () => {
      const data1 = extractOcrData('Date: 05-08-2024');
      expect(data1.extractedDate).toBe('2024-08-05');

      const data2 = extractOcrData('Transfer on 12/10/24');
      expect(data2.extractedDate).toBe('2024-10-12');

      const data3 = extractOcrData('Aug 5 2024 is the day');
      expect(data3.extractedDate).toBe('2024-08-05');
      
      const data4 = extractOcrData('2024-11-20');
      expect(data4.extractedDate).toBe('2024-11-20');
    });

    it('extracts time', () => {
      const data1 = extractOcrData('Time: 14:35:22');
      expect(data1.extractedTime).toBe('14:35');

      const data2 = extractOcrData('At 02:30 PM');
      expect(data2.extractedTime).toBe('14:30');

      const data3 = extractOcrData('12:45 am');
      expect(data3.extractedTime).toBe('00:45');
    });
    
    it('handles comprehensive mock receipts', () => {
      const receipt = `
        Bank of Something
        TID: ABC123XYZ987
        Amount: Rs 25,500
        Date: 15-09-2024
        Time: 04:20 PM
        Status: Success
      `;
      const data = extractOcrData(receipt);
      expect(data.extractedTransactionRef).toBe('ABC123XYZ987');
      expect(data.extractedAmount).toBe('25500');
      expect(data.extractedDate).toBe('2024-09-15');
      expect(data.extractedTime).toBe('16:20');
    });
  });
});

