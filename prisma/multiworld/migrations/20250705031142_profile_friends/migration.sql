/*
  Warnings:

  - The primary key for the `friendlist` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ignorelist` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE `friendlist` DROP PRIMARY KEY,
    ADD COLUMN `profile` VARCHAR(191) NOT NULL DEFAULT 'main',
    ADD PRIMARY KEY (`account_id`, `profile`, `friend_account_id`);

-- AlterTable
ALTER TABLE `ignorelist` DROP PRIMARY KEY,
    ADD COLUMN `profile` VARCHAR(191) NOT NULL DEFAULT 'main',
    ADD PRIMARY KEY (`account_id`, `profile`, `value`);
