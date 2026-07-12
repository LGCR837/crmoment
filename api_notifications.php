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

/**
 * POST /notifications/read   (单条标记已读)
 */
function handleNotificationsReadOne(): void {
    assertMethod('POST');

    // 先读取 php://input（只能读取一次），提取 id 和 token
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $notifId = isset($input['id']) ? (int)$input['id'] : 0;
    if ($notifId <= 0) {
        error('缺少通知 ID');
    }

    // 手动验证 token（避免 getTokenFromRequest 重复消费 php://input）
    $token = $input['token'] ?? '';
    $userId = validateToken($token);
    if (!$userId) {
        error('登录已过期，请重新登录', 401);
    }

    $pdo  = getDB();
    $stmt = $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?');
    $stmt->execute([$notifId, $userId]);

    success(null, '已标记为已读');
}
