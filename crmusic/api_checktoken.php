<?php
header('Content-Type: application/json; charset=utf-8');

$token = $_GET['token'] ?? '';

if (!$token) {
    echo json_encode(['code' => 1, 'message' => '未提供 token']);
    exit;
}

require_once '../api_helpers.php';

$userId = validateToken($token);
if (!$userId) {
    echo json_encode(['code' => 1, 'message' => 'token 无效或已过期']);
    exit;
}

$pdo = getDB();
$stmt = $pdo->prepare('SELECT id, username, nickname, avatar, bio FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    echo json_encode(['code' => 1, 'message' => '用户不存在']);
    exit;
}

$user['id'] = (int)$user['id'];
echo json_encode(['code' => 0, 'message' => 'ok', 'data' => $user]);