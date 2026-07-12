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
            'SELECT m.id, m.title, m.music_url, m.lrc_url, m.bg_url, m.video_url, m.lrc_pos, m.lrc_color, m.plays_count, m.created_at,
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
            'SELECT m.id, m.title, m.music_url, m.lrc_url, m.bg_url, m.video_url, m.lrc_pos, m.lrc_color, m.plays_count, m.created_at,
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
    $videoUrl = trim($body['video_url'] ?? '');
    $lrcPos   = trim($body['lrc_pos'] ?? 'center');
    $lrcColor = trim($body['lrc_color'] ?? 'light');
    if (!in_array($lrcPos, ['left', 'center', 'right', 'none'], true)) $lrcPos = 'center';
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
        'INSERT INTO music (user_id, title, music_url, lrc_url, bg_url, video_url, lrc_pos, lrc_color, plays_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())'
    );
    $stmt->execute([$userId, $title, $musicUrl, $lrcUrl, $bgUrl ?: null, $videoUrl ?: null, $lrcPos, $lrcColor]);
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
    $videoUrl = trim($body['video_url'] ?? '');
    $lrcPos   = trim($body['lrc_pos'] ?? 'center');
    $lrcColor = trim($body['lrc_color'] ?? 'light');
    if (!in_array($lrcPos, ['left', 'center', 'right', 'none'], true)) $lrcPos = 'center';
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
        'UPDATE music SET title = ?, music_url = ?, lrc_url = ?, bg_url = ?, video_url = ?, lrc_pos = ?, lrc_color = ? WHERE id = ?'
    );
    $stmt->execute([$title, $musicUrl, $lrcUrl, $bgUrl ?: null, $videoUrl ?: null, $lrcPos, $lrcColor, $id]);

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

// ========== 用户自定义歌单 ==========

/**
 * GET /music/playlists
 * 获取当前用户的歌单列表
 */
function handleUserPlaylistsList(): void {
    $userId = requireLogin();
    $pdo = getDB();

    $stmt = $pdo->prepare(
        'SELECT p.id, p.name, p.cover, p.created_at, p.updated_at,
                COUNT(pt.id) AS track_count
         FROM user_playlists p
         LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
         WHERE p.user_id = ?
         GROUP BY p.id
         ORDER BY p.created_at DESC'
    );
    $stmt->execute([$userId]);
    $list = $stmt->fetchAll();

    foreach ($list as &$item) {
        $item['id'] = (int)$item['id'];
        $item['track_count'] = (int)$item['track_count'];
    }
    unset($item);

    success(['list' => $list]);
}

/**
 * POST /music/playlists
 * 创建新歌单
 * Body: { "name": "我的歌单" }
 */
function handleUserPlaylistCreate(): void {
    $userId = requireLogin();
    $body = getJsonBody();
    $name = trim($body['name'] ?? '');

    if ($name === '') {
        error('歌单名称不能为空');
    }
    if (mb_strlen($name) > 100) {
        error('歌单名称不能超过100个字符');
    }

    $pdo = getDB();
    $stmt = $pdo->prepare(
        'INSERT INTO user_playlists (user_id, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())'
    );
    $stmt->execute([$userId, $name]);
    $id = (int)$pdo->lastInsertId();

    success(['id' => $id, 'name' => $name], '创建成功');
}

/**
 * GET /music/playlists/{id}
 * 获取歌单详情及歌曲列表
 */
function handleUserPlaylistShow(int $id): void {
    $userId = requireLogin();
    $pdo = getDB();

    $stmt = $pdo->prepare('SELECT id, name, cover, created_at, updated_at FROM user_playlists WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    $playlist = $stmt->fetch();
    if (!$playlist) {
        error('歌单不存在', 404);
    }

    $stmt = $pdo->prepare(
        'SELECT id, crmid, source, track_id, name, artist, album, sort_order, added_at
         FROM playlist_tracks WHERE playlist_id = ? ORDER BY sort_order ASC, added_at ASC'
    );
    $stmt->execute([$id]);
    $tracks = $stmt->fetchAll();

    foreach ($tracks as &$t) {
        $t['id'] = (int)$t['id'];
        $t['sort_order'] = (int)$t['sort_order'];
    }
    unset($t);

    $playlist['id'] = (int)$playlist['id'];
    $playlist['tracks'] = $tracks;

    success($playlist);
}

/**
 * PUT /music/playlists/{id}
 * 修改歌单名称
 * Body: { "name": "新名称" }
 */
function handleUserPlaylistUpdate(int $id): void {
    $userId = requireLogin();
    $body = getJsonBody();
    $name = trim($body['name'] ?? '');

    if ($name === '') {
        error('歌单名称不能为空');
    }
    if (mb_strlen($name) > 100) {
        error('歌单名称不能超过100个字符');
    }

    $pdo = getDB();
    $stmt = $pdo->prepare('UPDATE user_playlists SET name = ?, updated_at = NOW() WHERE id = ? AND user_id = ?');
    $stmt->execute([$name, $id, $userId]);
    if ($stmt->rowCount() === 0) {
        error('歌单不存在', 404);
    }

    success(['id' => $id, 'name' => $name], '修改成功');
}

/**
 * DELETE /music/playlists/{id}
 * 删除歌单
 */
function handleUserPlaylistDelete(int $id): void {
    $userId = requireLogin();
    $pdo = getDB();

    $stmt = $pdo->prepare('DELETE FROM user_playlists WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    if ($stmt->rowCount() === 0) {
        error('歌单不存在', 404);
    }

    success(null, '删除成功');
}

/**
 * POST /music/playlists/{id}/tracks
 * 添加歌曲到歌单
 * Body: { "crmid": "N123456", "source": "netease", "track_id": "123456", "name": "歌名", "artist": "歌手", "album": "专辑" }
 */
function handleUserPlaylistAddTrack(int $id): void {
    $userId = requireLogin();
    $body = getJsonBody();

    $crmid = trim($body['crmid'] ?? '');
    $source = trim($body['source'] ?? '');
    $trackId = trim($body['track_id'] ?? '');
    $name = trim($body['name'] ?? '');
    $artist = trim($body['artist'] ?? '');
    $album = trim($body['album'] ?? '');

    if ($crmid === '' || $source === '' || $trackId === '' || $name === '') {
        error('缺少必要的歌曲信息');
    }
    if (!in_array($source, ['netease', 'kugou', 'tencent'], true)) {
        error('无效的音乐来源');
    }

    $pdo = getDB();

    // 验证歌单所有权
    $stmt = $pdo->prepare('SELECT id FROM user_playlists WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    if (!$stmt->fetch()) {
        error('歌单不存在', 404);
    }

    // 获取当前最大排序值
    $stmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM playlist_tracks WHERE playlist_id = ?');
    $stmt->execute([$id]);
    $nextOrder = (int)$stmt->fetch()['next_order'];

    // 插入（重复时忽略）
    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO playlist_tracks (playlist_id, crmid, source, track_id, name, artist, album, sort_order, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())'
    );
    $stmt->execute([$id, $crmid, $source, $trackId, $name, $artist ?: null, $album ?: null, $nextOrder]);

    if ($stmt->rowCount() === 0) {
        error('该歌曲已在歌单中');
    }

    success(null, '添加成功');
}

/**
 * DELETE /music/playlists/{id}/tracks?crmid=N123456
 * 从歌单移除歌曲
 */
function handleUserPlaylistRemoveTrack(int $id): void {
    $userId = requireLogin();
    $crmid = trim(getParam('crmid', ''));

    if ($crmid === '') {
        error('缺少 crmid 参数');
    }

    $pdo = getDB();

    // 验证歌单所有权
    $stmt = $pdo->prepare('SELECT id FROM user_playlists WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    if (!$stmt->fetch()) {
        error('歌单不存在', 404);
    }

    $stmt = $pdo->prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND crmid = ?');
    $stmt->execute([$id, $crmid]);

    if ($stmt->rowCount() === 0) {
        error('歌曲不在歌单中');
    }

    success(null, '已移除');
}

/**
 * PUT /music/playlists/{id}/tracks/sort
 * 更新歌单歌曲排序
 * Body: { "orders": [{"id": 1, "sort_order": 0}, {"id": 2, "sort_order": 1}] }
 */
function handleUserPlaylistSortTracks(int $id): void {
    $userId = requireLogin();
    $body = getJsonBody();
    $orders = $body['orders'] ?? [];

    if (!is_array($orders) || empty($orders)) {
        error('缺少排序数据');
    }

    $pdo = getDB();

    // 验证歌单所有权
    $stmt = $pdo->prepare('SELECT id FROM user_playlists WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    if (!$stmt->fetch()) {
        error('歌单不存在', 404);
    }

    $stmt = $pdo->prepare('UPDATE playlist_tracks SET sort_order = ? WHERE id = ? AND playlist_id = ?');
    foreach ($orders as $item) {
        $trackId = (int)($item['id'] ?? 0);
        $sortOrder = (int)($item['sort_order'] ?? 0);
        if ($trackId > 0) {
            $stmt->execute([$sortOrder, $trackId, $id]);
        }
    }

    success(null, '排序已更新');
}
