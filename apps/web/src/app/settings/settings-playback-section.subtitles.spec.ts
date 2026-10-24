import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { OpenSubtitlesError, OpenSubtitlesService } from '@iptvnator/services';
import { StreamFormat, VideoPlayer } from '@iptvnator/shared/interfaces';
import { SettingsPlaybackSectionComponent } from './settings-playback-section.component';

describe('SettingsPlaybackSectionComponent audio and subtitles', () => {
    let fixture: ComponentFixture<SettingsPlaybackSectionComponent>;
    let form: FormGroup;
    let hasBridge: boolean;
    const testAccount = jest.fn();

    const query = <T extends Element = HTMLElement>(testId: string) =>
        fixture.nativeElement.querySelector(
            `[data-test-id="${testId}"]`
        ) as T | null;

    function render(desktop = true): void {
        TestBed.configureTestingModule({
            imports: [
                SettingsPlaybackSectionComponent,
                NoopAnimationsModule,
                ReactiveFormsModule,
                TranslateModule.forRoot(),
            ],
            providers: [
                {
                    provide: OpenSubtitlesService,
                    useValue: { hasBridge: () => hasBridge, testAccount },
                },
            ],
        });
        fixture = TestBed.createComponent(SettingsPlaybackSectionComponent);
        fixture.componentRef.setInput('form', form);
        fixture.componentRef.setInput('players', [
            { id: VideoPlayer.VideoJs, labelKey: 'SETTINGS.PLAYER_VIDEOJS' },
        ]);
        fixture.componentRef.setInput('streamFormatEnum', StreamFormat);
        fixture.componentRef.setInput('isDesktop', desktop);
        fixture.detectChanges();
    }

    beforeEach(() => {
        hasBridge = true;
        testAccount.mockReset();
        form = new FormGroup({
            player: new FormControl(VideoPlayer.VideoJs),
            webPlayerSharedControls: new FormControl(true),
            playerAmbientMode: new FormControl(false),
            detailTrailerBackdrop: new FormControl(false),
            showCaptions: new FormControl(false),
            playerUpNextRail: new FormControl(true),
            playerUpNextCard: new FormControl(true),
            fullscreenChannelPanel: new FormControl(true),
            streamFormat: new FormControl(StreamFormat.TsStreamFormat),
            openStreamOnDoubleClick: new FormControl(false),
            showExternalPlaybackBar: new FormControl(true),
            embeddedMpvFrameCopy: new FormControl(false),
            recordingFolder: new FormControl(''),
            vodAutoFailover: new FormControl(false),
            playbackSmoothness: new FormControl('stable'),
            audioLanguage: new FormControl('original'),
            openSubtitles: new FormGroup({
                apiKey: new FormControl('fake-key'),
                username: new FormControl('tiago'),
                password: new FormControl('fake-pass'),
                language: new FormControl('es'),
                secondLanguage: new FormControl(''),
                autoSearch: new FormControl(true),
            }),
        });
    });

    it('offers the audio language, original by default, bound to the form', async () => {
        render();

        expect(query('audio-language-setting')?.textContent).toContain(
            'SETTINGS.AUDIO_LANGUAGE'
        );
        query('select-audio-language')?.click();
        fixture.detectChanges();
        await fixture.whenStable();
        const option = (value: string) =>
            document.body.querySelector(
                `[data-test-id="audio-language-${value}"]`
            ) as HTMLElement | null;

        expect(option('original')?.textContent).toContain(
            'SETTINGS.AUDIO_LANGUAGE_ORIGINAL'
        );
        option('es')?.click();
        fixture.detectChanges();
        expect(form.value.audioLanguage).toBe('es');
    });

    it('never shows the key or the password in plain text', () => {
        render();

        expect(query<HTMLInputElement>('opensubtitles-api-key')?.type).toBe(
            'password'
        );
        expect(query<HTMLInputElement>('opensubtitles-password')?.type).toBe(
            'password'
        );
        expect(fixture.nativeElement.textContent).not.toContain('fake-key');
        expect(fixture.nativeElement.textContent).not.toContain('fake-pass');
        expect(
            query<HTMLAnchorElement>('opensubtitles-get-key-link')?.href
        ).toBe('https://www.opensubtitles.com/consumers');
    });

    it('says when the installer or the build cannot reach OpenSubtitles', () => {
        hasBridge = false;
        render(true);
        expect(query('opensubtitles-unavailable')?.textContent).toContain(
            'SETTINGS.OPEN_SUBTITLES_NEEDS_UPDATE'
        );

        TestBed.resetTestingModule();
        render(false);
        expect(query('opensubtitles-unavailable')?.textContent).toContain(
            'SETTINGS.OPEN_SUBTITLES_DESKTOP_ONLY'
        );
        expect(query<HTMLButtonElement>('opensubtitles-test')?.disabled).toBe(
            true
        );
    });

    it('checks the account as typed and shows the downloads left', async () => {
        testAccount.mockResolvedValue({ remaining: 18, allowed: 20 });
        render();

        query<HTMLButtonElement>('opensubtitles-test')?.click();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(testAccount).toHaveBeenCalledWith(
            expect.objectContaining({
                apiKey: 'fake-key',
                username: 'tiago',
                password: 'fake-pass',
            })
        );
        expect(query('opensubtitles-test-ok')?.textContent).toContain(
            'SETTINGS.OPEN_SUBTITLES_TEST_OK_QUOTA'
        );
    });

    it('names a failed login', async () => {
        testAccount.mockRejectedValue(new OpenSubtitlesError('login-failed'));
        render();

        query<HTMLButtonElement>('opensubtitles-test')?.click();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(query('opensubtitles-test-error')?.textContent).toContain(
            'SETTINGS.OPEN_SUBTITLES_TEST_LOGIN_FAILED'
        );
    });
});
