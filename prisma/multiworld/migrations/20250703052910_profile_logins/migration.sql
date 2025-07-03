/*
  Warnings:

  - You are about to drop the column `logged_in` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `logged_out` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `login_time` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `logout_time` on the `account` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `account` DROP COLUMN `logged_in`,
    DROP COLUMN `logged_out`,
    DROP COLUMN `login_time`,
    DROP COLUMN `logout_time`;

-- CreateTable
CREATE TABLE `account_login` (
    `account_id` INTEGER NOT NULL,
    `profile` VARCHAR(191) NOT NULL,
    `logged_in` INTEGER NOT NULL DEFAULT 0,
    `login_time` DATETIME(3) NULL,
    `logged_out` INTEGER NOT NULL DEFAULT 0,
    `logout_time` DATETIME(3) NULL,

    UNIQUE INDEX `account_login_account_id_profile_key`(`account_id`, `profile`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
