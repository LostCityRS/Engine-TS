# Decisions waiting on the owner

Everything here is a question I could not answer by reading the code, because the answer is a
choice about the game rather than a fact about the build. Each one says what the evidence is, what
the options are, and what it costs to get it wrong. None of it is blocked on more analysis.

The detail lives in the tools and files named; this page exists so the open questions are in one
place instead of scattered through commit messages.

---

## 1. Two shops that print money

`python3 tools/shoparbitrage.py` in the content repo. Both verified by hand.

| item | buy from | at | sell to | at | profit |
|---|---|---|---|---|---|
| `ruby_ring` | Irksol, `cheapringshop` | 500 (~1,012gp of its 2,025 cost) | Grum, `goldshop` | 700 (~1,417gp) | ~405gp a ring |
| `ale_yeast` | Blandebir, `blandebir_shop` | effectively 100 (2gp of its 25gp cost) | Noterazzo, `taxfree` | 600 (15gp) | 13gp a yeast |

Both in coins, both shops restock, so both repeat. `~price_mod` damps it as stock drifts, so each
loop is finite rather than infinite — but the early trades pay, which is enough.

**The ruby ring** is a straight price disagreement between two counters: Irksol sells jewellery at
half cost and Grum buys it at seven tenths. Either number alone is defensible. Together they are a
loop. Pick which one moves.

**The ale yeast** has a different cause worth separating. Blandebir's npc block carries
`owned_shop` and `shop_title` **and no multipliers at all** — he is the only one of 199 keepers who
omits both — so he inherits the params' declared defaults of 100 and 60. Those defaults are on the
scale from before `~calc_shop_value` ended in `scale($int5, 1000, $base_cost)`, where 1000 is par,
so they now mean 10% and 6%.

Two fixes, not equivalent:

- give Blandebir explicit multipliers like the other 198 keepers — fixes this shop, leaves the trap
  for the next keeper added without them;
- move the params' own defaults to 1000 and 600 — fixes this shop and the next one, and also fixes
  the one other keeper that omits only `shop_buy_multiplier`. Changes nothing else, because nobody
  else relies on the defaults.

I did not pick, because both change a price.

## 2. Fareed respawns after you kill him

`python3 tools/varpstates.py` in the content repo, its only finding.

`%fd_killed_firewarrior` is tested at `dt_smoke.rs2:227` and set nowhere. The guard is there to stop
Fareed being spawned again when the player re-enters his arena having already killed him, and the
comment directly beneath it says the spawn-on-demand design exists "so he cannot be farmed before
the quest". As written, he respawns every time.

The reason is already written down in this repo, for the twin varp: *"an `ai_queue` trigger starts
with neither the protected active player nor a player pointer at all, so `%fd_killed_ninja` cannot
be set from a death hook"* (`quest_deserttreasure.rs2:564`). Fareed's kill is handled by exactly
such a hook, `[ai_queue3,firediamond_firewarrior]`.

**The question is an engine one:** that hook does call `npc_findhero`, which establishes a hero
pointer. Whether a player varp can be written after that, or whether it needs the protected active
player, decides whether this is a one-line content fix or needs the state moving somewhere else. I
did not guess at engine semantics.

## 3. The three mining clusters

`npx tsx tools/sim/deadrocks.ts`, and the long section in `opsweep-backlog.md`. The tool settles the
ore for 99 of 175 rocks from seam colour, so most of this bucket needs no decision. Three clusters
have no colour to go on:

- **`dwarf_gold_mine` / `_l` / `_r`** — 155 instances, "Mineral vein", no recolour. The description
  names gold, which is the only evidence there is.
- **`loc_4976..4996` / `loc_12941..3`** — 110 instances, "A distinctive layer in the rock strata".
  No vein mechanic exists in this build.
- **`loc_14850/51/52`** — 72 instances, the awkward one. Their seam is recoloured to 0, which by
  `regional_rocks.loc`'s own rule ("a rock with no ore colour is a rock with no ore in it") makes
  them spent — but they carry `mapscene=12`, so the map draws a mine icon there, and the live rocks
  of their family sit 300 tiles away in the Lava Maze. Spent, or never assigned.

Each also needs a yes/no on **whether the rock depletes**, which is not cosmetic: a depleting rock
needs `param=next_loc_stage_mining` pointing at a spent partner and `loc_change` **throws** on a
null type, so wiring one without a partner fails loudly. A non-depleting rock needs its own
`get_ore_*` label instead — `blankrunestone` and `get_ore_essence` are the precedent.

And the trap, before anything is wired: several declare no `op3`, including the whole Lunar Isle
run. `mining.rs2` keeps a player swinging with `p_oploc(3)` and `P_OPLOC` returns early on a null
slot, so such a rock mines once and stops even with the category and ore right. Every working rock
carries `op3=hidden`.

## 4. The 24 remaining dead ladders

`npx tsx tools/sim/deadladders.ts`. These need somebody who knows the areas; three approaches have
already failed and are written up in `opsweep-backlog.md`. The specific trap, found the hard way:
three Lunar Isle ladders whose other half is one tile off had **already been wired and reverted**
once, and `lunar_isle.loc` says so. 28 were wired on tool evidence and all 28 reverted.

`climbladders.ts` exists and its calibration proves it cannot decide this — a working ladder manages
6 of 13 interaction tiles landing on open ground and a deliberately unwired one manages 4 of 7. One
rule survived: a ladder solid from *every* interaction tile cannot be a vertical link, which rules
out 10 and leaves the rest to judgement.

## 5. `Release` and `Play-With` intent

Six items drop silently and three fishbowl fish equip into the **weapon slot**. Whether `Release`
should delete the item, place a creature, or do nothing is a design call, and the fishbowl fish
going to the weapon slot is either a bug or the only slot available. One decision covers all nine.

## 6. Twelve script-spawned npcs with a dead `Talk-to`

Dialogue nobody has written, for npcs a script spawns rather than the map placing. Writing words in
somebody's characters' mouths is not mine to do. The larger bucket is 501 npc `Talk-to` options in
the same state (`opsweep-backlog.md`); these twelve are separated only because a script spawns them,
so a player meets them in a specific moment that suggests what they would say.

## 7. Three test assertions I rewrote

Each asserted an option was **absent** and now asserts the guarantee instead: the two barrows
broken-piece checks (`~barrows_broken_refuse` claims the Wear) and the `maxcape` `iop3`. One revert
each if you disagree. Named here rather than left in a diff because a test that changed meaning is
easy to lose.

---

## Two new questions from the equip sweep, smaller

`npx tsx tools/sim/equipcycle.ts`. 1,406 ok, 0 FAIL, 21 untested of 1,427 — no second duplication
exists among wearable items.

- **93 objs have a `wearpos` and no Wear, Wield or Equip option** (`--unwearable`). Most look
  vestigial — `readbook_dummy`, `wearable_stool_white`, the strung lyres whose only option is Play —
  but `ikov_staffofarmardyl`, `rockpick` and `throwingrope` are quest items, and whether any of them
  is meant to be wearable is a content question.
- **21 would not go on at all** for a maxed player with an empty inventory: `bandos_platebody`,
  `gilded_dhide_body`, `dragon_sq_shield_g`, `dragon_scimitar_or`, both dragonfire shields and
  others. A wear option that refuses a player with every stat and no requirement left to fail is its
  own small question.

## Not a decision, just the measurement

The first nightly on the merged engine (run 40, `9d29cbde`) was **green**, and it answers the one
thing that was unmeasured. The fuzz job took **512s against its 90-minute cap** — and it is *faster*
on a hosted runner than the 881s measured on the development box, which is the opposite of what I
predicted when setting that cap. The ratchets job took 98s. Runs 38 and 39, before the merge, had
both failed.

One night is not variance, so the cap is worth leaving alone until there are a few more; if it is
ever tightened, 512s is the number to start from and not the 881s in `fuzz.ts`'s header.

## Tried and not viable: a world connectivity flood fill

The idea was to flood walkable tiles from Lumbridge and find content placed where no player can
walk. `isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED)` from `GameMap` is the right primitive and
a breadth-first fill over level 0 runs fine, so the attempt failed on its meaning rather than its
mechanics.

It reached **3,000,000 tiles and stopped there because that was the cap**, inside a bounding box of
about 4.35M. That makes the run inconclusive as it stands - "Varrock square not reached" came out of
it, and Varrock is plainly walkable from Lumbridge, so that is the truncation and not a finding.

The reason it got that far is the thing to fix before trying again: `WALK_BLOCKED` is set where
something blocks, so a tile with **no map data at all** is not flagged and reads as open. The fill
leaks through void instead of stopping at the edge of the world, which is why the number is
implausibly large for the walkable surface of a 377 map. A usable version needs a "does this tile
have map data" test - a loaded-zone check - and not just the collision flag.

Worth knowing even then: the honest signal is small. Entrana and Ape Atoll correctly came back
unreachable, and so would every island, dungeon and instance that a player reaches by boat, ladder
or teleport. Those are correct answers and useless ones, which is the shape `climbladders.ts` is
already in. Any second attempt should decide up front how it tells "unreachable on foot, as
designed" from "unreachable, which is a bug", because the first flood fill cannot.
