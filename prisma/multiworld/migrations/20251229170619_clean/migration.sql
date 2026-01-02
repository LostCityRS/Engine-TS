-- CreateTable
CREATE TABLE `ipban` (
    `ip` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`ip`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `registration_ip` VARCHAR(191) NULL,
    `registration_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `muted_until` DATETIME(3) NULL,
    `banned_until` DATETIME(3) NULL,
    `staffmodlevel` INTEGER NOT NULL DEFAULT 0,
    `members` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `account_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_login` (
    `account_id` INTEGER NOT NULL,
    `profile` VARCHAR(191) NOT NULL,
    `logged_in` INTEGER NOT NULL DEFAULT 0,
    `login_time` DATETIME(3) NULL,
    `logged_out` INTEGER NOT NULL DEFAULT 0,
    `logout_time` DATETIME(3) NULL,

    PRIMARY KEY (`profile`, `account_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hiscore` (
    `account_id` INTEGER NOT NULL,
    `profile` VARCHAR(191) NOT NULL DEFAULT 'main',
    `type` INTEGER NOT NULL,
    `level` INTEGER NOT NULL,
    `value` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`profile`, `type`, `account_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hiscore_large` (
    `account_id` INTEGER NOT NULL,
    `profile` VARCHAR(191) NOT NULL DEFAULT 'main',
    `type` INTEGER NOT NULL,
    `level` INTEGER NOT NULL,
    `value` BIGINT NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`profile`, `type`, `account_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `friendlist` (
    `account_id` INTEGER NOT NULL,
    `friend_account_id` INTEGER NOT NULL,
    `profile` VARCHAR(191) NOT NULL DEFAULT 'main',
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`profile`, `account_id`, `friend_account_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ignorelist` (
    `account_id` INTEGER NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `profile` VARCHAR(191) NOT NULL DEFAULT 'main',
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`profile`, `account_id`, `value`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session` (
    `uuid` VARCHAR(191) NOT NULL,
    `account_id` INTEGER NOT NULL,
    `profile` VARCHAR(191) NOT NULL,
    `world` INTEGER NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `uid` INTEGER NOT NULL,
    `ip` VARCHAR(191) NULL,

    PRIMARY KEY (`uuid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_uuid` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `coord` INTEGER NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `event_type` INTEGER NOT NULL DEFAULT -1,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_wealth` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_uuid` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `coord` INTEGER NOT NULL,
    `event_type` INTEGER NOT NULL DEFAULT -1,
    `account_items` MEDIUMTEXT NOT NULL,
    `account_value` INTEGER NOT NULL,
    `recipient_session` VARCHAR(191) NULL,
    `recipient_items` MEDIUMTEXT NULL,
    `recipient_value` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `public_chat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_uuid` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `coord` INTEGER NOT NULL,
    `message` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `private_chat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `account_id` INTEGER NOT NULL,
    `profile` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `coord` INTEGER NOT NULL,
    `to_account_id` INTEGER NOT NULL,
    `message` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_uuid` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `coord` INTEGER NOT NULL,
    `offender` VARCHAR(191) NOT NULL,
    `reason` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `input_report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_uuid` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `data` LONGBLOB NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
