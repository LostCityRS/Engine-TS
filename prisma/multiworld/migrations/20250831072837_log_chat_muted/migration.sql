/*
  Warnings:

  - Added the required column `muted` to the `private_chat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `muted` to the `public_chat` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `private_chat` ADD COLUMN `muted` BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE `public_chat` ADD COLUMN `muted` BOOLEAN NOT NULL;
