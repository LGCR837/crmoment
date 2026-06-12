<?php
/**
 * CRMoment - 音乐广场处理器
 */

/**
 * GET /music?page=1&size=20
 * 获取音乐列表
 */
function handleMusicList(): void {
    assertMethod('GET');

    $page = max(1, (int)getParam('page', 1));
    $size = max(1, min(50, (int)getParam('size', PAGE_SIZE)));
    $offset = ($page - 1) * $size;
    $q     = trim(getParam('q', ''));

    $pdo = getDB();

    if ($q !== '') {
        $like = '%' . $q . '%';
        // 获取总数
        $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM music WHERE title LIKE ?');
        $stmt->execute([$like]);
        $total = (int)$stmt->fetch()['cnt'];

        // 获取列表（含作者信息）
        $stmt = $pdo->prepare(
            'SELECT m.id, m.title, m.music_url, m.lrc_url, m.bg_url, m.lrc_pos, m.lrc_color, m.plays_count, m.created_at,
                    u.id AS user_id, u.username, u.nickname, u.avatar
             FROM music m
             JOIN users u ON m.user_id = u.id
             WHERE m.title LIKE ?
             ORDER BY m.created_at DESC
             LIMIT ? OFFSET ?'
        );
        $stmt->execute([$like, $size, $offset]);
    } else {
        // 获取总数
        $stmt = $pdo->query('SELECT COUNT(*) AS cnt FROM music');
        $total = (int)$stmt->fetch()['cnt'];

        // 获取列表（含作者信息）
        $stmt = $pdo->prepare(
            'SELECT m.id, m.title, m.music_url, m.lrc_url, m.bg_url, m.lrc_pos, m.lrc_color, m.plays_count, m.created_at,
                    u.id AS user_id, u.username, u.nickname, u.avatar
             FROM music m
             JOIN users u ON m.user_id = u.id
             ORDER BY m.created_at DESC
             LIMIT ? OFFSET ?'
        );
        $stmt->execute([$size, $offset]);
    }
    $list = $stmt->fetchAll();

    // 格式化
    foreach ($list as &$item) {
        $item['id']          = (int)$item['id'];
        $item['user_id']     = (int)$item['user_id'];
        $item['plays_count'] = (int)$item['plays_count'];
    }
    unset($item);

    success([
        'list'     => $list,
        'total'    => $total,
        'page'     => $page,
        'size'     => $size,
        'has_more' => ($page * $size) < $total,
    ]);
}

/**
 * POST /music
 * Body: { "title": "...", "music_url": "...", "lrc_url": "...", "bg_url": "..." }
 * 添加音乐
 */
function handleMusicCreate(): void {
    $userId = requireLogin();

    $body = getJsonBody();

    $title    = trim($body['title'] ?? '');
    $musicUrl = trim($body['music_url'] ?? '');
    $lrcUrl   = trim($body['lrc_url'] ?? '');
    $bgUrl    = trim($body['bg_url'] ?? '');
    $lrcPos   = trim($body['lrc_pos'] ?? 'center');
    $lrcColor = trim($body['lrc_color'] ?? 'light');
    if (!in_array($lrcPos, ['left', 'center', 'right'], true)) $lrcPos = 'center';
    if (!in_array($lrcColor, ['light', 'dark'], true)) $lrcColor = 'light';

    if ($title === '') {
        error('音乐名称不能为空');
    }
    if ($musicUrl === '') {
        error('音频链接不能为空');
    }
    if ($lrcUrl === '') {
        error('歌词文件链接不能为空');
    }

    // 简单验证 URL 格式（仅对非空值验证）
    if (!filter_var($musicUrl, FILTER_VALIDATE_URL)) {
        error('音频链接格式不正确');
    }
    if (!filter_var($lrcUrl, FILTER_VALIDATE_URL)) {
        error('歌词文件链接格式不正确');
    }
    if ($bgUrl !== '' && !filter_var($bgUrl, FILTER_VALIDATE_URL)) {
        error('背景图片链接格式不正确');
    }

    $pdo = getDB();
    $stmt = $pdo->prepare(
        'INSERT INTO music (user_id, title, music_url, lrc_url, bg_url, lrc_pos, lrc_color, plays_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())'
    );
    $stmt->execute([$userId, $title, $musicUrl, $lrcUrl, $bgUrl ?: null, $lrcPos, $lrcColor]);
    $musicId = (int)$pdo->lastInsertId();

    success([
        'id'    => $musicId,
        'title' => $title,
    ], '添加成功');
}

/**
 * POST /music/{id}/play
 * 增加播放量
 */
function handleMusicPlay(int $id): void {
    assertMethod('POST');

    $pdo = getDB();
    $stmt = $pdo->prepare('UPDATE music SET plays_count = plays_count + 1 WHERE id = ?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        error('音乐不存在', 404);
    }

    success(null, 'ok');
}

/**
 * PUT /music/{id}
 * Body: { "title": "...", "music_url": "...", "lrc_url": "...", "bg_url": "...", "lrc_pos": "..." }
 * 修改音乐（仅创建者可操作）
 */
function handleMusicUpdate(int $id): void {
    $userId = requireLogin();

    $body = getJsonBody();

    $title    = trim($body['title'] ?? '');
    $musicUrl = trim($body['music_url'] ?? '');
    $lrcUrl   = trim($body['lrc_url'] ?? '');
    $bgUrl    = trim($body['bg_url'] ?? '');
    $lrcPos   = trim($body['lrc_pos'] ?? 'center');
    $lrcColor = trim($body['lrc_color'] ?? 'light');
    if (!in_array($lrcPos, ['left', 'center', 'right'], true)) $lrcPos = 'center';
    if (!in_array($lrcColor, ['light', 'dark'], true)) $lrcColor = 'light';

    if ($title === '') {
        error('音乐名称不能为空');
    }
    if ($musicUrl === '') {
        error('音频链接不能为空');
    }
    if ($lrcUrl === '') {
        error('歌词文件链接不能为空');
    }

    if (!filter_var($musicUrl, FILTER_VALIDATE_URL)) {
        error('音频链接格式不正确');
    }
    if (!filter_var($lrcUrl, FILTER_VALIDATE_URL)) {
        error('歌词文件链接格式不正确');
    }
    if ($bgUrl !== '' && !filter_var($bgUrl, FILTER_VALIDATE_URL)) {
        error('背景图片链接格式不正确');
    }

    $pdo = getDB();

    // 检查所有权
    $stmt = $pdo->prepare('SELECT user_id FROM music WHERE id = ?');
    $stmt->execute([$id]);
    $music = $stmt->fetch();
    if (!$music) {
        error('音乐不存在', 404);
    }
    if ((int)$music['user_id'] !== $userId) {
        error('无权修改此音乐', 403);
    }

    $stmt = $pdo->prepare(
        'UPDATE music SET title = ?, music_url = ?, lrc_url = ?, bg_url = ?, lrc_pos = ?, lrc_color = ? WHERE id = ?'
    );
    $stmt->execute([$title, $musicUrl, $lrcUrl, $bgUrl ?: null, $lrcPos, $lrcColor, $id]);

    success([
        'id'    => $id,
        'title' => $title,
    ], '修改成功');
}

/**
 * DELETE /music/{id}
 * 删除音乐（仅创建者可操作）
 */
function handleMusicDelete(int $id): void {
    $userId = requireLogin();

    $pdo = getDB();

    $stmt = $pdo->prepare('SELECT user_id FROM music WHERE id = ?');
    $stmt->execute([$id]);
    $music = $stmt->fetch();
    if (!$music) {
        error('音乐不存在', 404);
    }
    if ((int)$music['user_id'] !== $userId) {
        error('无权删除此音乐', 403);
    }

    $stmt = $pdo->prepare('DELETE FROM music WHERE id = ?');
    $stmt->execute([$id]);

    success(null, '删除成功');
}
