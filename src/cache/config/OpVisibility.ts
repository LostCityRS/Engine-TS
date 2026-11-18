// custom (2026-11-02) - "is this right-click option hidden?", in ONE place.
//
// FOUND BY tools/sim/opsweep.ts. The content writes this marker both ways - 674 `hidden` and 103
// `Hidden` across the configs - and the two sides of the connection disagreed about which counted:
//
//   client   jagex2/config/LocType.java and friends: equalsIgnoreCase("hidden"), so the client
//            drops BOTH spellings and never draws either option.
//   server   OpLocHandler, OpNpcHandler and OpObjHandler compared === 'hidden', case-sensitive, so
//            for the 103 capitalised ones the server's "bad client: that option is hidden" check
//            did not fire. The option a real client will not even draw was accepted if sent.
//
// Nothing a normal player does reaches it, because a normal client never offers the click. A client
// that sends the packet anyway got the interaction - or, where no trigger claimed it, defaultOp.
// Matching the client is the fix, and having one function to match it in is what stops the two
// drifting apart again.
export function isVisibleOp(label: string | null | undefined): label is string {
    return !!label && label.toLowerCase() !== 'hidden';
}

export function isHiddenOp(label: string | null | undefined): boolean {
    return !isVisibleOp(label);
}

// custom (2026-11-18) - "is this option the one that starts a conversation?", in ONE place, for
// the same reason as above: two copies of a label rule drift.
//
// The cache spells it both ways - 285 `Talk-to` and 22 `Talk-To` across the npc configs - so an
// exact comparison misses the twenty-two (Ahoy's ghost sailors, the Mort'ton afflicted). Two
// callers need the same answer and must agree:
//
//   Player.defaultOpMessage  prints "<name> is not interested in talking." instead of "Nothing
//                            interesting happens." when a Talk-to click found no trigger.
//   tools/sim/opsweep.ts     reports an unanswered op1 that is NOT Talk-to separately, because the
//                            sentence above is the wrong one for it: "Take" on the Haunted Mine's
//                            bronze pickaxes, "Pet" on Sophanem's plagued cows, "Kick" on the
//                            Wise Old Man's bed.
export const TALK_TO_OP = /^talk[- ]to$/i;

// ------------------------------------------------------------------------------------------------
// custom (2026-11-03) - "could a client ever send this op?", with multilocs resolved the way the
// handler resolves them.
//
// A multiloc is one loc on the map whose TYPE depends on a varbit or varp: a bank booth that is
// rubble before a quest and a booth after, a tree that becomes a stump. OpLocHandler does this, and
// this file mirrors it rather than approximating it:
//
//     let locType = LocType.get(loc.type);                 // the type PLACED on the map
//     if (locType.multivarp !== -1)   -> multiloc[player's varp]
//     else if (locType.multivarbit !== -1) -> multiloc[player's varbit]
//     if (!locType.op || isHiddenOp(locType.op[op - 1]))  -> "bad client", refused
//
// So the resolution is DOWNWARD ONLY: the placed type, or one of the variants its own multiloc list
// can select. It does not go up from a variant to its shell and it does not go sideways between
// siblings. Getting that wrong in both directions is how this ended up in one file: a shell-only
// check called 60 working sim steps broken, and a check that walked shells and siblings cleared
// Desert Treasure's obelisks, which a real OpLoc packet is refused for.
//
// A state out of range leaves locType as the shell, so the shell's own ops count too.
//
// `hidden` counts as DECLARED here. The handler refuses it for a client - and so does this - but
// p_oploc re-enters a hidden op from script and the content relies on that, which is why
// tools/sim/orphans.ts asks this question with hidden allowed and opsweep asks it with hidden
// refused. The two are different questions about the same field; see those files' headers.

import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';

/** The placed type, plus the variants its own multiloc list can resolve to. Nothing else. */
function resolvable(own: number, multiloc: number[] | undefined, multivarp: number, multivarbit: number): number[] {
    if (multivarp === -1 && multivarbit === -1) {
        return [own]; // no resolution happens; the type is what the client sees
    }
    const out = [own];
    for (const variant of multiloc ?? []) {
        if (variant >= 0) {
            out.push(variant);
        }
    }
    return out;
}

/** Every loc type id a client could be looking at, given this type is the one on the map. */
export function locFamily(id: number): number[] {
    const type = LocType.get(id);
    return type ? resolvable(id, type.multiloc, type.multivarp, type.multivarbit) : [id];
}

/** The same for npcs - OpNpcHandler resolves them identically. */
export function npcFamily(id: number): number[] {
    const type = NpcType.get(id);
    return type ? resolvable(id, type.multinpc, type.multivarp, type.multivarbit) : [id];
}

/** Is op `op` (1-based) declared on this loc, or on any variant it can resolve to? */
export function locCanOp(id: number, op: number): boolean {
    return locFamily(id).some(i => {
        const label = LocType.get(i)?.op?.[op - 1];
        return label !== null && label !== undefined && label !== '';
    });
}

/** The same for npcs. */
export function npcCanOp(id: number, op: number): boolean {
    return npcFamily(id).some(i => {
        const label = NpcType.get(i)?.op?.[op - 1];
        return label !== null && label !== undefined && label !== '';
    });
}
