<?php
/**
 * CRMoment API 路由入口
 *
 * Web 服务器（Apache/Nginx）会将所有 /app/* 请求重写到此文件。
 * 此文件解析 URI 路径，分派到对应的处理函数。
 */

require_once __DIR__ . '/api_config.php';
require_once __DIR__ . '/api_helpers.php';
require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/api_user.php';
require_once __DIR__ . '/api_posts.php';
require_once __DIR__ . '/api_comments.php';
require_once __DIR__ . '/api_notifications.php';
require_once __DIR__ . '/api_upload.php';
require_once __DIR__ . '/api_conversations.php';
require_once __DIR__ . '/api_music.php';

// 解析请求路径
$method = $_SERVER['REQUEST_METHOD'];

// 优先级1：来自 api.php 的 APP_ROUTE（?route=/xxx 查询参数方式）
// 最可靠的方式，不依赖 PATH_INFO 和 URL 重写
if (!empty($_SERVER['APP_ROUTE'])) {
    $path = '/' . trim($_SERVER['APP_ROUTE'], '/');
}
// 优先级2：来自 api.php 或 api_index.php 的 PATH_INFO（/api.php/posts 形式）
elseif (!empty($_SERVER['PATH_INFO'])) {
    $path = '/' . trim($_SERVER['PATH_INFO'], '/');
} else {
    // 优先级3：从 REQUEST_URI 去掉 /app 前缀（配合 nginx/apache 重写规则）
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $path = preg_replace('#^/app#', '', $uri);
    $path = '/' . trim($path, '/');
}
$path = rtrim($path, '/') ?: '/';

// 直接访问 /app 根路径时，返回 API 基本信息（而非重定向）
if ($path === '/') {
    jsonResponse(0, 'CRMoment API', [
        'version' => '1.0',
        'endpoints' => '/app/posts',
        'docs' => '/docs/deployment.md',
    ]);
}

// 路由表
try {
    // ---- Auth ----
    if ($path === '/auth/register' && $method === 'POST') {
        handleAuthRegister();
    } elseif ($path === '/auth/login' && $method === 'POST') {
        handleAuthLogin();
    } elseif ($path === '/auth/logout' && $method === 'POST') {
        handleAuthLogout();

    // ---- User ----
    } elseif ($path === '/user/me' && $method === 'GET') {
        handleUserMe();
    } elseif ($path === '/user/bio' && $method === 'POST') {
        handleUserBio();
    } elseif ($path === '/user/nickname' && $method === 'POST') {
        handleUserNickname();
    } elseif ($path === '/user/avatar' && $method === 'POST') {
        handleUserAvatar();
    } elseif (preg_match('#^/user/(\d+)$#', $path, $m) && $method === 'GET') {
        handleUserShow((int)$m[1]);

    // ---- Posts ----
    } elseif ($path === '/posts' && $method === 'GET') {
        handlePostsList();
    } elseif ($path === '/posts' && $method === 'POST') {
        handlePostsCreate();
    } elseif (preg_match('#^/posts/(\d+)$#', $path, $m) && $method === 'GET') {
        handlePostsShow((int)$m[1]);
    } elseif (preg_match('#^/posts/(\d+)$#', $path, $m) && $method === 'DELETE') {
        handlePostsDelete((int)$m[1]);
    } elseif (preg_match('#^/posts/(\d+)/like$#', $path, $m) && $method === 'POST') {
        handlePostsLike((int)$m[1]);
    } elseif (preg_match('#^/posts/(\d+)/like$#', $path, $m) && $method === 'DELETE') {
        handlePostsUnlike((int)$m[1]);
    } elseif (preg_match('#^/posts/(\d+)/comments$#', $path, $m) && $method === 'GET') {
        handleCommentsList((int)$m[1]);
    } elseif (preg_match('#^/posts/(\d+)/comments$#', $path, $m) && $method === 'POST') {
        handleCommentsCreate((int)$m[1]);

    // ---- Comments ----
    } elseif (preg_match('#^/comments/(\d+)$#', $path, $m) && $method === 'DELETE') {
        handleCommentsDelete((int)$m[1]);

    // ---- Notifications ----
    } elseif ($path === '/notifications' && $method === 'GET') {
        handleNotificationsList();
    } elseif ($path === '/notifications/unread' && $method === 'GET') {
        handleNotificationsUnread();
    } elseif ($path === '/notifications/read' && $method === 'PUT') {
        handleNotificationsRead();
    } elseif ($path === '/notifications/read' && $method === 'POST') {
        handleNotificationsReadOne();

    // ---- Conversations ----
    } elseif ($path === '/conversations' && $method === 'GET') {
        handleConversationsList();
    } elseif ($path === '/conversations' && $method === 'POST') {
        handleConversationsCreate();
    } elseif ($path === '/conversations/unread' && $method === 'GET') {
        handleConversationsUnread();
    } elseif (preg_match('#^/conversations/(\d+)/messages$#', $path, $m) && $method === 'GET') {
        handleConversationMessages((int)$m[1]);
    } elseif (preg_match('#^/conversations/(\d+)/messages$#', $path, $m) && $method === 'POST') {
        handleConversationSend((int)$m[1]);
    } elseif (preg_match('#^/conversations/(\d+)/read$#', $path, $m) && $method === 'POST') {
        handleConversationRead((int)$m[1]);
    } elseif (preg_match('#^/conversations/(\d+)/members$#', $path, $m) && $method === 'GET') {
        handleConversationMembers((int)$m[1]);
    } elseif (preg_match('#^/conversations/(\d+)/members$#', $path, $m) && $method === 'POST') {
        handleConversationAddMember((int)$m[1]);

    // ---- Upload ----
    } elseif ($path === '/upload/image' && $method === 'POST') {
        handleUploadImage();
    } elseif ($path === '/upload/video' && $method === 'POST') {
        handleUploadVideo();

    // ---- Music ----
    } elseif ($path === '/music' && $method === 'GET') {
        handleMusicList();
    } elseif ($path === '/music' && $method === 'POST') {
        handleMusicCreate();
    } elseif (preg_match('#^/music/(\d+)/play$#', $path, $m) && $method === 'POST') {
        handleMusicPlay((int)$m[1]);
    } elseif (preg_match('#^/music/(\d+)$#', $path, $m) && $method === 'PUT') {
        handleMusicUpdate((int)$m[1]);
    } elseif (preg_match('#^/music/(\d+)$#', $path, $m) && $method === 'DELETE') {
        handleMusicDelete((int)$m[1]);

    // ---- User Playlists ----
    } elseif ($path === '/music/playlists' && $method === 'GET') {
        handleUserPlaylistsList();
    } elseif ($path === '/music/playlists' && $method === 'POST') {
        handleUserPlaylistCreate();
    } elseif (preg_match('#^/music/playlists/(\d+)$#', $path, $m) && $method === 'GET') {
        handleUserPlaylistShow((int)$m[1]);
    } elseif (preg_match('#^/music/playlists/(\d+)$#', $path, $m) && $method === 'PUT') {
        handleUserPlaylistUpdate((int)$m[1]);
    } elseif (preg_match('#^/music/playlists/(\d+)$#', $path, $m) && $method === 'DELETE') {
        handleUserPlaylistDelete((int)$m[1]);
    } elseif (preg_match('#^/music/playlists/(\d+)/tracks$#', $path, $m) && $method === 'POST') {
        handleUserPlaylistAddTrack((int)$m[1]);
    } elseif (preg_match('#^/music/playlists/(\d+)/tracks$#', $path, $m) && $method === 'DELETE') {
        handleUserPlaylistRemoveTrack((int)$m[1]);
    } elseif (preg_match('#^/music/playlists/(\d+)/tracks/sort$#', $path, $m) && $method === 'PUT') {
        handleUserPlaylistSortTracks((int)$m[1]);

    } else {
        error('接口不存在', 404);
    }
} catch (PDOException $e) {
    error('数据库错误: ' . $e->getMessage(), 500);
} catch (Throwable $e) {
    error('服务器错误: ' . $e->getMessage(), 500);
}
