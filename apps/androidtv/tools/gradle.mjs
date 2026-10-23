#!/usr/bin/env node
/**
 * Runs Gradle for apps/androidtv: the project's wrapper if one was
 * generated (`gradle wrapper`), otherwise the `gradle` on PATH (8.9 or
 * newer, with a JDK 17+). ANDROID_HOME (or ANDROID_SDK_ROOT, or
 * apps/androidtv/local.properties) must point at an Android SDK with
 * platform 34 and build-tools 34.0.0.
 *
 *   node apps/androidtv/tools/gradle.mjs assembleRelease
 *   node apps/androidtv/tools/gradle.mjs testReleaseUnitTest
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT = fileURLToPath(new URL('../', import.meta.url));

export function gradleCommand(env = process.env) {
    const wrapper = join(PROJECT, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
    if (existsSync(wrapper)) {
        return wrapper;
    }
    return env.GRADLE_BIN || 'gradle';
}

export function runGradle(tasks, env = process.env) {
    const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
    if (!sdk && !existsSync(join(PROJECT, 'local.properties'))) {
        throw new Error('No Android SDK: set ANDROID_HOME (platform 34, build-tools 34.0.0) or write apps/androidtv/local.properties');
    }
    const result = spawnSync(gradleCommand(env), ['-p', PROJECT, '--no-daemon', '--console=plain', ...tasks], {
        stdio: 'inherit',
        env,
    });
    if (result.error) {
        throw result.error;
    }
    return result.status ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        process.exit(runGradle(process.argv.slice(2)));
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
