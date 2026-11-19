import fs from 'fs';
import { Worker } from 'worker_threads';

import { collectDefaultMetrics, register } from 'prom-client';

import { packAll } from '#tools/pack/PackAll.js';
import World from '#/engine/World.js';
import TcpServer from '#/server/tcp/TcpServer.js';
import Environment from '#/util/Environment.js';
import { printError, printInfo, printWarning } from '#/util/Logger.js';
import { startWeb } from '#/web.js';
import { startManagementWeb } from '#/server/management/ManagementWeb.js';
import OnDemand from '#/engine/OnDemand.js';
import BotManager from '#/engine/bot/BotManager.js';
import DeadOps from '#/engine/script/DeadOps.js';
import ScriptCoverage from '#/engine/script/ScriptCoverage.js';
import ScriptFaults from '#/engine/script/ScriptFaults.js';
import { BroadcastFeed } from '#/server/broadcast/BroadcastFeed.js';
import { MarketFeed } from '#/server/market/MarketFeed.js';
import VoteService from '#/engine/vote/VoteService.js';
import VoteSites from '#/engine/vote/VoteSites.js';

if (OnDemand.cache.count(0) !== 9 || OnDemand.cache.count(2) === 0 || !fs.existsSync('data/pack/server/script.dat')) {
    printInfo('Packing cache, please wait until you see the world is ready.');

    try {
        // todo: different logic so the main thread doesn't have to load pack files
        const modelFlags: number[] = [];
        await packAll(modelFlags);
    } catch (err) {
        if (err instanceof Error) {
            printError(err);
        }

        process.exit(1);
    }
}

if (Environment.EASY_STARTUP) {
    new Worker(new URL('./login.ts', import.meta.url));
    new Worker(new URL('./friend.ts', import.meta.url));
    new Worker(new URL('./logger.ts', import.meta.url));
}

// custom (2026-09-27) - development mode makes EVERY login a developer (LoginThread) with the
// destructive commands, and turns the login rate limits off. Fine on a laptop, a disaster on a
// port-forwarded world - say so where the log is read.
if (!Environment.NODE_PRODUCTION) {
    printWarning('NODE_PRODUCTION is false: every player gets developer commands and login rate limits are off. Set NODE_PRODUCTION=true in .env on any world other people can reach.');
}
if (Environment.NODE_MIN_STAFF_LEVEL > 0) {
    printInfo(`Staff-only world: accounts below staff level ${Environment.NODE_MIN_STAFF_LEVEL} are refused at login (NODE_MIN_STAFF_LEVEL).`);
}

// custom (2026-09-29) - the script fault reporter (engine/script/ScriptFaults.ts). Before
// World.start, because the login and startup scripts run inside it and a fault there is exactly the
// kind nobody is watching for. Does nothing at all unless NODE_SCRIPT_FAULTS is set.
ScriptFaults.init();
// custom (2026-11-09) - the public market feed. Reads its webhook once and is off without
// one, so this costs nothing on a world that has not configured it.
MarketFeed.init();
BroadcastFeed.init();

// custom (2026-10-27) - read the voting sites now rather than the first time somebody talks to the
// Vote clerk, so a mistyped sites.json is a line in the boot log and not a surprise in front of a
// player. With no file there are no sites and this says nothing at all.
VoteSites.load();

// custom (2026-11-02) - and open the LEDGER now, for that same reason and one more: its schema is
// upgraded on open, so a release that adds a column does the adding here, in front of whoever is
// watching the deploy, rather than in front of whoever logs in first. ready_at arrived that way
// on 2 November and read as a missing column on the live box for twenty minutes after a perfectly
// good deploy, which is the kind of thing that gets a deploy rolled back for no reason.
//
// ONLY WHERE VOTING IS ON. With no sites there is nothing that could ever be credited, and a
// server that does not vote should not have a ledger file made for it on the way up.
//
// This cannot throw: ledgerOrNull says why it could not open, turns voting off and leaves the
// rest of the world alone - the same thing that used to happen at the first login instead.
if (VoteSites.count() > 0) {
    VoteService.ledgerOrNull();
}

await World.start();

// custom (2026-09-29) - trigger coverage (engine/script/ScriptCoverage.ts). AFTER World.start,
// unlike the reporter above: it counts the build's triggers, and ScriptProvider has not loaded them
// until the world has started.
ScriptCoverage.init();

// custom (2026-11-02) - the dead-op collector (engine/script/DeadOps.ts). It needs nothing from the
// cache, but it is kept beside coverage because the two are read together: coverage says which
// triggers nothing reached, dead ops says which clicks reached nothing.
DeadOps.init();

// custom (2026-09-27) - server-side bots, only where asked for (the dev world). Never on live.
if (Environment.NODE_BOTS) {
    BotManager.start();

    // custom (2026-09-29) - the fuzzers (src/engine/bot/BotFuzzer.ts). startFuzzers refuses on
    // anything but a development world and says why, so this is safe to leave in app.ts: on live it
    // is one boolean read that is false.
    if (Environment.NODE_BOTS_FUZZ) {
        const why = BotManager.startFuzzers(Environment.NODE_BOTS_FUZZ_COUNT, Environment.NODE_BOTS_FUZZ_SEED);
        if (why) {
            printWarning(`bots: fuzzers not started - ${why}`);
        }
    }
}

const tcpServer = new TcpServer();
tcpServer.start();

await startWeb();
await startManagementWeb();

register.setDefaultLabels({ nodeId: Environment.NODE_ID });
collectDefaultMetrics({ register });

let exiting = false;
function safeExit() {
    if (exiting) {
        return;
    }

    exiting = true;
    // Anything recorded since the last five-second flush would otherwise be lost on a restart, and
    // the fault that took the world down is the one most worth keeping.
    ScriptFaults.flush();
    World.rebootTimer(0);
}

process.on('SIGINT', safeExit);
process.on('SIGTERM', safeExit);

process.on('uncaughtException', function (err) {
    console.error(err, 'Uncaught exception');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error({ promise, reason }, 'Unhandled Rejection at: Promise');
});
