<?php
/**
 * CRMoment - 评论处理器
 */

/**
 * GET /posts/{id}/comments?page=1
 */
function handleCommentsList(int $postId): void {
    assertMethod('GET');

    $page   = max(1, (int)getParam('page', 1));
    $size   = 20;
    $offset = ($page - 1) * $size;

    $pdo = getDB();

    // 检查动态存在
    $stmt = $pdo->prepare('SELECT id FROM posts WHERE id = ?');
    $stmt->execute([$postId]);
    if (!$stmt->fetch()) {
        error('动态不存在', 404);
    }

    // 只获取一级评论（parent_id IS NULL）
    $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM comments WHERE post_id = ? AND parent_id IS NULL');
    $stmt->execute([$postId]);
    $total = (int)$stmt->fetch()['cnt'];

    $stmt = $pdo->prepare(
        'SELECT c.id, c.content, c.parent_id, c.created_at,
                u.id AS user_id, u.username, u.avatar
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.post_id = ? AND c.parent_id IS NULL
         ORDER BY c.created_at ASC
         LIMIT ? OFFSET ?'
    );
    $stmt->execute([$postId, $size, $offset]);
    $comments = $stmt->fetchAll();

    foreach ($comments as &$c) {
        $c['id']      = (int)$c['id'];
        $c['user_id'] = (int)$c['user_id'];
        $c['parent_id'] = $c['parent_id'] ? (int)$c['parent_id'] : null;

        // 加载子评论（回复）
        $stmt2 = $pdo->prepare(
            'SELECT c.id, c.content, c.parent_id, c.created_at,
                    u.id AS user_id, u.username, u.avatar
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.parent_id = ?
             ORDER BY c.created_at ASC'
        );
        $stmt2->execute([$c['id']]);
        $c['replies'] = $stmt2->fetchAll();
        foreach ($c['replies'] as &$r) {
            $r['id']      = (int)$r['id'];
            $r['user_id'] = (int)$r['user_id'];
            $r['parent_id'] = (int)$r['parent_id'];
        }
        unset($r);
    }
    unset($c);

    success([
        'list'      => $comments,
        'total'     => $total,
        'page'      => $page,
        'has_more'  => ($page * $size) < $total,
    ]);
}

/**
 * POST /posts/{id}/comments
 * Body: { "content": "...", "parent_id": null }
 */
function handleCommentsCreate(int $postId): void {
    assertMethod('POST');
    $userId   = requireLogin();
    $data     = getJsonBody();
    $content  = trim($data['content'] ?? '');
    $parentId = isset($data['parent_id']) ? (int)$data['parent_id'] : null;

    if ($content === '') {
        error('评论内容不能为空');
    }

    $pdo = getDB();

    // 检查动态
    $stmt = $pdo->prepare('SELECT id, user_id FROM posts WHERE id = ?');
    $stmt->execute([$postId]);
    $post = $stmt->fetch();
    if (!$post) {
        error('动态不存在', 404);
    }

    // 如果指定了父评论，检查父评论是否存在
    $targetUserId = (int)$post['user_id'];
    $notifyType = 'comment';
    if ($parentId) {
        $stmt = $pdo->prepare('SELECT id, user_id FROM comments WHERE id = ? AND post_id = ?');
        $stmt->execute([$parentId, $postId]);
        $parent = $stmt->fetch();
        if (!$parent) {
            error('父评论不存在', 404);
        }
        $targetUserId = (int)$parent['user_id'];
        $notifyType = 'reply';
    }

    $stmt = $pdo->prepare(
        'INSERT INTO comments (post_id, user_id, parent_id, content, created_at)
         VALUES (?, ?, ?, ?, NOW())'
    );
    $stmt->execute([$postId, $userId, $parentId, $content]);
    $commentId = (int)$pdo->lastInsertId();

    // 更新动态评论数
    $stmt = $pdo->prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?');
    $stmt->execute([$postId]);

    // 发送通知
    createNotification($targetUserId, $notifyType, $userId, $postId);

    $stmt = $pdo->prepare(
        'SELECT c.id, c.content, c.parent_id, c.created_at,
                u.id AS user_id, u.username, u.avatar
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.id = ?'
    );
    $stmt->execute([$commentId]);
    $comment = $stmt->fetch();
    $comment['id']      = (int)$comment['id'];
    $comment['user_id'] = (int)$comment['user_id'];
    $comment['parent_id'] = $comment['parent_id'] ? (int)$comment['parent_id'] : null;

    success($comment, '评论成功');
}

/**
 * DELETE /comments/{id}
 */
function handleCommentsDelete(int $id): void {
    assertMethod('DELETE');
    $userId = requireLogin();

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT id, post_id, user_id FROM comments WHERE id = ?');
    $stmt->execute([$id]);
    $comment = $stmt->fetch();

    if (!$comment) {
        error('评论不存在', 404);
    }
    if ((int)$comment['user_id'] !== $userId) {
        error('无权删除此评论', 403);
    }

    // 删除评论及其子回复
    $stmt = $pdo->prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?');
    $stmt->execute([$id, $id]);

    // 更新评论数
    $affected = $stmt->rowCount();
    $stmt = $pdo->prepare('UPDATE posts SET comments_count = GREATEST(comments_count - ?, 0) WHERE id = ?');
    $stmt->execute([$affected, $comment['post_id']]);

    success(null, '删除成功');
}
