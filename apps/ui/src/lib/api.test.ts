import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitAction, getReceipts, applyAction, getCurrentRoot } from './api';
import * as config from '@/config/offsec';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OffSec API Wiring', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getReceipts', () => {
    it('should use OFFSEC_HTTP_BASE for receipts endpoint', async () => {
      const mockResponse = { ok: true, json: async () => [] };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await getReceipts();

      const expectedUrl = `${config.OFFSEC_HTTP_BASE}/receipts`;
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
    });

    it('should include guardian_id query param when provided', async () => {
      const mockResponse = { ok: true, json: async () => [] };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await getReceipts('guardian-123');

      const expectedUrl = `${config.OFFSEC_HTTP_BASE}/receipts?guardian_id=guardian-123`;
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
    });

    it('should not use hardcoded port like 9110 or 3001', async () => {
      const mockResponse = { ok: true, json: async () => [] };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await getReceipts();

      const call = mockFetch.mock.calls[0][0];
      expect(call).not.toContain(':9110');
      expect(call).not.toContain(':3001');
      expect(call).toContain(':9115');
    });
  });

  describe('getCurrentRoot', () => {
    it('should use OFFSEC_HTTP_BASE for root endpoint', async () => {
      const mockResponse = { ok: true, json: async () => ({ root: 'abc123' }) };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await getCurrentRoot();

      const expectedUrl = `${config.OFFSEC_HTTP_BASE}/root`;
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
    });

    it('should extract root from response', async () => {
      const mockRoot = 'bce499be3c5f6c62168fa1870a7dc59d16a8ccd0fcf486b3112f60a9d027a992';
      const mockResponse = { ok: true, json: async () => ({ root: mockRoot }) };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await getCurrentRoot();

      expect(result).toBe(mockRoot);
    });
  });

  describe('submitAction', () => {
    it('should use OFFSEC_HTTP_BASE for action endpoint', async () => {
      const mockResponse = { ok: true, json: async () => ({}) };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const action = { id: '1', action: 'test', status: 'pending' as const };
      await submitAction(action);

      const expectedUrl = `${config.OFFSEC_HTTP_BASE}/action`;
      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should POST JSON body', async () => {
      const mockResponse = { ok: true, json: async () => ({}) };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const action = { id: '1', action: 'test', status: 'pending' as const };
      await submitAction(action);

      const call = mockFetch.mock.calls[0][1];
      expect(call?.body).toBe(JSON.stringify(action));
    });
  });

  describe('applyAction', () => {
    it('should use OFFSEC_HTTP_BASE for action/apply endpoint', async () => {
      const mockResponse = { ok: true, json: async () => ({}) };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const payload = {
        action_id: 'act-1',
        action_type: 'block_ip',
        target: { ip: '192.168.1.1' },
        ts: new Date().toISOString()
      };
      await applyAction(payload);

      const expectedUrl = `${config.OFFSEC_HTTP_BASE}/action/apply`;
      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('Endpoint Consistency', () => {
    it('all endpoints should use OFFSEC_HTTP_BASE (no hardcoded 9115)', async () => {
      const mockResponse = { ok: true, json: async () => [] };
      mockFetch.mockResolvedValueOnce(mockResponse);
      mockFetch.mockResolvedValueOnce(mockResponse);

      await getReceipts();
      await getCurrentRoot();

      const urls = mockFetch.mock.calls.map(call => call[0]);
      urls.forEach(url => {
        expect(url).toContain(config.OFFSEC_HTTP_BASE);
        expect(url).not.toMatch(/http:\/\/localhost:9115\/[^/]/); // Should have /offsec
      });
    });
  });
});
