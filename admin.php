<?php
/**
 * CRMoment - 管理面板（BA 风格）
 *
 * 仅允许本站第一个注册的用户（username = lgcr837，user_id = 1）登录。
 * 功能：数据看板 / 用户管理（搜索、封禁、删除）/ 动态管理（置顶、撤回）
 *       / 音乐管理 / 评论管理 / 邮件发送 / 系统信息
 *
 * 访问方式：直接浏览器打开 /admin.php
 */

session_start();

require_once __DIR__ . '/api_config.php';
require_once __DIR__ . '/api_email.php';

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

// ---------- 通用：JSON 响应 ----------
function adminJson(array $data): void {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function requireAdmin(): void {
    if (empty($_SESSION['admin_logged_in'])) {
        adminJson(['ok' => false, 'error' => '未登录']);
    }
}

// ---------- 处理删除动态 ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete_post') {
    requireAdmin();
    $postId = (int)($_POST['post_id'] ?? 0);
    if ($postId <= 0) {
        adminJson(['ok' => false, 'error' => '参数错误']);
    }

    try {
        $pdo  = getDB();
        $stmt = $pdo->prepare('SELECT id, images, videos FROM posts WHERE id = ?');
        $stmt->execute([$postId]);
        $post = $stmt->fetch();

        if (!$post) {
            adminJson(['ok' => false, 'error' => '动态不存在']);
        }

        // 删除关联的图片/视频文件
        foreach (['images', 'videos'] as $field) {
            if ($post[$field]) {
                $files = json_decode($post[$field], true);
                if (is_array($files)) {
                    foreach ($files as $f) {
                        $filePath = __DIR__ . '/' . ltrim($f, '/');
                        if (file_exists($filePath)) {
                            @unlink($filePath);
                        }
                    }
                }
            }
        }

        // 删除动态（外键 CASCADE 自动删除评论、点赞、通知）
        $pdo->prepare('DELETE FROM posts WHERE id = ?')->execute([$postId]);

        adminJson(['ok' => true, 'message' => '已强行撤回']);
    } catch (PDOException $e) {
        adminJson(['ok' => false, 'error' => '数据库错误']);
    }
}

// ---------- 处理置顶/取消置顶 ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && in_array($_POST['action'], ['pin_post', 'unpin_post'], true)) {
    requireAdmin();
    $postId = (int)($_POST['post_id'] ?? 0);
    if ($postId <= 0) {
        adminJson(['ok' => false, 'error' => '参数错误']);
    }

    try {
        $pdo     = getDB();
        $isPinned = ($_POST['action'] === 'pin_post') ? 1 : 0;
        $stmt     = $pdo->prepare('UPDATE posts SET is_pinned = ? WHERE id = ?');
        $stmt->execute([$isPinned, $postId]);

        if ($stmt->rowCount() === 0) {
            adminJson(['ok' => false, 'error' => '动态不存在']);
        }

        adminJson(['ok' => true, 'message' => $isPinned ? '已置顶' : '已取消置顶']);
    } catch (PDOException $e) {
        adminJson(['ok' => false, 'error' => '数据库错误']);
    }
}

// ---------- 处理删除评论 ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete_comment') {
    requireAdmin();
    $commentId = (int)($_POST['comment_id'] ?? 0);
    if ($commentId <= 0) {
        adminJson(['ok' => false, 'error' => '参数错误']);
    }

    try {
        $pdo  = getDB();
        $stmt = $pdo->prepare('SELECT post_id FROM comments WHERE id = ?');
        $stmt->execute([$commentId]);
        $comment = $stmt->fetch();

        if (!$comment) {
            adminJson(['ok' => false, 'error' => '评论不存在']);
        }

        $pdo->prepare('DELETE FROM comments WHERE id = ?')->execute([$commentId]);

        // 更新动态评论数
        $pdo->prepare('UPDATE posts SET comments_count = (SELECT COUNT(*) FROM comments WHERE post_id = ?) WHERE id = ?')
            ->execute([$comment['post_id'], $comment['post_id']]);

        adminJson(['ok' => true, 'message' => '评论已删除']);
    } catch (PDOException $e) {
        adminJson(['ok' => false, 'error' => '数据库错误']);
    }
}

// ---------- 处理删除音乐 ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete_music') {
    requireAdmin();
    $musicId = (int)($_POST['music_id'] ?? 0);
    if ($musicId <= 0) {
        adminJson(['ok' => false, 'error' => '参数错误']);
    }

    try {
        $pdo = getDB();
        $stmt = $pdo->prepare('DELETE FROM music WHERE id = ?');
        $stmt->execute([$musicId]);

        if ($stmt->rowCount() === 0) {
            adminJson(['ok' => false, 'error' => '音乐不存在']);
        }

        adminJson(['ok' => true, 'message' => '音乐已删除']);
    } catch (PDOException $e) {
        adminJson(['ok' => false, 'error' => '数据库错误']);
    }
}

// ---------- 处理删除用户 ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete_user') {
    requireAdmin();
    $userId = (int)($_POST['user_id'] ?? 0);
    if ($userId <= 0) {
        adminJson(['ok' => false, 'error' => '参数错误']);
    }
    if ($userId === 1) {
        adminJson(['ok' => false, 'error' => '不能删除管理员账户']);
    }

    try {
        $pdo  = getDB();
        $stmt = $pdo->prepare('SELECT avatar FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            adminJson(['ok' => false, 'error' => '用户不存在']);
        }

        // 删除头像文件
        if ($user['avatar']) {
            $avatarPath = __DIR__ . '/' . ltrim(parse_url($user['avatar'], PHP_URL_PATH), '/');
            if ($avatarPath && file_exists($avatarPath)) {
                @unlink($avatarPath);
            }
        }

        // 删除该用户的动态及文件
        $stmt = $pdo->prepare('SELECT id, images, videos FROM posts WHERE user_id = ?');
        $stmt->execute([$userId]);
        foreach ($stmt->fetchAll() as $post) {
            foreach (['images', 'videos'] as $field) {
                if ($post[$field]) {
                    $files = json_decode($post[$field], true);
                    if (is_array($files)) {
                        foreach ($files as $f) {
                            $filePath = __DIR__ . '/' . ltrim($f, '/');
                            if (file_exists($filePath)) {
                                @unlink($filePath);
                            }
                        }
                    }
                }
            }
        }

        // CASCADE 删除用户及其所有关联数据
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);

        adminJson(['ok' => true, 'message' => '用户及其全部内容已删除']);
    } catch (PDOException $e) {
        adminJson(['ok' => false, 'error' => '数据库错误']);
    }
}

// ---------- 处理邮件发送 ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'send_email') {
    requireAdmin();

    $fromName    = trim($_POST['from_name'] ?? '');
    $emailPrefix = trim($_POST['email_prefix'] ?? '');
    $subject     = trim($_POST['subject'] ?? '');
    $content     = trim($_POST['content'] ?? '');
    $target      = trim($_POST['target'] ?? '');

    if (!$fromName || !$emailPrefix || !$subject || !$content || !$target) {
        adminJson(['ok' => false, 'error' => '请填写所有必填字段']);
    }

    try {
        $pdo = getDB();

        $recipients = [];
        if ($target === 'all') {
            $stmt = $pdo->query("SELECT email FROM users WHERE email IS NOT NULL AND email_verified = 1");
            foreach ($stmt->fetchAll() as $row) {
                $recipients[] = $row['email'];
            }
            if (empty($recipients)) {
                adminJson(['ok' => false, 'error' => '暂无已绑定邮箱的用户']);
            }
        } else {
            $emails = explode(',', $target);
            foreach ($emails as $e) {
                $e = trim($e);
                if (!filter_var($e, FILTER_VALIDATE_EMAIL)) {
                    adminJson(['ok' => false, 'error' => "邮箱格式无效: $e"]);
                }
                $recipients[] = $e;
            }
        }

        $fromEmail = $emailPrefix . '@mail.crweb.ccwu.cc';

        $successCount = 0;
        $failCount    = 0;
        $errors       = [];

        foreach (array_chunk($recipients, 50) as $batch) {
            $result = sendMail(implode(',', $batch), $subject, $content, $fromName, $fromEmail);
            if ($result['success']) {
                $successCount += count($batch);
            } else {
                $failCount += count($batch);
                $errors[] = $result['message'];
            }
        }

        $message = "发送完成：成功 $successCount 人";
        if ($failCount > 0) {
            $message .= "，失败 $failCount 人（错误: " . implode('; ', array_unique($errors)) . "）";
        }

        adminJson(['ok' => true, 'message' => $message]);
    } catch (PDOException $e) {
        adminJson(['ok' => false, 'error' => '数据库错误: ' . $e->getMessage()]);
    } catch (Throwable $e) {
        adminJson(['ok' => false, 'error' => '服务器错误: ' . $e->getMessage()]);
    }
}

// ---------- 判断是否已登录 ----------
$loggedIn = !empty($_SESSION['admin_logged_in']);

// 公开看板：未登录时可通过 ?public=1 查看数据看板（其余页面仍要求管理员登录）
$publicView = !$loggedIn && (($_GET['public'] ?? '') === '1');

// ---------- 获取数据（看板数据公开，列表数据仅管理员）----------
$users       = [];
$posts       = [];
$musicList   = [];
$comments    = [];
$totalUsers  = 0;
$totalPosts  = 0;
$totalMusic  = 0;
$totalComments = 0;
$totalLikes  = 0;
$totalMessages = 0;
$todayUsers  = 0;
$todayPosts  = 0;
$page        = 1;
$size        = 20;
$keyword     = '';
$trend       = ['users' => [], 'posts' => [], 'comments' => [], 'likes' => []];
$topPosters  = [];
$topPosts    = [];
$mediaDist   = ['text_only' => 0, 'img_only' => 0, 'vid_only' => 0, 'both_m' => 0];
$sysInfo     = [
    'php_version'  => PHP_VERSION,
    'php_sapi'     => PHP_SAPI,
    'db_version'   => '未知',
    'max_upload'   => '未知',
    'memory_limit' => '未知',
    'server_soft'  => '未知',
];

if ($loggedIn || $publicView) {
    try {
        $pdo = getDB();

        // ===== 统计卡片 =====
        $totalUsers  = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        $totalPosts  = (int)$pdo->query('SELECT COUNT(*) FROM posts')->fetchColumn();
        $totalMusic  = (int)$pdo->query('SELECT COUNT(*) FROM music')->fetchColumn();
        $totalComments = (int)$pdo->query('SELECT COUNT(*) FROM comments')->fetchColumn();
        $totalLikes  = (int)$pdo->query('SELECT COUNT(*) FROM likes')->fetchColumn();
        $totalMessages = (int)$pdo->query('SELECT COUNT(*) FROM messages')->fetchColumn();
        $todayUsers  = (int)$pdo->query('SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()')->fetchColumn();
        $todayPosts  = (int)$pdo->query('SELECT COUNT(*) FROM posts WHERE DATE(created_at) = CURDATE()')->fetchColumn();

        // ===== 近90日趋势（注册/发帖/评论/点赞）=====
        $trend = ['users' => [], 'posts' => [], 'comments' => [], 'likes' => []];
        $queries = [
            'users'    => 'SELECT DATE(created_at) AS d, COUNT(*) AS c FROM users WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY) GROUP BY d',
            'posts'    => 'SELECT DATE(created_at) AS d, COUNT(*) AS c FROM posts WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY) GROUP BY d',
            'comments' => 'SELECT DATE(created_at) AS d, COUNT(*) AS c FROM comments WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY) GROUP BY d',
            'likes'    => 'SELECT DATE(created_at) AS d, COUNT(*) AS c FROM likes WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY) GROUP BY d',
        ];
        $maps = [];
        foreach ($queries as $key => $sql) {
            $maps[$key] = [];
            foreach ($pdo->query($sql)->fetchAll() as $r) {
                $maps[$key][$r['d']] = (int)$r['c'];
            }
        }
        for ($i = 89; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-$i days"));
            foreach (['users', 'posts', 'comments', 'likes'] as $key) {
                $trend[$key][] = (int)($maps[$key][$d] ?? 0);
            }
        }

        // ===== TOP 排行：发帖最多的用户 =====
        $topPosters = $pdo->query(
            'SELECT u.id, u.username, u.nickname, u.avatar, COUNT(p.id) AS cnt
             FROM users u LEFT JOIN posts p ON p.user_id = u.id
             GROUP BY u.id ORDER BY cnt DESC, u.id ASC LIMIT 8'
        )->fetchAll();

        // ===== TOP 排行：获赞最多的动态 =====
        $topPosts = $pdo->query(
            'SELECT p.id, p.content, p.likes_count, p.comments_count, u.username, u.nickname
             FROM posts p JOIN users u ON u.id = p.user_id
             ORDER BY p.likes_count DESC, p.comments_count DESC LIMIT 8'
        )->fetchAll();

        // ===== 媒体类型分布（饼图）=====
        $mediaDist = $pdo->query(
            "SELECT
                SUM(CASE WHEN (images IS NOT NULL AND images NOT IN ('[]','null','')) AND (videos IS NULL OR videos IN ('[]','null','')) THEN 1 ELSE 0 END) AS img_only,
                SUM(CASE WHEN (videos IS NOT NULL AND videos NOT IN ('[]','null','')) AND (images IS NULL OR images IN ('[]','null','')) THEN 1 ELSE 0 END) AS vid_only,
                SUM(CASE WHEN (images IS NOT NULL AND images NOT IN ('[]','null','')) AND (videos IS NOT NULL AND videos NOT IN ('[]','null','')) THEN 1 ELSE 0 END) AS both_m,
                SUM(CASE WHEN (images IS NULL OR images IN ('[]','null','')) AND (videos IS NULL OR videos IN ('[]','null','')) THEN 1 ELSE 0 END) AS text_only
             FROM posts"
        )->fetch();

        // ===== 以下数据仅管理员可见 =====
        if ($loggedIn) {

        // ===== 用户列表（搜索 + 活跃度）=====
        $keyword = trim($_GET['q'] ?? '');
        $page    = max(1, (int)($_GET['page'] ?? 1));
        $size    = max(1, min(100, (int)($_GET['size'] ?? 20)));
        $offset  = ($page - 1) * $size;

        $where  = '';
        $params = [];
        if ($keyword !== '') {
            $where  = 'WHERE u.username LIKE ? OR u.nickname LIKE ?';
            $params = ["%$keyword%", "%$keyword%"];
        }

        $stmt = $pdo->prepare(
            "SELECT u.id, u.username, u.nickname, u.bio, u.avatar, u.email, u.email_verified, u.created_at,
                    (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS post_cnt,
                    (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS comment_cnt,
                    (SELECT COUNT(*) FROM likes l WHERE l.user_id = u.id) AS like_cnt
             FROM users u
             $where
             ORDER BY u.id ASC"
        );
        $stmt->execute($params);
        $users = $stmt->fetchAll();
        foreach ($users as &$u) {
            $u['id'] = (int)$u['id'];
            $u['post_cnt'] = (int)$u['post_cnt'];
            $u['comment_cnt'] = (int)$u['comment_cnt'];
            $u['like_cnt'] = (int)$u['like_cnt'];
        }
        unset($u);

        // ===== 动态列表（搜索 + 分页）=====
        $postWhere  = '';
        $postParams = [];
        if ($keyword !== '') {
            $postWhere  = 'WHERE p.content LIKE ?';
            $postParams = ["%$keyword%"];
        }
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM posts p $postWhere");
        $stmt->execute($postParams);
        $totalPosts = (int)$stmt->fetchColumn();

        $stmt = $pdo->prepare(
            "SELECT p.id, p.content, p.images, p.videos, p.likes_count, p.comments_count, p.is_pinned, p.created_at,
                    u.id AS user_id, u.username, u.nickname
             FROM posts p
             JOIN users u ON p.user_id = u.id
             $postWhere
             ORDER BY p.is_pinned DESC, p.created_at DESC"
        );
        $stmt->execute($postParams);
        $posts = $stmt->fetchAll();

        foreach ($posts as &$p) {
            $p['id']            = (int)$p['id'];
            $p['user_id']       = (int)$p['user_id'];
            $p['likes_count']   = (int)$p['likes_count'];
            $p['comments_count'] = (int)$p['comments_count'];
            $p['is_pinned']     = (bool)$p['is_pinned'];
            $p['images']        = $p['images'] ? json_decode($p['images'], true) : [];
            $p['videos']        = $p['videos'] ? json_decode($p['videos'], true) : [];
        }
        unset($p);

        // ===== 音乐列表 =====
        $stmt = $pdo->query(
            'SELECT m.id, m.title, m.music_url, m.plays_count, m.created_at, u.username, u.nickname
             FROM music m JOIN users u ON u.id = m.user_id
             ORDER BY m.created_at DESC'
        );
        $musicList = $stmt->fetchAll();
        foreach ($musicList as &$m) {
            $m['id'] = (int)$m['id'];
            $m['plays_count'] = (int)$m['plays_count'];
        }
        unset($m);

        // ===== 评论列表 =====
        $stmt = $pdo->query(
            'SELECT c.id, c.content, c.created_at, u.username, u.nickname, p.content AS post_content, p.id AS post_id
             FROM comments c
             JOIN users u ON u.id = c.user_id
             JOIN posts p ON p.id = c.post_id
             ORDER BY c.created_at DESC'
        );
        $comments = $stmt->fetchAll();
        foreach ($comments as &$c) {
            $c['id'] = (int)$c['id'];
            $c['post_id'] = (int)$c['post_id'];
        }
        unset($c);

        // ===== 系统信息 =====
        $sysInfo = [
            'php_version'  => PHP_VERSION,
            'php_sapi'     => PHP_SAPI,
            'db_version'   => (string)$pdo->query('SELECT VERSION()')->fetchColumn(),
            'max_upload'   => ini_get('upload_max_filesize'),
            'memory_limit' => ini_get('memory_limit'),
            'server_soft'  => $_SERVER['SERVER_SOFTWARE'] ?? '未知',
        ];

        } // end if ($loggedIn) — 管理员专属数据

    } catch (PDOException $e) {
        $dbError = '数据库连接失败: ' . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRMoment 管理面板</title>
<link rel="icon" href="web/logo192.png">
<script>
/* 防闪烁：加载时即应用主题 */
(function(){
    var t = localStorage.getItem('crmoment-admin-theme');
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
})();
</script>
<style>
/* ===== BA 风格主题变量 ===== */
:root {
    color-scheme: light only;
    --ba-blue: #7ec8e3;
    --ba-blue-dark: #4a9fc7;
    --ba-pink: #f4c2d0;
    --ba-accent: #7ec8e3;
    --ba-accent-light: #4a9fc7;
    --ba-text: #4a6075;
    --ba-text-secondary: #5a6f84;
    --ba-text-muted: #8a9db0;
    --ba-bg-gradient: linear-gradient(180deg, #e8f4fa 0%, #f0f7fb 15%, #fdf6f8 40%, #fafcfe 70%, #f5f0f8 100%);
    --ba-card-bg: rgba(255, 255, 255, 0.55);
    --ba-card-border: rgba(255, 255, 255, 0.8);
    --ba-card-shadow: 0 2px 12px rgba(150, 170, 190, 0.12);
    --ba-card-shadow-hover: 0 8px 28px rgba(150, 170, 190, 0.22);
    --ba-radius: 12px;
    --ba-radius-lg: 20px;
    --ba-danger: #d93025;
    --ba-danger-hover: #b3261e;
    --ba-success: #188038;
    --ba-warn: #e8710a;
    --ba-sidebar-bg: rgba(255, 255, 255, 0.5);
    --ba-input-bg: rgba(255, 255, 255, 0.7);
    --ba-hover: rgba(126, 200, 227, 0.12);
}
[data-theme="dark"] {
    color-scheme: dark only;
    --ba-blue: #5a9fbf;
    --ba-blue-dark: #7ec8e3;
    --ba-pink: #b0806a;
    --ba-accent: #7A5C2D;
    --ba-accent-light: #c9a06a;
    --ba-text: #d4dce8;
    --ba-text-secondary: #b0c0d0;
    --ba-text-muted: #7a8a9a;
    --ba-bg-gradient: linear-gradient(180deg, #1a1e24 0%, #1e222a 25%, #222730 50%, #1e222a 75%, #1a1e24 100%);
    --ba-card-bg: rgba(30, 35, 45, 0.7);
    --ba-card-border: rgba(60, 70, 85, 0.5);
    --ba-card-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    --ba-card-shadow-hover: 0 8px 28px rgba(0, 0, 0, 0.4);
    --ba-danger: #f28b82;
    --ba-danger-hover: #d93025;
    --ba-success: #81c995;
    --ba-warn: #f5a623;
    --ba-sidebar-bg: rgba(22, 26, 32, 0.6);
    --ba-input-bg: rgba(35, 42, 52, 0.7);
    --ba-hover: rgba(126, 200, 227, 0.15);
}

* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html { scrollbar-color: rgba(180, 190, 200, 0.5) transparent; scrollbar-width: thin; }
body {
    background: var(--ba-bg-gradient);
    background-attachment: fixed;
    font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", sans-serif;
    color: var(--ba-text);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
}
a { color: var(--ba-blue-dark); text-decoration: none; }
a:hover { text-decoration: underline; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(180, 190, 200, 0.5); border-radius: 3px; }

/* ===== 顶部导航 ===== */
.app-bar {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    height: 56px; padding: 0 20px;
    background: var(--ba-card-bg);
    border-bottom: 1px solid var(--ba-card-border);
    box-shadow: 0 1px 6px rgba(150, 170, 190, 0.1);
}
.app-bar-left { display: flex; align-items: center; gap: 10px; }
.app-bar-title { font-size: 16px; font-weight: 700; color: var(--ba-text); }
.app-bar-title small { font-weight: 400; color: var(--ba-text-muted); font-size: 12px; margin-left: 6px; }
.app-bar-right { display: flex; align-items: center; gap: 10px; }
.app-bar-user { font-size: 13px; color: var(--ba-text-secondary); }

/* ===== 图标按钮 ===== */
.icon-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: 50%;
    border: none; background: transparent; color: var(--ba-text-secondary);
    cursor: pointer; font-size: 18px; font-family: inherit;
}
.icon-btn:hover { background: var(--ba-hover); }

/* ===== 布局 ===== */
.admin-layout { display: flex; max-width: 1400px; margin: 0 auto; padding: 16px; gap: 16px; align-items: flex-start; }
.sidebar {
    width: 190px; flex-shrink: 0; position: sticky; top: 72px;
    background: var(--ba-sidebar-bg);
    border: 1px solid var(--ba-card-border);
    border-radius: var(--ba-radius-lg);
    box-shadow: var(--ba-card-shadow);
    padding: 10px; display: flex; flex-direction: column; gap: 2px;
}
.sidebar .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: var(--ba-radius);
    border: none; background: transparent; color: var(--ba-text-secondary);
    font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit;
    text-align: left; width: 100%;
}
.sidebar .nav-item:hover { background: var(--ba-hover); color: var(--ba-text); }
.sidebar .nav-item.active { background: rgba(126, 200, 227, 0.2); color: var(--ba-blue-dark); font-weight: 600; }
.sidebar .nav-item .nav-icon { font-size: 16px; width: 20px; text-align: center; }

.main-area { flex: 1; min-width: 0; }
.page { display: none; }
.page.active { display: block; animation: fadeUp 0.25s ease; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

/* ===== 统计卡片 ===== */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat-card {
    background: var(--ba-card-bg);
    border: 1px solid var(--ba-card-border);
    border-radius: var(--ba-radius);
    box-shadow: var(--ba-card-shadow);
    padding: 16px 18px;
}
.stat-card .num { font-size: 26px; font-weight: 700; color: var(--ba-blue-dark); line-height: 1.2; }
.stat-card .label { font-size: 12px; color: var(--ba-text-muted); margin-top: 4px; }
.stat-card .sub { font-size: 11px; color: var(--ba-text-muted); margin-top: 2px; }

/* ===== 卡片 ===== */
.card {
    background: var(--ba-card-bg);
    border: 1px solid var(--ba-card-border);
    border-radius: var(--ba-radius-lg);
    box-shadow: var(--ba-card-shadow);
    padding: 18px 20px;
    margin-bottom: 16px;
}
.card-title { font-size: 15px; font-weight: 600; color: var(--ba-text); margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
.card-title .hint { font-size: 12px; font-weight: 400; color: var(--ba-text-muted); margin-left: auto; }

.chart-row { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
.mini-chart-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px; }
.chart-col { min-width: 0; }
.chart-box { position: relative; height: 260px; }
@media (max-width: 900px) { .chart-row { grid-template-columns: 1fr; } .mini-chart-grid { grid-template-columns: 1fr; } }

/* ===== 按钮 ===== */
.btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 16px; border-radius: 20px; border: none;
    font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit;
    transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
}
.btn-primary { background: var(--ba-blue); color: #fff; }
.btn-primary:hover { background: var(--ba-blue-dark); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(126, 200, 227, 0.3); }
.btn-secondary { background: transparent; border: 1px solid var(--ba-blue); color: var(--ba-blue-dark); }
.btn-secondary:hover { background: var(--ba-hover); }
.btn-danger { background: var(--ba-danger); color: #fff; }
.btn-danger:hover { background: var(--ba-danger-hover); }
.btn-warning { background: var(--ba-warn); color: #fff; }
.btn-small { padding: 4px 12px; font-size: 12px; }
.btn[disabled] { opacity: 0.6; cursor: not-allowed; transform: none !important; }

/* ===== 表格 ===== */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead th {
    background: var(--ba-input-bg);
    padding: 10px 12px; text-align: left; font-weight: 600;
    color: var(--ba-text-secondary); border-bottom: 1px solid var(--ba-card-border);
    white-space: nowrap;
}
tbody td { padding: 10px 12px; border-bottom: 1px solid rgba(150, 170, 190, 0.12); vertical-align: middle; }
tbody tr:hover { background: var(--ba-hover); }
tbody tr:last-child td { border-bottom: none; }
.col-id { width: 56px; color: var(--ba-text-muted); white-space: nowrap; }
.col-small { white-space: nowrap; }
.text-muted { color: var(--ba-text-muted); font-size: 12px; }
.content-preview { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.avatar-img { width: 30px; height: 30px; border-radius: 50%; vertical-align: middle; margin-right: 8px; object-fit: cover; }
.avatar-placeholder {
    display: inline-flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--ba-blue); color: #fff; font-size: 13px; font-weight: 600;
    vertical-align: middle; margin-right: 8px;
}
.row-actions { display: flex; gap: 6px; flex-wrap: wrap; }

/* ===== 标签 ===== */
.tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.tag-admin { background: rgba(126, 200, 227, 0.25); color: var(--ba-blue-dark); }
.tag-verified { background: rgba(24, 128, 56, 0.12); color: var(--ba-success); }
.tag-unverified { background: rgba(233, 113, 10, 0.12); color: var(--ba-warn); }
.tag-pinned { background: rgba(244, 194, 208, 0.35); color: var(--ba-pink); }

/* ===== 表单 ===== */
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 13px; font-weight: 600; color: var(--ba-text-secondary); margin-bottom: 5px; }
.field input[type="text"],
.field input[type="password"],
.field input[type="email"],
.field input[type="search"],
.field textarea {
    width: 100%; padding: 10px 14px;
    background: var(--ba-input-bg);
    border: 1px solid var(--ba-card-border);
    border-radius: var(--ba-radius);
    font-size: 14px; color: var(--ba-text); outline: none; font-family: inherit;
}
.field input:focus, .field textarea:focus { border-color: var(--ba-blue); }
.field textarea { resize: vertical; line-height: 1.6; }
.form-row { display: flex; gap: 16px; }
.form-row .field { flex: 1; }
@media (max-width: 768px) { .form-row { flex-direction: column; gap: 0; } }

/* ===== 搜索栏 ===== */
.search-bar { display: flex; gap: 8px; margin-bottom: 14px; }
.search-bar input {
    flex: 1; padding: 9px 14px;
    background: var(--ba-input-bg);
    border: 1px solid var(--ba-card-border);
    border-radius: 20px; font-size: 13px; color: var(--ba-text); outline: none; font-family: inherit;
}
.search-bar input:focus { border-color: var(--ba-blue); }

/* ===== 分页 ===== */
.pagination { display: flex; align-items: center; gap: 8px; padding: 12px 4px; font-size: 13px; flex-wrap: wrap; }
.pagination a {
    padding: 5px 12px; border: 1px solid var(--ba-card-border); border-radius: 14px;
    color: var(--ba-text-secondary); font-size: 13px; background: var(--ba-card-bg);
}
.pagination a:hover { background: var(--ba-hover); text-decoration: none; }
.pagination .current { padding: 5px 12px; color: var(--ba-text-muted); }

/* ===== 排行 ===== */
.rank-list { display: flex; flex-direction: column; gap: 8px; }
.rank-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--ba-radius); background: var(--ba-input-bg); }
.rank-idx { width: 22px; height: 22px; border-radius: 50%; background: var(--ba-blue); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rank-idx.gold { background: #f5a623; }
.rank-idx.silver { background: #9aa5b1; }
.rank-idx.bronze { background: #cd7f32; }
.rank-info { flex: 1; min-width: 0; }
.rank-name { font-size: 13px; font-weight: 600; color: var(--ba-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-sub { font-size: 11px; color: var(--ba-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-val { font-size: 13px; font-weight: 700; color: var(--ba-blue-dark); flex-shrink: 0; }

/* ===== 登录页 ===== */
.login-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
.login-box {
    background: var(--ba-card-bg);
    border: 1px solid var(--ba-card-border);
    border-radius: var(--ba-radius-lg);
    box-shadow: var(--ba-card-shadow-hover);
    padding: 36px 34px; width: 380px; max-width: 100%;
}
.login-box h1 { font-size: 22px; text-align: center; margin-bottom: 4px; color: var(--ba-text); }
.login-box .login-sub { text-align: center; color: var(--ba-text-muted); font-size: 13px; margin-bottom: 24px; }
.login-error { color: var(--ba-danger); font-size: 13px; margin-bottom: 12px; padding: 8px 12px; background: rgba(217, 48, 37, 0.08); border-radius: 8px; }
.login-divider { display: flex; align-items: center; gap: 10px; margin: 14px 0; color: var(--ba-text-muted); font-size: 12px; }
.login-divider::before, .login-divider::after { content: ''; flex: 1; height: 1px; background: var(--ba-card-border); }
.login-box .field { margin-bottom: 16px; }
.login-box .btn { width: 100%; justify-content: center; padding: 10px; font-size: 15px; margin-top: 6px; }

/* ===== Toast ===== */
.toast {
    position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: var(--ba-radius);
    color: #fff; font-size: 14px; z-index: 999; display: none;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
.toast-success { background: var(--ba-success); }
.toast-error { background: var(--ba-danger); }

/* ===== 空状态 ===== */
.empty-state { text-align: center; padding: 36px; color: var(--ba-text-muted); font-size: 14px; }

/* ===== 系统信息 ===== */
.sys-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.sys-item { background: var(--ba-input-bg); border-radius: var(--ba-radius); padding: 12px 14px; }
.sys-item .k { font-size: 11px; color: var(--ba-text-muted); }
.sys-item .v { font-size: 14px; font-weight: 600; color: var(--ba-text); margin-top: 2px; word-break: break-all; }

/* ===== 响应式 ===== */
@media (max-width: 768px) {
    .admin-layout { flex-direction: column; padding: 12px; }
    .sidebar { width: 100%; position: static; flex-direction: row; overflow-x: auto; }
    .sidebar .nav-item { white-space: nowrap; padding: 8px 12px; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .app-bar-title small { display: none; }
}
</style>
</head>
<body>

<?php if (!$loggedIn && !$publicView): ?>
<!--- ============ 登录页 ============ -->
<div class="login-page">
    <div class="login-box">
        <h1>管理面板</h1>
        <p class="login-sub">仅限管理员 (lgcr837) 登录</p>
        <?php if ($loginError): ?>
            <div class="login-error"><?= htmlspecialchars($loginError) ?></div>
        <?php endif; ?>
        <form method="post">
            <input type="hidden" name="action" value="login">
            <div class="field">
                <label for="username">用户名</label>
                <input type="text" id="username" name="username" placeholder="请输入管理员用户名" required autofocus autocomplete="username">
            </div>
            <div class="field">
                <label for="password">密码</label>
                <input type="password" id="password" name="password" placeholder="请输入密码" required autocomplete="current-password">
            </div>
            <button type="submit" class="btn btn-primary">登 录</button>
        </form>
        <div class="login-divider"><span>或</span></div>
        <a href="?public=1" class="btn btn-secondary" style="justify-content:center;width:100%;display:flex">查看公开数据</a>
    </div>
</div>

<?php else: ?>
<!--- ============ 管理面板 ============ -->
<div class="app-bar">
    <div class="app-bar-left">
        <div class="app-bar-title">CRMoment 管理面板 <small>Admin Console</small></div>
    </div>
    <div class="app-bar-right">
        <button class="btn btn-secondary btn-small" id="btn-theme" title="切换主题">亮暗</button>
        <?php if ($publicView): ?>
            <a href="?logout=1" class="btn btn-secondary btn-small">返回登录</a>
        <?php else: ?>
            <span class="app-bar-user">👤 <?= htmlspecialchars($_SESSION['admin_nickname'] ?: $_SESSION['admin_username']) ?></span>
            <button class="btn btn-secondary btn-small" onclick="location.href='?logout=1'">退出登录</button>
        <?php endif; ?>
    </div>
</div>

<div class="admin-layout">
    <!-- 侧边导航 -->
    <aside class="sidebar" id="sidebar">
        <button class="nav-item active" data-page="dashboard"><span class="nav-icon">📊</span> 数据看板</button>
        <?php if (!$publicView): ?>
        <button class="nav-item" data-page="users"><span class="nav-icon">👥</span> 用户管理</button>
        <button class="nav-item" data-page="posts"><span class="nav-icon">📝</span> 动态管理</button>
        <button class="nav-item" data-page="comments"><span class="nav-icon">💬</span> 评论管理</button>
        <button class="nav-item" data-page="music"><span class="nav-icon">🎵</span> 音乐管理</button>
        <button class="nav-item" data-page="email"><span class="nav-icon">✉️</span> 邮件发送</button>
        <button class="nav-item" data-page="system"><span class="nav-icon">🖥️</span> 系统信息</button>
        <?php endif; ?>
    </aside>

    <main class="main-area">
        <?php if (isset($dbError)): ?>
            <div class="card" style="border-color:var(--ba-danger);color:var(--ba-danger)"><?= htmlspecialchars($dbError) ?></div>
        <?php endif; ?>

        <!-- ===== 数据看板 ===== -->
        <div class="page active" id="page-dashboard">
            <div class="stats-grid">
                <div class="stat-card"><div class="num"><?= $totalUsers ?></div><div class="label">注册用户</div><div class="sub">今日 +<?= $todayUsers ?></div></div>
                <div class="stat-card"><div class="num"><?= $totalPosts ?></div><div class="label">全部动态</div><div class="sub">今日 +<?= $todayPosts ?></div></div>
                <div class="stat-card"><div class="num"><?= $totalComments ?></div><div class="label">全部评论</div></div>
                <div class="stat-card"><div class="num"><?= $totalLikes ?></div><div class="label">全部点赞</div></div>
                <div class="stat-card"><div class="num"><?= $totalMusic ?></div><div class="label">音乐广场</div></div>
                <div class="stat-card"><div class="num"><?= $totalMessages ?></div><div class="label">私信消息</div></div>
            </div>

            <div class="card">
                <div class="card-title">📈 近 90 日总趋势<span class="hint">注册 / 动态 / 评论 / 点赞</span></div>
                <div class="chart-box" style="height:280px"><canvas id="trendTotalChart"></canvas></div>
            </div>

            <div class="mini-chart-grid">
                <div class="card chart-col">
                    <div class="card-title">👤 注册趋势</div>
                    <div class="chart-box" style="height:190px"><canvas id="trendUsersChart"></canvas></div>
                </div>
                <div class="card chart-col">
                    <div class="card-title">📝 动态趋势</div>
                    <div class="chart-box" style="height:190px"><canvas id="trendPostsChart"></canvas></div>
                </div>
                <div class="card chart-col">
                    <div class="card-title">💬 评论趋势</div>
                    <div class="chart-box" style="height:190px"><canvas id="trendCommentsChart"></canvas></div>
                </div>
                <div class="card chart-col">
                    <div class="card-title">👍 点赞趋势</div>
                    <div class="chart-box" style="height:190px"><canvas id="trendLikesChart"></canvas></div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">🥧 动态媒体类型分布</div>
                <div class="chart-box" style="height:280px"><canvas id="mediaChart"></canvas></div>
            </div>

            <div class="chart-row">
                <div class="card chart-col">
                    <div class="card-title">🏆 发帖最多的用户 TOP8</div>
                    <div class="rank-list">
                        <?php foreach ($topPosters as $i => $tp): ?>
                        <div class="rank-item">
                            <div class="rank-idx <?= $i === 0 ? 'gold' : ($i === 1 ? 'silver' : ($i === 2 ? 'bronze' : '')) ?>"><?= $i + 1 ?></div>
                            <div class="rank-info">
                                <div class="rank-name"><?= htmlspecialchars($tp['nickname'] ?: $tp['username']) ?></div>
                                <div class="rank-sub">@<?= htmlspecialchars($tp['username']) ?></div>
                            </div>
                            <div class="rank-val"><?= $tp['cnt'] ?> 条</div>
                        </div>
                        <?php endforeach; ?>
                        <?php if (empty($topPosters)): ?><div class="empty-state">暂无数据</div><?php endif; ?>
                    </div>
                </div>
                <div class="card chart-col">
                    <div class="card-title">🔥 热门动态 TOP8</div>
                    <div class="rank-list">
                        <?php foreach ($topPosts as $i => $tp): ?>
                        <div class="rank-item">
                            <div class="rank-idx <?= $i === 0 ? 'gold' : ($i === 1 ? 'silver' : ($i === 2 ? 'bronze' : '')) ?>"><?= $i + 1 ?></div>
                            <div class="rank-info">
                                <div class="rank-name"><?= htmlspecialchars(mb_substr($tp['content'], 0, 28)) ?><?= mb_strlen($tp['content']) > 28 ? '…' : '' ?></div>
                                <div class="rank-sub">@<?= htmlspecialchars($tp['username']) ?> · #<?= $tp['id'] ?></div>
                            </div>
                            <div class="rank-val">👍 <?= $tp['likes_count'] ?></div>
                        </div>
                        <?php endforeach; ?>
                        <?php if (empty($topPosts)): ?><div class="empty-state">暂无数据</div><?php endif; ?>
                    </div>
                </div>
            </div>
        </div>

        <?php if (!$publicView): ?>
        <!-- ===== 用户管理 ===== -->
        <div class="page" id="page-users">
            <div class="card">
                <div class="card-title">👥 用户管理<span class="hint">共 <?= $totalUsers ?> 人 · 管理员不可删除</span></div>
                <form class="search-bar" method="get">
                    <input type="hidden" name="page" value="1">
                    <input type="search" name="q" placeholder="搜索用户名 / 昵称 / 邮箱..." value="<?= htmlspecialchars($keyword) ?>">
                    <button class="btn btn-primary btn-small" type="submit">搜索</button>
                    <?php if ($keyword !== ''): ?><button class="btn btn-secondary btn-small" type="button" onclick="location.href='?page=1'">清空</button><?php endif; ?>
                </form>
                <div class="table-wrap">
                    <table>
                        <thead><tr>
                            <th class="col-id">ID</th><th>用户</th><th>邮箱</th><th>简介</th>
                            <th class="col-small">动态</th><th class="col-small">评论</th><th class="col-small">点赞</th>
                            <th class="col-small">注册时间</th><th>操作</th>
                        </tr></thead>
                        <tbody>
                        <?php if (empty($users)): ?>
                            <tr><td colspan="9" class="empty-state">暂无用户</td></tr>
                        <?php else: foreach ($users as $u): ?>
                            <tr>
                                <td class="col-id">#<?= $u['id'] ?></td>
                                <td class="col-small">
                                    <?php if ($u['avatar']): ?><img class="avatar-img" src="<?= htmlspecialchars($u['avatar']) ?>" alt="">
                                    <?php else: ?><span class="avatar-placeholder"><?= htmlspecialchars(mb_substr($u['nickname'] ?: $u['username'], 0, 1)) ?></span><?php endif; ?>
                                    <strong><?= htmlspecialchars($u['nickname'] ?: $u['username']) ?></strong>
                                    <?= $u['id'] === 1 ? ' <span class="tag tag-admin">管理员</span>' : '' ?>
                                    <div class="text-muted">@<?= htmlspecialchars($u['username']) ?></div>
                                </td>
                                <td class="col-small">
                                    <?= htmlspecialchars($u['email'] ?: '-') ?>
                                    <?php if ($u['email']): ?>
                                        <br><span class="tag <?= $u['email_verified'] ? 'tag-verified' : 'tag-unverified' ?>"><?= $u['email_verified'] ? '已验证' : '未验证' ?></span>
                                    <?php endif; ?>
                                </td>
                                <td class="text-muted"><?= htmlspecialchars(mb_substr($u['bio'] ?? '', 0, 40) ?: '-') ?></td>
                                <td class="col-small"><?= $u['post_cnt'] ?></td>
                                <td class="col-small"><?= $u['comment_cnt'] ?></td>
                                <td class="col-small"><?= $u['like_cnt'] ?></td>
                                <td class="col-small text-muted"><span class="time-utc" data-utc="<?= htmlspecialchars($u['created_at']) ?>"><?= $u['created_at'] ?></span></td>
                                <td class="col-small">
                                    <div class="row-actions">
                                        <?php if ($u['id'] !== 1): ?>
                                            <button class="btn btn-danger btn-small" onclick="deleteUser(<?= $u['id'] ?>, '<?= htmlspecialchars($u['username'], ENT_QUOTES) ?>', this)">删除</button>
                                        <?php endif; ?>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- ===== 动态管理 ===== -->
        <div class="page" id="page-posts">
            <div class="card">
                <div class="card-title">📝 动态管理<span class="hint">共 <?= $totalPosts ?> 条 · 可置顶 / 撤回</span></div>
                <form class="search-bar" method="get">
                    <input type="hidden" name="page" value="1">
                    <input type="search" name="q" placeholder="搜索动态内容..." value="<?= htmlspecialchars($keyword) ?>">
                    <button class="btn btn-primary btn-small" type="submit">搜索</button>
                    <?php if ($keyword !== ''): ?><button class="btn btn-secondary btn-small" type="button" onclick="location.href='?page=1'">清空</button><?php endif; ?>
                </form>
                <div class="table-wrap">
                    <table>
                        <thead><tr>
                            <th class="col-id">ID</th><th>作者</th><th>内容</th><th class="col-small">媒体</th>
                            <th class="col-small">👍</th><th class="col-small">💬</th><th class="col-small">置顶</th>
                            <th class="col-small">时间</th><th>操作</th>
                        </tr></thead>
                        <tbody>
                        <?php if (empty($posts)): ?>
                            <tr><td colspan="9" class="empty-state">暂无动态</td></tr>
                        <?php else: foreach ($posts as $p): ?>
                            <?php
                                $imgCount = count($p['images']);
                                $vidCount = count($p['videos']);
                                $mediaParts = [];
                                if ($imgCount > 0) $mediaParts[] = "🖼️ {$imgCount}张";
                                if ($vidCount > 0) $mediaParts[] = "🎬 {$vidCount}个";
                                $mediaStr = $mediaParts ? implode(' / ', $mediaParts) : '-';
                                $idDisplay = $p['is_pinned'] ? '#TOP' . $p['id'] : '#' . $p['id'];
                            ?>
                            <tr>
                                <td class="col-id"><?= $idDisplay ?></td>
                                <td class="col-small"><strong><?= htmlspecialchars($p['nickname'] ?: $p['username']) ?></strong><div class="text-muted">@<?= htmlspecialchars($p['username']) ?></div></td>
                                <td><span class="content-preview"><?= htmlspecialchars(mb_substr($p['content'], 0, 120)) ?></span></td>
                                <td class="col-small text-muted"><?= $mediaStr ?></td>
                                <td class="col-small"><?= $p['likes_count'] ?></td>
                                <td class="col-small"><?= $p['comments_count'] ?></td>
                                <td class="col-small"><?= $p['is_pinned'] ? '<span class="tag tag-pinned">📌 置顶</span>' : '-' ?></td>
                                <td class="col-small text-muted"><span class="time-utc" data-utc="<?= htmlspecialchars($p['created_at']) ?>"><?= $p['created_at'] ?></span></td>
                                <td class="col-small">
                                    <div class="row-actions">
                                        <button class="btn btn-small <?= $p['is_pinned'] ? 'btn-warning' : 'btn-secondary' ?>" onclick="togglePin(<?= $p['id'] ?>, '<?= $p['is_pinned'] ? 'unpin_post' : 'pin_post' ?>', this)"><?= $p['is_pinned'] ? '取消置顶' : '置顶' ?></button>
                                        <button class="btn btn-danger btn-small" onclick="deletePost(<?= $p['id'] ?>, this)">撤回</button>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- ===== 评论管理 ===== -->
        <div class="page" id="page-comments">
            <div class="card">
                <div class="card-title">💬 评论管理<span class="hint">共 <?= $totalComments ?> 条</span></div>
                <div class="table-wrap">
                    <table>
                        <thead><tr>
                            <th class="col-id">ID</th><th>用户</th><th>评论内容</th><th class="col-small">所属动态</th>
                            <th class="col-small">时间</th><th>操作</th>
                        </tr></thead>
                        <tbody>
                        <?php if (empty($comments)): ?>
                            <tr><td colspan="6" class="empty-state">暂无评论</td></tr>
                        <?php else: foreach ($comments as $c): ?>
                            <tr>
                                <td class="col-id">#<?= $c['id'] ?></td>
                                <td class="col-small"><strong><?= htmlspecialchars($c['nickname'] ?: $c['username']) ?></strong><div class="text-muted">@<?= htmlspecialchars($c['username']) ?></div></td>
                                <td><span class="content-preview"><?= htmlspecialchars(mb_substr($c['content'], 0, 100)) ?></span></td>
                                <td class="col-small text-muted">#<?= $c['post_id'] ?> <span class="content-preview" style="max-width:140px"><?= htmlspecialchars(mb_substr($c['post_content'], 0, 30)) ?></span></td>
                                <td class="col-small text-muted"><span class="time-utc" data-utc="<?= htmlspecialchars($c['created_at']) ?>"><?= $c['created_at'] ?></span></td>
                                <td class="col-small"><button class="btn btn-danger btn-small" onclick="deleteComment(<?= $c['id'] ?>, this)">删除</button></td>
                            </tr>
                        <?php endforeach; endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- ===== 音乐管理 ===== -->
        <div class="page" id="page-music">
            <div class="card">
                <div class="card-title">🎵 音乐管理<span class="hint">共 <?= $totalMusic ?> 首</span></div>
                <div class="table-wrap">
                    <table>
                        <thead><tr>
                            <th class="col-id">ID</th><th>标题</th><th>上传者</th><th class="col-small">播放量</th>
                            <th class="col-small">时间</th><th>操作</th>
                        </tr></thead>
                        <tbody>
                        <?php if (empty($musicList)): ?>
                            <tr><td colspan="6" class="empty-state">暂无音乐</td></tr>
                        <?php else: foreach ($musicList as $m): ?>
                            <tr>
                                <td class="col-id">#<?= $m['id'] ?></td>
                                <td><strong><?= htmlspecialchars($m['title']) ?></strong><div class="text-muted content-preview" style="max-width:280px"><?= htmlspecialchars($m['music_url']) ?></div></td>
                                <td class="col-small"><?= htmlspecialchars($m['nickname'] ?: $m['username']) ?></td>
                                <td class="col-small">▶️ <?= $m['plays_count'] ?></td>
                                <td class="col-small text-muted"><span class="time-utc" data-utc="<?= htmlspecialchars($m['created_at']) ?>"><?= $m['created_at'] ?></span></td>
                                <td class="col-small"><button class="btn btn-danger btn-small" onclick="deleteMusic(<?= $m['id'] ?>, this)">删除</button></td>
                            </tr>
                        <?php endforeach; endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- ===== 邮件发送 ===== -->
        <div class="page" id="page-email">
            <div class="card">
                <div class="card-title">✉️ 邮件发送<span class="hint">SendCloud · @mail.crweb.ccwu.cc</span></div>
                <form id="emailForm" onsubmit="return sendEmail(event)">
                    <div class="form-row">
                        <div class="field">
                            <label for="from_name">发件人名称</label>
                            <input type="text" id="from_name" name="from_name" placeholder="例如：CRMoment 团队" required>
                        </div>
                        <div class="field">
                            <label for="email_prefix">邮箱前缀</label>
                            <input type="text" id="email_prefix" name="email_prefix" placeholder="例如：noreply" value="noreply" required>
                        </div>
                    </div>
                    <div class="field">
                        <label for="subject">邮件主题</label>
                        <input type="text" id="subject" name="subject" placeholder="请输入邮件主题" required>
                    </div>
                    <div class="field">
                        <label for="content">邮件内容</label>
                        <textarea id="content" name="content" rows="8" placeholder="请输入邮件正文内容..." required></textarea>
                    </div>
                    <div class="field">
                        <label for="target">发送目标</label>
                        <input type="text" id="target" name="target" placeholder="输入邮箱地址，多个用逗号分隔">
                        <div class="text-muted" style="margin-top:4px">或输入 <code>all</code> 发送给所有已验证邮箱的用户</div>
                    </div>
                    <div class="row-actions" style="align-items:center">
                        <button type="submit" class="btn btn-primary" id="sendBtn">发送邮件</button>
                        <span id="sendStatus" class="text-muted"></span>
                    </div>
                </form>
            </div>
        </div>

        <!-- ===== 系统信息 ===== -->
        <div class="page" id="page-system">
            <div class="card">
                <div class="card-title">🖥️ 系统信息</div>
                <div class="sys-grid">
                    <div class="sys-item"><div class="k">PHP 版本</div><div class="v"><?= htmlspecialchars($sysInfo['php_version']) ?></div></div>
                    <div class="sys-item"><div class="k">PHP SAPI</div><div class="v"><?= htmlspecialchars($sysInfo['php_sapi']) ?></div></div>
                    <div class="sys-item"><div class="k">数据库</div><div class="v"><?= htmlspecialchars($sysInfo['db_version']) ?></div></div>
                    <div class="sys-item"><div class="k">上传限制</div><div class="v"><?= htmlspecialchars($sysInfo['max_upload']) ?></div></div>
                    <div class="sys-item"><div class="k">内存限制</div><div class="v"><?= htmlspecialchars($sysInfo['memory_limit']) ?></div></div>
                    <div class="sys-item"><div class="k">Web 服务器</div><div class="v"><?= htmlspecialchars($sysInfo['server_soft']) ?></div></div>
                </div>
            </div>
        </div>
        <?php endif; ?>
    </main>
</div>
<?php endif; ?>

<!-- 提示消息 -->
<div id="toast" class="toast"></div>

<script>
/* ===== 主题切换 ===== */
(function() {
    var btn = document.getElementById('btn-theme');
    if (btn) {
        btn.addEventListener('click', function() {
            var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', cur);
            localStorage.setItem('crmoment-admin-theme', cur);
        });
    }
})();

/* ===== 侧边导航切换 ===== */
(function() {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.querySelectorAll('.nav-item').forEach(function(item) {
        item.addEventListener('click', function() {
            sidebar.querySelectorAll('.nav-item').forEach(function(i) { i.classList.remove('active'); });
            item.classList.add('active');
            var page = item.dataset.page;
            document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
            var target = document.getElementById('page-' + page);
            if (target) target.classList.add('active');
            window.scrollTo({ top: 0 });
        });
    });
})();

/* ===== Toast ===== */
function showToast(msg, type) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast toast-' + (type || 'success');
    toast.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(function() { toast.style.display = 'none'; }, 3000);
}

/* ===== 通用 POST ===== */
function adminPost(params, onOk) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onload = function() {
        try {
            var res = JSON.parse(xhr.responseText);
            if (res.ok) {
                showToast(res.message || '操作成功', 'success');
                if (onOk) onOk(res);
            } else {
                showToast(res.error || '操作失败', 'error');
            }
        } catch (e) {
            showToast('服务器响应异常', 'error');
        }
    };
    xhr.onerror = function() { showToast('网络错误', 'error'); };
    xhr.send(params);
}

/* ===== 动态操作 ===== */
function deletePost(postId, btn) {
    if (!confirm('确定要强行撤回动态 #' + postId + ' 吗？此操作不可撤销！')) return;
    btn.disabled = true;
    adminPost('action=delete_post&post_id=' + postId, function() {
        var tr = btn.closest('tr');
        if (tr) tr.remove();
    });
}
function togglePin(postId, action, btn) {
    btn.disabled = true;
    adminPost('action=' + action + '&post_id=' + postId, function() {
        location.reload();
    });
}

/* ===== 评论操作 ===== */
function deleteComment(commentId, btn) {
    if (!confirm('确定要删除评论 #' + commentId + ' 吗？')) return;
    btn.disabled = true;
    adminPost('action=delete_comment&comment_id=' + commentId, function() {
        var tr = btn.closest('tr');
        if (tr) tr.remove();
    });
}

/* ===== 音乐操作 ===== */
function deleteMusic(musicId, btn) {
    if (!confirm('确定要删除音乐 #' + musicId + ' 吗？')) return;
    btn.disabled = true;
    adminPost('action=delete_music&music_id=' + musicId, function() {
        var tr = btn.closest('tr');
        if (tr) tr.remove();
    });
}

/* ===== 用户操作 ===== */
function deleteUser(userId, username, btn) {
    if (!confirm('确定要删除用户 @' + username + ' 吗？\n将同时删除其全部动态、评论、点赞、私信、音乐！此操作不可撤销！')) return;
    btn.disabled = true;
    adminPost('action=delete_user&user_id=' + userId, function() {
        var tr = btn.closest('tr');
        if (tr) tr.remove();
    });
}

/* ===== 邮件发送 ===== */
function sendEmail(event) {
    event.preventDefault();
    var btn = document.getElementById('sendBtn');
    var status = document.getElementById('sendStatus');
    var fromName = document.getElementById('from_name').value.trim();
    var emailPrefix = document.getElementById('email_prefix').value.trim();
    var subject = document.getElementById('subject').value.trim();
    var content = document.getElementById('content').value.trim();
    var target = document.getElementById('target').value.trim();

    if (!fromName || !emailPrefix || !subject || !content || !target) {
        status.textContent = '请填写所有字段';
        return false;
    }

    btn.disabled = true;
    btn.textContent = '发送中...';
    status.textContent = '正在发送，请稍候...';

    var params = new URLSearchParams();
    params.append('action', 'send_email');
    params.append('from_name', fromName);
    params.append('email_prefix', emailPrefix);
    params.append('subject', subject);
    params.append('content', content);
    params.append('target', target);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onload = function() {
        btn.disabled = false;
        btn.textContent = '发送邮件';
        try {
            var res = JSON.parse(xhr.responseText);
            if (res.ok) {
                status.textContent = res.message;
                showToast(res.message, 'success');
            } else {
                status.textContent = '发送失败：' + (res.error || '未知错误');
                showToast('发送失败：' + (res.error || '未知错误'), 'error');
            }
        } catch (e) {
            status.textContent = '服务器响应异常';
            showToast('服务器响应异常', 'error');
        }
    };
    xhr.onerror = function() {
        btn.disabled = false;
        btn.textContent = '发送邮件';
        status.textContent = '网络错误';
        showToast('网络错误', 'error');
    };
    xhr.send(params);
    return false;
}

/* ===== 时间转换：UTC → 本地时区 ===== */
(function() {
    document.querySelectorAll('.time-utc').forEach(function(el) {
        var utcStr = el.getAttribute('data-utc');
        if (!utcStr) return;
        var d = new Date(utcStr.replace(' ', 'T') + 'Z');
        if (isNaN(d.getTime())) return;
        el.textContent = d.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    });
})();

/* ===== Chart.js 图表（异步加载，不阻塞首屏）===== */
function initCharts() {
    if (typeof Chart === 'undefined') return;
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var gridColor = isDark ? 'rgba(180,190,200,0.12)' : 'rgba(150,170,190,0.18)';
    var tickColor = isDark ? '#b0c0d0' : '#5a6f84';
    Chart.defaults.color = tickColor;
    Chart.defaults.borderColor = gridColor;

    // 90 日趋势：总图 + 4 分图
    var labels = [];
    var d = new Date();
    d.setDate(d.getDate() - 89);
    for (var i = 0; i < 90; i++) {
        var dd = String(d.getDate()).padStart(2, '0');
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        labels.push(mm + '-' + dd);
        d.setDate(d.getDate() + 1);
    }
    var trendData = {
        users:    <?= json_encode($trend['users']) ?>,
        posts:    <?= json_encode($trend['posts']) ?>,
        comments: <?= json_encode($trend['comments']) ?>,
        likes:    <?= json_encode($trend['likes']) ?>
    };
    var lineOpts = {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { boxWidth: 12, usePointStyle: true } } },
        scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
            y: { beginAtZero: true, ticks: { precision: 0 } }
        }
    };
    function makeTrendChart(canvasId, datasets) {
        var c = document.getElementById(canvasId);
        if (c) new Chart(c, { type: 'line', data: { labels: labels, datasets: datasets }, options: lineOpts });
    }
    // 总图（4 系列）
    makeTrendChart('trendTotalChart', [
        { label: '注册', data: trendData.users, borderColor: '#7ec8e3', backgroundColor: 'rgba(126,200,227,0.15)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
        { label: '动态', data: trendData.posts, borderColor: '#4a9fc7', backgroundColor: 'rgba(74,159,199,0.12)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
        { label: '评论', data: trendData.comments, borderColor: '#f4c2d0', backgroundColor: 'rgba(244,194,208,0.15)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
        { label: '点赞', data: trendData.likes, borderColor: '#f5a623', backgroundColor: 'rgba(245,166,35,0.12)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }
    ]);
    // 4 个分图（各 1 系列）
    makeTrendChart('trendUsersChart', [{ label: '注册', data: trendData.users, borderColor: '#7ec8e3', backgroundColor: 'rgba(126,200,227,0.15)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }]);
    makeTrendChart('trendPostsChart', [{ label: '动态', data: trendData.posts, borderColor: '#4a9fc7', backgroundColor: 'rgba(74,159,199,0.12)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }]);
    makeTrendChart('trendCommentsChart', [{ label: '评论', data: trendData.comments, borderColor: '#f4c2d0', backgroundColor: 'rgba(244,194,208,0.15)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }]);
    makeTrendChart('trendLikesChart', [{ label: '点赞', data: trendData.likes, borderColor: '#f5a623', backgroundColor: 'rgba(245,166,35,0.12)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }]);

    // 媒体类型饼图
    var mediaCanvas = document.getElementById('mediaChart');
    if (mediaCanvas) {
        var md = <?= json_encode([
            'text' => (int)($mediaDist['text_only'] ?? 0),
            'img'  => (int)($mediaDist['img_only'] ?? 0),
            'vid'  => (int)($mediaDist['vid_only'] ?? 0),
            'both' => (int)($mediaDist['both_m'] ?? 0),
        ]) ?>;
        new Chart(mediaCanvas, {
            type: 'doughnut',
            data: {
                labels: ['纯文字', '仅图片', '仅视频', '图文+视频'],
                datasets: [{
                    data: [md.text, md.img, md.vid, md.both],
                    backgroundColor: ['#7ec8e3', '#f4c2d0', '#4a9fc7', '#f5a623'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } } }
            }
        });
    }
}

/* ===== 动态加载 Chart.js（不阻塞首屏渲染）===== */
(function() {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    s.onload = initCharts;
    s.onerror = function() { console.warn('Chart.js 加载失败，图表不可用'); };
    document.head.appendChild(s);
})();
</script>

</body>
</html>
