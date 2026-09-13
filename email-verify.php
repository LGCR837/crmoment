<?php
/**
 * CRMoment - 邮箱验证回调入口
 *
 * 用户在邮箱中点击验证链接后，由该文件处理。
 * 流程：验证 token → 绑定邮箱到用户 → 重定向到前端
 *
 * 回调地址格式：
 *   https://crmoment.ccwu.cc/email-verify.php?token=xxx
 */

require_once __DIR__ . '/api_config.php';
require_once __DIR__ . '/api_helpers.php';

// 获取 token
$token = $_GET['token'] ?? '';

if (!$token) {
    header('Location: /web/?email_error=' . urlencode('缺少验证参数'));
    exit;
}

$pdo = getDB();

// 查找验证记录
$stmt = $pdo->prepare(
    'SELECT id, user_id, email, expires_at, used FROM email_verifications WHERE token = ?'
);
$stmt->execute([$token]);
$record = $stmt->fetch();

if (!$record) {
    header('Location: /web/?email_error=' . urlencode('验证链接无效'));
    exit;
}

// 检查是否已使用
if ($record['used']) {
    header('Location: /web/?email_error=' . urlencode('该验证链接已被使用'));
    exit;
}

// 检查是否过期
if (strtotime($record['expires_at']) < time()) {
    header('Location: /web/?email_error=' . urlencode('验证链接已过期，请重新发送'));
    exit;
}

$userId = (int)$record['user_id'];
$email  = $record['email'];

// 标记验证记录为已使用
$stmt = $pdo->prepare('UPDATE email_verifications SET used = 1 WHERE id = ?');
$stmt->execute([$record['id']]);

// 检查该邮箱是否已被其他用户绑定
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND email_verified = 1 AND id != ?');
$stmt->execute([$email, $userId]);
if ($stmt->fetch()) {
    header('Location: /web/?email_error=' . urlencode('该邮箱已被其他账号绑定'));
    exit;
}

// 更新用户邮箱
$stmt = $pdo->prepare('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?');
$stmt->execute([$email, $userId]);

// 重定向到前端，传递成功状态
$baseUrl = (defined('SITE_URL') && SITE_URL ? SITE_URL : 'https://crmoment.ccwu.cc');
header('Location: ' . $baseUrl . '/web/?email_bound=1');
exit;