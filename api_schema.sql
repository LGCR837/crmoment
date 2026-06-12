-- CRMoment 数据库建表脚本
-- 使用方式：在 phpMyAdmin 或 mysql 命令行中执行

CREATE DATABASE IF NOT EXISTS serad2nim77d3wq DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE serad2nim77d3wq;

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `nickname` VARCHAR(50) DEFAULT NULL COMMENT '昵称',
    `password_hash` VARCHAR(255) NOT NULL,
    `avatar` VARCHAR(255) DEFAULT NULL COMMENT '头像路径',
    `bio` VARCHAR(200) DEFAULT NULL COMMENT '个人简介',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_username` (`username`),
    INDEX `idx_nickname` (`nickname`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 迁移说明：已有用户的 nickname 需手动设置为与 username 相同
-- ALTER TABLE users ADD COLUMN nickname VARCHAR(50) DEFAULT NULL AFTER username, ADD INDEX idx_nickname (nickname);

-- 动态表
CREATE TABLE IF NOT EXISTS `posts` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `content` TEXT NOT NULL,
    `images` JSON DEFAULT NULL COMMENT '图片路径数组 ["/uploads/posts/...", ...]',
    `likes_count` INT UNSIGNED DEFAULT 0,
    `comments_count` INT UNSIGNED DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_created_at` (`created_at`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 评论表
CREATE TABLE IF NOT EXISTS `comments` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `post_id` INT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NOT NULL,
    `parent_id` INT UNSIGNED DEFAULT NULL COMMENT '父评论ID，支持回复',
    `content` TEXT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_post_id` (`post_id`),
    INDEX `idx_user_id` (`user_id`),
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 点赞表（联合主键）
CREATE TABLE IF NOT EXISTS `likes` (
    `user_id` INT UNSIGNED NOT NULL,
    `post_id` INT UNSIGNED NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `post_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Token 认证表
CREATE TABLE IF NOT EXISTS `auth_tokens` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `token` VARCHAR(64) NOT NULL UNIQUE,
    `expires_at` DATETIME NOT NULL,
    `last_used_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_token` (`token`),
    INDEX `idx_user_id` (`user_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会话表（私聊/群聊）
CREATE TABLE IF NOT EXISTS `conversations` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `type` ENUM('private', 'group') NOT NULL DEFAULT 'private',
    `name` VARCHAR(100) DEFAULT NULL COMMENT '群聊名称',
    `avatar` VARCHAR(255) DEFAULT NULL,
    `created_by` INT UNSIGNED NOT NULL,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_updated_at` (`updated_at`),
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会话参与者表
CREATE TABLE IF NOT EXISTS `conversation_members` (
    `conversation_id` INT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NOT NULL,
    `last_read_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `joined_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`conversation_id`, `user_id`),
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 消息表
CREATE TABLE IF NOT EXISTS `messages` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `conversation_id` INT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_conv_id` (`conversation_id`, `id`),
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 音乐表（音乐广场）
CREATE TABLE IF NOT EXISTS `music` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `title` VARCHAR(200) NOT NULL COMMENT '音乐名称',
    `music_url` VARCHAR(500) NOT NULL COMMENT '音频直链',
    `lrc_url` VARCHAR(500) DEFAULT NULL COMMENT '歌词文件直链',
    `bg_url` VARCHAR(500) DEFAULT NULL COMMENT '背景图片直链',
    `lrc_pos` VARCHAR(10) DEFAULT 'center' COMMENT '歌词位置 left/center/right',
    `lrc_color` VARCHAR(10) DEFAULT 'light' COMMENT '歌词颜色 light/dark',
    `plays_count` INT UNSIGNED DEFAULT 0 COMMENT '播放量',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_created_at` (`created_at`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 通知表
CREATE TABLE IF NOT EXISTS `notifications` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '通知接收者',
    `type` ENUM('comment', 'reply', 'like') NOT NULL COMMENT '通知类型',
    `actor_id` INT UNSIGNED NOT NULL COMMENT '触发者',
    `post_id` INT UNSIGNED DEFAULT NULL COMMENT '关联动态',
    `is_read` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_id` (`user_id`, `is_read`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
