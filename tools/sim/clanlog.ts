// WHAT GETS WRITTEN TO clan_chat, AND WHAT DOES NOT.
// Usage: npx tsx tools/sim/clanlog.ts   (exit code is the verdict)
//
// Clan chat was the one kind of chat nobody could read back: public and private have been going
// into the database since FRIEND_SERVER went on, and a clan line was relayed in memory by
// ClanChat.message and then gone. A channel is where a trade gets arranged and a scam gets
// planned, so it was the gap that mattered most.
//
// THE LOG CALL IS WHAT IS ASSERTED, not a database row. The insert itself happens in the friend
// server, a separate process a sim has no business starting, and whether kysely can write a row
// is not in question - public_chat has done it 7,929 times on the live world. What IS in question
// is whether the one choke point fires with the right channel, the right text, and ONLY for a
// line that was actually carried. So World.logClanChat is stood in for and its arguments read.
//
// THE REFUSALS ARE HALF THE POINT. ClanChat.message turns a line away twice - no channel, and a
// talk rank the speaker does not meet - and a log that recorded those would be a log of things
// nobody heard, which is worse than no log at all in a ban appeal.
import { DatabaseSync } from 'node:sqlite';

import ClanChat, { ClanRank } from '#/engine/clan/ClanChat.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';

import { check, R } from './a1lib.js';
import * as H from './harness.js';

await H.boot();

type Logged = { owner: string; channel: string; text: string };
const logged: Logged[] = [];
const realLog = World.logClanChat;
// Stood in rather than spied on: the real one posts to the friend thread, which a sim has not
// started, and the message would go nowhere and say nothing either way.
(World as unknown as { logClanChat: unknown }).logClanChat = (_p: unknown, owner: string, channel: string, chat: string) => {
    logged.push({ owner, channel, text: chat });
};

const tag = 'cls' + (Date.now() % 100000);
const made: string[] = [];
const fresh = (suffix: string) => {
    const name = tag + suffix;
    made.push(name);
    return H.makePlayer(name, 3222, 3218);
};
const last = () => logged[logged.length - 1];

const boss = fresh('boss');
const mate = fresh('mate');
ClanChat.setName(boss as never, 'Yak Fans');
ClanChat.join(boss as never, boss.username);
ClanChat.join(mate as never, boss.username);

console.log('== a line said in a channel is logged, once, as said');
{
    const before = logged.length;
    ClanChat.message(mate as never, 'whip for sale, 2m');
    check('exactly one log call', logged.length - before, 1);
    check('the text is what was typed', last()?.text, 'whip for sale, 2m');
    check("the channel's owner", last()?.owner, boss.username);
    check("the channel's name", last()?.channel, 'Yak Fans');
}

console.log('\n== the owner talking is logged the same way');
{
    const before = logged.length;
    ClanChat.message(boss as never, 'sold');
    check('logged', logged.length - before, 1);
    check('as the same channel', last()?.channel, 'Yak Fans');
}

console.log('\n== a rename is reflected, because the NAME is stored and not re-derived later');
{
    ClanChat.setName(boss as never, 'Yak Fans 2');
    ClanChat.message(mate as never, 'nice new name');
    check('the new name is logged', last()?.channel, 'Yak Fans 2');
    check('the owner has not changed', last()?.owner, boss.username);
}

console.log('\n== a line the channel REFUSED is not logged');
{
    // Only me: a member with no rank can no longer talk here.
    ClanChat.setRank(boss as never, 1, ClanRank.OWNER);
    const before = logged.length;
    ClanChat.message(mate as never, 'can anyone hear me');
    check('nothing logged for a refused line', logged.length - before, 0);

    // and the owner, who does meet it, still is
    ClanChat.message(boss as never, 'only me in here');
    check('the owner still gets through', logged.length - before, 1);
    check('  with their line', last()?.text, 'only me in here');
}

console.log('\n== a player in no channel at all is not logged');
{
    const nobody = fresh('solo');
    const before = logged.length;
    ClanChat.message(nobody as never, 'hello?');
    check('nothing logged', logged.length - before, 0);
}

console.log('\n== and every line logged names a channel');
{
    check('no blank channel slipped through', logged.filter(l => !l.channel).length, 0);
    check('no blank owner slipped through', logged.filter(l => !l.owner).length, 0);
    check('no blank text slipped through', logged.filter(l => !l.text).length, 0);
}

(World as unknown as { logClanChat: unknown }).logClanChat = realLog;

// Leave the clan database as it was found - with SQL, as helpclan.ts does, so a sim adds no
// test-only surface to the thing it is testing.
{
    const db = new DatabaseSync(`data/clans/${Environment.NODE_PROFILE}.sqlite`);
    for (const name of made) {
        db.prepare('DELETE FROM last_channel WHERE player = ?').run(name);
        db.prepare('DELETE FROM help_seeded WHERE player = ?').run(name);
        db.prepare('DELETE FROM channel WHERE owner = ?').run(name);
    }
    db.close();
    console.log(`\ncleaned up ${made.length} test players`);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
