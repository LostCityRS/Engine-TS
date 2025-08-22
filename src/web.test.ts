import { describe, expect, it } from 'bun:test';
import { getRequestUrl } from './web.js';

describe('getRequestUrl', () => {
    it('uses host header when req.url is undefined', () => {
        const req = { url: undefined, headers: new Headers({ host: 'example.com' }) } as unknown as Request;
        const url = getRequestUrl(req);
        expect(url.href).toBe('http://example.com/');
    });
});
