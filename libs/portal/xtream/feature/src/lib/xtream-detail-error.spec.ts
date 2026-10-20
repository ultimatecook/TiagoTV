import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { injectXtreamDetailsErrorText } from './xtream-detail-error';

describe('injectXtreamDetailsErrorText', () => {
    function setup(error: string | null) {
        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
        });
        const translate = TestBed.inject(TranslateService);
        translate.setTranslation('es', {
            PORTALS: {
                REQUEST_ERRORS: {
                    SERVER_STATUS:
                        'No se pudo conectar con el servidor (error {{status}})',
                    SERVER_UNREACHABLE: 'No se pudo conectar con el servidor',
                },
            },
        });
        translate.use('es');
        const detailsError = signal<string | null>(error);
        return TestBed.runInInjectionContext(() =>
            injectXtreamDetailsErrorText(detailsError)
        );
    }

    it('words a failed details request instead of showing its message', () => {
        expect(setup('HTTP Error 500')()).toBe(
            'No se pudo conectar con el servidor (error 500)'
        );
    });

    it('never shows raw request text, whatever it says', () => {
        const text = setup(
            'Http failure response for http://localhost:3000/xtream?username=fake-user&password=fake-pass: 0 Unknown Error'
        )();
        expect(text).toBe('No se pudo conectar con el servidor');
    });

    it('is empty without an error', () => {
        expect(setup(null)()).toBeUndefined();
    });
});
