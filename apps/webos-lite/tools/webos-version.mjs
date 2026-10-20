/** webOS app versions are three numbers, without a pre-release part. */
export function webosVersion(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version ?? ''));
    if (!match) {
        throw new Error(`Not a semantic version: ${version}`);
    }
    return match.slice(1).map(Number).join('.');
}
