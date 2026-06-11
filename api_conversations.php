<?php
/**
 * CRMoment - 私聊/群聊处理器
 */

/**
 * GET /conversations - 获取当前用户的会话列表
 */
function handleConversationsList(): void {
    assertMethod('GET');
    $userId = requireLogin();

    $pdo = getDB();

    // 获取会话列表，包含最后一条消息和未读数
    $stmt = $pdo->prepare(
        'SELECT c.id, c.type, c.name, c.avatar, c.updated_at, c.created_at,
                c2.id AS last_msg_id, c2.user_id AS last_msg_user_id, c2.content AS last_msg_content, c2.created_at AS last_msg_created_at,
                u.nickname AS last_msg_nickname, u.username AS last_msg_username,
                (SELECT COUNT(*) FROM messages m2 WHERE m2.conversation_id = c.id AND m2.id > IFNULL(cm.last_read_at, 0)) AS unread_count
         FROM conversations c
         JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
         LEFT JOIN messages c2 ON c2.id = (SELECT MAX(m3.id) FROM messages m3 WHERE m3.conversation_id = c.id)
         LEFT JOIN users u ON u.id = c2.user_id
         ORDER BY c.updated_at DESC'
    );
    $stmt->execute([$userId]);
    $list = $stmt->fetchAll();

    // 对于私聊，获取对方用户信息作为显示名称
    foreach ($list as &$conv) {
        $conv['id'] = (int)$conv['id'];
        $conv['unread_count'] = (int)$conv['unread_count'];
        $conv['last_msg_id'] = $conv['last_msg_id'] ? (int)$conv['last_msg_id'] : null;

        if ($conv['type'] === 'private') {
            // 获取私聊对方
            $stmt2 = $pdo->prepare(
                'SELECT u.id, u.username, u.nickname, u.avatar
                 FROM conversation_members cm
                 JOIN users u ON u.id = cm.user_id
                 WHERE cm.conversation_id = ? AND cm.user_id != ?'
            );
            $stmt2->execute([$conv['id'], $userId]);
            $other = $stmt2->fetch();

            $conv['other_user'] = $other ? [
                'id' => (int)$other['id'],
                'username' => $other['username'],
                'nickname' => $other['nickname'],
                'avatar' => $other['avatar'],
            ] : null;
            $conv['display_name'] = $other ? ($other['nickname'] ?: $other['username']) : '已退出的用户';
            $conv['display_avatar'] = $other ? ($other['avatar'] ?: '/uploads/avatars/default.svg') : '/uploads/avatars/default.svg';
        } else {
            $conv['display_name'] = $conv['name'] ?: '群聊';
            $conv['display_avatar'] = $conv['avatar'] ?: '/uploads/avatars/default.svg';
            $conv['other_user'] = null;
        }
    }
    unset($conv);

    success(['list' => $list]);
}

/**
 * POST /conversations - 创建会话
 * Body (private): { "type": "private", "user_id": 123 }
 * Body (group):   { "type": "group", "name": "群名", "user_ids": [1,2,3] }
 */
function handleConversationsCreate(): void {
    assertMethod('POST');
    $userId = requireLogin();
    $data = getJsonBody();

    $type = $data['type'] ?? 'private';
    if (!in_array($type, ['private', 'group'], true)) {
        error('会话类型无效');
    }

    $pdo = getDB();

    if ($type === 'private') {
        $otherUserId = (int)($data['user_id'] ?? 0);
        if ($otherUserId <= 0) {
            error('请指定用户');
        }
        if ($otherUserId === $userId) {
            error('不能和自己私聊');
        }

        // 检查用户是否存在
        $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ?');
        $stmt->execute([$otherUserId]);
        if (!$stmt->fetch()) {
            error('用户不存在');
        }

        // 查找是否已存在私聊
        $stmt = $pdo->prepare(
            'SELECT c.id FROM conversations c
             WHERE c.type = "private"
             AND EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = ?)
             AND EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = ?)'
        );
        $stmt->execute([$userId, $otherUserId]);
        $existing = $stmt->fetch();

        if ($existing) {
            // 返回已有会话
            success(['id' => (int)$existing['id'], 'existing' => true]);
        }

        // 创建新会话
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO conversations (type, created_by, updated_at) VALUES ("private", ?, NOW())');
            $stmt->execute([$userId]);
            $convId = (int)$pdo->lastInsertId();

            $stmt = $pdo->prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)');
            $stmt->execute([$convId, $userId]);
            $stmt->execute([$convId, $otherUserId]);

            $pdo->commit();
            success(['id' => $convId, 'existing' => false]);
        } catch (Exception $e) {
            $pdo->rollBack();
            error('创建会话失败: ' . $e->getMessage(), 500);
        }
    } else {
        // 群聊
        $name = trim($data['name'] ?? '');
        if ($name === '') {
            error('请输入群聊名称');
        }

        $userIds = $data['user_ids'] ?? [];
        if (!is_array($userIds) || count($userIds) < 1) {
            error('请至少邀请一个成员');
        }

        // 去重，确保包含自己
        $userIds = array_unique(array_merge([$userId], array_map('intval', $userIds)));

        // 验证用户都存在
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $stmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM users WHERE id IN ($placeholders)");
        $stmt->execute($userIds);
        if ((int)$stmt->fetch()['cnt'] !== count($userIds)) {
            error('部分用户不存在');
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO conversations (type, name, created_by, updated_at) VALUES ("group", ?, ?, NOW())');
            $stmt->execute([$name, $userId]);
            $convId = (int)$pdo->lastInsertId();

            $stmt = $pdo->prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)');
            foreach ($userIds as $uid) {
                $stmt->execute([$convId, $uid]);
            }

            $pdo->commit();
            success(['id' => $convId, 'existing' => false]);
        } catch (Exception $e) {
            $pdo->rollBack();
            error('创建群聊失败: ' . $e->getMessage(), 500);
        }
    }
}

/**
 * GET /conversations/{id}/messages?since_id=0 - 获取消息
 */
function handleConversationMessages(int $convId): void {
    assertMethod('GET');
    $userId = requireLogin();

    // 验证是成员
    checkConversationMember($convId, $userId);

    $sinceId = max(0, (int)getParam('since_id', 0));

    $pdo = getDB();

    $stmt = $pdo->prepare(
        'SELECT m.id, m.user_id, m.content, m.created_at,
                u.nickname, u.username, u.avatar
         FROM messages m
         JOIN users u ON u.id = m.user_id
         WHERE m.conversation_id = ? AND m.id > ?
         ORDER BY m.id ASC
         LIMIT 50'
    );
    $stmt->execute([$convId, $sinceId]);
    $messages = $stmt->fetchAll();

    foreach ($messages as &$msg) {
        $msg['id'] = (int)$msg['id'];
        $msg['user_id'] = (int)$msg['user_id'];
    }
    unset($msg);

    success(['messages' => $messages]);
}

/**
 * POST /conversations/{id}/messages - 发送消息
 * Body: { "content": "..." }
 */
function handleConversationSend(int $convId): void {
    assertMethod('POST');
    $userId = requireLogin();

    // 验证是成员
    checkConversationMember($convId, $userId);

    $data = getJsonBody();
    $content = trim($data['content'] ?? '');
    if ($content === '') {
        error('消息不能为空');
    }
    if (mb_strlen($content) > 5000) {
        error('消息太长');
    }

    $pdo = getDB();

    $stmt = $pdo->prepare('INSERT INTO messages (conversation_id, user_id, content, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$convId, $userId, $content]);
    $msgId = (int)$pdo->lastInsertId();

    // 更新会话 updated_at
    $stmt = $pdo->prepare('UPDATE conversations SET updated_at = NOW() WHERE id = ?');
    $stmt->execute([$convId]);

    // 返回刚插入的消息
    $stmt = $pdo->prepare(
        'SELECT m.id, m.user_id, m.content, m.created_at,
                u.nickname, u.username, u.avatar
         FROM messages m
         JOIN users u ON u.id = m.user_id
         WHERE m.id = ?'
    );
    $stmt->execute([$msgId]);
    $msg = $stmt->fetch();
    $msg['id'] = (int)$msg['id'];
    $msg['user_id'] = (int)$msg['user_id'];

    success($msg);
}

/**
 * POST /conversations/{id}/read - 标记已读
 */
function handleConversationRead(int $convId): void {
    assertMethod('POST');
    $userId = requireLogin();

    checkConversationMember($convId, $userId);

    $pdo = getDB();
    $stmt = $pdo->prepare('UPDATE conversation_members SET last_read_at = NOW() WHERE conversation_id = ? AND user_id = ?');
    $stmt->execute([$convId, $userId]);

    success(null, '已读');
}

/**
 * GET /conversations/{id}/members - 获取会话成员列表
 */
function handleConversationMembers(int $convId): void {
    assertMethod('GET');
    $userId = requireLogin();

    checkConversationMember($convId, $userId);

    $pdo = getDB();
    $stmt = $pdo->prepare(
        'SELECT u.id, u.username, u.nickname, u.avatar
         FROM conversation_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.conversation_id = ?
         ORDER BY cm.user_id ASC'
    );
    $stmt->execute([$convId]);
    $members = $stmt->fetchAll();

    foreach ($members as &$m) {
        $m['id'] = (int)$m['id'];
    }
    unset($m);

    success(['members' => $members]);
}

/**
 * POST /conversations/{id}/members - 添加群成员
 * Body: { "user_ids": [1,2,3] }
 */
function handleConversationAddMember(int $convId): void {
    assertMethod('POST');
    $userId = requireLogin();

    // 验证是成员
    checkConversationMember($convId, $userId);

    $pdo = getDB();

    // 验证是群聊
    $stmt = $pdo->prepare('SELECT type FROM conversations WHERE id = ?');
    $stmt->execute([$convId]);
    $conv = $stmt->fetch();
    if (!$conv || $conv['type'] !== 'group') {
        error('只能向群聊添加成员', 400);
    }

    $data = getJsonBody();
    $newUserIds = $data['user_ids'] ?? [];
    if (!is_array($newUserIds) || count($newUserIds) < 1) {
        error('请至少指定一个用户');
    }

    $newUserIds = array_unique(array_map('intval', $newUserIds));

    // 验证用户都存在
    $placeholders = implode(',', array_fill(0, count($newUserIds), '?'));
    $stmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM users WHERE id IN ($placeholders)");
    $stmt->execute($newUserIds);
    if ((int)$stmt->fetch()['cnt'] !== count($newUserIds)) {
        error('部分用户不存在');
    }

    // 过滤已在群中的成员
    $stmt = $pdo->prepare('SELECT user_id FROM conversation_members WHERE conversation_id = ?');
    $stmt->execute([$convId]);
    $existingIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    $toAdd = array_diff($newUserIds, $existingIds);

    if (empty($toAdd)) {
        error('所选用户已在群中');
    }

    // 添加新成员
    $stmt = $pdo->prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)');
    foreach ($toAdd as $uid) {
        $stmt->execute([$convId, $uid]);
    }

    // 更新会话时间
    $stmt = $pdo->prepare('UPDATE conversations SET updated_at = NOW() WHERE id = ?');
    $stmt->execute([$convId]);

    success(['added' => array_values($toAdd)], '成员添加成功');
}

/**
 * GET /conversations/unread - 获取总未读消息数
 */
function handleConversationsUnread(): void {
    assertMethod('GET');
    $userId = requireLogin();

    $pdo = getDB();
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) AS cnt
         FROM conversation_members cm
         JOIN conversations c ON c.id = cm.conversation_id
         WHERE cm.user_id = ?
         AND EXISTS (
             SELECT 1 FROM messages m
             WHERE m.conversation_id = c.id
             AND m.id > IFNULL(cm.last_read_at, 0)
         )'
    );
    $stmt->execute([$userId]);
    $count = (int)$stmt->fetch()['cnt'];

    success(['unread_count' => $count]);
}

/**
 * 验证用户是否为会话成员
 */
function checkConversationMember(int $convId, int $userId): void {
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?');
    $stmt->execute([$convId, $userId]);
    if (!$stmt->fetch()) {
        error('你不是该会话的成员', 403);
    }
}
