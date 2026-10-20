const addLanguage = jest.fn();

jest.unstable_mockModule('video.js', () => ({ default: { addLanguage } }));

describe('Video.js language', () => {
    let language: typeof import('./vjs-language');

    beforeAll(async () => {
        language = await import('./vjs-language');
    });

    it('follows the app language, Spanish or English', () => {
        expect(language.resolveVjsLanguage('es')).toBe('es');
        expect(language.resolveVjsLanguage('es-AR')).toBe('es');
        expect(language.resolveVjsLanguage('en')).toBe('en');
        expect(language.resolveVjsLanguage('de')).toBe('en');
        expect(language.resolveVjsLanguage(undefined)).toBe('en');
    });

    it('registers Spanish once, for the overlay strings Video.js draws itself', () => {
        language.registerVjsLanguages();
        language.registerVjsLanguages();

        expect(addLanguage).toHaveBeenCalledTimes(1);
        const [code, spanish] = addLanguage.mock.calls[0] as [
            string,
            Record<string, string>,
        ];
        expect(code).toBe('es');
        expect(spanish['No compatible source was found for this media.']).toBe(
            'No se ha encontrado ninguna fuente compatible con este vídeo.'
        );
        // Video.js 8 asks for the sentence with its period.
        expect(spanish['This is a modal window.']).toBe(
            'Esta es una ventana modal.'
        );
        expect(spanish['You aborted the media playback']).toBe(
            'Has interrumpido la reproducción del vídeo.'
        );
    });
});
