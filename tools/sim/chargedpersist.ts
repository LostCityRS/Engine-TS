// CHARGED JEWELLERY KEEPS ITS CHARGES ACROSS A LOGOUT.
//
//   npx tsx tools/sim/chargedpersist.ts
//
// Every charge of a teleport item is a SEPARATE OBJ - ring_of_dueling_8 down to ring_of_dueling_1,
// amulet_of_glory_4 down to the plain amulet - so "how many teleports are left" is carried by nothing
// except which obj sits in the slot. A save that wrote back a different member of the family, or the
// base one, would move a player's charges without them teleporting at all, which is a bug no sim
// could see from the teleport side: all eight teleport paths spend exactly one charge and always did.
//
// So this saves a player holding charged items worn AND carried, rebuilds them through the engine's
// own loader, and asserts every slot comes back holding the same obj. Player.save() and
// PlayerLoading.load are the two halves a real logout and login use (World.ts calls that loader with
// the bytes the login thread read), so this is the real path rather than a model of it.
//
// TWO CONTROLS, and they are not decoration. While investigating tracker issue 12 a hand-rolled
// version of this probe reported that a reloaded player came back with an empty bag - which looked
// like catastrophic item loss and was nothing of the kind: Player.save() returns a Uint8Array, not a
// Packet, and reading `.data` off it yielded undefined, so the probe fed the loader an empty buffer
// and the loader correctly handed back a fresh character. A plain item and a big stack are checked
// alongside the charged ones so that a future failure of that shape reads as "everything is gone,
// so suspect the harness" rather than as a charge bug.
import * as H from './harness.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Packet from '#/io/Packet.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';

await H.boot();
H.loginOrder();

const RING = 12;
const FRONT = 2;

/** A case: what to wear, what to carry, and the slot the worn half lives in. */
type Case = { what: string; worn: string; wornSlot: number; carried: [string, number][] };

const CASES: Case[] = [
    {
        what: 'ring of dueling, full worn and part-used carried',
        worn: 'ring_of_dueling_8',
        wornSlot: RING,
        carried: [['ring_of_dueling_5', 1]]
    },
    {
        what: 'ring of dueling on its last charges',
        worn: 'ring_of_dueling_1',
        wornSlot: RING,
        carried: [['ring_of_dueling_2', 1]]
    },
    {
        what: 'games necklace, full worn and part-used carried',
        worn: 'necklace_of_minigames_8',
        wornSlot: FRONT,
        carried: [['necklace_of_minigames_3', 1]]
    },
    {
        // Glory's last charge leaves the plain amulet rather than dust, so the uncharged one is a
        // member of the family and has to survive the trip as itself.
        what: 'amulet of glory, charged worn and uncharged carried',
        worn: 'amulet_of_glory_4',
        wornSlot: FRONT,
        carried: [
            ['amulet_of_glory_1', 1],
            ['amulet_of_glory', 1]
        ]
    },
    {
        what: 'controls: a plain item and a big stack',
        worn: 'amulet_of_glory_2',
        wornSlot: FRONT,
        // 70,000 coins exercises the save's 255-and-then-a-word count branch.
        carried: [
            ['bronze_dagger', 1],
            ['coins', 70000]
        ]
    }
];

let failed = 0;
const name = (id: number) => ObjType.get(id).debugname ?? String(id);

let bucket = 20;
for (const c of CASES) {
    const p = H.makePlayer('persist' + bucket, 3222, 3222, bucket) as never as {
        save(): Uint8Array;
        getInventory(t: number): { capacity: number; get(s: number): { id: number; count: number } | null } | null;
    };
    bucket++;
    H.tick(2);
    H.maxOut(p as never);
    H.clearInv(p as never);
    H.equip(p as never, { [c.wornSlot === RING ? 'ring' : 'front']: c.worn } as never);
    for (const [obj, n] of c.carried) H.give(p as never, obj, n);
    H.tick(2);

    /** Every occupied slot of an inventory, as "slot=objname xcount". */
    const slots = (q: typeof p, inv: number): string[] => {
        const i = q.getInventory(inv);
        if (!i) return ['<no inventory>'];
        const out: string[] = [];
        for (let s = 0; s < i.capacity; s++) {
            const o = i.get(s);
            if (o) out.push(`${s}=${name(o.id)}x${o.count}`);
        }
        return out;
    };

    const before = [...slots(p, InvType.WORN), ...slots(p, InvType.INV)].join(' ');
    const reloaded = PlayerLoading.load('persist', new Packet(new Uint8Array(p.save())), null) as never as typeof p;
    const after = [...slots(reloaded, InvType.WORN), ...slots(reloaded, InvType.INV)].join(' ');

    const pass = before === after && before !== '';
    if (!pass) failed++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${c.what}`);
    if (!pass) {
        console.log(`         before: ${before || '<nothing - the player was never given anything>'}`);
        console.log(`         after:  ${after || '<nothing - suspect the save buffer, see the note at the top>'}`);
    }
}

console.log(failed ? `\n${failed} of ${CASES.length} lost or changed something across the save` : `\n${CASES.length} ok, charges survive a logout`);
process.exit(failed ? 1 : 0);
