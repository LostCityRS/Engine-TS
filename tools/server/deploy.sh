#!/bin/bash
# Pull the game's code and put the services back, in the one order that works.
#
# WHY THIS EXISTS, and both halves are from the same evening - 2026-11-24, deploying a ticket-bot
# change three times before it took:
#
#   GIT AS ROOT POISONS THE REPOSITORY. One `git pull` run as root writes objects owned by root
#   into .git, and the next pull as the service user dies with "failed to read object <sha>:
#   Permission denied" - on an object that is perfectly intact. The repository is not corrupt and
#   nothing says so; it is simply unreadable by the only user that matters. So every git command
#   here goes through runuser, and the script fixes the ownership it finds before it starts rather
#   than failing the way git does.
#
#   AND A RESTART BEFORE A PULL RESTARTS THE OLD CODE. The ticket bot is a long-running process
#   that reads its source once, at start. Restarting it and then pulling leaves it running exactly
#   what it was running before, and the only evidence is that the new feature quietly does nothing
#   - which cost a round of "is it deployed?" with the answer being yes and no at once. Pull first,
#   restart after, and restart only what actually changed.
#
# WHAT IT WILL NOT DO. It does not run migrations. `prisma migrate deploy` alters a live database
# and wants somebody who knows what the migration is - but a migration that arrives unnoticed is
# how a server starts against a schema it does not have, so this SAYS when the pull brought new
# ones and leaves running them to you.
#
# It does not rebuild data/pack either: the server does that on its own next start.
#
# Usage, as root (it needs root for systemctl and for repairing ownership):
#   tools/server/deploy.sh              pull, then restart whatever changed
#   tools/server/deploy.sh --dry-run    say what it would do, change nothing
#   tools/server/deploy.sh --all        restart the services even if nothing changed
#
# Paths and names come from the environment, so this can be tried against a scratch tree:
#   DP_ROOT      the install           default /opt/deathplateau
#   DP_USER      the service user      default lostcity
#   DP_REPOS     repositories to pull  default "engine content"
#   DP_SERVICES  units to restart      default "deathplateau deathplateau-tickets"
set -euo pipefail

DP_ROOT="${DP_ROOT:-/opt/deathplateau}"
DP_USER="${DP_USER:-lostcity}"
DP_REPOS="${DP_REPOS:-engine content}"
DP_SERVICES="${DP_SERVICES:-deathplateau deathplateau-tickets}"

dry_run=0
restart_all=0
for arg in "$@"; do
    case "$arg" in
        --dry-run) dry_run=1 ;;
        --all) restart_all=1 ;;
        *) echo "Unknown argument: $arg" >&2; exit 2 ;;
    esac
done

say() { printf '%s\n' "$*"; }
run() { if [ "$dry_run" = 1 ]; then say "    would run: $*"; else "$@"; fi; }

# AS THE SERVICE USER, NEVER AS WHOEVER IS SITTING HERE. If this is already running as DP_USER
# there is nothing to switch to, and runuser would need root it does not have.
as_user() {
    if [ "$(id -un)" = "$DP_USER" ]; then
        "$@"
    else
        runuser -u "$DP_USER" -- "$@"
    fi
}

if [ "$(id -u)" != 0 ] && [ "$(id -un)" != "$DP_USER" ]; then
    say "Run this as root (it restarts services and repairs file ownership), or as $DP_USER."
    exit 1
fi

changed=""

for repo in $DP_REPOS; do
    dir="$DP_ROOT/$repo"
    if [ ! -d "$dir/.git" ]; then
        say "$repo: no git repository at $dir - skipped"
        continue
    fi
    say "$repo:"

    # THE OWNERSHIP REPAIR COMES FIRST, because git's own error for this names an object id and
    # not a cause, and the obvious reading of it - a corrupt repository - leads somewhere bad.
    if [ "$(id -u)" = 0 ]; then
        wrong=$(find "$dir" ! -user "$DP_USER" -print -quit 2>/dev/null || true)
        if [ -n "$wrong" ]; then
            count=$(find "$dir" ! -user "$DP_USER" 2>/dev/null | wc -l)
            say "    $count file(s) are not owned by $DP_USER - repairing (first: $wrong)"
            run chown -R "$DP_USER:$DP_USER" "$dir"
        fi
    fi

    # FETCH, THEN COMPARE, THEN PULL - and not pull-and-see-what-moved. A dry run has to be able
    # to say what WOULD change, and the obvious shape of this could not: with no pull performed,
    # HEAD still equals itself and --dry-run cheerfully reported "already up to date" on a repo
    # with a commit waiting. A dry run that says there is nothing to do, when there is, is worse
    # than no dry run at all. Fetching is safe in both modes; it writes no working tree.
    if ! as_user git -C "$dir" fetch --quiet; then
        say "    fetch failed - left alone, nothing restarted."
        exit 1
    fi
    before=$(as_user git -C "$dir" rev-parse HEAD)
    target=$(as_user git -C "$dir" rev-parse '@{u}' 2>/dev/null || echo "$before")

    if [ "$before" = "$target" ]; then
        say "    already up to date at ${before:0:8}"
    else
        say "    ${before:0:8} -> ${target:0:8}"
        as_user git -C "$dir" --no-pager log --oneline "$before..$target" 2>/dev/null | sed 's/^/      /' || true
        if [ "$dry_run" = 1 ]; then
            say "    would fast-forward"
        elif ! as_user git -C "$dir" merge --ff-only "$target"; then
            say "    fast-forward refused - the checkout has diverged or has local changes."
            say "    Nothing was restarted. Sort it out and run this again."
            exit 1
        fi
        changed="$changed $repo"

        # A MIGRATION THAT ARRIVES UNNOTICED is how a server starts against a schema it does not
        # have. Named, not run - see the header.
        if as_user git -C "$dir" diff --name-only "$before" "$target" 2>/dev/null | grep -q '^prisma/.*/migrations/'; then
            say "    NOTE: this pull brought new prisma migrations. They are NOT applied by this script:"
            say "          cd $dir && runuser -u $DP_USER -- npm run sqlite:migrate"
        fi
    fi
done

if [ -z "$changed" ] && [ "$restart_all" = 0 ]; then
    say ""
    say "Nothing changed, so nothing was restarted. --all restarts anyway."
    exit 0
fi

say ""
say "Restarting:${changed:- (forced)}"
for unit in $DP_SERVICES; do
    # LoadState, and not `list-unit-files`. That one answers a PATTERN and will happily print a
    # row for something that does not exist - on a container shim it answered "ubuntu" for a unit
    # named deathplateau-nosuch, so the guard let a restart of nothing straight through. show
    # -p LoadState asks about one unit and says not-found when it means it.
    load=$(systemctl show -p LoadState --value "$unit.service" 2>/dev/null || echo "")
    if [ "$load" != "loaded" ]; then
        say "    $unit: no such unit (LoadState=${load:-unknown}) - skipped"
        continue
    fi
    run systemctl restart "$unit"
    if [ "$dry_run" = 0 ]; then
        # ACTIVE IS NOT THE SAME AS STARTED. A unit that dies a second later still reports active
        # for that second, and a deploy that reports success on a dead bot is the failure this
        # script is meant to stop.
        sleep 2
        state=$(systemctl is-active "$unit" 2>/dev/null || true)
        say "    $unit: $state"
        if [ "$state" != "active" ]; then
            say "      journalctl -u $unit -n 40 --no-pager"
            exit 1
        fi
    fi
done

say ""
say "Done."
