/**
 * A stand-in for ESPN's public standings answer (site.api.espn.com
 * …/standings), for the smoke run's league page: the smoke serves it in
 * place of the real API, so the run never leaves the machine. The teams
 * are LaLiga's; the numbers are made up.
 */
const TEAMS = [
    'Barcelona', 'Atlético Madrid', 'Real Madrid', 'Real Betis', 'Real Sociedad', 'Sevilla', 'Alavés',
    'Celta Vigo', 'Deportivo', 'Osasuna', 'Athletic Club', 'Villarreal', 'Rayo Vallecano', 'Getafe',
    'Valencia', 'Girona', 'Mallorca', 'Espanyol', 'Las Palmas', 'Leganés',
];

const NOTES = { 1: 'Champions League', 2: 'Champions League', 3: 'Champions League', 4: 'Champions League', 5: 'Europa League', 18: 'Relegation', 19: 'Relegation', 20: 'Relegation' };

export function espnStandings() {
    return {
        name: 'LaLiga',
        standings: {
            entries: TEAMS.map((name, index) => ({
                team: { displayName: name, logos: [] },
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
