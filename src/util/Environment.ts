import 'dotenv/config';
import { tryParseBoolean, tryParseInt, tryParseString } from '#/util/TryParse.js';
import { WalkTriggerSetting } from '#/engine/entity/WalkTriggerSetting.js';

export default {
    EASY_STARTUP: tryParseBoolean(process.env.EASY_STARTUP, false),
    WEBSITE_REGISTRATION: tryParseBoolean(process.env.WEBSITE_REGISTRATION, true),

    /// web server
    WEB_PORT: tryParseInt(process.env.WEB_PORT, process.platform === 'win32' || process.platform === 'darwin' ? 80 : 8888),
    WEB_ALLOWED_ORIGIN: tryParseString(process.env.WEB_ALLOWED_ORIGIN, ''),

    // management server
    WEB_MANAGEMENT_PORT: tryParseInt(process.env.WEB_MANAGEMENT_PORT, 8898),
    // custom (2026-09-27) - loopback by default: /prometheus is not for the internet. Set to 0.0.0.0
    // only if something on another machine scrapes it, and firewall the port to that machine.
    WEB_MANAGEMENT_HOST: tryParseString(process.env.WEB_MANAGEMENT_HOST, '127.0.0.1'),

    /// internal servers (login, friend, logger) - see server/InternalServer.ts
    // What they listen on. Loopback keeps them off the network; a world on another machine needs
    // this set to a LAN address AND INTERNAL_SECRET set, or they refuse to start.
    INTERNAL_BIND_HOST: tryParseString(process.env.INTERNAL_BIND_HOST, '127.0.0.1'),
    // Shared by every process (world, login, friend, logger). Empty = no check, loopback only.
    INTERNAL_SECRET: tryParseString(process.env.INTERNAL_SECRET, ''),

    /// game server
    // Build handshake, NOT the RS protocol revision. The client sends this in its login
    // block (Client.java, `this.login.p2(...)`) and World.onClientData rejects a mismatch
    // with login response 6, "your client is out of date". Bump BOTH sides together
    // whenever a client change is mandatory - it is the only way a stale jar gets turned
    // away at the door instead of crashing someone mid-fight.
    //   378 = the walk-merge skeleton guard (Model.method368). An unpatched client throws
    //         ArrayIndexOutOfBounds on eat-while-walking with a godsword.
    //   379 = P_DIALOGPROMPT (server prot 9, 2026-09-21). An older client has no length for it and
    //         would read its text as the next packets.
    //   380 = the login RSA key rotation (2026-09-27). An older client encrypts with the old, public key,
    //         which the server no longer has - it could not log in anyway, this says why.
    //   381 = chat as typed (wordenc/ChatText, 2026-09-27). Public, private and clan lines are their
    //         characters now, not 377 WordPack nibbles; an older client would read every line as noise.
    // Escape hatch: ENGINE_REVISION=377 in the server's .env lets old clients back in
    // without a rebuild, if a cutover has to be rolled back in a hurry. (Not across 380: the
    // old clients' key is gone, so rolling back past it also means LOGIN_RSA_KEY_PATH=the old pem.)
    //   383 = PING / PONG (server prot 1, client prot 2, 2026-11-03). An older client has no length
    //         for opcode 1 and would read the probe's payload as its next packets.
    ENGINE_REVISION: tryParseInt(process.env.ENGINE_REVISION, 384),
    // world id - offset by 9, so 1 = 10, 2 = 11, etc
    NODE_ID: tryParseInt(process.env.NODE_ID, 10),
    NODE_PORT: tryParseInt(process.env.NODE_PORT, 43594),
    // members content
    NODE_MEMBERS: tryParseBoolean(process.env.NODE_MEMBERS, true),
    // automatically upgrade accounts to members on successful login to a members world
    NODE_AUTO_SUBSCRIBE_MEMBERS: tryParseBoolean(process.env.NODE_AUTO_SUBSCRIBE_MEMBERS, true),
    // addxp multiplier
    NODE_XPRATE: tryParseInt(process.env.NODE_XPRATE, 1),
    // production mode!
    NODE_PRODUCTION: tryParseBoolean(process.env.NODE_PRODUCTION, false),
    // custom (2026-09-27) - a staff-only world (the dev world): a login whose account is below this
    // staffmodlevel is refused with "This world is full". 3 = administrators and up; 1-2 (player mods,
    // mods) are turned away. It is the level in the database that counts, not the developer level
    // NODE_PRODUCTION=false gives everyone who does get in. 0 = anyone may log in. See LoginThread.
    NODE_MIN_STAFF_LEVEL: tryParseInt(process.env.NODE_MIN_STAFF_LEVEL, 0),
    NODE_SUBMIT_INPUT: tryParseBoolean(process.env.NODE_SUBMIT_INPUT, false),
    // Maximum approximate number of storage bytes allowed per single input tracking session.
    // It does not seem remotely possible to get near this amount under normal inputs.
    // Named LIMIT and read MAX, which nothing noticed because nothing reads this setting at all -
    // the property has no other use in the tree. Aligned so the one rule holds everywhere rather
    // than needing an exception; safe precisely because neither name is documented or read.
    NODE_LIMIT_BYTES_PER_TRACKING_SESSION: tryParseInt(process.env.NODE_LIMIT_BYTES_PER_TRACKING_SESSION, 50_000),
    NODE_MINIMUM_WEALTH_VALUE_EVENT: tryParseInt(process.env.NODE_MINIMUM_WEALTH_VALUE_EVENT, 10),
    // extra debug info e.g. missing triggers
    NODE_DEBUG: tryParseBoolean(process.env.NODE_DEBUG, true),
    // measuring script execution
    NODE_DEBUG_PROFILE: tryParseBoolean(process.env.NODE_DEBUG_PROFILE, false),
    // doing headless bot testing!
    NODE_DEBUG_SOCKET: tryParseBoolean(process.env.NODE_DEBUG_SOCKET, false),
    // no server routefinding until 2009
    NODE_CLIENT_ROUTEFINDER: tryParseBoolean(process.env.NODE_CLIENT_ROUTEFINDER, true),
    // yellow-x walktriggers in osrs went from: in packet handler -> in player setup -> player movement
    // 0 = processed in packet handler. 1 = processed in player setup (client input). 2 = processed in player movement
    NODE_WALKTRIGGER_SETTING: tryParseInt(process.env.NODE_WALKTRIGGER_SETTING, WalkTriggerSetting.PLAYERPACKET),
    // separate save folder
    NODE_PROFILE: tryParseString(process.env.NODE_PROFILE, 'main'),
    // custom (2026-09-27) - server-side bot players in the Wilderness (src/engine/bot). OFF unless a
    // world asks for them: the dev world sets NODE_BOTS=true, the live world never does. Counts,
    // hotspots and the rest come from NODE_BOTS_CONFIG (a JSON file, optional - see
    // src/engine/bot/BotConfig.ts for every knob and its default); the two counts can also be set here,
    // -1 meaning "whatever the file (or the default) says".
    NODE_BOTS: tryParseBoolean(process.env.NODE_BOTS, false),
    // custom (2026-09-29) - run energy never depletes, for everybody. Asked for by the owner as a
    // server-wide rule, so it defaults ON: the world wants it, and a flag that had to be set
    // before it did anything would not be the thing that was asked for. Set
    // NODE_UNLIMITED_RUN=false to put the ordinary drain back without a code change.
    NODE_UNLIMITED_RUN: tryParseBoolean(process.env.NODE_UNLIMITED_RUN, true),
    NODE_BOTS_CONFIG: tryParseString(process.env.NODE_BOTS_CONFIG, 'data/config/bots.json'),
    // custom (2026-10-27) - which toplists this server is listed on, for vote claiming
    // (src/engine/vote). A JSON array; see data/vote/sites.example.json for the shape and
    // VoteSites.ts for what every field means. NO FILE MEANS NO SITES, which is the right default:
    // everything behind it is built, and the Vote clerk says voting is not set up yet rather than
    // pretending to check. Secrets are named here, not written here - "env:VOTE_TOPG_KEY".
    VOTE_SITES_CONFIG: tryParseString(process.env.VOTE_SITES_CONFIG, 'data/vote/sites.json'),
    // How long to wait on a toplist's "has this player voted" API before giving up on it. A player
    // is standing in front of the clerk while this runs, so it is short on purpose.
    VOTE_CHECK_TIMEOUT: tryParseInt(process.env.VOTE_CHECK_TIMEOUT, 5000),
    // Where the vote ledger lives (VoteBook.ts). Named so it can be moved off a path the server
    // process cannot write to, which is the one thing that stops it opening, and so a test can
    // point it somewhere that is guaranteed not to open.
    VOTE_LEDGER: tryParseString(process.env.VOTE_LEDGER, ''),
    NODE_BOTS_ROAMERS: tryParseInt(process.env.NODE_BOTS_ROAMERS, -1),
    NODE_BOTS_PKERS: tryParseInt(process.env.NODE_BOTS_PKERS, -1),
    // what bots pray in a fight: smite, protect or none ('' = the file, or the default: smite)
    NODE_BOTS_PRAYER: tryParseString(process.env.NODE_BOTS_PRAYER, ''),
    // every N ticks, one log line per bot: what it is doing and why (0 = off)
    NODE_BOTS_TRACE: tryParseInt(process.env.NODE_BOTS_TRACE, 0),
    // custom (2026-09-29) - the fuzzing bots (src/engine/bot/BotFuzzer.ts): bots that wander and
    // then click everything in reach, with watchers that decide something is wrong without knowing
    // what the content meant. DEV WORLDS ONLY - BotManager.startFuzzers refuses to start unless
    // NODE_PRODUCTION is false as well, because a fuzzer on a live world is a griefing tool: it
    // would drop things, fire quest triggers and pull every monster in sight, under an account
    // nobody is holding. That check is in the code, not only in this comment.
    NODE_BOTS_FUZZ: tryParseBoolean(process.env.NODE_BOTS_FUZZ, false),
    NODE_BOTS_FUZZ_COUNT: tryParseInt(process.env.NODE_BOTS_FUZZ_COUNT, 4),
    // the seed every fuzzer's choices come from (its own is this plus its index), so a run repeats.
    // 0 = a fresh one each boot, printed on startup so it can be pinned afterwards.
    NODE_BOTS_FUZZ_SEED: tryParseInt(process.env.NODE_BOTS_FUZZ_SEED, 0),
    // where they start, "x,z,level" - empty = Lumbridge, which is where the most content per tile is
    NODE_BOTS_FUZZ_AT: tryParseString(process.env.NODE_BOTS_FUZZ_AT, ''),
    NODE_BOTS_FUZZ_FILE: tryParseString(process.env.NODE_BOTS_FUZZ_FILE, 'data/fuzz-findings.jsonl'),
    // custom (2026-11-02) - ticks between a fuzzer being picked up and put down somewhere else on
    // the map (BotManager.relocateFuzzer). A fuzzer that only walks never leaves the town it
    // started in, so without this the run tests one town however long it is given. 0 turns it off,
    // which is what a run investigating a reachability bug wants.
    NODE_BOTS_FUZZ_ROAM: tryParseInt(process.env.NODE_BOTS_FUZZ_ROAM, 400),
    // entities cap
    NODE_MAX_PLAYERS: tryParseInt(process.env.NODE_MAX_PLAYERS, 2047),
    NODE_MAX_CONNECTED: tryParseInt(process.env.NODE_MAX_CONNECTED, 1000),
    // custom (2026-09-27) - open sockets (game + ondemand, TCP + WebSocket), see server/ConnectionLimiter.ts.
    // 0 = no limit. Behind a proxy, set PROXY_PROTOCOL_FROM below so players keep their own addresses -
    // without it every player shares the proxy's, and one per-IP cap.
    NODE_MAX_SOCKETS: tryParseInt(process.env.NODE_MAX_SOCKETS, 2048),
    NODE_MAX_SOCKETS_PER_IP: tryParseInt(process.env.NODE_MAX_SOCKETS_PER_IP, 16),
    // custom (2026-10-19) - ticks without real input (an action, chat, a click, a camera move) before a
    // live world logs a player out; three times this and it does not wait for combat to end. 1000 = 10
    // minutes. 0 = off. Production only; administrators (3+) are never logged out for it. World.processLogouts
    // custom (2026-11-03) - how often to measure each client's round trip, in ticks (5 = every 3s).
    // 0 turns it off, and the client then shows no ping. World.processPings
    NODE_PING_TICKS: tryParseInt(process.env.NODE_PING_TICKS, 5),
    NODE_IDLE_LOGOUT_TICKS: tryParseInt(process.env.NODE_IDLE_LOGOUT_TICKS, 1000),
    // custom (2026-09-27) - addresses (and IPv4 CIDRs), comma separated, of a proxy or tunnel in front of
    // the game and web ports that sends PROXY protocol, so players keep their own addresses. Empty = off.
    // Connections from these are read for the header (one with none keeps its own address - Tailscale in
    // userspace mode forwards from 127.0.0.1); everyone else connects as before. server/ProxyProtocol.ts
    PROXY_PROTOCOL_FROM: tryParseString(process.env.PROXY_PROTOCOL_FROM, ''),
    NODE_MAX_NPCS: tryParseInt(process.env.NODE_MAX_NPCS, 16383),
    NODE_DEBUGPROC_CHAR: tryParseString(process.env.NODE_DEBUGPROC_CHAR, '~'),
    NODE_WS_ONDEMAND: tryParseBoolean(process.env.NODE_WS_ONDEMAND, false),
    // READS ITS OWN NAME, and did not: it was copy-pasted from NODE_MAX_NPCS three lines up and
    // the variable was never changed, so the hop timer was however many NPCs the world allowed,
    // in milliseconds. Harmless only while NODE_MAX_NPCS is unset - and .env.example offers
    // NODE_MAX_NPCS=8191, so uncommenting a line about NPCs would have quietly cut the relog
    // delay from 45 seconds to 8. tools/envcheck.ts now fails the build on any key that reads a
    // different variable than it is named.
    NODE_HOP_TIME: tryParseInt(process.env.NODE_HOP_TIME, 45000), // 45s
    // limit login attempts
    NODE_RATELIMIT_ADDRESS_LOGIN: tryParseInt(process.env.NODE_RATELIMIT_ADDRESS_LOGIN, 30), // ip (60s)
    NODE_RATELIMIT_DEVICE_LOGIN: tryParseInt(process.env.NODE_RATELIMIT_DEVICE_LOGIN, 5), // uid+ip (15s)
    // the private half of the login RSA key - made by `npm run rsa`, never committed (World.ts)
    LOGIN_RSA_KEY_PATH: tryParseString(process.env.LOGIN_RSA_KEY_PATH, 'data/config/login-rsa.pem'),

    /// login server
    LOGIN_SERVER: tryParseBoolean(process.env.LOGIN_SERVER, false),
    LOGIN_HOST: tryParseString(process.env.LOGIN_HOST, 'localhost'),
    LOGIN_PORT: tryParseInt(process.env.LOGIN_PORT, 43500),

    /// friends server
    FRIEND_SERVER: tryParseBoolean(process.env.FRIEND_SERVER, false),
    FRIEND_HOST: tryParseString(process.env.FRIEND_HOST, 'localhost'),
    FRIEND_PORT: tryParseInt(process.env.FRIEND_PORT, 45099),

    /// logger server
    LOGGER_SERVER: tryParseBoolean(process.env.LOGGER_SERVER, false),
    LOGGER_HOST: tryParseString(process.env.LOGGER_HOST, 'localhost'),
    LOGGER_PORT: tryParseInt(process.env.LOGGER_PORT, 43501),

    /// database
    DB_BACKEND: tryParseString(process.env.DB_BACKEND, 'sqlite'),
    DB_HOST: tryParseString(process.env.DB_HOST, 'localhost'),
    DB_PORT: tryParseInt(process.env.DB_PORT, 3306),
    DB_USER: tryParseString(process.env.DB_USER, 'root'),
    DB_PASS: tryParseString(process.env.DB_PASS, 'password'),
    DB_NAME: tryParseString(process.env.DB_NAME, 'lostcity'),
    DB_LOGGER_HOST: tryParseString(process.env.DB_LOGGER_HOST, ''),
    DB_LOGGER_PORT: tryParseInt(process.env.DB_LOGGER_PORT, 0),
    DB_LOGGER_USER: tryParseString(process.env.DB_LOGGER_USER, ''),
    DB_LOGGER_PASS: tryParseString(process.env.DB_LOGGER_PASS, ''),
    DB_LOGGER_NAME: tryParseString(process.env.DB_LOGGER_NAME, ''),

    /// kysely
    KYSELY_VERBOSE: tryParseBoolean(process.env.KYSELY_VERBOSE, false),

    /// development
    BUILD_VERBOSE: tryParseBoolean(process.env.BUILD_VERBOSE, false),
    // auto-build on startup
    BUILD_STARTUP: tryParseBoolean(process.env.BUILD_STARTUP, false),
    // BUILD_VERIFY covers the pack files: every config has an id line, and every id line has a
    // config. Those catch real mistakes in a content repo and cost nothing, so they stay on.
    BUILD_VERIFY: tryParseBoolean(process.env.BUILD_VERIFY, true),
    // BUILD_VERIFY_CACHE is the other thing BUILD_VERIFY used to gate: a CRC of each packed archive
    // against the ORIGINAL 377 cache, to prove the build reproduces it byte for byte. That is a
    // guarantee an unmodified repo can give and a content repo cannot - this one has added locs,
    // npcs, objs, seqs, spotanims, varbits, varps and interfaces, and eight of the ten archives no
    // longer match (.flo and .idk still do). One flag covering both meant the only way to build was
    // BUILD_VERIFY=false, which ALSO turned off the pack-file checks - and that is how a dangling
    // seq id sat in the repo unnoticed. Set it to true on a repo that is meant to reproduce stock.
    BUILD_VERIFY_CACHE: tryParseBoolean(process.env.BUILD_VERIFY_CACHE, false),
    // used to keep some semblance of sanity in our folder structure
    BUILD_VERIFY_FOLDER: tryParseBoolean(process.env.BUILD_VERIFY_FOLDER, true),
    // used for unpacking/custom development
    BUILD_VERIFY_PACK: tryParseBoolean(process.env.BUILD_VERIFY_PACK, true),
    // used for unpacking/custom development
    BUILD_SRC_DIR: tryParseString(process.env.BUILD_SRC_DIR, '../content'),

    // custom (2026-09-29) - the script fault reporter (engine/script/ScriptFaults.ts). A RuneScript
    // error aborts the whole trigger stack, so one bad line inside a gosub can silently eat a drop
    // table; this collects every fault by signature instead of leaving them in journalctl. OFF
    // unless NODE_SCRIPT_FAULTS is set, and off it costs one boolean read per error.
    // NODE_SCRIPT_FAULTS_WEBHOOK is a Discord webhook URL and is a SECRET: keep it in .env, never
    // in a commit. It is never printed - not on startup, not in an error, not in the JSONL file.
    NODE_SCRIPT_FAULTS: tryParseBoolean(process.env.NODE_SCRIPT_FAULTS, false),
    NODE_SCRIPT_FAULTS_FILE: tryParseString(process.env.NODE_SCRIPT_FAULTS_FILE, 'data/faults.jsonl'),
    NODE_SCRIPT_FAULTS_WEBHOOK: tryParseString(process.env.NODE_SCRIPT_FAULTS_WEBHOOK, ''),
    // custom (2026-09-29) - which of the build's triggers have ever run (engine/script/
    // ScriptCoverage.ts), and the file ::coverage write puts the never-reached list in. Off unless
    // asked for, and off it is one boolean read per script execution. The list is the point: a
    // trigger nothing has ever reached is content nobody has ever played.
    NODE_SCRIPT_COVERAGE: tryParseBoolean(process.env.NODE_SCRIPT_COVERAGE, false),
    NODE_SCRIPT_COVERAGE_FILE: tryParseString(process.env.NODE_SCRIPT_COVERAGE_FILE, 'data/coverage.txt'),

    // custom (2026-11-02) - the dead-op collector (engine/script/DeadOps.ts): every click that
    // reached a real target and found no trigger, which is every "Nothing interesting happens." the
    // engine says. Off unless asked for; on, it costs one Map.get per unanswered click, and only an
    // unanswered click gets there at all. The file is the to-do list.
    NODE_DEAD_OPS: tryParseBoolean(process.env.NODE_DEAD_OPS, false),
    NODE_DEAD_OPS_FILE: tryParseString(process.env.NODE_DEAD_OPS_FILE, 'data/dead-ops.jsonl'),
    // custom (2026-11-09) - the PUBLIC market feed (server/market/MarketFeed.ts), which is the
    // other half of the relay below: that one DMs a seller their own notices, this one tells
    // everybody else a thing is for sale. Off unless MARKET_FEED_WEBHOOK is set, and off it
    // costs one string comparison per listing.
    //
    // MARKET_FEED_WEBHOOK IS A SECRET - whoever holds it can post to that channel as the
    // server - so it belongs in .env and never in a commit. It is never printed, only whether
    // there is one.
    //
    // MARKET_FEED_MIN is the floor: a listing worth less than this many coins is not posted.
    //
    // IT IS NOUGHT, SO EVERYTHING IS. It was 50,000 to keep the bronze daggers out of the
    // channel, which is the right instinct on a server with an economy and the wrong one on a
    // server four days old: almost nobody has 50,000 to spend yet, and what the feed is actually
    // for at this stage is telling people a thing has been listed AT ALL. Changed on the owner's
    // reading of his own channel, 19 November 2026.
    //
    // AND IT SILENCED THE LISTINGS THAT MOST WANT AN AUDIENCE. A listing with no buyout - offers
    // please - has no price to judge, so TradingPostOps hands over the lot's shop value instead,
    // and any floor at all therefore muted every cheap item somebody was asking for offers on.
    //
    // NOUGHT POSTS A NOUGHT. The test is `value < minValue`, not `<=`, so a lot that is worth
    // nothing still goes out rather than being the one thing a floor of nought keeps catching.
    //
    // MARKET_FEED_EVERY is the gap between cards, which is what stops a busy evening becoming a
    // channel nobody reads - and that, with the queue's cap dropping the cheapest first, is what
    // makes a floor of nought safe to have.
    //
    // MARKET_CARD_ICONS is where tools/models/ObjIconFiles.java wrote the item icons - on the
    // live box, the website's public/icons. Unset, and cards still draw, with an empty slot.
    MARKET_FEED_WEBHOOK: tryParseString(process.env.MARKET_FEED_WEBHOOK, ''),
    MARKET_FEED_MIN: tryParseInt(process.env.MARKET_FEED_MIN, 0),
    MARKET_FEED_EVERY: tryParseInt(process.env.MARKET_FEED_EVERY, 15000),
    MARKET_CARD_ICONS: tryParseString(process.env.MARKET_CARD_ICONS, ''),

    // custom (2026-11-19) - the broadcast feed (server/broadcast/BroadcastFeed.ts): the world's
    // own announcements as cards in a Discord channel, drawn the same way the market's are. Off
    // unless BROADCAST_FEED_WEBHOOK is set, and a webhook url is a password, so it belongs in .env
    // and is never printed - only whether there is one.
    //
    // A DIFFERENT CHANNEL FROM THE MARKET, which is the point of it being a second variable rather
    // than a flag on the first: a feed of what people are selling and a feed of what people have
    // achieved are read by the same person in two different moods.
    //
    // BROADCAST_FEED_EVERY is lower than the market's 15s because these are rarer and more worth
    // reading, and because milestones arrive in bursts rather than steadily - a total level and a
    // 99 can land on the same tick.
    // CARD_SKILL_ICONS is the sibling of MARKET_CARD_ICONS: the 23 skill icons the website draws
    // on its own hiscore pages, which a 99 or an experience milestone puts on its card. Unset, and
    // those cards come out without a picture rather than not at all.
    CARD_SKILL_ICONS: tryParseString(process.env.CARD_SKILL_ICONS, ''),
    BROADCAST_FEED_WEBHOOK: tryParseString(process.env.BROADCAST_FEED_WEBHOOK, ''),
    BROADCAST_FEED_EVERY: tryParseInt(process.env.BROADCAST_FEED_EVERY, 5000),

    // custom (2026-09-21) - the Discord relay (server/discord/DiscordThread.ts): a bot that DMs players
    // their trading post notices. Both must be set or it does not start. Keep the token in .env only.
    DISCORD_TOKEN: tryParseString(process.env.DISCORD_TOKEN, ''),
    DISCORD_GUILD_ID: tryParseString(process.env.DISCORD_GUILD_ID, ''),

    // custom (2026-09-27) - the ticket bot (server/tickets/TicketBot.ts, `npm run tickets`): support
    // tickets and bug reports. A separate Discord application from the relay above, with its own
    // token. The guild defaults to DISCORD_GUILD_ID. Keep the token in .env only.
    TICKET_BOT_TOKEN: tryParseString(process.env.TICKET_BOT_TOKEN, ''),
    TICKET_GUILD_ID: tryParseString(process.env.TICKET_GUILD_ID, ''),

    // custom (2026-11-10) - handing a bug report over as a GitHub issue
    // (server/tickets/BugTracker.ts). The repository is "owner/name" and must be PRIVATE: bug
    // reports live in private threads so an exploit is never readable by players, and all four code
    // repositories are public, so the issue cannot go in one of them.
    //
    // The token is a fine-grained token with Issues: read and write on that tracker and nothing
    // else - no contents, no other repository. It cannot push code anywhere. Keep it in .env only.
    // Both must be set or the Hand to Claude button does not appear.
    BUGS_GITHUB_REPO: tryParseString(process.env.BUGS_GITHUB_REPO, ''),
    BUGS_GITHUB_TOKEN: tryParseString(process.env.BUGS_GITHUB_TOKEN, '')
};
