import { crestSearchNames, pickCrest, TeamCrestResolver } from './team-crests';

const CELTA = {
    strTeam: 'Celta Vigo',
    strSport: 'Soccer',
    strLeague: 'Spanish La Liga',
    strBadge: 'https://crests.test/celta.png',
};
const GRAN_PENA = {
    strTeam: 'Gran Peña',
    strSport: 'Soccer',
    strLeague: 'Spanish Tercera Federación Group 1',
    strBadge: 'https://crests.test/gran-pena.png',
};
const BRIGHTON_WOMEN = {
    strTeam: 'Brighton WFC',
    strSport: 'Soccer',
    strLeague: 'English Womens Super League',
    strBadge: 'https://crests.test/brighton-w.png',
};

describe('team crests', () => {
    it('searches the name as written and without club affixes', () => {
        expect(crestSearchNames('RC Celta')).toEqual(['RC Celta', 'Celta']);
        expect(crestSearchNames('Arsenal')).toEqual(['Arsenal']);
    });

    it("prefers the competition's league and skips women's sides", () => {
        expect(pickCrest([GRAN_PENA, CELTA], 'laliga')).toEqual({
            url: CELTA.strBadge,
            inLeague: true,
        });
        expect(pickCrest([BRIGHTON_WOMEN], 'premier-league')).toBeNull();
    });

    it('keeps looking past an out-of-league answer, then caches', async () => {
        const storage = new Map<string, string>();
        const requests: string[] = [];
        const resolver = () =>
            new TeamCrestResolver({
                fetchJson: async (url) => {
                    requests.push(url);
                    return {
                        teams: url.includes('t=RC_Celta')
                            ? [GRAN_PENA]
                            : [CELTA],
                    };
                },
                storage: {
                    getItem: (key) => storage.get(key) ?? null,
                    setItem: (key, value) => void storage.set(key, value),
                },
                wait: async () => undefined,
            });

        await expect(resolver().resolve('RC Celta', 'laliga')).resolves.toBe(
            CELTA.strBadge
        );
        expect(requests).toHaveLength(2);

        // A new resolver reads the stored answer.
        await expect(resolver().resolve('RC Celta', 'laliga')).resolves.toBe(
            CELTA.strBadge
        );
        expect(requests).toHaveLength(2);
    });

    it('looks aliased clubs up by id', async () => {
        const requests: string[] = [];
        const resolver = new TeamCrestResolver({
            fetchJson: async (url) => {
                requests.push(url);
                return {
                    teams: [{ strBadge: 'https://crests.test/forest.png' }],
                };
            },
            storage: null,
            wait: async () => undefined,
        });

        await expect(
            resolver.resolve('Nottingham Forest', 'premier-league')
        ).resolves.toBe('https://crests.test/forest.png');
        expect(requests[0]).toContain('lookupteam.php?id=133720');
    });

    it('retries a refused request', async () => {
        let calls = 0;
        const resolver = new TeamCrestResolver({
            fetchJson: async () => {
                calls += 1;
                if (calls === 1) {
                    throw new Error('429');
                }
                return { teams: [CELTA] };
            },
            storage: null,
            wait: async () => undefined,
        });

        await expect(resolver.resolve('Celta', 'laliga')).resolves.toBe(
            CELTA.strBadge
        );
        expect(calls).toBe(2);
    });

    it('keeps no "no crest" answer for a lookup that failed', async () => {
        const storage = new Map<string, string>();
        let down = true;
        const resolver = new TeamCrestResolver({
            fetchJson: async () => {
                if (down) {
                    throw new Error('429');
                }
                return { teams: [CELTA] };
            },
            storage: {
                getItem: (key) => storage.get(key) ?? null,
                setItem: (key, value) => void storage.set(key, value),
            },
            wait: async () => undefined,
        });

        await expect(resolver.resolve('Celta', 'laliga')).resolves.toBeNull();
        expect(storage.size).toBe(0);

        down = false;
        await expect(resolver.resolve('Celta', 'laliga')).resolves.toBe(
            CELTA.strBadge
        );
    });
});
