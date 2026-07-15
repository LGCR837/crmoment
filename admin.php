<?php
/**
 * CRMoment - 简易管理面板
 *
 * 仅允许本站第一个注册的用户（username = lgcr837，user_id = 1）登录。
 * 功能：查看用户列表、动态列表、强行撤回任意动态。
 *
 * 访问方式：直接浏览器打开 /admin.php
 */

// 显示所有错误（调试用，生产环境可注释掉）
// error_reporting(E_ALL);
// ini_set('display_errors', 1);

session_start();

require_once __DIR__ . '/api_config.php';

// ---------- 强制注销 ----------
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: /admin.php');
    exit;
}

// ---------- 处理登录 ----------
$loginError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'login') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    // 只允许 username 为 lgcr837 的用户登录
    if ($username === '' || $password === '') {
        $loginError = '请输入用户名和密码';
    } elseif ($username !== 'lgcr837') {
        $loginError = '非管理员账户，拒绝登录';
    } else {
        try {
            $pdo  = getDB();
            $stmt = $pdo->prepare('SELECT id, username, nickname, password_hash FROM users WHERE username = ?');
            $stmt->execute([$username]);
            $user = $stmt->fetch();

            if (!$user || !password_verify($password, $user['password_hash'])) {
                $loginError = '用户名或密码错误';
            } elseif ((int)$user['id'] !== 1) {
                // 即使用户名是 lgcr837，也必须 user_id = 1 才是第一个用户
                $loginError = '非管理员账户，拒绝登录';
            } else {
                $_SESSION['admin_logged_in'] = true;
                $_SESSION['admin_user_id']   = (int)$user['id'];
                $_SESSION['admin_username']  = $user['username'];
                $_SESSION['admin_nickname']  = $user['nickname'];
            }
        } catch (PDOException $e) {
            $loginError = '数据库错误';
        }
    }
}

// ---------- 处理删除动态 ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete_post') {
    if (empty($_SESSION['admin_logged_in'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => '未登录']);
        exit;
    }
    $postId = (int)($_POST['post_id'] ?? 0);
    if ($postId <= 0) {
        echo json_encode(['ok' => false, 'error' => '参数错误']);
        exit;
    }

    try {
        $pdo  = getDB();

        // 获取动态信息（含图片、视频）
        $stmt = $pdo->prepare('SELECT id, images, videos FROM posts WHERE id = ?');
        $stmt->execute([$postId]);
        $post = $stmt->fetch();

        if (!$post) {
            echo json_encode(['ok' => false, 'error' => '动态不存在']);
            exit;
        }

        // 删除关联的图片文件
        if ($post['images']) {
            $images = json_decode($post['images'], true);
            if (is_array($images)) {
                foreach ($images as $img) {
                    $filePath = __DIR__ . '/' . ltrim($img, '/');
                    if (file_exists($filePath)) {
                        @unlink($filePath);
                    }
                }
            }
        }

        // 删除关联的视频文件
        if ($post['videos']) {
            $videos = json_decode($post['videos'], true);
            if (is_array($videos)) {
                foreach ($videos as $vid) {
                    $filePath = __DIR__ . '/' . ltrim($vid, '/');
                    if (file_exists($filePath)) {
                        @unlink($filePath);
                    }
                }
            }
        }

        // 删除动态（外键 CASCADE 会自动删除关联的评论、点赞、通知）
        $stmt = $pdo->prepare('DELETE FROM posts WHERE id = ?');
        $stmt->execute([$postId]);

        echo json_encode(['ok' => true, 'message' => '已强行撤回']);
        exit;
    } catch (PDOException $e) {
        echo json_encode(['ok' => false, 'error' => '数据库错误']);
        exit;
    }
}

// ---------- 处理置顶/取消置顶 ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && in_array($_POST['action'], ['pin_post', 'unpin_post'], true)) {
    if (empty($_SESSION['admin_logged_in'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => '未登录']);
        exit;
    }
    $postId = (int)($_POST['post_id'] ?? 0);
    if ($postId <= 0) {
        echo json_encode(['ok' => false, 'error' => '参数错误']);
        exit;
    }

    try {
        $pdo  = getDB();
        $isPinned = ($_POST['action'] === 'pin_post') ? 1 : 0;
        $stmt = $pdo->prepare('UPDATE posts SET is_pinned = ? WHERE id = ?');
        $stmt->execute([$isPinned, $postId]);

        if ($stmt->rowCount() === 0) {
            echo json_encode(['ok' => false, 'error' => '动态不存在']);
            exit;
        }

        $message = $isPinned ? '已置顶' : '已取消置顶';
        echo json_encode(['ok' => true, 'message' => $message]);
        exit;
    } catch (PDOException $e) {
        echo json_encode(['ok' => false, 'error' => '数据库错误']);
        exit;
    }
}

// ---------- 判断是否已登录 ----------
$loggedIn = !empty($_SESSION['admin_logged_in']);

// ---------- 已登录：获取数据 ----------
$users     = [];
$posts     = [];
$totalUsers = 0;
$totalPosts = 0;
$page      = 1;
$size      = 20;

if ($loggedIn) {
    try {
        $pdo = getDB();

        // 用户列表
        $stmt = $pdo->query('SELECT id, username, nickname, bio, avatar, created_at FROM users ORDER BY id ASC');
        $users = $stmt->fetchAll();
        foreach ($users as &$u) {
            $u['id'] = (int)$u['id'];
        }
        unset($u);
        $totalUsers = count($users);

        // 近两个月注册/发帖统计（用于图表）
        $dailyUsers = [];
        $dailyPosts = [];
        $stmt = $pdo->query(
            'SELECT DATE(created_at) AS day, COUNT(*) AS cnt FROM users
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
             GROUP BY day ORDER BY day ASC'
        );
        $dailyUsers = $stmt->fetchAll();
        $stmt = $pdo->query(
            'SELECT DATE(created_at) AS day, COUNT(*) AS cnt FROM posts
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
             GROUP BY day ORDER BY day ASC'
        );
        $dailyPosts = $stmt->fetchAll();
        // 补全缺失的天数为0
        $dailyUsersMap = [];
        foreach ($dailyUsers as $r) $dailyUsersMap[$r['day']] = (int)$r['cnt'];
        $dailyPostsMap = [];
        foreach ($dailyPosts as $r) $dailyPostsMap[$r['day']] = (int)$r['cnt'];
        $chartDays = [];
        for ($i = 59; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-$i days"));
            $chartDays[] = [
                'day'  => date('m-d', strtotime($d)),
                'users' => (int)($dailyUsersMap[$d] ?? 0),
                'posts' => (int)($dailyPostsMap[$d] ?? 0),
            ];
        }
        $maxUsers = max(array_column($chartDays, 'users')) ?: 1;
        $maxPosts = max(array_column($chartDays, 'posts')) ?: 1;

        // 动态列表（分页）
        $page = max(1, (int)($_GET['page'] ?? 1));
        $size = max(1, min(100, (int)($_GET['size'] ?? 20)));
        $offset = ($page - 1) * $size;

        $stmt = $pdo->query('SELECT COUNT(*) AS cnt FROM posts');
        $totalPosts = (int)$stmt->fetch()['cnt'];

        $stmt = $pdo->prepare(
            'SELECT p.id, p.content, p.images, p.videos, p.likes_count, p.comments_count, p.is_pinned, p.created_at,
                    u.id AS user_id, u.username, u.nickname
             FROM posts p
             JOIN users u ON p.user_id = u.id
             ORDER BY p.is_pinned DESC, p.created_at DESC
             LIMIT ? OFFSET ?'
        );
        $stmt->execute([$size, $offset]);
        $posts = $stmt->fetchAll();

        foreach ($posts as &$p) {
            $p['id']            = (int)$p['id'];
            $p['user_id']       = (int)$p['user_id'];
            $p['likes_count']   = (int)$p['likes_count'];
            $p['comments_count'] = (int)$p['comments_count'];
            $p['is_pinned']     = (bool)$p['is_pinned'];
            $p['images']        = $p['images'] ? json_decode($p['images'], true) : [];
            $p['videos']        = $p['videos'] ? json_decode($p['videos'], true) : [];
            // 计算视频文件总大小
            $videoSize = 0;
            foreach ($p['videos'] as $vid) {
                $fp = __DIR__ . '/' . ltrim($vid, '/');
                if (file_exists($fp)) {
                    $videoSize += filesize($fp);
                }
            }
            $p['video_size'] = $videoSize;
        }
        unset($p);

    } catch (PDOException $e) {
        $dbError = '数据库连接失败';
    }
}

$hasMore = ($page * $size) < $totalPosts;
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRMoment 管理面板</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f5f5f5; color: #333; }
a { color: #1a73e8; text-decoration: none; }
a:hover { text-decoration: underline; }

/* 登录页 */
.login-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.login-box { background: #fff; border-radius: 8px; padding: 32px; width: 360px; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
.login-box h1 { font-size: 22px; margin-bottom: 4px; }
.login-box p { color: #666; font-size: 13px; margin-bottom: 20px; }
.login-box label { display: block; font-size: 14px; margin-bottom: 4px; color: #555; }
.login-box input[type="text"],
.login-box input[type="password"] { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 14px; outline: none; }
.login-box input[type="text"]:focus,
.login-box input[type="password"]:focus { border-color: #1a73e8; }
.login-box button { width: 100%; padding: 10px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; font-size: 15px; cursor: pointer; }
.login-box button:hover { background: #1557b0; }
.login-error { color: #d93025; font-size: 13px; margin-bottom: 12px; }

/* 管理面板 */
.admin-header { background: #222; color: #fff; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
.admin-header h1 { font-size: 18px; }
.admin-header .admin-info { font-size: 13px; color: #aaa; }
.admin-header a { color: #ff6b6b; font-size: 13px; margin-left: 12px; }
.container { max-width: 1200px; margin: 0 auto; padding: 20px 16px; }

/* 统计图表 */
.chart-row { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
.chart-box { flex: 1; min-width: 260px; background: #fff; border-radius: 8px; padding: 18px 20px 14px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
.chart-box .chart-title { font-size: 13px; font-weight: 600; color: #555; margin-bottom: 10px; }
.chart-bars { display: flex; align-items: flex-end; gap: 3px; height: 80px; }
.chart-bar { flex: 1; min-width: 6px; border-radius: 3px 3px 0 0; position: relative; transition: height .2s; }
.chart-bar-user { background: linear-gradient(to top, #1a73e8, #4a9af5); }
.chart-bar-post { background: linear-gradient(to top, #e8710a, #f5a623); }
.chart-labels { display: flex; gap: 3px; margin-top: 4px; }
.chart-labels span { flex: 1; min-width: 6px; font-size: 8px; color: #999; text-align: center; overflow: hidden; }
.chart-empty { color: #bbb; font-size: 12px; padding: 20px 0; text-align: center; }

/* 统计卡片 */
.stats { display: flex; gap: 16px; margin-bottom: 24px; }
.stat-card { background: #fff; border-radius: 8px; padding: 20px 24px; flex: 1; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
.stat-card .num { font-size: 28px; font-weight: 700; color: #1a73e8; }
.stat-card .label { font-size: 13px; color: #888; margin-top: 4px; }

/* 区块标题 */
.section-title { font-size: 16px; font-weight: 600; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #1a73e8; display: flex; justify-content: space-between; align-items: center; }

/* 表格 */
.table-wrap { background: #fff; border-radius: 8px; overflow-x: auto; box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 20px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead th { background: #fafafa; padding: 10px 12px; text-align: left; font-weight: 600; color: #555; border-bottom: 1px solid #eee; white-space: nowrap; }
tbody td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
tbody tr:hover { background: #fafafa; }
tbody tr:last-child td { border-bottom: none; }
.col-id { width: 60px; color: #999; }
.col-small { white-space: nowrap; }
.text-muted { color: #999; font-size: 12px; }
.content-preview { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }

/* 头像占位 */
.avatar-placeholder { display: inline-block; width: 28px; height: 28px; border-radius: 50%; background: #1a73e8; color: #fff; text-align: center; line-height: 28px; font-size: 13px; font-weight: 600; vertical-align: middle; margin-right: 6px; }
.avatar-img { width: 28px; height: 28px; border-radius: 50%; vertical-align: middle; margin-right: 6px; object-fit: cover; }

/* 标签 */
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
.tag-admin { background: #e8f0fe; color: #1a73e8; }

/* 删除按钮 */
.btn { display: inline-block; padding: 6px 14px; border-radius: 5px; font-size: 12px; border: none; cursor: pointer; transition: background .15s; }
.btn-danger { background: #d93025; color: #fff; }
.btn-danger:hover { background: #b3261e; }
.btn-primary { background: #1a73e8; color: #fff; }
.btn-primary:hover { background: #1557b0; }
.btn-warning { background: #e8710a; color: #fff; }
.btn-warning:hover { background: #c86200; }
.btn-small { padding: 4px 10px; font-size: 11px; }

/* 分页 */
.pagination { display: flex; align-items: center; gap: 8px; padding: 12px 16px; font-size: 13px; }
.pagination a { padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; color: #333; font-size: 13px; }
.pagination a:hover { background: #f0f0f0; text-decoration: none; }
.pagination .current { padding: 6px 12px; color: #999; }

/* 提示消息 */
.toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 6px; color: #fff; font-size: 14px; z-index: 999; display: none; }
.toast-success { background: #188038; }
.toast-error { background: #d93025; }

/* 响应式 */
@media (max-width: 768px) {
    .stats { flex-direction: column; }
    .admin-header { flex-direction: column; gap: 6px; text-align: center; }
    .table-wrap { font-size: 12px; }
    .content-preview { max-width: 140px; }
}

/* 空状态 */
.empty-state { text-align: center; padding: 40px; color: #999; font-size: 14px; }
</style>
</head>
<body>

<?php if (!$loggedIn): ?>
<!--- ============ 登录页 ============ -->
<div class="login-page">
    <div class="login-box">
        <h1>🔐 管理面板</h1>
        <p>仅限管理员 (lgcr837) 登录</p>
        <?php if ($loginError): ?>
            <div class="login-error"><?= htmlspecialchars($loginError) ?></div>
        <?php endif; ?>
        <form method="post">
            <input type="hidden" name="action" value="login">
            <label for="username">用户名</label>
            <input type="text" id="username" name="username" placeholder="请输入管理员用户名" required autofocus>
            <label for="password">密码</label>
            <input type="password" id="password" name="password" placeholder="请输入密码" required>
            <button type="submit">登 录</button>
        </form>
    </div>
</div>

<?php else: ?>
<!--- ============ 管理面板 ============ -->
<div class="admin-header">
    <h1>📊 CRMoment 管理面板</h1>
    <div class="admin-info">
        <span><?= htmlspecialchars($_SESSION['admin_nickname'] ?: $_SESSION['admin_username']) ?></span>
        <a href="?logout=1">退出登录</a>
    </div>
</div>

<div class="container">
    <!-- 统计 -->
    <div class="stats">
        <div class="stat-card">
            <div class="num"><?= $totalUsers ?></div>
            <div class="label">注册用户</div>
        </div>
        <div class="stat-card">
            <div class="num"><?= $totalPosts ?></div>
            <div class="label">全部动态</div>
        </div>
    </div>

    <!-- 近14日趋势图 -->
    <div class="chart-row">
        <div class="chart-box">
            <div class="chart-title">📈 每日注册（近两个月）</div>
            <?php if (array_sum(array_column($chartDays, 'users')) === 0): ?>
                <div class="chart-empty">暂无数据</div>
            <?php else: ?>
            <div class="chart-bars">
                <?php $ci = 0; foreach ($chartDays as $d): ?>
                    <div class="chart-bar chart-bar-user" style="height:<?= max(4, round($d['users'] / $maxUsers * 76)) ?>px" title="<?= $d['day'] ?>: <?= $d['users'] ?> 人"></div>
                <?php $ci++; endforeach; ?>
            </div>
            <div class="chart-labels">
                <?php $ci = 0; foreach ($chartDays as $d): ?>
                    <span<?= ($ci % 5 === 0 || $ci === 59) ? '' : ' style="visibility:hidden"' ?> title="<?= $d['day'] ?>"><?= $d['day'] ?></span>
                <?php $ci++; endforeach; ?>
            </div>
            <?php endif; ?>
        </div>
        <div class="chart-box">
            <div class="chart-title">📝 每日发帖（近两个月）</div>
            <?php if (array_sum(array_column($chartDays, 'posts')) === 0): ?>
                <div class="chart-empty">暂无数据</div>
            <?php else: ?>
            <div class="chart-bars">
                <?php $ci = 0; foreach ($chartDays as $d): ?>
                    <div class="chart-bar chart-bar-post" style="height:<?= max(4, round($d['posts'] / $maxPosts * 76)) ?>px" title="<?= $d['day'] ?>: <?= $d['posts'] ?> 条"></div>
                <?php $ci++; endforeach; ?>
            </div>
            <div class="chart-labels">
                <?php $ci = 0; foreach ($chartDays as $d): ?>
                    <span<?= ($ci % 5 === 0 || $ci === 59) ? '' : ' style="visibility:hidden"' ?> title="<?= $d['day'] ?>"><?= $d['day'] ?></span>
                <?php $ci++; endforeach; ?>
            </div>
            <?php endif; ?>
        </div>
    </div>

    <?php if (isset($dbError)): ?>
        <div style="background:#fce8e6;color:#d93025;padding:12px 16px;border-radius:6px;margin-bottom:16px;"><?= htmlspecialchars($dbError) ?></div>
    <?php endif; ?>

    <!-- 用户列表 -->
    <div class="section-title">👤 用户列表（共 <?= $totalUsers ?> 人）</div>
    <div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th class="col-id">ID</th>
                    <th>头像</th>
                    <th>用户名</th>
                    <th>昵称</th>
                    <th>简介</th>
                    <th class="col-small">注册时间</th>
                    <th>身份</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($users)): ?>
                    <tr><td colspan="7" class="empty-state">暂无用户</td></tr>
                <?php else: ?>
                    <?php foreach ($users as $u): ?>
                    <tr>
                        <td class="col-id">#<?= $u['id'] ?></td>
                        <td>
                            <?php if ($u['avatar']): ?>
                                <img class="avatar-img" src="<?= htmlspecialchars($u['avatar']) ?>" alt="">
                            <?php else: ?>
                                <span class="avatar-placeholder"><?= htmlspecialchars(mb_substr($u['nickname'] ?: $u['username'], 0, 1)) ?></span>
                            <?php endif; ?>
                        </td>
                        <td><strong><?= htmlspecialchars($u['username']) ?></strong></td>
                        <td><?= htmlspecialchars($u['nickname'] ?: '-') ?></td>
                        <td class="text-muted"><?= htmlspecialchars(mb_substr($u['bio'] ?? '', 0, 50)) ?: '-' ?></td>
                        <td class="col-small text-muted"><span class="time-utc" data-utc="<?= htmlspecialchars($u['created_at']) ?>"><?= $u['created_at'] ?></span></td>
                        <td><?= $u['id'] === 1 ? '<span class="tag tag-admin">管理员</span>' : '' ?></td>
                    </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>

    <!-- 动态列表 -->
    <div class="section-title">
        <span>📝 动态列表（共 <?= $totalPosts ?> 条）</span>
        <span style="font-size:12px;font-weight:400;color:#999;">管理员可强行撤回任意动态</span>
    </div>
    <div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th class="col-id">ID</th>
                    <th>作者</th>
                    <th>内容</th>
                    <th>媒体</th>
                    <th class="col-small">👍 点赞</th>
                    <th class="col-small">💬 评论</th>
                    <th class="col-small">置顶</th>
                    <th class="col-small">时间</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($posts)): ?>
                    <tr><td colspan="9" class="empty-state">暂无动态</td></tr>
                <?php else: ?>
                    <?php foreach ($posts as $p): ?>
                    <?php
                        $imgCount = count($p['images']);
                        $vidCount = count($p['videos']);
                        $vidSizeStr = '';
                        if ($p['video_size'] > 0) {
                            $s = $p['video_size'];
                            $vidSizeStr = $s >= 1048576 ? round($s / 1048576, 1) . 'MB' : round($s / 1024, 1) . 'KB';
                        }
                        $mediaParts = [];
                        if ($imgCount > 0) $mediaParts[] = "{$imgCount}张图";
                        if ($vidCount > 0) $mediaParts[] = "🎬 {$vidSizeStr}";
                        $mediaStr = $mediaParts ? implode(' / ', $mediaParts) : '-';
                        $idDisplay = $p['is_pinned'] ? '#TOP' . $p['id'] : '#' . $p['id'];
                        $pinBtnText = $p['is_pinned'] ? '取消置顶' : '置顶';
                        $pinBtnAction = $p['is_pinned'] ? 'unpin_post' : 'pin_post';
                    ?>
                    <tr>
                        <td class="col-id"><?= $idDisplay ?></td>
                        <td class="col-small">
                            <span class="avatar-placeholder" style="width:24px;height:24px;line-height:24px;font-size:11px;"><?= htmlspecialchars(mb_substr($p['nickname'] ?: $p['username'], 0, 1)) ?></span>
                            <?= htmlspecialchars($p['nickname'] ?: $p['username']) ?>
                        </td>
                        <td><span class="content-preview"><?= htmlspecialchars(mb_substr($p['content'], 0, 120)) ?></span></td>
                        <td class="col-small text-muted"><?= $mediaStr ?></td>
                        <td class="col-small"><?= $p['likes_count'] ?></td>
                        <td class="col-small"><?= $p['comments_count'] ?></td>
                        <td class="col-small"><?= $p['is_pinned'] ? '📌' : '-' ?></td>
                        <td class="col-small text-muted"><span class="time-utc" data-utc="<?= htmlspecialchars($p['created_at']) ?>"><?= $p['created_at'] ?></span></td>
                        <td style="display:flex;gap:4px;flex-wrap:wrap;">
                            <button class="btn btn-small <?= $p['is_pinned'] ? 'btn-warning' : 'btn-primary' ?>" onclick="togglePin(<?= $p['id'] ?>, '<?= $pinBtnAction ?>', this)"><?= $pinBtnText ?></button>
                            <button class="btn btn-danger btn-small" onclick="deletePost(<?= $p['id'] ?>, this)">撤回</button>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
            <?php if ($totalPosts > $size): ?>
            <tfoot>
                <tr>
                    <td colspan="9">
                        <div class="pagination">
                            <?php if ($page > 1): ?>
                                <a href="?page=<?= $page - 1 ?>&size=<?= $size ?>">← 上一页</a>
                            <?php endif; ?>
                            <span class="current">第 <?= $page ?> / <?= max(1, (int)ceil($totalPosts / $size)) ?> 页（共 <?= $totalPosts ?> 条）</span>
                            <?php if ($hasMore): ?>
                                <a href="?page=<?= $page + 1 ?>&size=<?= $size ?>">下一页 →</a>
                            <?php endif; ?>
                        </div>
                    </td>
                </tr>
            </tfoot>
            <?php endif; ?>
        </table>
    </div>
</div>

<!-- 提示消息 -->
<div id="toast" class="toast"></div>

<script>
function deletePost(postId, btn) {
    if (!confirm('确定要强行撤回动态 #' + postId + ' 吗？此操作不可撤销！')) {
        return;
    }
    btn.disabled = true;
    btn.textContent = '处理中...';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onload = function() {
        try {
            var res = JSON.parse(xhr.responseText);
            if (res.ok) {
                showToast('已成功撤回动态 #' + postId, 'success');
                // 移除该行
                var tr = btn.closest('tr');
                if (tr) tr.remove();
            } else {
                showToast('撤回失败：' + (res.error || '未知错误'), 'error');
                btn.disabled = false;
                btn.textContent = '撤回';
            }
        } catch(e) {
            showToast('服务器响应异常', 'error');
            btn.disabled = false;
            btn.textContent = '撤回';
        }
    };
    xhr.onerror = function() {
        showToast('网络错误', 'error');
        btn.disabled = false;
        btn.textContent = '撤回';
    };
    xhr.send('action=delete_post&post_id=' + postId);
}

function togglePin(postId, action, btn) {
    btn.disabled = true;
    var originalText = btn.textContent;
    btn.textContent = '处理中...';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onload = function() {
        try {
            var res = JSON.parse(xhr.responseText);
            if (res.ok) {
                showToast(res.message, 'success');
                // 刷新页面以反映排序变化
                location.reload();
            } else {
                showToast('操作失败：' + (res.error || '未知错误'), 'error');
                btn.disabled = false;
                btn.textContent = originalText;
            }
        } catch(e) {
            showToast('服务器响应异常', 'error');
            btn.disabled = false;
            btn.textContent = originalText;
        }
    };
    xhr.onerror = function() {
        showToast('网络错误', 'error');
        btn.disabled = false;
        btn.textContent = originalText;
    };
    xhr.send('action=' + action + '&post_id=' + postId);
}

function showToast(msg, type) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast toast-' + type;
    toast.style.display = 'block';
    setTimeout(function() {
        toast.style.display = 'none';
    }, 3000);
}

// ========== 时间转换：UTC → 本地时区 ==========
(function() {
    document.querySelectorAll('.time-utc').forEach(function(el) {
        var utcStr = el.getAttribute('data-utc');
        if (!utcStr) return;
        var d = new Date(utcStr.replace(' ', 'T') + 'Z');
        if (isNaN(d.getTime())) return;
        el.textContent = d.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    });
})();
</script>

<?php endif; ?>
</body>
</html>
