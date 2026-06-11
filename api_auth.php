<?php
/**
 * CRMoment - 认证处理器（注册 / 登录 / 退出）
 */

/**
 * POST /auth/register
 * Body: { "username": "...", "password": "..." }
 */
function handleAuthRegister(): void {
    assertMethod('POST');
    $data   = getJsonBody();
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (strlen($username) < 2 || strlen($username) > 50) {
        error('用户名长度需在 2-50 个字符之间');
    }
    if (strlen($password) < 6) {
        error('密码长度不能少于 6 位');
    }
    if (!preg_match('/^[a-zA-Z0-9_\x{4e00}-\x{9fa5}]+$/u', $username)) {
        error('用户名只能包含字母、数字、下划线和中文');
    }

    $pdo = getDB();

    // 检查用户名是否已存在
    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        error('用户名已被注册');
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, NOW())');
    $stmt->execute([$username, $hash]);
    $userId = (int)$pdo->lastInsertId();

    // 生成 Token
    $token = createTokenForUser($userId);

    success([
        'id'       => $userId,
        'username' => $username,
        'avatar'   => null,
        'token'    => $token,
    ], '注册成功');
}

/**
 * POST /auth/login
 * Body: { "username": "...", "password": "..." }
 */
function handleAuthLogin(): void {
    assertMethod('POST');
    $data     = getJsonBody();
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if ($username === '' || $password === '') {
        error('用户名和密码不能为空');
    }

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT id, username, avatar, bio, password_hash FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        error('用户名或密码错误');
    }

    // 生成 Token
    $token = createTokenForUser((int)$user['id']);

    success([
        'id'       => (int)$user['id'],
        'username' => $user['username'],
        'avatar'   => $user['avatar'],
        'bio'      => $user['bio'],
        'token'    => $token,
    ], '登录成功');
}

/**
 * POST /auth/logout
 */
function handleAuthLogout(): void {
    assertMethod('POST');
    requireLogin();
    $token = getTokenFromRequest();
    if ($token) {
        $pdo = getDB();
        $stmt = $pdo->prepare('DELETE FROM auth_tokens WHERE token = ?');
        $stmt->execute([$token]);
    }
    success(null, '已退出');
}
