import { homeChannelFace } from './home-recent-channels';

describe('homeChannelFace', () => {
    it('names a brand channel its way, with its white logo and flag', () => {
        expect(
            homeChannelFace('|ES| DAZN LALIGA HD', 'http://logo/x.png')
        ).toEqual({
            name: 'DAZN LaLiga',
            logo: './assets/channels/dazn.png',
            brandLogo: true,
            flag: './assets/flags/es.svg',
        });
    });

    it("keeps the provider's logo for other channels", () => {
        const face = homeChannelFace('UK: BBC ONE FHD', 'http://logo/bbc.png');
        expect(face.logo).toBe('http://logo/bbc.png');
        expect(face.brandLogo).toBe(false);
        expect(face.flag).toBe('./assets/flags/gb.svg');
        expect(face.name).toMatch(/^bbc one$/i);
    });

    it('has no logo or flag the name and data do not give', () => {
        const face = homeChannelFace('La 1', '');
        expect(face.logo).toBeNull();
        expect(face.flag).toBeNull();
        expect(face.name).toMatch(/^la 1$/i);
    });

    it('reads a feed number into the name', () => {
        expect(homeChannelFace('|AR| ESPN 2 HD', null).name).toBe('ESPN 2');
        expect(homeChannelFace('|AR| ESPN 2 HD', null).flag).toBe(
            './assets/flags/ar.svg'
        );
    });
});
