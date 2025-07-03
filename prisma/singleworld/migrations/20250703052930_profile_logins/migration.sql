/*
  Warnings:

  - You are about to drop the column `logged_in` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `logged_out` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `login_time` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `logout_time` on the `account` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "account_login" (
    "account_id" INTEGER NOT NULL,
    "profile" TEXT NOT NULL,
    "logged_in" INTEGER NOT NULL DEFAULT 0,
    "login_time" DATETIME,
    "logged_out" INTEGER NOT NULL DEFAULT 0,
    "logout_time" DATETIME
);

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
    "muted_until" DATETIME,
    "banned_until" DATETIME,
    "tracked_until" DATETIME,
    "staffmodlevel" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "notes_updated" DATETIME,
    "members" BOOLEAN NOT NULL DEFAULT false,
    "tfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tfa_last_code" INTEGER NOT NULL DEFAULT 0,
    "tfa_secret_base32" TEXT,
    "tfa_incorrect_attempts" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_account" ("banned_until", "email", "id", "members", "muted_until", "notes", "notes_updated", "oauth_provider", "password", "password_updated", "registration_date", "registration_ip", "staffmodlevel", "tfa_enabled", "tfa_incorrect_attempts", "tfa_last_code", "tfa_secret_base32", "username") SELECT "banned_until", "email", "id", "members", "muted_until", "notes", "notes_updated", "oauth_provider", "password", "password_updated", "registration_date", "registration_ip", "staffmodlevel", "tfa_enabled", "tfa_incorrect_attempts", "tfa_last_code", "tfa_secret_base32", "username" FROM "account";
DROP TABLE "account";
ALTER TABLE "new_account" RENAME TO "account";
CREATE UNIQUE INDEX "account_username_key" ON "account"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "account_login_account_id_profile_key" ON "account_login"("account_id", "profile");
