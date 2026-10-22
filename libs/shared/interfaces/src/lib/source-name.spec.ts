import {
    isHostLikeName,
    sourceDisplayLabel,
    visibleSourceName,
} from './source-name';

describe('source names on the title pages', () => {
    it.each([
        'line.example.online',
        'LINE.EXAMPLE.ONLINE',
        'example.tv',
        'www.example.com',
        'cdn-3.example.co.uk',
        'http://line.example.online:8080',
        'https://example.tv/get.php?username=a&password=b',
        'http://1.2.3.4:8080 usr== a pas== b',
        '10.0.0.12',
        '10.0.0.12:25461',
        'localhost:8080',
        'portal:8080',
        'example.tv:80/c/',
    ])('treats "%s" as an address', (name) => {
        expect(isHostLikeName(name)).toBe(true);
        expect(visibleSourceName(name)).toBeNull();
    });

    it.each([
        ['Casa', 'Casa'],
        ['My IPTV', 'My IPTV'],
        ['Netflix', 'Netflix'],
        ['Mr. Robot fans', 'Mr. Robot fans'],
        ['  Lista del living  ', 'Lista del living'],
        ['TV 2024', 'TV 2024'],
    ])('keeps the chosen name "%s"', (name, shown) => {
        expect(isHostLikeName(name)).toBe(false);
        expect(visibleSourceName(name)).toBe(shown);
    });

    it('drops credentials typed into a chosen name', () => {
        expect(visibleSourceName('Casa usr== abc pas== def')).toBe('Casa');
    });

    it('shows nothing for an empty name', () => {
        expect(visibleSourceName(null)).toBeNull();
        expect(visibleSourceName('   ')).toBeNull();
        expect(isHostLikeName(undefined)).toBe(false);
    });

    it('labels a source by its kind where its name is an address', () => {
        expect(sourceDisplayLabel('line.example.online', 'xtream')).toBe(
            'Xtream'
        );
        expect(
            sourceDisplayLabel('http://portal.test:8080/c/', 'stalker')
        ).toBe('Stalker');
        expect(sourceDisplayLabel('Casa', 'xtream')).toBe('Casa');
    });
});
