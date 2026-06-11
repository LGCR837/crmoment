<?php
/**
 * CRMoment - 通知处理器
 */

/**
 * GET /notifications?page=1
 */
function handleNotificationsList(): void {
    assertMethod('GET');
    $userId = requireLogin();

    $page   = max(1, (int)getParam('page', 1));
    $size   = 20;
    $offset = ($page - 1) * $size;

    $pdo = getDB();

    $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ?');
    $stmt->execute([$userId]);
    $total = (int)$stmt->fetch()['cnt'];

    $stmt = $pdo->prepare(
        'SELECT n.id, n.type, n.post_id, n.is_read, n.created_at,
                u.id AS actor_id, u.username AS actor_username, u.nickname AS actor_nickname, u.avatar AS actor_avatar
         FROM notifications n
         JOIN users u ON n.actor_id = u.id
         WHERE n.user_id = ?
         ORDER BY n.created_at DESC
         LIMIT ? OFFSET ?'
    );
    $stmt->execute([$userId, $size, $offset]);
    $list = $stmt->fetchAll();

    foreach ($list as &$item) {
        $item['id']       = (int)$item['id'];
        $item['actor_id'] = (int)$item['actor_id'];
        $item['post_id']  = $item['post_id'] ? (int)$item['post_id'] : null;
        $item['is_read']  = (bool)$item['is_read'];
    }
    unset($item);

    success([
        'list'     => $list,
        'total'    => $total,
        'page'     => $page,
        'has_more' => ($page * $size) < $total,
    ]);
}

/**
 * GET /notifications/unread
 */
function handleNotificationsUnread(): void {
    assertMethod('GET');
    $userId = requireLogin();

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0');
    $stmt->execute([$userId]);

    success(['unread_count' => (int)$stmt->fetch()['cnt']]);
}

/**
 * PUT /notifications/read
 */
function handleNotificationsRead(): void {
    assertMethod('PUT');
    $userId = requireLogin();

    $pdo  = getDB();
    $stmt = $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0');
    $stmt->execute([$userId]);

    success(null, '已全部标记为已读');
}
