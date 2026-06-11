<?php
/**
 * CRMoment - 认证处理器（注册 / 登录 / 退出）
 */

/**
 * POST /auth/register
 * Body: { "username": "...", "nickname": "...", "password": "..." }
 */
function handleAuthRegister(): void {
    assertMethod('POST');
    $data     = getJsonBody();
    $username = trim($data['username'] ?? '');
    $nickname = trim($data['nickname'] ?? '');
    $password = $data['password'] ?? '';

    if (strlen($username) < 2 || strlen($username) > 50) {
        error('用户名长度需在 2-50 个字符之间');
    }
    if ($nickname === '') {
        error('昵称不能为空');
    }
    if (strlen($nickname) < 2 || strlen($nickname) > 50) {
        error('昵称长度需在 2-50 个字符之间');
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

    // 检查昵称是否与已有用户名或昵称冲突（不区分大小写）
    // utf8mb4_unicode_ci 默认不区分大小写
    $stmt = $pdo->prepare('SELECT id FROM users WHERE nickname = ? OR username = ?');
    $stmt->execute([$nickname, $nickname]);
    if ($stmt->fetch()) {
        error('昵称已被使用');
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('INSERT INTO users (username, nickname, password_hash, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$username, $nickname, $hash]);
    $userId = (int)$pdo->lastInsertId();

    // 生成 Token
    $token = createTokenForUser($userId);

    success([
        'id'       => $userId,
        'username' => $username,
        'nickname' => $nickname,
        'avatar'   => null,
        'token'    => $token,
    ], '注册成功');
}

/**
 * POST /auth/login
 * Body: { "username": "...", "password": "..." }
 * 支持使用用户名或昵称登录
 */
function handleAuthLogin(): void {
    assertMethod('POST');
    $data     = getJsonBody();
    $account  = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if ($account === '' || $password === '') {
        error('用户名和密码不能为空');
    }

    $pdo  = getDB();
    // 支持通过用户名或昵称登录
    $stmt = $pdo->prepare(
        'SELECT id, username, nickname, avatar, bio, password_hash FROM users WHERE username = ? OR nickname = ?'
    );
    $stmt->execute([$account, $account]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        error('用户名或密码错误');
    }

    // 生成 Token
    $token = createTokenForUser((int)$user['id']);

    success([
        'id'       => (int)$user['id'],
        'username' => $user['username'],
        'nickname' => $user['nickname'],
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
