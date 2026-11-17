// THE WEB CLIENT PAGE IS JAVASCRIPT NOBODY COMPILES.
// Usage: npx tsx tools/sim/webpage.ts   (exit code is the verdict)
//
// src/web.ts holds the whole CheerpJ page in a template literal. tsc checks the TypeScript around
// it and not one character inside it, so a typo there ships and is only found by someone opening
// the page in a browser. This parses every script block in it.
//
// It also holds the two rules the page's own history turned on, both of which were silent failures:
// the game is found by SIZE and not by a CSS class (CheerpJ 4.3 renamed everything out from under
// '.cjWindow .cjTitleBar', the slide never ran, and the bottom of the client was cut off for
// months), and there is always a path that opens the hole to full height rather than leaving part
// of the client hidden.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { check, R } from './a1lib.js';

const src = fs.readFileSync('src/web.ts', 'utf8');

// The page's ${...} holes are all numeric constants from the same file; fill them so the script is
// parseable JavaScript rather than a template.
const consts: Record<string, string> = {};
for (const m of src.matchAll(/^const (WEB_CLIENT_\w+) = (\d+);/gm)) {
    consts[m[1]] = m[2];
}
const fill = (js: string) =>
    js.replace(/\$\{([^}]+)\}/g, (_whole, expr: string) => {
        let out = expr;
        for (const [k, v] of Object.entries(consts)) out = out.replaceAll(k, v);
        // what is left should be arithmetic on numbers
        try {
            return String(Function(`"use strict";return (${out});`)());
        } catch {
            return '0';
        }
    });

console.log('== every script block in the page parses');
{
    const blocks = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    check('the page has script in it at all', blocks.length > 0, true);
    let parsed = 0;
    const broken: string[] = [];
    for (const [i, block] of blocks.entries()) {
        const js = fill(block);
        // node --check on a real .mjs file, because the page is a module - it uses import and
        // top-level await, and new Function() cannot parse either.
        const tmp = path.join(os.tmpdir(), `webpage_block_${i}_${process.pid}.mjs`);
        fs.writeFileSync(tmp, js);
        try {
            execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
            parsed++;
        } catch (e) {
            const err = e as { stderr?: Buffer };
            broken.push(
                `block ${i}: ${String(err.stderr ?? e)
                    .split('\n')
                    .slice(0, 3)
                    .join(' ')}`
            );
        } finally {
            fs.rmSync(tmp, { force: true });
        }
    }
    console.log(`${blocks.length} script blocks, ${parsed} parsed`);
    check('none of them is a syntax error', broken, []);
}

console.log('\n== the game is found by size, not by a class name');
{
    // The exact failure this page has already had: a selector for CheerpJ's own markup, which
    // CheerpJ then renamed. 4.3's runtime contains no cjWindow and no cjTitleBar at all.
    const page = src.slice(src.indexOf('const CHEERPJ_PAGE'));
    // The CODE, not the commentary: the comment above fitWindow names both classes on purpose, so
    // that the next person knows what was tried and why it stopped working.
    const code = page.replace(/\/\/[^\n]*/g, '');
    check('nothing queries a cj* class any more', /querySelector[^)]*\.cj/i.test(code), false);
    check('  and no cj class name is left in the code', /cjWindow|cjTitleBar/.test(code), false);
    check('it looks for a canvas instead', /getElementsByTagName\('canvas'\)/.test(page), true);
    // AND NOT AGAINST ANY SIZE THIS FILE KNOWS, which is the rule as it now stands - this check
    // used to demand the opposite. It asserted /WEB_CLIENT_WIDTH\}\) <= 2/, a match on the client's
    // own width, and web.ts has since stopped matching on size on purpose and says why: "Every
    // size this has been matched on has since moved. 765x503 stopped matching when the plugin
    // sidebar landed and took the width out of the game. Then the height alone stopped matching
    // too, because on a phone the game is drawn at the screen's height and not at the client's
    // 503." What it matches on now is the ARRANGEMENT - CheerpJ draws the whole window into one
    // canvas and the game's sits inside it, so the window's is the larger and the game's is the
    // next one down - and the file states the invariant outright: "No number from this file
    // appears in the test."
    //
    // So that is what is checked, and it cannot rot the way the old one did: a size this check
    // knows is exactly what must NOT be in there (tracker issue 21).
    const finder = page.slice(page.indexOf('function gameCanvas()'), page.indexOf('function fitWindow()'));
    check('  and the finder uses no size from this file', /WEB_CLIENT_\w+/.test(finder), false);
    check('  it takes the game out of the window by area', /byArea\.sort/.test(finder) && /byArea\[1\]\.el/.test(finder), true);
}

console.log('\n== and it can never leave part of the client hidden');
{
    const page = src.slice(src.indexOf('const CHEERPJ_PAGE'));
    // If the game cannot be found, the hole must open rather than stay at the client's height with
    // a taller display behind it - that state is exactly the bug, and it is silent.
    // THE HEIGHT IS A VARIABLE NOW, not a constant, and the path is still there. This asked for
    // `(${WEB_CLIENT_HEIGHT + WEB_CLIENT_ROOM})` written out; web.ts keeps the hole's height in
    // `holeH` instead, because on a phone it is the screen's height and not the client's 503. The
    // rule being guarded is unchanged: if the game cannot be found after ten looks, open the hole
    // to the full height of the display rather than leave the chat tabs cut off.
    const fit = page.slice(page.indexOf('function fitWindow()'));
    check('there is a path that opens the hole to full height', /looked === 10/.test(fit) && /style\.height = \(holeH \+ \$\{WEB_CLIENT_ROOM\}\)/.test(fit), true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
