/*
  Warnings:

  - You are about to drop the column `category` on the `tag` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `account` ADD COLUMN `alog_privacy_enabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `tag` DROP COLUMN `category`;
