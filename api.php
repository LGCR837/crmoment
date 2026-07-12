<?php
/**
 * CRMoment - 通用 API 入口点
 *
 * 适用于无 URL 重写/Nginx 配置权限的虚拟主机环境。
 * 使用 GET 参数路由，兼容所有 PHP 主机。
 *
 * 用法：  /api.php?route=/posts          （推荐，最可靠）
 *         /api.php?route=/auth/login      （POST 请求时用 ?route=）
 *         /api.php/posts                  （PATH_INFO 方式，取决于主机是否支持）
 *
 * 这个文件放在网站根目录，不需要任何 URL 重写规则。
 */

// CORS 跨域支持：允许子域名 music.crmoment.ccwu.cc 访问 API
$allowedOrigins = ['https://music.crmoment.ccwu.cc'];
if (!empty($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Auth-Token');
    // 预检请求直接返回 204
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// 构建 $_GET['route']：优先取查询参数，再尝试 PATH_INFO
if (!empty($_GET['route'])) {
    // /api.php?route=/posts
    $route = '/' . ltrim($_GET['route'], '/');
} elseif (!empty($_SERVER['PATH_INFO'])) {
    // /api.php/posts
    $route = '/' . ltrim($_SERVER['PATH_INFO'], '/');
} else {
    // 直接访问 /api.php → 返回 API 信息
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'code'    => 0,
        'message' => 'CRMoment API',
        'data'    => [
            'version'   => '1.0',
            'usage'     => '请在 URL 末尾加上 ?route=/接口路径',
            'example'   => '/api.php?route=/posts',
            'docs'      => '/docs/deployment.md',
        ],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 把 route 写入 $_SERVER['APP_ROUTE']，让 app/index.php 读取
$_SERVER['APP_ROUTE'] = $route;

// 引入主路由文件
require __DIR__ . '/api_index.php';
