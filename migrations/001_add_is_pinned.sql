-- CRMoment 迁移脚本
-- 添加 is_pinned 列到 posts 表（用于动态置顶功能）
-- 在 phpMyAdmin 或 mysql 命令行中执行

ALTER TABLE `posts`
    ADD COLUMN `is_pinned` TINYINT(1) DEFAULT 0 COMMENT '是否置顶'
    AFTER `comments_count`,
    ADD INDEX `idx_is_pinned` (`is_pinned`);