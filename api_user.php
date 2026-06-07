<?php
/**
 * CRMoment - 用户处理器
 */

/**
 * GET /user/me
 */
function handleUserMe(): void {
    assertMethod('GET');
    $userId = requireLogin();

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT id, username, avatar, bio, created_at FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        error('用户不存在', 404);
    }

    $user['id'] = (int)$user['id'];
    success($user);
}

/**
 * GET /user/{id}
 */
function handleUserShow(int $id): void {
    assertMethod('GET');

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT id, username, avatar, bio, created_at FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $user = $stmt->fetch();

    if (!$user) {
        error('用户不存在', 404);
    }

    // 附带动态数量
    $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM posts WHERE user_id = ?');
    $stmt->execute([$id]);
    $user['posts_count'] = (int)$stmt->fetch()['cnt'];
    $user['id'] = (int)$user['id'];

    success($user);
}

/**
 * POST /user/avatar
 * multipart/form-data 上传头像
 */
function handleUserAvatar(): void {
    assertMethod('POST');
    $userId = requireLogin();

    $file = $_FILES['avatar'] ?? null;
    if (!$file) {
        error('请选择要上传的头像');
    }

    $ext = validateImageFile($file);
    $filename = $userId . '.jpg'; // 统一 jpg，覆盖旧图

    $dest = getUploadDir('avatar') . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        error('头像保存失败', 500);
    }

    $url = getUploadUrl('avatar', $filename);

    // 更新数据库
    $pdo = getDB();
    $stmt = $pdo->prepare('UPDATE users SET avatar = ? WHERE id = ?');
    $stmt->execute([$url, $userId]);

    success(['avatar' => $url], '头像上传成功');
}
