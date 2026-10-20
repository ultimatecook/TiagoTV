import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { PageStateComponent, splitStateMessage } from './page-state.component';

describe('splitStateMessage', () => {
    it('makes the first sentence the title and the rest the line', () => {
        expect(
            splitStateMessage(
                'No se pudo cargar el catálogo. Probá de nuevo en un rato.'
            )
        ).toEqual({
            title: 'No se pudo cargar el catálogo',
            detail: 'Probá de nuevo en un rato.',
        });
        expect(
            splitStateMessage(
                'Preparando tu catálogo… La primera vez puede tardar unos minutos.'
            )
        ).toEqual({
            title: 'Preparando tu catálogo…',
            detail: 'La primera vez puede tardar unos minutos.',
        });
    });

    it('keeps a one-sentence message, or one with its own line, whole', () => {
        expect(
            splitStateMessage('Agregá una fuente Xtream para ver sus canales.')
        ).toEqual({
            title: 'Agregá una fuente Xtream para ver sus canales',
            detail: '',
        });
        expect(
            splitStateMessage(
                'Sin resultados para «real»',
                'Prueba con otro nombre.'
            )
        ).toEqual({
            title: 'Sin resultados para «real»',
            detail: 'Prueba con otro nombre.',
        });
        expect(splitStateMessage('WORKSPACE.SPORTS.NO_MATCHES')).toEqual({
            title: 'WORKSPACE.SPORTS.NO_MATCHES',
            detail: '',
        });
    });
});

describe('PageStateComponent', () => {
    function render(inputs: Record<string, unknown>) {
        TestBed.configureTestingModule({
            imports: [PageStateComponent, TranslateModule.forRoot()],
        });
        const fixture = TestBed.createComponent(PageStateComponent);
        for (const [name, value] of Object.entries(inputs)) {
            fixture.componentRef.setInput(name, value);
        }
        fixture.detectChanges();
        return fixture;
    }

    it('shows the title and its line, and Retry only where asked', () => {
        const fixture = render({
            message: 'No se pudo cargar la lista. Revisá la conexión.',
            boxed: true,
            role: 'alert',
        });
        const element: HTMLElement = fixture.nativeElement;

        expect(
            element.querySelector('.page-state__title')?.textContent
        ).toBe('No se pudo cargar la lista');
        expect(
            element.querySelector('.page-state__detail')?.textContent
        ).toBe('Revisá la conexión.');
        expect(element.classList).toContain('page-state--boxed');
        expect(element.getAttribute('role')).toBe('alert');
        expect(element.querySelector('button')).toBeNull();
    });

    it('emits retry from its pill', () => {
        const fixture = render({ message: 'Falló.', retryable: true });
        const retried = jest.fn();
        fixture.componentInstance.retry.subscribe(retried);

        const button = fixture.nativeElement.querySelector(
            '[data-test-id="page-state-retry"]'
        ) as HTMLButtonElement;
        expect(button.textContent).toContain('RETRY');
        button.click();

        expect(retried).toHaveBeenCalledTimes(1);
    });
});
