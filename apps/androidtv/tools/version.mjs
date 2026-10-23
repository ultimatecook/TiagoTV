#!/usr/bin/env node
/**
 * The APK's version, from apps/androidtv/version.properties (what
 * app/build.gradle.kts stamps): `node apps/androidtv/tools/version.mjs`
 * prints versionName, `--code` prints versionCode.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function readVersion(file = new URL('../version.properties', import.meta.url)) {
    const text = readFileSync(file, 'utf8');
    const value = (name) => {
        const match = new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm').exec(text);
        if (!match) {
            throw new Error(`version.properties has no ${name}`);
        }
        return match[1].trim();
    };
    const version = { name: value('versionName'), code: Number(value('versionCode')) };
    if (!/^\d+\.\d+\.\d+$/.test(version.name) || !Number.isInteger(version.code) || version.code < 1) {
        throw new Error(`version.properties: versionName must be x.y.z and versionCode a positive integer`);
    }
    return version;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const version = readVersion();
    console.log(process.argv.includes('--code') ? version.code : version.name);
}
