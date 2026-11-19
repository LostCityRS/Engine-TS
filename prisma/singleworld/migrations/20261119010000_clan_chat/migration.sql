-- CreateTable
-- custom (2026-11-19) - what was said in a clan channel. One row per line, written by the friend
-- server beside public_chat and private_chat.
--
-- IT WAS THE ONE KIND OF CHAT NOBODY COULD READ BACK. public_chat and private_chat have been
-- recorded since FRIEND_SERVER went on; clan chat was relayed in memory by ClanChat.message and
-- then gone. A channel is exactly where a trade gets arranged and a scam gets planned, so it was
-- the gap that mattered most.
--
-- BOTH THE OWNER AND THE NAME, on purpose. A channel's identity is its OWNER - that is its
-- primary key in data/clans/<profile>.sqlite - but its name can be changed at any time in Clan
-- Setup, and is what a moderator reading this would recognise. Storing only the owner means
-- re-deriving a name that may since have changed; storing only the name means two different
-- channels sharing a row's worth of history. A log has to be readable years later without the
-- rest of the database, so it keeps both: owner is who it was, channel is what it was called at
-- the time.
--
-- KEYED BY SESSION, like public_chat, so one join reaches the account and every tool that already
-- resolves a public line resolves a clan line the same way. private_chat's account_id would have
-- been the other option and is the odd one out of the three.
--
-- IF NOT EXISTS, as account_token's migration explains at length: the engine and a migration both
-- insisting on being first is what stopped a deploy dead with P3018.
CREATE TABLE IF NOT EXISTS "clan_chat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_uuid" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "coord" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "message" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "clan_chat_session_uuid_idx" ON "clan_chat"("session_uuid");
