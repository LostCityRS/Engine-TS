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
# ONE MUTATION PER LINE: sim, the content file, the line number, and the text to comment out. The
# line number is checked against the text before anything is edited, so a file that has shifted
# fails loudly instead of mutating the wrong line.
#
# THE FOURTH MUTATION, AND THE LESSON IN IT. The first attempt at the Ent one disabled
# moverestrict=nomove on line 1432 of antimacro.npc and woodcutents.ts stayed green - which looked
# like a hole in the sim and was not. Line 1432 belongs to macro_whirlpool_freshfish, a FISHING
# macro event npc that a woodcutting sim has no business asserting about. The mutation missed its
# target, the sim was right, and that is exactly the failure mode mutate_labels exists to prevent:
# a mutation nobody checked is pointed at the check it is written for. Hence the target name in each
# row below, and the `expect` on the end.

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

rebuild() {
    (cd "$CONTENT" && rm -f pack/script.pack pack/param.pack pack/category.pack pack/enum.pack \
        pack/struct.pack pack/mesanim.pack pack/dbtable.pack pack/dbrow.pack pack/hunt.pack \
        pack/varn.pack pack/vars.pack && touch pack/interface.pack)
    npx tsx tools/pack/Build.ts >/dev/null 2>&1
}

# sim | file | line | exact text on that line | what the mutation is | the npc/loc it must be about
MUTATIONS=(
"junglechop|scripts/quests/quest_mm/configs/mm.loc|1050|category=tree|Ape Atoll's jungle tree loses the category that dispatches its Chop-down|mm_bush_kharazi_jungle_tree1"
"woodcutents|scripts/macro events/configs/antimacro.npc|3446|moverestrict=nomove|an Ent is allowed to walk off its tree's tile|macro_ent_tree1"
"brewing|scripts/_unpack/377/all.npc|52530|param=shop_sell_multiplier,1000|Blandebir falls back to the stale per-cent default, selling 25gp yeast for 2gp|blandebir"
"brewing|scripts/_unpack/377/all.npc|52567|param=shop_sell_multiplier,200|Metarialus falls back to two ectotokens where his comment says five|metarialus"
)

caught=0
missed=0
broken=0

for row in "${MUTATIONS[@]}"; do
    IFS='|' read -r sim file line text what target <<<"$row"
    [ -n "$FILTER" ] && [[ "$sim" != *"$FILTER"* ]] && continue

    echo ""
    echo "== $sim : $what"
    echo "   target: $target"

    actual=$(cd "$CONTENT" && sed -n "${line}p" "$file" | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    if [ "$actual" != "$text" ]; then
        echo "   BROKEN MUTATION - $file:$line reads '$actual', expected '$text'"
        echo "   the file has shifted; fix the line number rather than trusting this run"
        broken=$((broken + 1))
        continue
    fi

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
done

echo ""
rebuild
echo "$caught caught, $missed MISSED, $broken unusable of ${#MUTATIONS[@]} mutations"
echo "(the cache has been rebuilt from the reverted content, so the next sim run is clean)"
[ "$missed" -gt 0 ] && exit 1
exit 0
