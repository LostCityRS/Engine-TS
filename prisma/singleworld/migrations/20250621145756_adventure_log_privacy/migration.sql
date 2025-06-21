/*
  Warnings:

  - You are about to drop the column `category` on the `tag` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_account" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "password_updated" DATETIME,
    "email" TEXT,
    "oauth_provider" TEXT,
    "registration_ip" TEXT,
    "registration_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logged_in" INTEGER NOT NULL DEFAULT 0,
    "login_time" DATETIME,
    "logged_out" INTEGER NOT NULL DEFAULT 0,
    "logout_time" DATETIME,
    "muted_until" DATETIME,
    "banned_until" DATETIME,
    "staffmodlevel" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "notes_updated" DATETIME,
    "members" BOOLEAN NOT NULL DEFAULT false,
    "tfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tfa_last_code" INTEGER NOT NULL DEFAULT 0,
    "tfa_secret_base32" TEXT,
    "tfa_incorrect_attempts" INTEGER NOT NULL DEFAULT 0,
    "alog_privacy_enabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_account" ("banned_until", "email", "id", "logged_in", "logged_out", "login_time", "logout_time", "members", "muted_until", "notes", "notes_updated", "oauth_provider", "password", "password_updated", "registration_date", "registration_ip", "staffmodlevel", "tfa_enabled", "tfa_incorrect_attempts", "tfa_last_code", "tfa_secret_base32", "username") SELECT "banned_until", "email", "id", "logged_in", "logged_out", "login_time", "logout_time", "members", "muted_until", "notes", "notes_updated", "oauth_provider", "password", "password_updated", "registration_date", "registration_ip", "staffmodlevel", "tfa_enabled", "tfa_incorrect_attempts", "tfa_last_code", "tfa_secret_base32", "username" FROM "account";
DROP TABLE "account";
ALTER TABLE "new_account" RENAME TO "account";
CREATE UNIQUE INDEX "account_username_key" ON "account"("username");
CREATE TABLE "new_tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT
);
INSERT INTO "new_tag" ("color", "id", "name") SELECT "color", "id", "name" FROM "tag";
DROP TABLE "tag";
ALTER TABLE "new_tag" RENAME TO "tag";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
