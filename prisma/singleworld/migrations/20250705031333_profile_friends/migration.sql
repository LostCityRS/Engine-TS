/*
  Warnings:

  - The primary key for the `friendlist` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ignorelist` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_friendlist" (
    "account_id" INTEGER NOT NULL,
    "profile" TEXT NOT NULL DEFAULT 'main',
    "friend_account_id" INTEGER NOT NULL,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("account_id", "profile", "friend_account_id")
);
INSERT INTO "new_friendlist" ("account_id", "created", "friend_account_id") SELECT "account_id", "created", "friend_account_id" FROM "friendlist";
DROP TABLE "friendlist";
ALTER TABLE "new_friendlist" RENAME TO "friendlist";
CREATE TABLE "new_ignorelist" (
    "account_id" INTEGER NOT NULL,
    "profile" TEXT NOT NULL DEFAULT 'main',
    "value" TEXT NOT NULL,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("account_id", "profile", "value")
);
INSERT INTO "new_ignorelist" ("account_id", "created", "value") SELECT "account_id", "created", "value" FROM "ignorelist";
DROP TABLE "ignorelist";
ALTER TABLE "new_ignorelist" RENAME TO "ignorelist";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
