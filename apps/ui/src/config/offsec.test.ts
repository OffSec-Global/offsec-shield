import { describe, it, expect } from 'vitest';
import { OFFSEC_HTTP_BASE, OFFSEC_WS_URL } from './offsec';

describe('OffSec Config', () => {
  describe('OFFSEC_HTTP_BASE', () => {
    it('should not have trailing slash', () => {
      expect(OFFSEC_HTTP_BASE.endsWith('/')).toBe(false);
    });

    it('should contain localhost and port 9115', () => {
      expect(OFFSEC_HTTP_BASE).toContain('localhost');
      expect(OFFSEC_HTTP_BASE).toContain('9115');
    });

    it('should contain /offsec path', () => {
      expect(OFFSEC_HTTP_BASE).toContain('/offsec');
    });

    it('should be http protocol', () => {
      expect(OFFSEC_HTTP_BASE).toMatch(/^http:\/\//);
    });

    it('should default to http://localhost:9115/offsec', () => {
      expect(OFFSEC_HTTP_BASE).toBe('http://localhost:9115/offsec');
    });
  });

  describe('OFFSEC_WS_URL', () => {
    it('should be websocket protocol', () => {
      expect(OFFSEC_WS_URL).toMatch(/^ws:\/\//);
    });

    it('should contain localhost and port 9115', () => {
      expect(OFFSEC_WS_URL).toContain('localhost');
      expect(OFFSEC_WS_URL).toContain('9115');
    });

    it('should contain /offsec/ws path', () => {
      expect(OFFSEC_WS_URL).toContain('/offsec/ws');
    });

    it('should default to ws://localhost:9115/offsec/ws', () => {
      expect(OFFSEC_WS_URL).toBe('ws://localhost:9115/offsec/ws');
    });
  });

  describe('Consistency', () => {
    it('should have matching ports in both URLs', () => {
      const httpPort = OFFSEC_HTTP_BASE.match(/:(\d+)\//)?.[1];
      const wsPort = OFFSEC_WS_URL.match(/:(\d+)\//)?.[1];
      expect(httpPort).toBe(wsPort);
      expect(httpPort).toBe('9115');
    });

    it('should have matching hosts in both URLs', () => {
      const httpHost = OFFSEC_HTTP_BASE.match(/\/\/([\w.]+)/)?.[1];
      const wsHost = OFFSEC_WS_URL.match(/\/\/([\w.]+)/)?.[1];
      expect(httpHost).toBe(wsHost);
    });
  });
});
