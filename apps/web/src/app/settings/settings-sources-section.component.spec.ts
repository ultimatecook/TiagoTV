import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
    signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PlaylistContextFacade } from '@iptvnator/playlist/shared/util';
import { PlaylistMeta } from '@iptvnator/shared/interfaces';
import {
    WORKSPACE_SHELL_ACTIONS,
    WORKSPACE_SHELL_COMMANDS,
} from '@iptvnator/workspace/shell/util';
import { SettingsSourcesSectionComponent } from './settings-sources-section.component';

@Component({
    selector: 'app-recent-playlists',
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockRecentPlaylistsComponent {
    readonly addPlaylistClicked = output<string | undefined>();
}

@Component({
    selector: 'app-source-tile',
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockSourceTileComponent {
    readonly playlist = input<unknown>(null);
    readonly size = input('lg');
}

const XTREAM = {
    _id: 'p1',
    title: 'Casa',
    serverUrl: 'http://portal.example',
    username: 'user',
    password: 'secret',
} as PlaylistMeta;

describe('SettingsSourcesSectionComponent', () => {
    const activePlaylist = signal<PlaylistMeta | null>(null);
    const commands = {
        openPlaylistSwitcher: jest.fn(),
        openAccountInfo: jest.fn(),
        openKeyboardShortcuts: jest.fn(),
    };
    const actions = { openAddPlaylistDialog: jest.fn() };

    async function create() {
        await TestBed.configureTestingModule({
            imports: [
                SettingsSourcesSectionComponent,
                NoopAnimationsModule,
                TranslateModule.forRoot(),
            ],
            providers: [
                provideRouter([]),
                {
                    provide: PlaylistContextFacade,
                    useValue: { activePlaylist },
                },
                { provide: WORKSPACE_SHELL_COMMANDS, useValue: commands },
                { provide: WORKSPACE_SHELL_ACTIONS, useValue: actions },
            ],
        })
            .overrideComponent(SettingsSourcesSectionComponent, {
                set: {
                    imports: [
                        MatButtonModule,
                        MatIconModule,
                        MockRecentPlaylistsComponent,
                        MockSourceTileComponent,
                        RouterLink,
                        TranslateModule,
                    ],
                },
            })
            .compileComponents();
        const fixture = TestBed.createComponent(
            SettingsSourcesSectionComponent
        );
        fixture.detectChanges();
        const button = (id: string) =>
            fixture.nativeElement.querySelector(
                `[data-test-id="${id}"]`
            ) as HTMLButtonElement;
        return { fixture, button };
    }

    beforeEach(() => {
        jest.clearAllMocks();
        activePlaylist.set(null);
    });

    it('switches, adds and shows the account through the shell', async () => {
        activePlaylist.set(XTREAM);
        const { button } = await create();

        expect(button('settings-active-source').textContent?.trim()).toBe(
            'Casa'
        );

        button('settings-switch-source').click();
        button('settings-add-playlist').click();
        button('settings-account-info').click();
        button('settings-keyboard-shortcuts').click();

        expect(commands.openPlaylistSwitcher).toHaveBeenCalledTimes(1);
        expect(actions.openAddPlaylistDialog).toHaveBeenCalledTimes(1);
        expect(commands.openAccountInfo).toHaveBeenCalledWith(XTREAM);
        expect(commands.openKeyboardShortcuts).toHaveBeenCalledTimes(1);
    });

    it('offers account details only for a portal source', async () => {
        activePlaylist.set({
            _id: 'm1',
            title: 'Lista',
            url: 'x',
        } as PlaylistMeta);
        const { button } = await create();

        expect(button('settings-account-info').disabled).toBe(true);
    });

    it('locks or unlocks the parental lock and opens its page', async () => {
        const { fixture, button } = await create();
        const lockNow = jest.fn();
        const unlock = jest.fn();
        const openParental = jest.fn();
        fixture.componentInstance.lockNow.subscribe(lockNow);
        fixture.componentInstance.unlock.subscribe(unlock);
        fixture.componentInstance.openParental.subscribe(openParental);

        // Off: only the way to its settings.
        expect(button('settings-parental-lock-now')).toBeNull();
        expect(button('settings-parental-unlock')).toBeNull();

        fixture.componentRef.setInput('parentalEnabled', true);
        fixture.detectChanges();
        button('settings-parental-unlock').click();

        fixture.componentRef.setInput('parentalUnlocked', true);
        fixture.detectChanges();
        button('settings-parental-lock-now').click();
        button('settings-parental-open').click();

        expect(unlock).toHaveBeenCalledTimes(1);
        expect(lockNow).toHaveBeenCalledTimes(1);
        expect(openParental).toHaveBeenCalledTimes(1);
    });
});
