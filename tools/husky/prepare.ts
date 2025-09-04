/* eslint-disable @typescript-eslint/no-unused-vars */
import { $ } from 'bun';

async function main() {
    try {
        await $`git rev-parse --is-inside-work-tree`;
    } catch {
        console.log('Husky: skipping (not inside a Git work tree)');
        return;
    }

    try {
        await $`husky`;
    } catch (err) {
        console.log('Husky: skipping (husky not available or .git not accessible)');
    }
}

main();

