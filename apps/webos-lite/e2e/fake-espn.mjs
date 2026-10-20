/**
 * Stand-ins for ESPN's public answers in the smoke run, so it never
 * leaves the machine: the standings (site.api.espn.com …/<slug>/standings)
 * of LaLiga, the Premier League, Argentina's league and Ligue 1, each team
 * with a logo on a.espncdn.com, and those logos as generated SVG crests.
 * The teams are real clubs' names; numbers and crests are made up.
 */
const TABLES = {
    'esp.1': [
        'Barcelona', 'Atlético Madrid', 'Real Madrid', 'Real Betis', 'Real Sociedad', 'Sevilla', 'Alavés',
        'Celta Vigo', 'Deportivo', 'Osasuna', 'Athletic Club', 'Villarreal', 'Rayo Vallecano', 'Getafe',
        'Valencia', 'Girona', 'Mallorca', 'Espanyol', 'Las Palmas', 'Leganés',
    ],
    'eng.1': [
        'Arsenal', 'Manchester City', 'Liverpool', 'Chelsea', 'Tottenham Hotspur', 'Aston Villa', 'Newcastle United',
        'Brighton & Hove Albion', 'West Ham United', 'Brentford', 'Fulham', 'Crystal Palace', 'Everton', 'Wolverhampton Wanderers',
        'Bournemouth', 'Nottingham Forest', 'Leeds United', 'Burnley', 'Sunderland', 'Manchester United',
    ],
    'arg.1': [
        'River Plate', 'Boca Juniors', 'Racing Club', "Newell's Old Boys", 'Rosario Central', 'Independiente', 'San Lorenzo',
        'Estudiantes de La Plata', 'Talleres', 'Vélez Sarsfield', 'Lanús', 'Huracán', 'Argentinos Juniors', 'Belgrano',
    ],
    'fra.1': [
        'Paris Saint-Germain', 'Marseille', 'Monaco', 'Lille', 'Lyon', 'Nice', 'Lens', 'Stade Rennais', 'Paris FC', 'Strasbourg',
        'Toulouse', 'Brest', 'Nantes', 'Auxerre', 'Angers', 'Le Havre', 'Metz', 'Lorient',
    ],
};

const NOTES = { 1: 'Champions League', 2: 'Champions League', 3: 'Champions League', 4: 'Champions League', 5: 'Europa League', 18: 'Relegation', 19: 'Relegation', 20: 'Relegation' };

/** Each team's made-up ESPN id: its table and place. */
function teamId(slug, index) {
    return (Object.keys(TABLES).indexOf(slug) + 1) * 100 + index + 1;
}

/** The standings of `slug` (LaLiga's for a league the fixture lacks). */
export function espnStandings(slug = 'esp.1') {
    const key = TABLES[slug] ? slug : 'esp.1';
    return {
        name: key,
        standings: {
            entries: TABLES[key].map((name, index) => ({
                team: { displayName: name, logos: [{ href: `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId(key, index)}.png` }] },
                note: NOTES[index + 1] ? { description: NOTES[index + 1] } : undefined,
                stats: [
                    { name: 'rank', value: index + 1 },
                    { name: 'gamesPlayed', value: 9 },
                    { name: 'points', value: Math.max(1, 27 - index * 1.4) | 0 },
                ],
            })),
        },
    };
}

/** The slug of a standings URL. */
export function slugOf(url) {
    const match = /\/soccer\/([^/]+)\/standings/.exec(url);
    return match ? match[1] : 'esp.1';
}

/** A crest for a logo URL: a two-colour shield with the team's initials. */
export function crestSvg(url) {
    const match = /(\d+)\.png/.exec(decodeURIComponent(url));
    const id = match ? Number(match[1]) : 0;
    const slug = Object.keys(TABLES)[Math.floor(id / 100) - 1];
    const name = slug ? TABLES[slug][(id % 100) - 1] || '' : '';
    const letters = name
        .split(/[\s'&.-]+/)
        .filter((word) => word && !/^(de|la|fc|club)$/i.test(word))
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');
    const hue = (id * 47) % 360;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
<path d="M64 6 L116 22 V62 C116 94 92 114 64 124 C36 114 12 94 12 62 V22 Z" fill="hsl(${hue},62%,40%)" stroke="#f4f1ea" stroke-width="5"/>
<path d="M64 6 L116 22 V62 C116 94 92 114 64 124 Z" fill="hsl(${(hue + 40) % 360},70%,30%)"/>
<text x="64" y="78" font-family="Arial" font-weight="700" font-size="40" fill="#ffffff" text-anchor="middle">${letters}</text></svg>`;
}
