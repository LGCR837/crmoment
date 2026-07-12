<?php
header('Content-Type: application/json; charset=utf-8');

require_once '../api_helpers.php';

$token = getTokenFromRequest();
if (!$token) {
    echo json_encode(['code' => 1, 'message' => '未提供 token']);
    exit;
}

$userId = validateToken($token);
if (!$userId) {
    echo json_encode(['code' => 1, 'message' => 'token 无效或已过期']);
    exit;
}

$pdo = getDB();
$action = $_GET['action'] ?? $_POST['action'] ?? '';
$allowedKeys = ['his', 'playing', 'volume'];

if ($action === 'read') {
    $key = $_GET['key'] ?? '';
    if (!in_array($key, $allowedKeys)) {
        echo json_encode(['code' => 1, 'message' => '无效的 key']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT data_value, updated_at FROM user_music_data WHERE user_id = ? AND data_key = ?');
    $stmt->execute([$userId, $key]);
    $row = $stmt->fetch();

    if (!$row) {
        echo json_encode(['code' => 0, 'message' => 'ok', 'data' => null]);
        exit;
    }

    echo json_encode([
        'code' => 0,
        'message' => 'ok',
        'data' => [
            'value' => json_decode($row['data_value'], true),
            'updated_at' => $row['updated_at'],
        ],
    ], JSON_UNESCAPED_UNICODE);

} elseif ($action === 'save') {
    $key = $_POST['key'] ?? '';
    $dataRaw = $_POST['data'] ?? null;

    if (!in_array($key, $allowedKeys)) {
        echo json_encode(['code' => 1, 'message' => '无效的 key']);
        exit;
    }

    if ($dataRaw === null) {
        echo json_encode(['code' => 1, 'message' => '缺少 data 参数']);
        exit;
    }

    // 验证 JSON 格式
    $decoded = json_decode($dataRaw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(['code' => 1, 'message' => 'data 不是有效的 JSON']);
        exit;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO user_music_data (user_id, data_key, data_value, updated_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE data_value = VALUES(data_value), updated_at = NOW()'
    );
    $stmt->execute([$userId, $key, $dataRaw]);

    echo json_encode(['code' => 0, 'message' => 'ok']);

} else {
    echo json_encode(['code' => 1, 'message' => '无效的 action']);
}
