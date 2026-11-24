#!/usr/bin/env bash
# BREAK SOMETHING ON PURPOSE AND CHECK THE RIGHT SIM NOTICES.
#
#   tools/sim/simmutate.sh              run every mutation
#   tools/sim/simmutate.sh junglechop   only the ones whose sim name matches
#
# NOT IN CI, and not to be added to it: this edits files in the content checkout and rebuilds the
# cache. It reverts each file with `git checkout --` and traps EXIT so an interrupted run still
# puts the tree back, but a job that mutates a shared checkout is a job that can leave one broken.
# Hand-run, before trusting a sim you are about to rely on.
#
# WHY IT EXISTS. A sim that asserts nothing and a sim that passes print the same thing and exit the
# same way. The content repo already knows this - mutate_labels audits 1,502 mutation labels against
# the checks that are supposed to catch them - and the engine's sims had no equivalent, so "271 ok,
# 0 FAIL" was a claim with nothing behind it.
#
# A STATIC AUDIT WAS TRIED FIRST AND ANSWERS NOTHING, which is worth recording so nobody writes it
# again. Counting sims whose verdict counter is never incremented reports 227 of 358, then 99 of 358
# after one correction, and every single one is a false positive: the failure paths live in shared
# helpers, so `R.bad++` happens inside a1lib.ts's check(), and `bad` in a quest runner is populated
# by play() in questrun.js. Resolved through those three reporters, essentially every sim the nightly
# runs has a reachable failure path. There is no population of tests that cannot fail, so the only
# question left is whether the assertions are MEANINGFUL - and the only way to answer that is to
# break the thing they are about.
#
# ALL FOUR MUTATIONS ARE CAUGHT as of the last run: junglechop notices a jungle tree losing the
# category that dispatches its Chop-down, woodcutents notices an Ent allowed to walk off its tile
# and names it, and brewing notices either brewer falling back to the stale per-cent shop
# multiplier - 25gp yeast for 2gp, two ectotokens instead of five.
#
# EVERY BUILD HERE IS A FORCED BUILD, and that is not a detail. The packer decides what to repack
# by comparing mtimes, and an mtime comparison can answer "nothing is stale" when something is:
# delete a .rs2 and nothing the packer looks at got newer, so the build reports success in two
# seconds, does nothing, and leaves the previous script.dat in place. The sim then runs against
# content that was never mutated and reports the guard as passing. Measured on 377-wip: deleting
# interface_bank/scripts/bank_booth.rs2 outright and rebuilding normally left opsweep --check green
# with zero new dead options; the same deletion with --force turned up all six of that file's
# triggers. A mutation harness is the one caller that cannot live with a wrong no, because the whole
# exercise is to trust the red. See DeathPlateau-Bugs#81 for the other two shapes this takes.
#
# ONE MUTATION PER LINE: sim, the content file, the config block it belongs to, and the text to
# comment out. The line is RESOLVED from the block rather than written down, because a line number
# is a fact about the file on the day it was typed: both brewing rows went stale when all.npc
# shifted 39 lines under them, and a run that cannot place its mutation proves nothing. Resolving
# it also makes the lesson below structural instead of something a human has to get right - the
# text has to sit inside the named block, and a text that appears there no times, or more than
# once, is reported rather than guessed at.
#
# THE FOURTH MUTATION, AND THE LESSON IN IT. The first attempt at the Ent one disabled
# moverestrict=nomove on line 1432 of antimacro.npc and woodcutents.ts stayed green - which looked
# like a hole in the sim and was not. Line 1432 belongs to macro_whirlpool_freshfish, a FISHING
# macro event npc that a woodcutting sim has no business asserting about. The mutation missed its
# target, the sim was right, and that is exactly the failure mode mutate_labels exists to prevent:
# a mutation nobody checked is pointed at the check it is written for. That is why every row names
# the block it is about - and now why the line is looked up inside that block, so a row CANNOT
# point at another npc's config even if the file moves.

set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
ENGINE=$PWD
CONTENT=${BUILD_SRC_DIR:-../content}
cd "$CONTENT" || { echo "no content checkout at $CONTENT"; exit 1; }
CONTENT=$PWD
cd "$ENGINE" || exit 1

FILTER=${1:-}
TOUCHED=()

revert_all() {
    for f in "${TOUCHED[@]:-}"; do
        [ -n "$f" ] && (cd "$CONTENT" && git checkout -- "$f" 2>/dev/null)
    done
}
trap revert_all EXIT INT TERM

# REBUILD WITH --force, AND SAY HOW LONG IT TOOK. Both halves of that matter, and both were wrong
# here before (DeathPlateau-Bugs#81):
#
#   1. This used to force a repack by DELETING pack files in the content checkout and touching
#      interface.pack - writing to a repo it does not own, to make an mtime comparison come out the
#      way it needed. It worked by side effect: removing script.pack made regenScriptPack write a
#      fresh one, whose new mtime finally made script.dat look stale. Nothing said so, nothing
#      covered models, maps, graphics or midi, and a mutation outside the config packs got a build
#      that skipped it. --force asks the packer directly and the content checkout is left alone.
#
#   2. It used to send the build to /dev/null, which threw away the one tell that a build did
#      nothing: its own timing. A no-op build here is ~2.5s and a real one ~21s, so the difference
#      between a trustworthy mutation run and a meaningless one was being discarded to keep the
#      output tidy. The pack line is printed for every build now, so a 2-second build in the middle
#      of a mutation run is visible instead of silent.
#
# The build is still allowed to FAIL: a mutation that makes the content uncompilable is a caught
# mutation, not a harness error, so the caller decides what to make of a non-zero exit.
rebuild() {
    local out
    out=$(npx tsx tools/pack/Build.ts --force 2>&1)
    local rc=$?
    echo "   $(echo "$out" | grep '^pack:' || echo 'pack: DID NOT RUN')"
    if [ "$rc" -ne 0 ]; then
        echo "   build exited $rc:"
        echo "$out" | tail -15 | sed 's/^/     /'
    fi
    return 0
}

# sim | file | the [block] it must be about | exact text inside that block | what the mutation is
MUTATIONS=(
"junglechop|scripts/quests/quest_mm/configs/mm.loc|mm_bush_kharazi_jungle_tree1|category=tree|Ape Atoll's jungle tree loses the category that dispatches its Chop-down"
"woodcutents|scripts/macro events/configs/antimacro.npc|macro_ent_tree1|moverestrict=nomove|an Ent is allowed to walk off its tree's tile"
"brewing|scripts/_unpack/377/all.npc|blandebir|param=shop_sell_multiplier,1000|Blandebir falls back to the stale per-cent default, selling 25gp yeast for 2gp"
"brewing|scripts/_unpack/377/all.npc|metarialus|param=shop_sell_multiplier,200|Metarialus falls back to two ectotokens where his comment says five"
)

# WHERE DOES THIS TEXT LIVE? Prints the line number of every line inside the [$target] block of
# $file whose trimmed text is exactly $text. Zero lines means the row is stale; more than one means
# the row is ambiguous and the caller must not pick. Both are reported rather than mutated.
#
# THE CARRIAGE RETURNS ARE NOT OPTIONAL. Parts of the content repo are CRLF - quest_mm/configs
# mm.loc is, all 1,875 lines of it - so a record read straight out of awk ends in \r and matches
# nothing. The first version of this resolver compared the raw record, found no [block] header at
# all in that file, and reported the junglechop row as stale when it was perfectly good. The old
# line-number code got away with it because it ran the one line it already knew through
# `tr -d '\r'`; a resolver that has to FIND the line has to normalise every record it reads.
resolve_line() {
    local file=$1 target=$2 text=$3
    (cd "$CONTENT" && awk -v t="[$target]" -v want="$text" '
        { rec = $0; gsub(/\r/, "", rec) }
        rec == t { inblk = 1; next }
        inblk && rec ~ /^\[/ { exit }
        inblk {
            line = rec
            sub(/^[ \t]+/, "", line)
            sub(/[ \t]+$/, "", line)
            if (line == want) { print NR }
        }
    ' "$file")
}

caught=0
missed=0
broken=0

for row in "${MUTATIONS[@]}"; do
    IFS='|' read -r sim file target text what <<<"$row"
    [ -n "$FILTER" ] && [[ "$sim" != *"$FILTER"* ]] && continue

    echo ""
    echo "== $sim : $what"
    echo "   target: $target"

    hits=$(resolve_line "$file" "$target" "$text")
    found=$(printf '%s' "$hits" | grep -c . || true)
    if [ "${found:-0}" -ne 1 ]; then
        if [ "${found:-0}" -eq 0 ]; then
            echo "   BROKEN MUTATION - no line reading '$text' inside [$target] in $file"
            echo "   the config has changed; fix the row rather than trusting this run"
        else
            echo "   BROKEN MUTATION - '$text' appears $found times inside [$target] in $file"
            echo "   the row is ambiguous, and guessing which one is how a mutation misses its target"
        fi
        broken=$((broken + 1))
        continue
    fi
    line=$hits

    # Is the sim green before the mutation? A sim that is already red proves nothing either way.
    if ! timeout 600 npx tsx "tools/sim/$sim.ts" >/dev/null 2>&1; then
        echo "   SKIPPED - $sim is already failing before the mutation, so it cannot demonstrate anything"
        broken=$((broken + 1))
        continue
    fi

    TOUCHED+=("$file")
    (cd "$CONTENT" && sed -i "${line}s|^\([[:space:]]*\)$text|\1//MUTATION $text|" "$file")
    rebuild

    if timeout 600 npx tsx "tools/sim/$sim.ts" >/dev/null 2>&1; then
        echo "   MISSED - $sim still passes with this broken. Its assertions do not cover it."
        missed=$((missed + 1))
    else
        echo "   caught - $sim goes red"
        caught=$((caught + 1))
    fi

    # REVERT **AND REBUILD**, in that order, before the next mutation is considered. Reverting the
    # file alone leaves the previous mutation sitting in the cache, and the next mutation's
    # green-before check then runs against it: the first version of this reported woodcutents as
    # "already failing before the mutation" when it passes perfectly well - it was reading a cache
    # that still had the jungle tree's category commented out. The same incremental-build trap that
    # made equipcycle.ts look calibrated when it was reading stale scripts.
    (cd "$CONTENT" && git checkout -- "$file")
    rebuild

    # AND CHECK THE REVERT TOOK. A mutation run makes two claims - green before, red after - and
    # both are worthless if the cache is not actually tracking the file. Re-running the sim on the
    # restored content is what distinguishes "this sim catches the mutation" from "this sim is red
    # for some other reason and happened to be red at the right moment". It is one more sim run per
    # mutation and it is the difference between a demonstration and a coincidence.
    if ! timeout 600 npx tsx "tools/sim/$sim.ts" >/dev/null 2>&1; then
        echo "   !! $sim is STILL RED after the revert and rebuild - do not trust the line above."
        echo "      either the revert did not take, or the cache is not tracking $file."
        broken=$((broken + 1))
    fi
done

echo ""
rebuild
echo "$caught caught, $missed MISSED, $broken unusable of ${#MUTATIONS[@]} mutations"
echo "(the cache has been rebuilt from the reverted content, so the next sim run is clean)"
[ "$missed" -gt 0 ] && exit 1
exit 0
