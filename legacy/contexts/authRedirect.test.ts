import { describe, expect, test } from 'vitest';
import { buildBaseRedirectUrl, buildHashRouteRedirectUrl } from './authRedirect';

describe('auth redirects', () => {
    test('builds signup redirects at the deployed root', () => {
        expect(buildBaseRedirectUrl('https://app.bygsmart.com', '/')).toBe(
            'https://app.bygsmart.com/'
        );
    });

    test('builds reset redirects at the deployed root', () => {
        expect(
            buildHashRouteRedirectUrl('https://app.bygsmart.com', '/', '/reset-password')
        ).toBe('https://app.bygsmart.com/#/reset-password');
    });

    test('builds redirects under a non-root base path', () => {
        expect(
            buildHashRouteRedirectUrl('https://app.bygsmart.com', '/preview/', '/reset-password')
        ).toBe('https://app.bygsmart.com/preview/#/reset-password');
    });

    test('keeps localhost redirects at the root base path', () => {
        expect(
            buildHashRouteRedirectUrl('http://localhost:3000', '/', '/reset-password')
        ).toBe('http://localhost:3000/#/reset-password');
    });
});
