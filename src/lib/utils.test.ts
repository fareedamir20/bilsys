import { describe, it, expect } from 'vitest';
import { formatDateTimeDMY, generateId } from './utils';

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
});

