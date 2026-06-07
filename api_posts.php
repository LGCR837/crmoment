<?php
/**
 * CRMoment - 动态处理器（CRUD + 点赞）
 */

/**
 * GET /posts?page=1&size=20
 */
function handlePostsList(): void {
    assertMethod('GET');

    $page = max(1, (int)getParam('page', 1));
    $size = max(1, min(50, (int)getParam('size', PAGE_SIZE)));
    $offset = ($page - 1) * $size;

    $pdo = getDB();

    // 获取总数
    $stmt = $pdo->query('SELECT COUNT(*) AS cnt FROM posts');
    $total = (int)$stmt->fetch()['cnt'];

    // 获取列表（含作者信息）
    $stmt = $pdo->prepare(
        'SELECT p.id, p.content, p.images, p.likes_count, p.comments_count, p.created_at,
                u.id AS user_id, u.username, u.avatar
         FROM posts p
         JOIN users u ON p.user_id = u.id
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?'
    );
    $stmt->execute([$size, $offset]);
    $posts = $stmt->fetchAll();

    // 格式化
    foreach ($posts as &$post) {
        $post['id']            = (int)$post['id'];
        $post['user_id']       = (int)$post['user_id'];
        $post['likes_count']   = (int)$post['likes_count'];
        $post['comments_count'] = (int)$post['comments_count'];
        $post['images']        = $post['images'] ? json_decode($post['images'], true) : [];
    }
    unset($post);

    // 如果当前用户已登录，检查是否点赞
    $currentUserId = getCurrentUserId();
    if ($currentUserId && !empty($posts)) {
        $postIds = array_column($posts, 'id');
        $placeholders = implode(',', array_fill(0, count($postIds), '?'));
        $stmt = $pdo->prepare("SELECT post_id FROM likes WHERE user_id = ? AND post_id IN ($placeholders)");
        $stmt->execute(array_merge([$currentUserId], $postIds));
        $likedPostIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $likedMap = array_flip($likedPostIds);
        foreach ($posts as &$post) {
            $post['is_liked'] = isset($likedMap[$post['id']]);
        }
        unset($post);
    }

    success([
        'list'      => $posts,
        'total'     => $total,
        'page'      => $page,
        'size'      => $size,
        'has_more'  => ($page * $size) < $total,
    ]);
}

/**
 * GET /posts/{id}
 */
function handlePostsShow(int $id): void {
    assertMethod('GET');

    $pdo  = getDB();
    $stmt = $pdo->prepare(
        'SELECT p.id, p.content, p.images, p.likes_count, p.comments_count, p.created_at,
                u.id AS user_id, u.username, u.avatar
         FROM posts p
         JOIN users u ON p.user_id = u.id
         WHERE p.id = ?'
    );
    $stmt->execute([$id]);
    $post = $stmt->fetch();

    if (!$post) {
        error('动态不存在', 404);
    }

    $post['id']            = (int)$post['id'];
    $post['user_id']       = (int)$post['user_id'];
    $post['likes_count']   = (int)$post['likes_count'];
    $post['comments_count'] = (int)$post['comments_count'];
    $post['images']        = $post['images'] ? json_decode($post['images'], true) : [];

    // 点赞状态
    $currentUserId = getCurrentUserId();
    $post['is_liked'] = false;
    if ($currentUserId) {
        $stmt = $pdo->prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?');
        $stmt->execute([$currentUserId, $id]);
        $post['is_liked'] = (bool)$stmt->fetch();
    }

    // 获取评论（前 10 条）
    $stmt = $pdo->prepare(
        'SELECT c.id, c.content, c.parent_id, c.created_at,
                u.id AS user_id, u.username, u.avatar
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.post_id = ?
         ORDER BY c.created_at ASC
         LIMIT 10'
    );
    $stmt->execute([$id]);
    $comments = $stmt->fetchAll();

    foreach ($comments as &$c) {
        $c['id']      = (int)$c['id'];
        $c['user_id'] = (int)$c['user_id'];
        $c['parent_id'] = $c['parent_id'] ? (int)$c['parent_id'] : null;
    }
    unset($c);

    $post['comments'] = $comments;

    success($post);
}

/**
 * POST /posts
 * multipart/form-data: content, images[] (最多9张)
 */
function handlePostsCreate(): void {
    $userId = requireLogin();

    $content = trim($_POST['content'] ?? '');
    if ($content === '') {
        error('内容不能为空');
    }

    $imagePaths = [];

    // 处理上传的图片
    if (!empty($_FILES['images'])) {
        $files = $_FILES['images'];
        $fileCount = is_array($files['name']) ? count($files['name']) : 1;
        $fileCount = min($fileCount, 9);

        $allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        $uploadDir = getUploadDir('post');

        for ($i = 0; $i < $fileCount; $i++) {
            $name     = is_array($files['name']) ? $files['name'][$i] : $files['name'];
            $tmpName  = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
            $error    = is_array($files['error']) ? $files['error'][$i] : $files['error'];
            $size     = is_array($files['size']) ? $files['size'][$i] : $files['size'];

            if ($error !== UPLOAD_ERR_OK) continue;
            if ($size > MAX_FILE_SIZE) continue;

            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExts, true)) continue;

            $info = @getimagesize($tmpName);
            if ($info === false) continue;

            $filename = randomFileName($ext);
            $dest = $uploadDir . '/' . $filename;
            if (move_uploaded_file($tmpName, $dest)) {
                $imagePaths[] = getUploadUrl('post', $filename);
            }
        }
    }

    $pdo = getDB();
    $stmt = $pdo->prepare(
        'INSERT INTO posts (user_id, content, images, likes_count, comments_count, created_at)
         VALUES (?, ?, ?, 0, 0, NOW())'
    );
    $stmt->execute([
        $userId,
        $content,
        empty($imagePaths) ? null : json_encode($imagePaths, JSON_UNESCAPED_UNICODE),
    ]);
    $postId = (int)$pdo->lastInsertId();

    success([
        'id' => $postId,
        'content' => $content,
        'images'  => $imagePaths,
    ], '发布成功');
}

/**
 * DELETE /posts/{id}
 */
function handlePostsDelete(int $id): void {
    assertMethod('DELETE');
    $userId = requireLogin();

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT user_id, images, created_at FROM posts WHERE id = ?');
    $stmt->execute([$id]);
    $post = $stmt->fetch();

    if (!$post) {
        error('动态不存在', 404);
    }
    if ((int)$post['user_id'] !== $userId) {
        error('无权删除此动态', 403);
    }

    // 8 分钟撤回时限
    $createdAt = strtotime($post['created_at'] . ' UTC');
    if (!$createdAt || time() - $createdAt > 480) {
        error('已超过 8 分钟，无法撤回', 403);
    }

    // 删除关联图片文件
    if ($post['images']) {
        $images = json_decode($post['images'], true);
        foreach ($images as $img) {
            $filePath = __DIR__ . '/' . ltrim($img, '/');
            if (file_exists($filePath)) {
                @unlink($filePath);
            }
        }
    }

    $stmt = $pdo->prepare('DELETE FROM posts WHERE id = ?');
    $stmt->execute([$id]);

    success(null, '删除成功');
}

/**
 * POST /posts/{id}/like
 */
function handlePostsLike(int $id): void {
    assertMethod('POST');
    $userId = requireLogin();

    $pdo = getDB();

    // 检查动态存在
    $stmt = $pdo->prepare('SELECT id, user_id FROM posts WHERE id = ?');
    $stmt->execute([$id]);
    $post = $stmt->fetch();
    if (!$post) {
        error('动态不存在', 404);
    }

    // 已点赞则忽略
    $stmt = $pdo->prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?');
    $stmt->execute([$userId, $id]);
    if ($stmt->fetch()) {
        success(null, '已点赞');
    }

    // 插入点赞记录
    $stmt = $pdo->prepare('INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, NOW())');
    $stmt->execute([$userId, $id]);

    // 更新点赞数
    $stmt = $pdo->prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?');
    $stmt->execute([$id]);

    // 发送通知
    createNotification((int)$post['user_id'], 'like', $userId, $id);

    success(null, '点赞成功');
}

/**
 * DELETE /posts/{id}/like
 */
function handlePostsUnlike(int $id): void {
    assertMethod('DELETE');
    $userId = requireLogin();

    $pdo = getDB();

    $stmt = $pdo->prepare('SELECT id FROM posts WHERE id = ?');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        error('动态不存在', 404);
    }

    $stmt = $pdo->prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?');
    $stmt->execute([$userId, $id]);

    if ($stmt->rowCount() > 0) {
        // 更新点赞数
        $stmt = $pdo->prepare('UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?');
        $stmt->execute([$id]);
    }

    success(null, '取消点赞成功');
}
