import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import {
    ANIMATION_MODULE_TYPE,
    Component,
    RendererFactory2,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    ExtraOptions,
    provideRouter,
    Router,
    ROUTER_CONFIGURATION,
    withRouterConfig,
} from '@angular/router';

type ProviderEntry = { provide?: unknown };

function flattenProviders(providers: readonly unknown[]): ProviderEntry[] {
    return providers.flatMap((provider) => {
        if (Array.isArray(provider)) {
            return flattenProviders(provider);
        }
        // makeEnvironmentProviders() wraps its list in ɵproviders.
        const wrapped = (provider as { ɵproviders?: unknown[] } | null)
            ?.ɵproviders;
        return wrapped
            ? flattenProviders(wrapped)
            : [provider as ProviderEntry];
    });
}

describe('appConfig', () => {
    // The @angular/animations renderer queues every DOM removal until the
    // end of the next change detection, while the router inserts a routed
    // page at once: leaving a portal for the dashboard laid out both pages
    // until the coalesced tick and scored the swap as a layout shift.
    it('keeps the default DOM renderer, so routed pages swap in one task', async () => {
        const { appConfig } = await import('./app.config');
        const tokens = flattenProviders(appConfig.providers).map(
            (provider) => provider?.provide
        );

        expect(tokens).not.toContain(RendererFactory2);
        expect(tokens).not.toContain(ANIMATION_MODULE_TYPE);
    });
});

describe('appConfig router', () => {
    @Component({ template: '' })
    class PageComponent {}

    async function routerOptions(): Promise<ExtraOptions> {
        const { appConfig } = await import('./app.config');
        const entry = flattenProviders(appConfig.providers).find(
            (provider) => provider?.provide === ROUTER_CONFIGURATION
        ) as { useValue?: ExtraOptions } | undefined;
        return entry?.useValue ?? {};
    }

    afterEach(() => TestBed.resetTestingModule());

    // Ajustes with unsaved edits cancels a history Back. Resolved by
    // 'replace' (Angular's default), the cancelled Back rewrote the entry
    // before Ajustes into Ajustes: the page left before was gone from
    // history, and the next Back could not reach it.
    it('keeps history intact when a guard cancels a Back', async () => {
        let leave = false;
        TestBed.configureTestingModule({
            providers: [
                provideLocationMocks(),
                provideRouter(
                    [
                        { path: 'home', component: PageComponent },
                        {
                            path: 'settings',
                            component: PageComponent,
                            canDeactivate: [() => leave],
                        },
                    ],
                    withRouterConfig(await routerOptions())
                ),
            ],
        });
        const router = TestBed.inject(Router);
        const location = TestBed.inject(Location);
        // Listens to the location's popstate, as the app's bootstrap does.
        router.initialNavigation();
        const settle = () => new Promise((resolve) => setTimeout(resolve));

        await router.navigateByUrl('/home');
        await router.navigateByUrl('/settings');
        location.back();
        await settle();
        await settle();
        expect(location.path()).toBe('/settings');

        leave = true;
        location.back();
        await settle();
        await settle();
        expect(location.path()).toBe('/home');
        expect(router.url).toBe('/home');
    });
});

describe('getInitialLanguage', () => {
    afterEach(() => localStorage.clear());

    it('renders a fresh install in Spanish, TiagoTV’s default', async () => {
        const { getInitialLanguage } = await import('./app.config');

        expect(getInitialLanguage()).toBe('es');
    });

    it('keeps the language saved last, English included', async () => {
        const { getInitialLanguage, PREFERRED_LANGUAGE_STORAGE_KEY } =
            await import('./app.config');
        localStorage.setItem(PREFERRED_LANGUAGE_STORAGE_KEY, 'en');

        expect(getInitialLanguage()).toBe('en');
    });
});
