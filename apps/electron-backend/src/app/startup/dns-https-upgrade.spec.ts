import { disableDnsHttpsUpgrade } from './dns-https-upgrade';

function commandLine(initial = '') {
    const switches = new Map<string, string>();
    if (initial) {
        switches.set('disable-features', initial);
    }
    return {
        switches,
        getSwitchValue: (name: string) => switches.get(name) ?? '',
        appendSwitch: (name: string, value?: string) => {
            switches.set(name, value ?? '');
        },
    };
}

describe('disableDnsHttpsUpgrade', () => {
    it('stops Chromium from upgrading http streams through DNS HTTPS records', () => {
        const line = commandLine();
        disableDnsHttpsUpgrade(line);

        expect(line.switches.get('disable-features')).toBe(
            'UseDnsHttpsSvcb,AsyncDns'
        );
    });

    it('keeps features that were already disabled', () => {
        const line = commandLine('CalculateNativeWinOcclusion, AsyncDns');
        disableDnsHttpsUpgrade(line);
        disableDnsHttpsUpgrade(line);

        expect(line.switches.get('disable-features')).toBe(
            'CalculateNativeWinOcclusion,AsyncDns,UseDnsHttpsSvcb'
        );
    });
});
