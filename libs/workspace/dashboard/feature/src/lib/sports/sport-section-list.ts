/**
 * TiagoTV sports: the competitions (the league cards show them in the
 * order of SPORTS_ROW_ORDER), and the rules that gather each one's
 * channels and matches (applied in sport-sections.ts).
 *
 * A channel belongs to a section through its category ("|ES| ✪ DAZN LA
 * LIGA"), its own name ("|UK| SKY SPORTS PREMIER LEAGUE"), or, for event
 * channels, the competition of the match it carries ("Live | … | Premier
 * League | ES"). Competition rules are anchored so lookalikes stay out:
 * "Premier League - Lebanon", "Ligue 1 - Burkina Faso", "Frauen-Bundesliga".
 */
export type SportSectionId =
    | 'premier-league'
    | 'laliga'
    | 'tennis'
    | 'motor'
    | 'serie-a'
    | 'ligue-1'
    | 'bundesliga'
    | 'champions-league'
    | 'europa-league'
    | 'liga-argentina'
    | 'libertadores'
    | 'hypermotion'
    | 'mls'
    | 'eredivisie'
    | 'rest-of-world'
    | 'basketball';

export interface SportSection {
    readonly id: SportSectionId;
    readonly title: string;
    /** A player cut-out (transparent PNG/WebP), remote or bundled. */
    readonly image: string;
    /**
     * The cut-out's height in card heights, chosen so every head looks
     * the same size (the files frame their players from the waist or
     * whole); the card shows its top, the rest is cut at the floor.
     */
    readonly artHeight: number;
    /** The transparent share of the file above the head. */
    readonly artHeadroom: number;
    /** Where the cut-out's centre sits across the card, in %. */
    readonly artX: number;
    /** The competition's logo in white, shown instead of its name. */
    readonly logo: string | null;
    /**
     * The competitions `logo` is the logo of, when the section has several
     * (the basketball card's is the NBA's): a row of another shows none.
     */
    readonly logoCompetition?: RegExp;
    /** The logo's size against the others, so they look even. */
    readonly logoSize: number;
    /** The card's backdrop colour behind the artwork. */
    readonly tint: string;
    readonly category: RegExp | null;
    readonly channel: RegExp | null;
    /** Channels named this way stay out, whatever their category. */
    readonly notChannel?: RegExp;
    readonly competition: RegExp;
    /**
     * The card of every other football match: the competitions without a
     * card of their own ("Super League Greece", "Liga Portugal"). Its
     * `competition` rule is never asked.
     */
    readonly catchAll?: boolean;
}

const ART = './assets/sports/';
const LOGO = './assets/sports/logos/';

export const SPORT_SECTIONS: readonly SportSection[] = [
    {
        id: 'premier-league',
        title: 'Premier League',
        image: 'https://img.uefa.com/imgml/TP/players/1/2027/cutoff/250103758.webp',
        artHeight: 1.38,
        artHeadroom: 0.094,
        artX: 50,
        logo: `${LOGO}premier-league.svg`,
        logoSize: 1.1,
        tint: '#3d185a',
        category: /premier league/i,
        channel: /premier league\b(?!\s*-)/i,
        competition: /^premier league$/i,
    },
    {
        id: 'laliga',
        title: 'LaLiga',
        image: 'https://img.uefa.com/imgml/TP/players/1/2027/cutoff/250076574.webp',
        artHeight: 1.23,
        artHeadroom: 0.094,
        artX: 50,
        logo: `${LOGO}laliga.png`,
        logoSize: 0.95,
        tint: '#5c1420',
        category: /la ?liga/i,
        channel: /la ?liga|dazn liga/i,
        // The second division has its own card; the third none.
        notChannel: /hypermotion|primera federaci/i,
        competition: /^(spanish )?la ?liga( ea sports)?$/i,
    },
    {
        id: 'tennis',
        title: 'Tenis',
        image: `${ART}tennis.webp`,
        artHeight: 1.17,
        artHeadroom: 0,
        artX: 50,
        logo: `${LOGO}tennis.png`,
        logoSize: 0.82,
        tint: '#2f4a1c',
        category: /tennis|tenis|roland/i,
        channel: /tennis|tenis|\batp\b|\bwta\b/i,
        competition:
            /\b(atp|wta|itf|tennis|tenis|roland|wimbledon|us open|australian open|davis cup|billie jean)\b|\bchallenger\b(?! pro league)/i,
    },
    {
        id: 'motor',
        title: 'Motor',
        image: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/alpine/fracol01/2026alpinefracol01right.webp',
        artHeight: 2.84,
        artHeadroom: 0.01,
        artX: 49,
        logo: `${LOGO}motor.png`,
        logoSize: 0.55,
        tint: '#123a5c',
        category: /formula ?1|moto ?gp/i,
        channel: /formula ?1|\bf1\b|moto ?gp/i,
        competition:
            /formula ?[1e]|\bf1\b|moto ?(gp|2|3)|motojunior|nascar|indycar|world endurance|\bwec\b|superbike|\bw(orld)?sbk\b|\bdtm\b|\brally|\btcr\b/i,
    },
    {
        id: 'serie-a',
        title: 'Serie A',
        image: 'https://img.uefa.com/imgml/TP/players/1/2027/cutoff/250118281.webp',
        artHeight: 1.23,
        artHeadroom: 0.089,
        artX: 50,
        logo: `${LOGO}serie-a.png`,
        logoSize: 1.05,
        tint: '#0e2f5a',
        category: /serie a\b/i,
        channel: /serie a\b/i,
        competition: /^serie a( enilive)?$/i,
    },
    {
        id: 'ligue-1',
        title: 'Ligue 1',
        image: 'https://img.uefa.com/imgml/TP/players/1/2027/cutoff/250066886.webp',
        artHeight: 1.45,
        artHeadroom: 0.036,
        artX: 49,
        logo: `${LOGO}ligue-1.png`,
        logoSize: 1.1,
        tint: '#16244f',
        category: null,
        channel: /ligue ?1\b(?!\s*-)/i,
        competition: /^ligue ?1\+?$/i,
    },
    {
        id: 'bundesliga',
        title: 'Bundesliga',
        image: 'https://img.uefa.com/imgml/TP/players/1/2027/cutoff/250016833.webp',
        artHeight: 1.16,
        artHeadroom: 0.049,
        artX: 48,
        logo: `${LOGO}bundesliga.png`,
        logoSize: 1.25,
        tint: '#5a1414',
        category: /bundesliga/i,
        channel: /bundesliga/i,
        competition: /^bundesliga$/i,
    },
    {
        id: 'champions-league',
        title: 'Champions League',
        image: `${ART}champions-league.webp`,
        artHeight: 1.1,
        artHeadroom: 0,
        artX: 44,
        logo: `${LOGO}champions-league.png`,
        logoSize: 1.2,
        tint: '#0b1d4d',
        category: /champions|lcampeon/i,
        channel: /champions league|lcampeon|liga de campeones/i,
        // UEFA's: the AFC's, CAF's and CONCACAF's go to "Resto del mundo".
        // The French feeds call it "Ligue des champions".
        competition:
            /^(uefa )?(champions league|liga de campeones|ligue des champions)\b/i,
    },
    {
        id: 'europa-league',
        title: 'Europa League',
        image: `${ART}europa-league.webp`,
        artHeight: 1.154,
        artHeadroom: 0.029,
        artX: 50,
        logo: `${LOGO}europa-league.svg`,
        logoSize: 1.05,
        tint: '#5a2a06',
        category: /europa league/i,
        channel: /europa league/i,
        competition: /^(uefa )?(europa league|ligue europa)\b/i,
    },
    {
        id: 'liga-argentina',
        title: 'Liga Profesional',
        image: `${ART}liga-argentina.webp`,
        artHeight: 1.124,
        artHeadroom: 0.003,
        artX: 40,
        logo: `${LOGO}liga-argentina.png`,
        logoSize: 1.35,
        tint: '#14466e',
        category: /liga profesional/i,
        // ESPN Premium ("|ARG| FOX SPORTS PREMIUM") carries its matches.
        channel: /liga profesional|\blpf\b|^\s*\|arg\|.*\bpremium\b/i,
        // The Liga Profesional, its cups and the Copa Argentina; not the
        // Primera Nacional and the other lower divisions.
        competition:
            /^(?!.*\b(primera nacional|nacional b|primera [bc]|federal|ascenso|reserva)\b)(?=.*\b(liga profesional|lpf|argentin\w*)\b)/i,
    },
    {
        id: 'libertadores',
        title: 'Libertadores',
        image: `${ART}libertadores.webp`,
        artHeight: 1.18,
        artHeadroom: 0.05,
        artX: 50,
        logo: `${LOGO}libertadores.png`,
        logoSize: 1.35,
        tint: '#4a3a10',
        category: /libertadores/i,
        channel: /libertadores/i,
        competition: /^(copa )?(conmebol )?libertadores\b/i,
    },
    {
        id: 'hypermotion',
        title: 'Hypermotion',
        image: `${ART}hypermotion.webp`,
        artHeight: 1.144,
        artHeadroom: 0.021,
        artX: 50,
        logo: `${LOGO}hypermotion.svg`,
        logoSize: 0.62,
        tint: '#103f63',
        category: /hypermotion/i,
        channel: /hypermotion/i,
        // The provider files the third division under it too.
        notChannel: /primera federaci/i,
        competition:
            /^(spanish )?la ?liga (hypermotion|2)$|^segunda divisi[oó]n$/i,
    },
    {
        id: 'mls',
        title: 'MLS',
        image: `${ART}mls.webp`,
        artHeight: 1.128,
        artHeadroom: 0.007,
        artX: 50,
        logo: `${LOGO}mls.svg`,
        logoSize: 1.1,
        tint: '#2a1a4a',
        category: /\bmls\b|major league soccer/i,
        channel: /\bmls\b|major league soccer/i,
        competition: /^(mls|major league soccer)\b(?! next)/i,
    },
    {
        id: 'eredivisie',
        title: 'Eredivisie',
        image: `${ART}eredivisie.webp`,
        artHeight: 1.142,
        artHeadroom: 0.019,
        artX: 50,
        logo: `${LOGO}eredivisie.png`,
        logoSize: 1.1,
        tint: '#5c1030',
        category: /eredivisie/i,
        channel: /eredivisie/i,
        competition: /^(dutch )?eredivisie$/i,
    },
    {
        id: 'rest-of-world',
        title: 'Resto del mundo',
        image: `${ART}rest-of-world.webp`,
        artHeight: 1.124,
        artHeadroom: 0.004,
        artX: 50,
        logo: `${LOGO}rest-of-world.svg`,
        logoSize: 0.85,
        tint: '#0d4040',
        // GOL Mundial's events, and the football channels no card claims.
        category: /gol mundial/i,
        channel:
            /\bgol mundial\b|sky sports football|fox soccer|saudi pro league|\bgol ?tv\b/i,
        competition: /(?!)/,
        catchAll: true,
    },
    {
        id: 'basketball',
        title: 'Básquet',
        image: `${ART}basketball.webp`,
        artHeight: 1.1,
        artHeadroom: 0,
        artX: 50,
        logo: `${LOGO}basketball.png`,
        logoCompetition: /\bnba\b/i,
        logoSize: 0.8,
        tint: '#5a3412',
        category: /\bnba\b|\bacb\b|baloncesto|basket/i,
        channel: /\bnba\b|\bacb\b|baloncesto|euroleague|euroliga/i,
        competition:
            /\bnba\b|liga endesa|\bacb\b|euroleague|euroliga|eurocup|basket\w*|baloncesto/i,
    },
];

/**
 * The league cards' order (the Home's and the sports hub's). Motor and
 * the Eredivisie keep their pages and their matches, without a card.
 */
export const SPORTS_ROW_ORDER: readonly SportSectionId[] = [
    'laliga',
    'premier-league',
    'liga-argentina',
    'champions-league',
    'europa-league',
    'libertadores',
    'mls',
    'hypermotion',
    'serie-a',
    'bundesliga',
    'ligue-1',
    'rest-of-world',
    'tennis',
    'basketball',
];
