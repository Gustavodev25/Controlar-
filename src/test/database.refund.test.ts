import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dbService from '../services/database';

// Mock do Firebase
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
  batch: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  db: {}
}));

describe('Database Service - Refund Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('deleteTransaction', () => {
    it('should return true when transaction is successfully deleted', async () => {
      const { deleteDoc } = await import('firebase/firestore');
      vi.mocked(deleteDoc).mockResolvedValueOnce(undefined);

      const result = await dbService.deleteTransaction('user123', 'tx123');
      
      expect(result).toBe(true);
      expect(deleteDoc).toHaveBeenCalledTimes(1);
    });

    it('should return false when database is not initialized', async () => {
      // Mock db as null
      vi.doMock('../config/firebase', () => ({
        db: null
      }));

      const result = await dbService.deleteTransaction('user123', 'tx123');
      
      expect(result).toBe(false);
    });

    it('should return false when delete operation fails', async () => {
      const { deleteDoc } = await import('firebase/firestore');
      vi.mocked(deleteDoc).mockRejectedValueOnce(new Error('Firebase error'));

      const result = await dbService.deleteTransaction('user123', 'tx123');
      
      expect(result).toBe(false);
    });
  });

  describe('deleteCreditCardTransaction', () => {
    it('should return true when credit card transaction is successfully deleted', async () => {
      const { deleteDoc } = await import('firebase/firestore');
      vi.mocked(deleteDoc).mockResolvedValueOnce(undefined);

      const result = await dbService.deleteCreditCardTransaction('user123', 'tx123');
      
      expect(result).toBe(true);
      expect(deleteDoc).toHaveBeenCalledTimes(1);
    });

    it('should return false when database is not initialized', async () => {
      vi.doMock('../config/firebase', () => ({
        db: null
      }));

      const result = await dbService.deleteCreditCardTransaction('user123', 'tx123');
      
      expect(result).toBe(false);
    });

    it('should return false when delete operation fails', async () => {
      const { deleteDoc } = await import('firebase/firestore');
      vi.mocked(deleteDoc).mockRejectedValueOnce(new Error('Firebase error'));

      const result = await dbService.deleteCreditCardTransaction('user123', 'tx123');
      
      expect(result).toBe(false);
    });
  });

  describe('transactionExists', () => {
    it('should return true when transaction exists', async () => {
      const { getDoc } = await import('firebase/firestore');
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: true } as any);

      const result = await dbService.transactionExists('user123', 'tx123');
      
      expect(result).toBe(true);
      expect(getDoc).toHaveBeenCalledTimes(1);
    });

    it('should return false when transaction does not exist', async () => {
      const { getDoc } = await import('firebase/firestore');
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: false } as any);

      const result = await dbService.transactionExists('user123', 'tx123');
      
      expect(result).toBe(false);
    });

    it('should return false when database is not initialized', async () => {
      vi.doMock('../config/firebase', () => ({
        db: null
      }));

      const result = await dbService.transactionExists('user123', 'tx123');
      
      expect(result).toBe(false);
    });

    it('should return false when getDoc operation fails', async () => {
      const { getDoc } = await import('firebase/firestore');
      vi.mocked(getDoc).mockRejectedValueOnce(new Error('Firebase error'));

      const result = await dbService.transactionExists('user123', 'tx123');
      
      expect(result).toBe(false);
    });
  });

  describe('creditCardTransactionExists', () => {
    it('should return true when credit card transaction exists', async () => {
      const { getDoc } = await import('firebase/firestore');
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: true } as any);

      const result = await dbService.creditCardTransactionExists('user123', 'tx123');
      
      expect(result).toBe(true);
      expect(getDoc).toHaveBeenCalledTimes(1);
    });

    it('should return false when credit card transaction does not exist', async () => {
      const { getDoc } = await import('firebase/firestore');
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: false } as any);

      const result = await dbService.creditCardTransactionExists('user123', 'tx123');
      
      expect(result).toBe(false);
    });

    it('should return false when database is not initialized', async () => {
      vi.doMock('../config/firebase', () => ({
        db: null
      }));

      const result = await dbService.creditCardTransactionExists('user123', 'tx123');
      
      expect(result).toBe(false);
    });

    it('should return false when getDoc operation fails', async () => {
      const { getDoc } = await import('firebase/firestore');
      vi.mocked(getDoc).mockRejectedValueOnce(new Error('Firebase error'));

      const result = await dbService.creditCardTransactionExists('user123', 'tx123');
      
      expect(result).toBe(false);
    });
  });
});