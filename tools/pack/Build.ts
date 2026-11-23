import { assertClientCache } from '#tools/pack/CacheCheck.js';
import { packAll } from '#tools/pack/PackAll.js';
import { forcePackRebuild } from '#tools/pack/PackFile.js';
import { printError } from '#/util/Logger.js';

// --force PACKS EVERYTHING, skipping every staleness check. For when a wrong "nothing is stale"
// would be worse than the wait - mutation testing above all, where a skipped repack reports a
// guard as passing over a mutation that was never compiled in. DeathPlateau-Bugs#81. BUILD_FORCE=1
// does the same thing for callers that invoke this file directly rather than through npm.
if (process.argv.includes('--force')) {
    forcePackRebuild();
}

try {
    const modelFlags: number[] = [];
    console.time('pack');
    await packAll(modelFlags);
    console.timeEnd('pack');

    // AND IS IT READABLE? Packing reports success per file and cannot see the one failure that
    // matters: two builds against one checkout append their blocks into each other's chains, and
    // from then on the engine serves a crc of 0 for whatever it can no longer read. Clients then
    // fail at 30% with a connection error, which is the last place anybody looks for a bad pack.
    // Two seconds here against the day that cost.
    console.time('cache check');
    assertClientCache('data/pack');
    console.timeEnd('cache check');
} catch (err) {
    if (err instanceof Error) {
        printError(err);
    }

    process.exit(1);
}
