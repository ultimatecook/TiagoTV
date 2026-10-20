import { clear, h } from '../core/dom';
import { requestErrorText } from '../core/http';
import { moveWithin, nav, onActivate, onFocus, registerGroup } from '../core/nav';
import { resume } from '../data/resume';
import { t } from '../data/strings';
import type { App } from '../app';
import { FLUIDEZ_HINT, FLUIDEZ_LABEL, loadFluidez, saveFluidez, type Fluidez } from '../player/fluidez';
import { confirmDialog } from '../ui/dialog';
import { accountProblem, connectionsLabel, expiryLabel, STATUS_LABEL, type AccountInfo } from '../xtream/account';
import { forgetSource } from '../xtream/source';
import { DiagnosticsView } from './diagnostics-view';
import type { Page } from './shell';

declare const __BUILD_DATE__: string;

/**
 * Ajustes, as the desktop's: the sections on the left (Cuenta, Reproducción,
 * Acerca de), the focused one's cards on the right. The TV keeps what it
 * can act on: the account (its state, checking it, another one), "Fluidez"
 * and "Seguir viendo", what the TV is loading (Diagnóstico) and what this
 * build is.
 */
type SectionId = 'account' | 'playback' | 'diagnostics' | 'about';

function engineLabel(): string {
    const match = /Chrome\/(\d+)/.exec(navigator.userAgent);
    return match ? `Chrome ${match[1]}` : 'desconocido';
}

function settingRow(title: string, description: string, control: HTMLElement | null): HTMLElement {
    return h(
        'div',
        'setting',
        h('div', 'setting__text', h('div', { className: 'setting__title', text: title }), description ? h('div', { className: 'setting__description', text: description }) : null),
        control ? h('div', 'setting__control', control) : null
    );
}

function valueOf(text: string): HTMLElement {
    return h('span', { className: 'setting__value', text });
}

function pill(text: string, run: () => void, extra = ''): HTMLElement {
    return onActivate(h('div', { className: `button button--small ${extra}`, text }), run);
}

export class SettingsPage implements Page {
    readonly el: HTMLElement;
    private readonly rail = h('nav', 'settings__rail');
    private readonly panel = h('div', 'settings__panel');
    private readonly railItems: Record<SectionId, HTMLElement>;
    private section: SectionId = 'account';
    private account: AccountInfo | null = null;
    private accountError: string | null = null;
    private checking = false;
    private visible = false;
    private readonly diagnostics: DiagnosticsView;

    constructor(private readonly app: App) {
        const item = (id: SectionId, label: string) => {
            const el = onActivate(h('div', { className: 'rail__item', text: label }), () => nav.focus(nav.first(this.panel)));
            onFocus(el, () => this.select(id));
            return el;
        };
        this.railItems = {
            account: item('account', t('SETTINGS.NAV_SOURCES')),
            playback: item('playback', t('SETTINGS.PLAYBACK')),
            diagnostics: item('diagnostics', 'Diagnóstico'),
            about: item('about', t('SETTINGS.ABOUT')),
        };
        this.diagnostics = new DiagnosticsView(app);
        this.rail.appendChild(h('h1', { className: 'page__title', text: t('WORKSPACE.SHELL.RAIL_SETTINGS') }));
        this.rail.appendChild(h('div', { className: 'rail__group', text: t('SETTINGS.NAV_GROUP_ACCOUNT') }));
        this.rail.appendChild(this.railItems.account);
        this.rail.appendChild(h('div', { className: 'rail__group', text: 'Aplicación' }));
        this.rail.appendChild(this.railItems.playback);
        this.rail.appendChild(this.railItems.diagnostics);
        this.rail.appendChild(h('div', 'rail__rule'));
        this.rail.appendChild(this.railItems.about);
        this.el = h('div', 'page page--settings', this.rail, this.panel);
        // Left out of the cards goes back to the section they belong to.
        registerGroup({
            el: this.panel,
            enter: () => nav.first(this.panel),
            move: (direction, from) => {
                const next = moveWithin(this.panel, direction, from);
                if (next) {
                    nav.focus(next);
                    return true;
                }
                if (direction === 'left') {
                    nav.focus(this.railItems[this.section]);
                    return true;
                }
                return null;
            },
        });
        this.render();
    }

    focusTarget(): HTMLElement | null {
        return this.railItems[this.section];
    }

    show(): void {
        this.visible = true;
        if (!this.account && !this.checking) {
            void this.check();
        }
        this.render();
    }

    hide(): void {
        // Diagnóstico's updates are the only thing that runs here.
        this.visible = false;
        this.diagnostics.stop();
    }

    private select(id: SectionId): void {
        if (id !== this.section) {
            this.section = id;
            this.render();
        }
    }

    private render(): void {
        (Object.keys(this.railItems) as SectionId[]).forEach((id) => this.railItems[id].classList.toggle('is-active', id === this.section));
        clear(this.panel);
        this.diagnostics.stop();
        if (this.section === 'account') {
            this.renderAccount();
        } else if (this.section === 'playback') {
            this.renderPlayback();
        } else if (this.section === 'diagnostics') {
            this.panel.appendChild(this.diagnostics.el);
            if (this.visible) {
                this.diagnostics.start();
            }
        } else {
            this.renderAbout();
        }
    }

    private card(title: string, subtitle: string, rows: HTMLElement[]): void {
        this.panel.appendChild(h('h2', { className: 'settings__title', text: title }));
        this.panel.appendChild(h('p', { className: 'settings__subtitle', text: subtitle }));
        const card = h('div', 'settings__card');
        rows.forEach((row) => card.appendChild(row));
        this.panel.appendChild(card);
    }

    private renderAccount(): void {
        const credentials = this.app.client.credentials;
        const info = this.account;
        const rows = [
            settingRow('Servidor', '', valueOf(credentials.server.replace(/^https?:\/\//, ''))),
            settingRow('Usuario', '', valueOf(credentials.username)),
        ];
        if (info) {
            rows.push(settingRow('Estado', accountProblem(info) ?? '', valueOf(STATUS_LABEL[info.status])));
            rows.push(settingRow('Vencimiento', '', valueOf(expiryLabel(info))));
            rows.push(settingRow('Conexiones', '', valueOf(connectionsLabel(info))));
        } else {
            rows.push(settingRow('Estado', this.accountError ?? '', valueOf(this.checking ? 'Comprobando…' : '—')));
        }
        const actions = h(
            'div',
            'settings__actions',
            pill('Comprobar cuenta', () => void this.check(), 'button--primary'),
            pill('Cambiar de cuenta', () => this.app.openSetup()),
            pill('Olvidar esta cuenta', () => this.forget(), 'button--danger')
        );
        rows.push(actions);
        this.card(t('SETTINGS.NAV_SOURCES'), 'Tu proveedor Xtream: queda guardado solo en esta tele.', rows);
    }

    private renderPlayback(): void {
        const chosen = loadFluidez();
        const options = h('div', 'segmented');
        (['stable', 'normal'] as Fluidez[]).forEach((value) => {
            options.appendChild(
                onActivate(h('div', { className: `segmented__option${value === chosen ? ' is-selected' : ''}`, text: FLUIDEZ_LABEL[value] }), () => {
                    saveFluidez(value);
                    this.render();
                    nav.focus(this.panel.querySelectorAll('.segmented__option')[value === 'stable' ? 0 : 1] as HTMLElement);
                })
            );
        });
        this.card(t('SETTINGS.PLAYBACK'), 'Cómo abre la tele los canales en vivo.', [
            settingRow('Fluidez', FLUIDEZ_HINT, options),
            settingRow('Seguir viendo', 'Las películas y episodios empezarán desde el principio.', pill('Borrar', () => this.clearResume())),
        ]);
    }

    private renderAbout(): void {
        this.card(t('SETTINGS.ABOUT'), 'TiagoTV para la tele LG (webOS).', [
            settingRow('App', '', valueOf(`TiagoTV liviano ${this.app.version}`)),
            settingRow(t('SETTINGS.VERSION'), '', valueOf(this.app.version)),
            settingRow('Compilada', '', valueOf(__BUILD_DATE__)),
            settingRow('Motor web', '', valueOf(engineLabel())),
        ]);
    }

    private async check(): Promise<void> {
        this.checking = true;
        this.accountError = null;
        if (this.section === 'account') {
            this.render();
        }
        try {
            this.account = await this.app.client.account();
        } catch (error) {
            this.accountError = requestErrorText(error);
        }
        this.checking = false;
        if (this.section === 'account') {
            const focused = nav.focused;
            const inPanel = !!focused && this.panel.contains(focused);
            this.render();
            if (inPanel) {
                nav.focus(nav.first(this.panel.querySelector('.settings__actions') as HTMLElement));
            }
        }
    }

    private clearResume(): void {
        this.app.stack.push(
            confirmDialog(this.app.stack, {
                title: '¿Borrar "Seguir viendo"?',
                text: 'Las películas y episodios empezarán desde el principio.',
                confirm: 'Borrar',
                cancel: 'Cancelar',
                onConfirm: () => resume.clear(),
            })
        );
    }

    private forget(): void {
        this.app.stack.push(
            confirmDialog(this.app.stack, {
                title: '¿Olvidar esta cuenta?',
                text: 'Vas a tener que escribir el servidor, el usuario y la contraseña de nuevo.',
                confirm: 'Olvidar',
                cancel: 'Cancelar',
                onConfirm: () => {
                    forgetSource();
                    resume.clear();
                    this.app.openSetup();
                },
            })
        );
    }
}
