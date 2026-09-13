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
    $stmt = $pdo->prepare('SELECT id, username, nickname, avatar, bio, created_at FROM users WHERE id = ?');
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
    $stmt = $pdo->prepare('SELECT id, username, nickname, avatar, bio, created_at FROM users WHERE id = ?');
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

    // 追加版本参数（时间戳），URL 变化后浏览器会绕过本地缓存重新加载新头像
    $url = getUploadUrl('avatar', $filename) . '?v=' . time();

    // 更新数据库
    $pdo = getDB();
    $stmt = $pdo->prepare('UPDATE users SET avatar = ? WHERE id = ?');
    $stmt->execute([$url, $userId]);

    success(['avatar' => $url], '头像上传成功');
}

/**
 * POST /user/bio
 * 修改个人简介
 */
function handleUserBio(): void {
    assertMethod('POST');
    $userId = requireLogin();

    $body = getJsonBody();

    $bio = trim($body['bio'] ?? '');
    if ($bio === '') {
        error('参数不能为空');
    }
    if (mb_strlen($bio) > 200) {
        error('个人简介不能超过200个字符');
    }

    $pdo = getDB();
    $stmt = $pdo->prepare('UPDATE users SET bio = ? WHERE id = ?');
    $stmt->execute([$bio, $userId]);

    if ($stmt->rowCount() === 0) {
        error('更新失败，请稍后重试');
    }

    success(['bio' => $bio]);
}

/**
 * POST /user/nickname
 * 修改昵称
 */
function handleUserNickname(): void {
    assertMethod('POST');
    $userId = requireLogin();

    $body = getJsonBody();

    $nickname = trim($body['nickname'] ?? '');
    if ($nickname === '') {
        error('昵称不能为空');
    }
    if (mb_strlen($nickname) > 50 || mb_strlen($nickname) < 2) {
        error('昵称长度需在 2-50 个字符之间');
    }

    $pdo = getDB();

    // 检查昵称是否与别人冲突（不区分大小写，但允许与自己的用户名相同）
    $stmt = $pdo->prepare(
        'SELECT id FROM users WHERE id != ? AND (nickname = ? OR username = ?)'
    );
    $stmt->execute([$userId, $nickname, $nickname]);
    if ($stmt->fetch()) {
        error('该昵称已被使用');
    }

    $stmt = $pdo->prepare('UPDATE users SET nickname = ? WHERE id = ?');
    $stmt->execute([$nickname, $userId]);

    if ($stmt->rowCount() === 0) {
        error('更新失败，请稍后重试');
    }

    success(['nickname' => $nickname]);
}
