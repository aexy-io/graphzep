import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  utcNow,
  parseDbDate,
  formatDateForDb,
  addDays,
  subtractDays,
  isBefore,
  isAfter,
  isSameDay,
  startOfDay,
  endOfDay,
} from '../utils/datetime.js';

describe('DateTime Utilities', () => {
  describe('utcNow', () => {
    it('should return current date', () => {
      const now = utcNow();
      assert(now instanceof Date);
      assert(now.getTime() <= Date.now());
      assert(now.getTime() > Date.now() - 1000);
    });
  });

  describe('parseDbDate', () => {
    it('should parse ISO date string', () => {
      const dateStr = '2025-08-21T10:30:00.000Z';
      const parsed = parseDbDate(dateStr);

      assert(parsed instanceof Date);
      assert.strictEqual(parsed?.toISOString(), dateStr);
    });

    it('should return Date object as-is', () => {
      const date = new Date('2025-08-21');
      const parsed = parseDbDate(date);

      assert.strictEqual(parsed, date);
    });

    it('should return null for null/undefined', () => {
      assert.strictEqual(parseDbDate(null), null);
      assert.strictEqual(parseDbDate(undefined), null);
    });

    it('should return null for invalid date string', () => {
      assert.strictEqual(parseDbDate('invalid-date'), null);
    });
  });

  describe('formatDateForDb', () => {
    it('should format date as ISO string', () => {
      const date = new Date('2025-08-21T10:30:00.000Z');
      const formatted = formatDateForDb(date);

      assert.strictEqual(formatted, '2025-08-21T10:30:00.000Z');
    });
  });

  describe('addDays', () => {
    it('should add days to date', () => {
      const date = new Date('2025-08-21');
      const result = addDays(date, 5);

      assert.strictEqual(result.getDate(), 26);
      assert.strictEqual(result.getMonth(), 7);
    });

    it('should handle month overflow', () => {
      const date = new Date('2025-08-30');
      const result = addDays(date, 5);

      assert.strictEqual(result.getDate(), 4);
      assert.strictEqual(result.getMonth(), 8);
    });

    it('should handle negative days', () => {
      const date = new Date('2025-08-21');
      const result = addDays(date, -5);

      assert.strictEqual(result.getDate(), 16);
      assert.strictEqual(result.getMonth(), 7);
    });
  });

  describe('subtractDays', () => {
    it('should subtract days from date', () => {
      const date = new Date('2025-08-21');
      const result = subtractDays(date, 5);

      assert.strictEqual(result.getDate(), 16);
      assert.strictEqual(result.getMonth(), 7);
    });

    it('should handle month underflow', () => {
      const date = new Date('2025-08-05');
      const result = subtractDays(date, 10);

      assert.strictEqual(result.getDate(), 26);
      assert.strictEqual(result.getMonth(), 6);
    });
  });

  describe('isBefore', () => {
    it('should return true when first date is before second', () => {
      const date1 = new Date('2025-08-20');
      const date2 = new Date('2025-08-21');

      assert(isBefore(date1, date2));
    });

    it('should return false when first date is after second', () => {
      const date1 = new Date('2025-08-22');
      const date2 = new Date('2025-08-21');

      assert(!isBefore(date1, date2));
    });

    it('should return false when dates are equal', () => {
      const date1 = new Date('2025-08-21T10:00:00.000Z');
      const date2 = new Date('2025-08-21T10:00:00.000Z');

      assert(!isBefore(date1, date2));
    });
  });

  describe('isAfter', () => {
    it('should return true when first date is after second', () => {
      const date1 = new Date('2025-08-22');
      const date2 = new Date('2025-08-21');

      assert(isAfter(date1, date2));
    });

    it('should return false when first date is before second', () => {
      const date1 = new Date('2025-08-20');
      const date2 = new Date('2025-08-21');

      assert(!isAfter(date1, date2));
    });

    it('should return false when dates are equal', () => {
      const date1 = new Date('2025-08-21T10:00:00.000Z');
      const date2 = new Date('2025-08-21T10:00:00.000Z');

      assert(!isAfter(date1, date2));
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day different times', () => {
      const date1 = new Date('2025-08-21T10:00:00.000Z');
      const date2 = new Date('2025-08-21T15:30:00.000Z');

      assert(isSameDay(date1, date2));
    });

    it('should return false for different days', () => {
      const date1 = new Date('2025-08-21');
      const date2 = new Date('2025-08-22');

      assert(!isSameDay(date1, date2));
    });

    it('should handle year boundaries', () => {
      const date1 = new Date('2024-12-31');
      const date2 = new Date('2025-01-01');

      assert(!isSameDay(date1, date2));
    });
  });

  describe('startOfDay', () => {
    it('should set time to start of day', () => {
      const date = new Date('2025-08-21T15:30:45.123Z');
      const result = startOfDay(date);

      assert.strictEqual(result.getHours(), 0);
      assert.strictEqual(result.getMinutes(), 0);
      assert.strictEqual(result.getSeconds(), 0);
      assert.strictEqual(result.getMilliseconds(), 0);
      assert.strictEqual(result.getDate(), date.getDate());
    });

    it('should not modify original date', () => {
      const date = new Date('2025-08-21T15:30:45.123Z');
      const originalTime = date.getTime();
      startOfDay(date);

      assert.strictEqual(date.getTime(), originalTime);
    });
  });

  describe('endOfDay', () => {
    it('should set time to end of day', () => {
      const date = new Date('2025-08-21T10:30:45.123Z');
      const result = endOfDay(date);

      assert.strictEqual(result.getHours(), 23);
      assert.strictEqual(result.getMinutes(), 59);
      assert.strictEqual(result.getSeconds(), 59);
      assert.strictEqual(result.getMilliseconds(), 999);
      assert.strictEqual(result.getDate(), date.getDate());
    });

    it('should not modify original date', () => {
      const date = new Date('2025-08-21T10:30:45.123Z');
      const originalTime = date.getTime();
      endOfDay(date);

      assert.strictEqual(date.getTime(), originalTime);
    });
  });
});
