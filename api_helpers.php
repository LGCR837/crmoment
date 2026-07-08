<?php
/**
 * CRMoment - 辅助函数
 */

/**
 * 输出 JSON 响应并终止
 */
function jsonResponse(int $code, string $message, $data = null) {
    header('Content-Type: application/json; charset=utf-8');
    $res = ['code' => $code, 'message' => $message];
    if ($data !== null) {
        $res['data'] = $data;
    }
    echo json_encode($res, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * 成功响应
 */
function success($data = null, string $message = 'ok') {
    jsonResponse(0, $message, $data);
}

/**
 * 失败响应
 */
function error(string $message, int $httpCode = 400) {
    if ($httpCode !== 200) {
        http_response_code($httpCode);
    }
    jsonResponse(1, $message);
}

/**
 * 获取当前登录用户 ID，未登录则中断
 */
function requireLogin(): int {
    $token = getTokenFromRequest();
    if (!$token) {
        error('请先登录', 401);
    }
    $userId = validateToken($token);
    if (!$userId) {
        error('登录已过期，请重新登录', 401);
    }
    return $userId;
}

/**
 * 获取当前登录用户 ID，未登录返回 null（不中断）
 */
function getCurrentUserId(): ?int {
    $token = getTokenFromRequest();
    if (!$token) {
        return null;
    }
    $userId = validateToken($token);
    return $userId ?: null;
}

/**
 * 从请求中获取 Token
 * 优先从 GET/POST 参数获取，兼容 JSON body 中的 token 字段
 */
function getTokenFromRequest(): ?string {
    // 从 GET 或 POST 参数获取
    $token = $_GET['token'] ?? $_POST['token'] ?? null;
    if ($token) {
        return $token;
    }
    // 也支持 JSON body 中的 token 字段（POST/PUT 时 body.token 会被解析后以参数形式传入）
    $raw = file_get_contents('php://input');
    if ($raw) {
        $data = json_decode($raw, true);
        if (is_array($data) && !empty($data['token'])) {
            return $data['token'];
        }
    }
    return null;
}

/**
 * 验证 Token 有效性，并延期（更新 last_used_at）
 * 返回 user_id 或 null
 */
function validateToken(string $token): ?int {
    $pdo = getDB();
    $stmt = $pdo->prepare(
        'SELECT user_id, expires_at FROM auth_tokens WHERE token = ?'
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    // 检查是否过期
    if (strtotime($row['expires_at']) < time()) {
        // 删除过期 token
        $stmt = $pdo->prepare('DELETE FROM auth_tokens WHERE token = ?');
        $stmt->execute([$token]);
        return null;
    }

    // 延期：更新 last_used_at，并将过期时间重置为 30 天后
    $stmt = $pdo->prepare(
        'UPDATE auth_tokens SET last_used_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE token = ?'
    );
    $stmt->execute([$token]);

    return (int)$row['user_id'];
}

/**
 * 生成随机 Token
 */
function generateToken(): string {
    return bin2hex(random_bytes(32)); // 64 字符
}

/**
 * 为指定用户创建 Token 并返回
 */
function createTokenForUser(int $userId): string {
    $token = generateToken();
    $pdo = getDB();
    $stmt = $pdo->prepare(
        'INSERT INTO auth_tokens (user_id, token, expires_at, created_at, last_used_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())'
    );
    $stmt->execute([$userId, $token]);
    return $token;
}

/**
 * 验证请求方法
 */
function assertMethod(string $method): void {
    if ($_SERVER['REQUEST_METHOD'] !== strtoupper($method)) {
        error('不支持的请求方法', 405);
    }
}

/**
 * 获取 JSON 请求体
 */
function getJsonBody(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        error('请求体必须是有效的 JSON');
    }
    return $data;
}

/**
 * 安全地获取 $_GET 参数
 */
function getParam(string $key, $default = null) {
    return $_GET[$key] ?? $default;
}

/**
 * 生成随机文件名
 */
function randomFileName(string $ext): string {
    return bin2hex(random_bytes(16)) . '.' . $ext;
}

/**
 * 验证图片文件
 */
function validateImageFile(array $file): string {
    if ($file['error'] !== UPLOAD_ERR_OK) {
        error('文件上传失败，错误码: ' . $file['error']);
    }
    if ($file['size'] > MAX_FILE_SIZE) {
        error('文件大小不能超过 5MB');
    }
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ALLOWED_EXTENSIONS, true)) {
        error('仅支持 jpg, png, gif, webp 格式');
    }
    // 验证是否为真实图片
    $info = getimagesize($file['tmp_name']);
    if ($info === false) {
        error('文件不是有效的图片');
    }
    return $ext;
}

/**
 * 创建通知
 */
function createNotification(int $userId, string $type, int $actorId, ?int $postId = null): void {
    // 自己操作不通知自己
    if ($userId === $actorId) return;

    $pdo = getDB();
    $stmt = $pdo->prepare(
        'INSERT INTO notifications (user_id, type, actor_id, post_id, is_read, created_at)
         VALUES (?, ?, ?, ?, 0, NOW())'
    );
    $stmt->execute([$userId, $type, $actorId, $postId]);
}

/**
 * 获取上传目录路径（相对于站点根目录）
 */
function getUploadDir(string $type): string {
    if ($type === 'avatar') {
        $dir = __DIR__ . '/uploads/avatars';
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        return $dir;
    }
    if ($type === 'video') {
        $dir = __DIR__ . '/uploads/videos/' . date('Y') . '/' . date('m');
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        return $dir;
    }
    // post images
    $dir = __DIR__ . '/uploads/posts/' . date('Y') . '/' . date('m');
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    return $dir;
}

/**
 * 获取上传文件的 URL 路径
 */
function getUploadUrl(string $type, string $filename): string {
    if ($type === 'avatar') {
        return '/uploads/avatars/' . $filename;
    }
    if ($type === 'video') {
        return '/uploads/videos/' . date('Y') . '/' . date('m') . '/' . $filename;
    }
    return '/uploads/posts/' . date('Y') . '/' . date('m') . '/' . $filename;
}
