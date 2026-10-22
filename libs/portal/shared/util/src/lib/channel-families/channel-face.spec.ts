import { channelFace } from './channel-face';

describe('channelFace', () => {
    it('writes a name in capitals as "En vivo" does', () => {
        expect(channelFace('|ARG| C5N', null).name).toBe('C5N');
        expect(channelFace('UK: BBC ONE FHD', null).name).toBe('BBC One');
        expect(channelFace('|US| CNN', null).name).toBe('CNN');
        expect(channelFace('|AR| TELEFE HD', null).name).toBe('Telefe');
        expect(channelFace('|ES| LA 1 HD', null).name).toBe('La 1');
    });

    it('keeps a known family’s name and a name written by hand', () => {
        expect(channelFace('|ES| DAZN LALIGA HD', null).name).toBe(
            'DAZN LaLiga'
        );
        expect(channelFace('|ARG| ESPN PREMIUM HD', null).name).toBe(
            'ESPN Premium'
        );
        expect(channelFace('|ES| 24h', null).name).toBe('24h');
        expect(channelFace('La Sexta', null).name).toBe('La Sexta');
    });

    it('gives the brand’s logo, else the provider’s, and the flag', () => {
        expect(channelFace('|ES| DAZN LALIGA HD', 'x.png')).toMatchObject({
            logo: './assets/channels/dazn.png',
            brandLogo: true,
            flag: './assets/flags/es.svg',
        });
        expect(channelFace('|US| CNN', 'cnn.png')).toMatchObject({
            logo: 'cnn.png',
            brandLogo: false,
            flag: './assets/flags/us.svg',
        });
        expect(channelFace('CNN', '').logo).toBeNull();
    });
});
