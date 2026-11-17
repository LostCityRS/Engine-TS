# Combat simulation harness

Boots the **real** engine and steps it by hand. Nothing in here models the game: `World.start(false,
false)` loads the real map and the real compiled content, and `World.cycle()` is the server's own
tick. Players are real `Player` objects put into `World.playerLoop`, and the clicks come from
helpers that copy the packet handlers (`OpPlayerHandler`, `OpHeldHandler`, `IfButtonHandler`,
`processClientsIn`) including the parts that throw a click away.

Every hitsplat is recorded at the moment `Player.applyDamage` runs, so the numbers below are the
ticks damage actually landed on, not an estimate.

## Running

```
BUILD_VERIFY=false BUILD_SRC_DIR=/path/to/content npx tsx tools/pack/Build.ts   # once, after content changes
npx tsx tools/sim/run.ts <scenario>
```

That build line is not optional. A sim boots the world with `startCycle` off, and a world that does
not run its own loop gets no dev thread: nothing here watches the content for changes and nothing
rebuilds the cache for you, so a scenario reads whatever `data/pack` last had in it. That is
deliberate - a rebuild landing mid-run used to fire `dev_reload` and swap every config out from
under the scenario, and its file watcher was what made a sim's `process.exit` die in V8's teardown
and report 3 whatever the run had just printed. Both are gone: **the exit code is the verdict**.

Scenarios: `baseline`, `style`, `eat`, `eatmove`, `drink`, `drinkmove`, `stack2`, `stack3`,
`stack4`, `trident`, `tridentsound`, `hitdelay`, `barrows:<npc>`, `pets:<item>`, `clues`, `ranges`,
`vengeance[:<case>]`, `lunar`, `lunarspells[:<case>]`, `comborunes`, and `tools/sim/soak.ts` for a
400-tick soak with the full npc population.

`comborunes` holds the server to what the spellbook buttons count: a combination rune is one of each
of its two elements. Falador, Lumbridge and High Alchemy are clicked; Wind Strike and Smoke Rush call
the requirement and payment procs directly. The checks cover what each cast spends (plain runes
first, and a combination rune spent for one element paying the other too), the rune pouch, a staff
paying one half, the message when you are short, and alching a combination rune the cast would pay
with.

`vengeance` is the Lunar spell's rules against the real queues, as numbered checks that print `ok` or
`FAIL` and a total: hits of chosen sizes (0, 1, 4, 80, 81), a real whip fight, two hits due on one
tick from either side of the victim in the player loop, a fire bolt and a whip stacking in a real
fight with vengeance re-armed every tick, vengeance and recoil on both players, the 50-tick cooldown
shared with Vengeance Other, a black demon, and the hit that kills (and the double kill). Its cases
are `rules`, `melee`, `sametick`, `recoil`, `cooldown`, `npc` and `kill`. `lunar` sails to Lunar Isle
with Lokar, walks to the Astral altar and prays there at 64 and 65 Magic, and sails home;
`lunarspells` casts the rest of the book (`teleports`, `telegroup`, `skilling`, `support`,
`insight`, `contact`, `farming`).

`pets:<item>` puts a pet down, walks the owner up a staircase, then across the map, and reports the
pet's floor, its npc mode and how far behind it ended up. `clues` reads every obj in the game that
carries a trail_desc and reports any that fail to put text on screen. `ranges` asks, for every loc
that calls itself a range, whether a cooking trigger would actually fire on it.

`hitdelay` prints the ticks between the cast animation and the hitsplat at every range the trident
reaches, which is the number to compare against Old School when deciding whether a projectile is
tuned right:

```
   1 tile  apart  ->  2 ticks        5 tiles apart  ->  4 ticks
   2 tiles apart  ->  3 ticks        6 tiles apart  ->  4 ticks
   3 tiles apart  ->  3 ticks        7 tiles apart  ->  4 ticks
   4 tiles apart  ->  3 ticks
```

`npx tsx tools/sim/wearop.ts` holds the Worn Equipment tab's per-item options (obj `wearop1-8`, the
WEAROP packet) to the real `WearOpHandler`: every item with a worn option has a
`[label,wearop<n>_...]` handler, a worn glory's Edgeville teleports and leaves the next charge down
worn, a ring or necklace uses its charge on the finger or neck, bad ops are refused, and the backpack
Rub menus that now share the teleports still work.

`npx tsx tools/sim/packs.ts` covers item packs (content `scripts/item_packs`). Half of it is the
shops: for each of the nine that stock the water-filled vial pack it reads the stock row back out of
the **built** cache and out of the live `Inventory.fromType` container, because a shop that reads
right in `all.inv` and packs wrong is a real failure mode here - a gap in the stock numbering packs
as obj 65535 and shows as a blank square in the shop window. It also prices the pack through the
engine's own `calc_shop_value`: no price is written for the item anywhere, so what it checks is that
each shop's existing multiplier applied to cost 201 lands on the price that shop's OSRS wiki page
prints. Eight of the nine do. Jossik's does not and is meant not to - his store has always sold at
1300 where Old School's sells at 1100, and repricing his 24 lines of 2006 stock to chase one 2014
item is the thing the era rule forbids. The other half is opening: the pack
gives 100 noted vials of water and takes one slot doing it, a completely full 28/28 inventory still
opens one (the pack's own slot is what the contents go into, so there is no "not enough space" case
to hit), a stack of packs opens itself one every 2 ticks without pinning the player, and walking away
stops the run.

The five elemental rune packs (air, water, earth, fire, mind) are covered the same way across the
eight shops that sell them, with three differences worth knowing. Their contents come out **unnoted**
- a rune already stacks, so it has no noted form at all, which the sim asserts rather than assumes.
Tutab's on Ape Atoll gets four packs and no mind one, because that is what Old School stocks there.
And there is a check that the **chaos rune pack does not exist**: Old School sells one beside these
five everywhere, and it was left out on purpose because 100 chaos runes for one click is a lever on
a 2006 rune economy that five cheap elementals are not. That check exists so the decision cannot be
reversed by accident - if the obj reappears, it fails and points at `item_packs.obj`.

Read its verdict off the printed `N ok, M FAIL` line and not off the exit code: this one makes many
players, and any sim here that makes three or more dies in V8's teardown after `process.exit` and
reports 3 whatever it found. That is the harness, not the scenario - a sim that makes three plain
players and touches nothing else does it too, while the same sim with two does not.

`npx tsx tools/sim/craftgaps.ts [smith|herb]` covers the anvil window and the Herblore bench.

The smithing half exists because three playtest reports about the anvil window - a row with no
icon, a row that could not be clicked, and a duplicate "Studs" - all describe what the server tells
the client to *draw*, and reading `smithing.rs2` cannot tell those three apart. So it records
IF_SETHIDE, reads each column off the player's own inventory listener (a sim player is a plain
`Player`, so the UpdateInvFull packets are never written), and clicks the odd-one-out row through
the engine's real `InvButtonHandler` - the one that refuses a click on a component the player was
never shown. All six metals are checked, not just the three that were reported. It then follows the
iron spit past the anvil: skewer a raw rabbit, be refused by a range, roast it on a fire, eat it,
and be refused at Cooking 15.

The Herblore half reads the recipes out of the **built** cache rather than naming them, so a row
added or renamed later is swept the day it lands: every struct carrying `brew_potion_mixture` is
tried in both click orders, because the engine takes the trigger off the target obj first and a
recipe can be live one way round and dead the other - which is exactly how the agility and energy
potions were broken. It then drinks everything the table makes, takes the agility potion from a
grimy toadflax to a +3 boost, walks the coconut-milk chain from a whole coconut to anti-venom+,
checks each antipoison actually clears `%poison`, and applies weapon poison to a weapon of each
shape the applier handles.

Poison itself is checked in two halves, because only one of them can be asserted: the severity the
obj carries, fed to the proc the melee script feeds it to, must poison a fire giant and then
damage it. The 1/4 roll is also driven as a real fight, but only reported - on a world with
several players in it the synthetic fight gets few real swings in, and asserting on the roll made
the sim flaky rather than strict.

Two things it prints rather than asserts, because they are absent features and not faults:
weapon poison(+) and (++) and antidote+ all have objs in the 377 cache and no recipe behind them.

`npx tsx tools/sim/bughunt.ts` is the script fault reporter
(`src/engine/script/ScriptFaults.ts`) against the real engine. It poisons a skeleton to death - the
one way a monster dies with an aggressive player and no hero, which is what the live
`.npc_findhero` fault needed - and asserts the death runs clean and the corpse is deleted, then
checks the reporter's own rules: off unless asked for, one signature per distinct fault however
often it fires, a full backtrace, a JSONL file, and a clear that empties both. Revert content
`d2f9bc2a4` and it prints the live backtrace instead, once.

`npx tsx tools/sim/fuzz.ts [ticks] [bots] [seed] [x,z,level]` puts fuzzing bots
(`src/engine/bot/BotFuzzer.ts`) into the real world and lets them click everything in reach, then
prints what the watchers and the fault reporter caught and what the bots actually did. It checks the
safety guard first every time - the fuzzer refuses on a production world and refuses around a player
who is not staff - because that is the part that must never rot. A run that finds nothing prints the
action histogram anyway: if it is all `idle` and `walk`, the finding is about the fuzzer.

What a fuzzer IS, as of 2 November 2026, is worth stating because the first version of it found
nothing at all in weeks of running, and the reason was not the watchers. Eight bots over 6,000
ticks reached 290 of the build's 15,410 triggers - 1.9% - and the curve was flat. They were not
short of clicks; they were short of being anybody. Four things were fixed together:

* **Personas** (`src/engine/bot/BotPersona.ts`). A fuzzer used to spawn with a combat kit, 24 tools
  and every one of the 106 quest varps at zero, so it could only ever see the first line of every
  quest and could not walk through any door a quest opens. It now rolls stats, quest stages (from
  the content's own `questvarps.json`) and a sample of the whole obj table, seeded off its fuzz seed
  so a finding still replays. One in four is left fresh, because a new account is a real state too.
* **Relocation.** It is picked up and put down in another part of the map every
  `NODE_BOTS_FUZZ_ROAM` ticks (400; 0 turns it off), because walking never got it out of Lumbridge.
  Destinations are rolled and then checked for density - with no density check at all, relocating
  made coverage *worse* than not relocating, because most of the map is field.
* **The missing packets** (`BotInput.ts`). No bot could send "use item on loc", "use item on npc",
  "use item on ground obj", a targeted spell, or an inventory drag, which is around 870 triggers
  unreachable by construction - `[oplocu]` alone is 505.
* **Oracles that can see unimplemented content**, which none of the old ones could: see DeadOps
  above, and the item audit below.

Together those take the same 6,000-tick, 8-bot run from 290 triggers and zero findings to roughly
400 triggers and several hundred findings.

Three more gaps closed after the first round, each one measured rather than assumed:

* **Every shop and bank was unreachable.** `tickInner` returns early whenever a modal is open, so
  `act()` never ran while one was - and `invOp()`, the op on an item in a grid the server has sent,
  which is Buy, Sell, Deposit and Withdraw, lives in `act()`. Every shop and bank in the game is a
  modal. The 240 npcs in this build with a "Trade" option opened a shop on one tick and had it shut
  on the next without a single item being clicked. The bot now *dwells* in a window for up to
  `MODAL_DWELL` ticks working its buttons and its grids: invops went from 254 a run to over 1,300.
* **A maxed account cannot be attacked.** `Npc.huntPlayers` skips a player whose combat level is
  more than twice the npc's `vislevel` outside the Wilderness, so nothing in the game would come
  near a rolled or maxed persona. `[ai_queue1..20]` (769 triggers for queue 3 alone),
  `[ai_opplayer2]` (175) and `[ai_applayer2]` (132) all fire from an npc *deciding to engage*. The
  `weak` persona has the quests and the items and combat stats of 1, on purpose.
* **The fuzzer had never once stood still.** Those same `ai_*` families need the player to still be
  there a few ticks later, and a bot that clicks something and walks twenty tiles away is never
  available. `loiter()` is now a scheduled stretch, and the budget is the one number here that came
  out the opposite way from the guess - see the note on `LOITER_EVERY`. Standing still is worth more
  coverage than walking.

Bot-to-bot trading and item-giving are **not** reachable and that is deliberate, not a gap to be
closed: `OpPlayerHandler` allows only op 2 (Attack) and op 3 (Follow) when the target is a bot, and
`OpPlayerUHandler` refuses outright so players cannot lose items into one. `[opplayeru]` and
`[applayeru]`, ten triggers between them, therefore want a sim with two real players - which is
`npx tsx tools/sim/jarshare.ts`, for the four butterfly jars. It covers all three branches of
`~hunter_jar_share`, because two of them are guards that would rot silently: the multi-combat flag
on *both* coords, and the target's own accept-aid option. It also asserts the thing easiest to get
wrong - the jar is consumed and an empty one takes its place, since a share that kept the jar would
be an unlimited Strength boost. 13 checks.

It uses `harness.useOnPlayer`, which mirrors `OpPlayerUHandler` rather than calling it: that
handler's `rsbuf.hasPlayer` check is filled only for a connected client, so the real one refuses
every such click before the content runs. Every other check is kept, the bot refusal included.

A caution about the numbers. Trigger coverage on a single seed moves about 15% run to run, so the
exact weights in `FuzzBrain.act` are tuned no further than that noise allows; two seeds at the
settings in this commit give 535 and 473 against a 290 baseline. What is *not* noise is the
structural reachability - whether a packet can be sent at all, whether a shop can be opened,
whether a monster will engage - and that is what each of the changes above is about.

The **item audit window** is the other fix worth reading about, in the header of
`watchItemAudit` in `BotFuzzWatch.ts`. The conservation watcher - the one the file itself calls "the
one that matters, because a dupe is the bug that costs a server" - asserted over a window in which
the bot did nothing but move items, and waited for such a window to happen by chance. It needs about
seventeen consecutive untainted ticks, and a tick is about one in sixteen, so it had never once run
its assertion. The window is now taken rather than waited for: every so often the bot stops clicking
the world, opens a bank if one is in reach, and does nothing but deposit, withdraw, equip, drop, take
and drag for thirty ticks. The totals at the end must equal the totals at the start.

The same run prints trigger coverage: how many of the build's triggers have ever run in that
process and how many never have. Pass `noguide` as the fifth argument to turn the coverage steering
off, so the same seed can be run both ways and the difference measured rather than asserted. On a
dev world the same numbers come from `NODE_SCRIPT_COVERAGE=true` and `::coverage` / `::coverage
write`, which is worth doing on its own: the never-reached list is a to-do list, and clearing it
before testing one thing says exactly which triggers that one thing touched.

`npx tsx tools/sim/opsweep.ts` is the whole-game version of the question the fuzzer answers one
click at a time: **every option the cache offers that no script answers**. It needs no bots and no
walking - the cache says a loc has a "Search", the script table says nothing claims `[oploc2]` for
it, and both facts are on disk. About forty seconds for the whole game.

Measured on the build of 2 November 2026 it reports 2,741 dead options, 1,008 of them on a loc or
npc the map actually places, sorted by how many of each the map has - which turns a list into a work
queue. `--baseline` writes `tools/sim/opsweep-baseline.txt` and `--check` fails on anything new, so
a build that adds a dead option is caught instead of waiting for a playtest report. `--area x1 z1 x2
z2` narrows it to a rectangle you are working in.

It replaces doing this by hand. `a1lib.deadLocOps`/`deadNpcOps` is the same idea for a rectangle you
name and `audit3sweep.ts` for a debugname prefix you name; both are for an audit somebody has
already decided to do. Three traps it had to learn are written up in its header: `ap` triggers count
as well as `op`, multiloc/multinpc shells answer for their children, and a global `_` fallback is
not a handler - this build has one for `[opheld2]`, which is how eighty-six dead options hid from
the first opheld audit (see `opheld2.ts`).

`npx tsx tools/sim/orphans.ts` is the exact inverse: **every trigger no click can fire**. opsweep
asks "the cache offers this option - does a script answer it?" and finds content nobody wrote; this
asks "a script answers this option - does the cache offer it?" and finds content somebody *did*
write that nothing can reach. 84 on this build, and `--baseline` / `--check` ratchet it the same way.

It matters because "never run" in a coverage report lumps together three different things: content
that works and nobody walked to, content that needs a quest state the run did not have, and content
that *cannot* run because the loc it is written against has no such option. Only the third is
decidable without running anything, and only the third is a bug rather than a to-do.

It cannot tell a lost feature from deliberate dead code, and says so, grouped by file so a cluster
is one decision: `[opheld1,ahoy_book_of_haricanto]` reads a quest book that declares no `iop1`, so
the book cannot be read - a bug. The 24 `[opheld2,barrows_*_broken]` are a refusal handler for
re-equipping broken Barrows, which is already impossible because the obj offers no Wear - correct
behaviour, redundant script.

**Two things got this wrong before it got it right, and both are now in one place**
(`src/cache/config/OpVisibility.ts`), because the same mistake was made twice in different files:

* `hidden` is **declared**, not missing. A tree's op3 is the literal string `"hidden"`, and
  `p_oploc(n)` re-enters any non-null slot from script - `farming_triggers.rs2` says "only
  `p_oploc(3)` fires it" in as many words, and this build calls `p_oploc` 65 times. Reporting those
  as unreachable condemned core woodcutting and mining. So: opsweep asks "would a **client** draw
  this?" (`hidden` = no, needs no script) and orphans asks "does the cache **declare** the slot?"
  (`hidden` = yes, a script is fine).
* a multiloc resolves **downward only**. `OpLocHandler` takes the placed type, resolves
  `multiloc[varbit]`, and checks *that* type's ops. Checking the shell alone called 60 working sim
  steps broken; walking up to shells and sideways to siblings cleared Desert Treasure's obelisks,
  which a real `OpLoc` packet is refused for. `locCanOp` now mirrors the handler line for line.

### What the four strict primitives cost the rest of the suite: one sim

`opLoc`, `opObj`, `opNpc` and `opheld` all refuse an option the cache does not declare now, and
twice that broke a test which was right: `blowpipe` (an empty toxic blowpipe is deliberately not
wieldable) and `mutagens` (iop4 on a plain serpentine helm is deliberately impossible - see
`opheldUnclickable`). Rather than wait for a third, every sim that calls one of the four was run.

**125 sims, and `mutagens` was the only one.** Nothing else throws on an impossible op. Twelve exit
non-zero for their own reasons and all twelve are already on `known-failing.txt` - the six `audit*`
batches, `blastfurnace`, `brutalarrows`, `gwdstaves`, `myrequevillage`, `securityfixes`,
`templetrek` - so 113 pass clean.

That is the evidence the checks are worth keeping: they cost one deliberate exception across the
whole suite, and they caught a quest that had been reporting 114 of 114 while being unplayable.

### Checking whether a sim is already known-failing

`known-failing.txt` carries a comment per entry - `audit6               # Error: unexpected menu:
multi3` - so matching a whole line against a name finds nothing. The job itself extracts the names
first (`grep -oE '^[a-z0-9_]+'`), and anything asking "is this one already listed?" has to do the
same. Getting that wrong here cost a pointless attribution hunt: `audit6` reads as absent to a
whole-line match, so five of its failures looked like a regression to be chased, and it had been on
the list all along.

### One of the recovered options was wrong, and the sim caught it

`toxic_blowpipe_empty` was given an `iop2=Wield`, copied from its loaded twin, which shares the
`[opheld2]` line and declares exactly that. `tools/sim/blowpipe.ts` then went **121 ok, 1 FAIL**:
it asserts *"the empty one has no Wield"*, and its header lists that among the things it covers on
purpose. An empty toxic blowpipe is deliberately not wieldable, so that handler is dead code the
author kept, and `[opheld2,toxic_blowpipe_empty]` belongs in the orphans baseline rather than being
"fixed".

The rule was too weak. A twin's label is good evidence; **an existing test asserting the option is
absent beats it**, and the order to check them in is the test first - `grep tools/sim` for the name
before touching its config. Done for every other name this branch changed: `implings`, `animmag`,
`maxcapes`, `zogreyanille`, `quest_zogre_run`, `quest_ahoy_run`, `templelight`, `myrequerod`,
`quest_myreque2_run`, `quest_eadgar_run` and `audit2` all pass.

### The quest runners were clicking options that do not exist

`harness.opLoc` reached `setInteraction` directly instead of going through `OpLocHandler`, so it
skipped the one check that matters here - *is this an op the loc actually has*. A sim could therefore
click an option no client would draw and no packet would be accepted, the content behind it ran, and
the sim passed. That is the exact failure `questrun.ts` was built to catch ("a player who blinks into
Zanaris never finds out that the gate has no handler"), reintroduced by its own click primitive, and
about 130 quest runners rest on it.

It now refuses, with the reason: `sword_mirror1 has no op1 on itself or any multiloc variant (null),
so no client could send this click`. `questrun` prints that instead of its old guess ("no <loc>
there"), which was wrong for every cause but one.

**This makes some quest runners fail, and that is the point.** `quest_dt_run.ts` reported 114 of 114
checks passing on a quest whose diamond-placement step no client can perform: `desert_treasure_oblix1`
and its three siblings declare no ops on the shell or on either multiloc variant, and a real `OpLoc`
packet at op1 on one is **refused by the server's own handler** - checked by sending one, not
inferred. `vampire_big_grave_noblood` in the same quest is a fifth: `[oploc1,...]` in `dt_blood.rs2`
against a loc with no op1 and no variants.

`quest_itexam_run.ts` was a *sim* bug of the other kind and is fixed here: it clicked a generic
`cupboardopen` at the default op1, where that loc declares op2="Search" and op3="Shut" and
`cupboards.rs2` hooks `[oploc2]`/`[oploc3]` to match. The quest's own `samplecupboardopen` does
declare op1, which is why only one of the two steps was wrong.

A caution about how to look for more of these. A static scan for `{ loc: '...' }` in the sim sources
is **not** a reliable way: `quest_garden_run.ts` has a `Bed` type with a `loc` field and nine data
rows of it, and those rows are consumed as `useLoc` steps (item-on-loc, `[oplocu,...]`) rather than
clicks - so a scan reports nine flower patches that are perfectly fine. Steps built from a variable
are missed for the opposite reason. The runtime check is the only complete answer, which is why it
lives in the harness and not in a linter.

`npx tsx tools/sim/fuzz.ts` also prints **OPTIONS NOTHING ANSWERED** now, from
`src/engine/script/DeadOps.ts`. `Player.defaultOp` has always printed `No trigger for
[oploc1,some_gate]` on a dev world and then "Nothing interesting happens." - and a fuzzing bot kept
those in a 16-entry message ring and dropped them off the end. Nothing read the mailbox. Every sim
in this directory, every fuzz run and a human playing on the dev world now all feed one deduped
file; on a world, `NODE_DEAD_OPS=true` plus `::deadops` reads it. It is the other half of
`::coverage`, and the more actionable half: coverage says which triggers nothing reached, which
includes plenty of content that is written and merely unplayed, while this says which *clicks*
reached nothing.

`npx tsx tools/sim/droplands.ts` puts back the one assertion that retiring the opportunistic
conservation watcher took away: **a drop lands exactly once**. That watcher counted the bot's own
ground drops, so it checked this as a side effect - and it could not be trusted to, because an obj
is only counted within nine zones of the bot, it stops being the bot's when the lootdrop timer makes
it public, and a drop onto a tile that already holds the same obj merges while a partial stack does
not. Every finding it produced was one of those three. The assertion belongs in a sim, where one
known item on one known tile can be counted: one Drop is one obj of one, 500 coins is one obj of
500 and not 500 objs, two drops of the same thing total two however the engine stores them, 200 then
300 is 500, and a drop belongs to the dropper and not to the next player who walks up. 13 checks.

`tools/sim/beforeafter.sh <scenario>...` runs a scenario against the content at `HEAD~1` and then at
`HEAD`, rebuilding in between, so a fix can be shown rather than asserted.

`tools/sim/sweep.sh` runs every sim in this directory, one per process, and classifies each as PASS,
FAIL, ABORT (died before printing a tally), TIMEOUT or NOSUM (a clean exit from one of the sims that
prints a report instead of checks). It writes `results.tsv` and a log per sim under `$OUT`
(`/tmp/simsweep` by default) and resumes from `results.tsv` if it is interrupted, so a long sweep can
be stopped for an urgent run and picked up again.

Two things it knows that are easy to get wrong. **It runs them sequentially**, because the world is
stateful and the sims share `data/` on disk - an earlier version of this ran three at a time and
reported five sims as aborting that passed perfectly well alone. And **a pass is one sample**:
several sims here depend on where a wandering npc happens to be standing, or on a click that has to
be walked to, and they pass alone and fail in a sweep twenty minutes later. Run anything that matters
twice before calling it fixed.

## Failures you will see more than once

Seven shapes account for nearly every sweep failure that is not a real game bug. All seven have
been mistaken for content faults at least once, so the signature matters as much as the fix.

- **A fixed offset from a wandering npc.** The sim reads the npc's tile, stands at `+1` or `+3` from
  it, and clicks - and the npc has moved. `wanderrange` defaults to **5** and most npcs do not
  override it, so this is a coin toss, not an edge case; it is worse inside a sealed cage or behind a
  fence, where a refused op prints *nothing at all* and every check below it fails with it. The fix
  is to re-read the tile per attempt and try several offsets, stopping on a signal that the content
  really started - `audit0`'s `walkUpAndTalk` (Solus) and the Glough blocks in `mmpanel` and
  `batch1012` are the pattern. Six sims in two days.
- **The mark taken after the click.** `H.ifaces.length` or `H.mesgs.length` captured *after* the op
  that drives the dialogue, so whatever that call drove before returning is already behind the slice.
  It passes until the tick where it does not. Mark first, click second, read the slice after -
  `fremtrials2` and the note at the top of `batch1012`.
- **A refusal read out of the wrong log.** `mes` writes a chat line and `~mesbox`, `~objbox` and
  `~doubleobjbox` write an *interface*, so a check that reads `A.mesSince` for "You need at least 28
  Fishing to bait these fish." sees nothing and reports a content fault. Which one a refusal uses is
  the content's choice and there is no pattern to it: the same script can `mes` a level gate and
  `~mesbox` the next one. Read `H.ifaces` for the boxes (`newsources` and `eelspots` both carry a
  local `shown()` for it) and the chat log for `mes`, and when a refusal check fails, print BOTH
  before believing it. Five failures in one sim, all of them the sim's own fault.
- **A random event in the middle of a long run.** The frog event teleports the player to the Land of
  the Frogs and the next loc click throws "no such loc"; it reads as a missing loc and is not one.
  `~macro_event_allowed` refuses to spawn one while `%macro_event` is already set, so
  `H.setVar(p, 'macro_event', 1)` stops the spawn - `eaglespeak` and the three `quest_*_run` sims.
  **That varp was never the whole switch, and you no longer need it for the other half.** Content
  reads `afk_event` at the top of the actions a macroer repeats - cooking, thieving a stall or a
  pocket, spinning, crafting jewellery - and every one of those sites spawns the event AND RETURNS,
  so the action is dropped whether or not the spawn was allowed. `H.tick` now clears
  `afkEventReady` every tick for every player, which is the half the varp could not reach. Family
  Crest spent a session looking like a content bug over it: the press that should have cast a
  perfect ruby ring made nothing, the necklace a few steps later worked because the first press had
  eaten the flag, and the quest sat at stage 7 with Avan refusing the fragment. Miscellania lost
  "Magnus's own rock is his" to the same thing while already setting the varp.
- **A handler written against a multinpc variant.** `OpNpcHandler` resolves multivarp/multinpc only
  to decide whether the option exists; `Player.getOpTrigger` then looks the trigger up on the npc's
  OWN type. So `[opnpc1,<variant>]` never fires and the click does nothing. Handlers go on the shell
  (`quest_swansong.rs2` says "Handler on the shell" for exactly this). `tools/silentnpcops.py` in the
  content repo lists every npc the maps place with an option nothing answers.
- **A stat id that is quietly `undefined`.** `PlayerStatMap` is keyed in CAPITALS, so
  `get('crafting')` is `undefined`, a non-null assertion makes tsc accept it, and
  `baseLevels[undefined] = 1` on a typed array is a silent no-op: the check then measures nothing and
  passes for the wrong reason. Use the `PlayerStat` enum, where a name that does not exist is a
  compile error (`lunar`).
- **A budgeted loop that only reports "false".** `catchIt`, `drive`, any `for (let t = 0; t < max; ...)`
  that gives up: on its own the failure says a thing did not happen and nothing about why. Print the
  state it gave up in - whether the npc is still there, where both parties are, whether the player is
  delayed or still targeting. `implings`' `catchIt` does this now, and the eagle's swipe in
  `eaglespeak` carries the hitpoints into its failure detail for the same reason.

## Two things that will bite you

- **Warm up past tick 8.** Half the combat guards in the content read
  `if (add(%lastcombat, 8) > map_clock)`. On a world that has only just started `map_clock` is 0-4,
  so an untouched player reads as "in combat two seconds ago" and monsters refuse to engage.
  `boot()` runs 30 ticks for this reason. The PvP half of that rule is the 20-tick PJ timer on
  `%lastcombat_pvp`, which only counts once it has actually been set (`pjtimer.ts`).
- **A sim player has no socket.** To the engine it lost its connection the tick it was made, and
  `World.processLogouts` idle-logs it out 50 ticks later. `tick()` marks every player heard from
  each tick so a longer scenario keeps its players; without that, a click after tick 50 lands on a
  player with no slot and silently does nothing.
- **A click from here lands between ticks.** A real click is read at the start of a cycle; `ifButton`
  and friends run before the next one, so a script's `p_delay(n)` ends one tick later than in game.
  Allow for it before the next click, or the next click is thrown away as "delayed".
- **One fight per process.** `%lastcombat` and `%aggressive_npc` survive a fight, and the content's
  own singles rule then refuses the next one. That is correct behaviour, but it is not what you are
  usually measuring.
