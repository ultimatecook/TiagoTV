import {
    accountStatusKey,
    formatAccountDate,
    formatServerTime,
} from './account-info-format';

describe('account info formatting', () => {
    it.each([
        ['Active', 'XTREAM.ACCOUNT_INFO.STATUS_VALUE.ACTIVE'],
        ['ACTIVE', 'XTREAM.ACCOUNT_INFO.STATUS_VALUE.ACTIVE'],
        ['Expired', 'XTREAM.ACCOUNT_INFO.STATUS_VALUE.EXPIRED'],
        ['Banned', 'XTREAM.ACCOUNT_INFO.STATUS_VALUE.BANNED'],
        ['Disabled', 'XTREAM.ACCOUNT_INFO.STATUS_VALUE.DISABLED'],
        [' trial ', 'XTREAM.ACCOUNT_INFO.STATUS_VALUE.TRIAL'],
    ])('translates the %s status', (status, key) => {
        expect(accountStatusKey(status)).toBe(key);
    });

    it('keeps a status it does not know for showing as sent', () => {
        expect(accountStatusKey('Suspended by reseller')).toBeNull();
        expect(accountStatusKey(undefined)).toBeNull();
    });

    it('formats the expiry in the app language, not the OS locale', () => {
        // 1900000000 is 2030-03-17 17:46:40 UTC.
        expect(formatAccountDate('1900000000', 'es')).toBe('17 mar 2030');
        expect(formatAccountDate('1900000000', 'en')).toBe('Mar 17, 2030');
        expect(formatAccountDate('0', 'es')).toBe('-');
        expect(formatAccountDate(undefined, 'es')).toBe('-');
    });

    it("shows the panel's clock localized, without shifting its zone", () => {
        expect(formatServerTime('2026-10-18 12:00:00', 'es')).toBe(
            '18 oct 2026, 12:00'
        );
        expect(formatServerTime('2026-10-18 12:00:00', 'en')).toBe(
            'Oct 18, 2026, 12:00 PM'
        );
        expect(formatServerTime('yesterday', 'es')).toBe('yesterday');
        expect(formatServerTime(undefined, 'es')).toBe('-');
    });
});
