import { h } from '../core/dom';
import { requestErrorText } from '../core/http';
import type { Action } from '../core/keys';
import { nav, onActivate } from '../core/nav';
import { redact } from '../core/redact';
import type { Screen } from '../core/screens';
import { accountProblem, accountSummary } from '../xtream/account';
import { XtreamClient, type XtreamCredentials } from '../xtream/client';
import { normalizeServerInput } from '../xtream/server-url';

/**
 * First run (and "Editar cuenta"): the provider's server, user and
 * password, typed with the TV's on-screen keyboard. "Probar y guardar"
 * asks `player_api.php` for the account before keeping anything; the
 * password is never shown back, and errors never quote it.
 */
export interface SetupOptions {
    readonly initial: XtreamCredentials | null;
    readonly onSaved: (credentials: XtreamCredentials) => void;
    readonly save: (credentials: XtreamCredentials) => boolean;
}

function field(label: string, input: HTMLInputElement, hint: string): HTMLElement {
    return h(
        'label',
        'setup__field',
        h('span', { className: 'setup__label', text: label }),
        input,
        h('span', { className: 'setup__hint', text: hint })
    );
}

function textInput(type: string, value: string, placeholder: string): HTMLInputElement {
    const input = h('input', {
        className: 'setup__input f',
        attrs: {
            type,
            autocomplete: 'off',
            autocapitalize: 'off',
            autocorrect: 'off',
            spellcheck: 'false',
            placeholder,
        },
    });
    input.value = value;
    return input;
}

export class SetupScreen implements Screen {
    readonly el: HTMLElement;
    private readonly server: HTMLInputElement;
    private readonly user: HTMLInputElement;
    private readonly pass: HTMLInputElement;
    private readonly status: HTMLElement;
    private readonly submit: HTMLElement;
    private busy = false;

    constructor(private readonly options: SetupOptions) {
        const initial = options.initial;
        this.server = textInput('text', initial?.server ?? '', 'http://servidor.com:8080');
        this.user = textInput('text', initial?.username ?? '', 'usuario');
        this.pass = textInput('password', initial?.password ?? '', 'contraseña');
        this.status = h('div', 'setup__status');
        this.submit = onActivate(
            h('div', { className: 'button button--primary setup__submit', text: 'Probar y guardar' }),
            () => void this.trySave()
        );
        const reveal = onActivate(
            h('div', { className: 'button button--small', text: 'Mostrar contraseña' }),
            () => {
                const shown = this.pass.type === 'text';
                this.pass.type = shown ? 'password' : 'text';
                reveal.textContent = shown ? 'Mostrar contraseña' : 'Ocultar contraseña';
            }
        );
        this.el = h(
            'div',
            'screen setup room',
            h(
                'div',
                'setup__panel',
                h('div', { className: 'brand setup__logo', text: 'TiagoTV' }),
                h('h1', { className: 'setup__title', text: 'Conectá tu cuenta' }),
                h('p', {
                    className: 'setup__lead',
                    text: 'Los datos de tu proveedor Xtream. Quedan guardados solo en esta tele.',
                }),
                field('Servidor', this.server, 'Con el puerto, si tiene: http://servidor.com:8080'),
                field('Usuario', this.user, ''),
                field('Contraseña', this.pass, ''),
                h('div', 'setup__actions', this.submit, reveal),
                this.status
            )
        );
    }

    initialFocus(): HTMLElement {
        return this.options.initial ? this.submit : this.server;
    }

    onKey(action: Action): boolean {
        const focused = nav.focused;
        if (action !== 'ok' || !focused || focused.tagName !== 'INPUT') {
            return false;
        }
        const input = focused as HTMLInputElement;
        if (!input.value) {
            // Opens the on-screen keyboard again.
            input.blur();
            input.focus();
            return true;
        }
        const order = [this.server, this.user, this.pass];
        const next = order[order.indexOf(input) + 1];
        nav.focus(next ?? this.submit);
        if (!next) {
            void this.trySave();
        }
        return true;
    }

    onBack(): boolean {
        const focused = nav.focused;
        if (focused && focused.tagName === 'INPUT' && document.activeElement === focused) {
            (focused as HTMLInputElement).blur();
            return true;
        }
        // On the first run Back reaches the root: the app asks to exit.
        return false;
    }

    private say(text: string, tone: 'info' | 'error' | 'ok'): void {
        this.status.className = `setup__status is-${tone}`;
        this.status.textContent = text;
    }

    private async trySave(): Promise<void> {
        if (this.busy) {
            return;
        }
        let server: string;
        try {
            server = normalizeServerInput(this.server.value);
        } catch (error) {
            this.say((error as Error).message, 'error');
            nav.focus(this.server);
            return;
        }
        const credentials: XtreamCredentials = {
            server,
            username: this.user.value.trim(),
            password: this.pass.value,
        };
        if (!credentials.username || !credentials.password) {
            this.say('Faltan el usuario o la contraseña.', 'error');
            nav.focus(credentials.username ? this.pass : this.user);
            return;
        }
        this.busy = true;
        this.say('Probando la cuenta…', 'info');
        const client = new XtreamClient(credentials);
        try {
            const account = await client.account();
            const problem = accountProblem(account);
            if (problem) {
                this.say(problem, 'error');
                return;
            }
            if (!this.options.save(credentials)) {
                this.say('La tele no dejó guardar los datos (almacenamiento lleno).', 'error');
                return;
            }
            this.say(`Cuenta lista: ${accountSummary(account)}`, 'ok');
            setTimeout(() => this.options.onSaved(credentials), 1200);
        } catch (error) {
            this.say(redact(requestErrorText(error), client.secrets), 'error');
        } finally {
            this.busy = false;
        }
    }
}
