// Read a quest manifest by RUNNING the file that builds it, with the world stubbed out.
//
//   npx tsx tools/quest/EvalManifest.ts quest_ahoy_run.ts [...]   -> JSON on stdout
//
// For the 23 sims whose steps are partly built by a function (`...southIn()`), which the AST
// reader in ExportHelper cannot evaluate and correctly refuses rather than half-export.
//
// HOW. The sim is copied into a scratch directory beside the three stub modules in evalstub/,
// which take the place of './harness.js', './questrun.js' and './a1lib.js' because those imports
// are RELATIVE: a copy of the file in another directory resolves them to whatever is next to it.
// Everything else it imports is '#/...' and resolves through the package's own imports map to the
// real engine modules, which is what the generators need and costs nothing to load.
//
// The file then runs top to bottom as written. `await H.boot()` returns at once instead of
// starting a world, the consts and generators evaluate for real, and `play(m)` keeps the manifest
// rather than playing the quest.
//
// WHY NOT EXTEND THE PARSER. Because the parser would have to become a TypeScript interpreter -
// loops, conditionals, helpers calling helpers - and would be wrong in a new way for every
// generator somebody writes next. Running the code is the only reading of it that cannot disagree
// with the sim.
import { execFileSync } from 'child_process';
import { createRequire } from 'node:module';
import * as fs from 'fs';
import * as path from 'path';

const SIM = path.join(import.meta.dirname, '..', 'sim');
const STUB = path.join(import.meta.dirname, 'evalstub');
const ROOT = path.join(import.meta.dirname, '..', '..');

/**
 * tsx's own entry point, which runs a TypeScript file under the node that is already running.
 *
 * A path and not a command: see the note where it is used. createRequire rather than a literal
 * node_modules path so that it is still found when the dependency is hoisted or linked somewhere
 * other than beside this file.
 */
const TSX = createRequire(import.meta.url).resolve('tsx/cli');

/**
 * One sim's manifest, or null when it will not give one up.
 *
 * Each file gets its OWN scratch directory and its own process. A module is evaluated once per
 * process, so twenty-three files sharing one would share one `captured` array and any top-level
 * state they set; and a file that throws would take the rest with it. A process each costs about
 * a second and keeps one broken sim from hiding twenty-two good ones.
 */
export function manifestOf(file: string): Record<string, unknown> | null {
    // INSIDE THE PROJECT, not os.tmpdir(). A copy of the sim elsewhere has no package.json above
    // it, so tsx transforms it as CommonJS and the file's own `await H.boot()` fails with "top
    // level await is not supported with the cjs output format"; and `#/...` would resolve against
    // the wrong package's imports map even if it did compile. A directory under tools/quest sits
    // beneath the root package.json, which supplies both.
    const work = fs.mkdtempSync(path.join(import.meta.dirname, '.eval-'));
    try {
        for (const stub of fs.readdirSync(STUB)) {
            fs.copyFileSync(path.join(STUB, stub), path.join(work, stub));
        }
        const name = path.basename(file);
        fs.copyFileSync(path.join(SIM, name), path.join(work, name));

        // The runner imports the copied sim, then prints what play() kept. Written beside it so
        // its own './questrun.js' is the same stub instance the sim just handed the manifest to.
        fs.writeFileSync(
            path.join(work, 'emit.ts'),
            [
                "import { captured } from './questrun.js';",
                'try {',
                `    await import('./${name.replace(/\.ts$/, '.js')}');`,
                '} catch (e) {',
                "    // DONE is the stub's own stop signal; anything else is the sim failing and",
                '    // the empty capture below reports it as a refusal rather than as no steps.',
                '}',
                "process.stdout.write('\\u0001' + JSON.stringify(captured[0] ?? null));",
                'process.exit(0);'
            ].join('\n')
        );

        // TSX ITSELF, not npx. npx is npx.cmd on Windows, which execFile cannot start without a
        // shell - so every one of these threw ENOENT there, the catch below turned each into a
        // null, and the exporter reported 28 of 108 quests as "still refused" rather than as a
        // tool that could not run. A table regenerated on that machine would have been short of
        // Recipe for Disaster, Legends' Quest, Monkey Madness and Desert Treasure. Resolving the
        // CLI from this package drops the launcher as well as the platform difference.
        const out = execFileSync(process.execPath, [TSX, path.join(work, 'emit.ts')], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 120000,
            maxBuffer: 64 * 1024 * 1024
        });
        // The sims print as they go and the engine logs over the top of them, so the payload is
        // marked rather than assumed to be the whole of stdout.
        const mark = out.lastIndexOf('\u0001');
        if (mark < 0) return null;
        const parsed = JSON.parse(out.slice(mark + 1));
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    } finally {
        fs.rmSync(work, { recursive: true, force: true });
    }
}

if (process.argv[1] && process.argv[1].endsWith('EvalManifest.ts')) {
    const files = process.argv.slice(2);
    const out: Record<string, unknown> = {};
    for (const f of files) {
        const m = manifestOf(f);
        out[path.basename(f)] = m;
        console.error(`${m ? 'ok  ' : 'FAIL'} ${path.basename(f)}${m ? ' -> ' + (Array.isArray(m.steps) ? m.steps.length : 0) + ' steps' : ''}`);
    }
    process.stdout.write(JSON.stringify(out));
}
