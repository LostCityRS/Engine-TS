/*
  Warnings:

  - Added the required column `muted` to the `private_chat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `muted` to the `public_chat` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_private_chat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" INTEGER NOT NULL,
    "profile" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "coord" INTEGER NOT NULL,
    "to_account_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "muted" BOOLEAN NOT NULL
);
INSERT INTO "new_private_chat" ("account_id", "coord", "id", "message", "profile", "timestamp", "to_account_id") SELECT "account_id", "coord", "id", "message", "profile", "timestamp", "to_account_id" FROM "private_chat";
DROP TABLE "private_chat";
ALTER TABLE "new_private_chat" RENAME TO "private_chat";
CREATE TABLE "new_public_chat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" INTEGER NOT NULL,
    "profile" TEXT NOT NULL,
    "world" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "coord" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "muted" BOOLEAN NOT NULL
);
INSERT INTO "new_public_chat" ("account_id", "coord", "id", "message", "profile", "timestamp", "world") SELECT "account_id", "coord", "id", "message", "profile", "timestamp", "world" FROM "public_chat";
DROP TABLE "public_chat";
ALTER TABLE "new_public_chat" RENAME TO "public_chat";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
