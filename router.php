<?php
/**
 * CRMoment - PHP 内置服务器路由脚本
 * 用于开发环境：php -S 127.0.0.1:80 router.php
 *
 * 将 /app/* 请求转发到 app/index.php
 * 将其他路径按文件提供服务
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// API 路由：所有 /app/* 请求交给 api_index.php
if (preg_match('#^/app(/|$)#', $uri)) {
    require __DIR__ . '/api_index.php';
    return true;
}

// API 路由：/api.php 直接交给 api.php
if ($uri === '/api.php' && isset($_GET['route'])) {
    require __DIR__ . '/api.php';
    return true;
}

// 静态文件：存在则直接返回 false 让 PHP 内置服务器处理
$filePath = __DIR__ . $uri;
if (is_file($filePath)) {
    return false;
}

// 前端 SPA：对于 web/ 下的请求，如果文件不存在，返回 web/index.html
if (preg_match('#^/web/#', $uri) || $uri === '/web') {
    $webPath = __DIR__ . '/web' . preg_replace('#^/web#', '', $uri);
    if (is_file($webPath)) {
        return false;
    }
    require __DIR__ . '/web/index.html';
    return true;
}

// 根路径或未知路径
$rootPath = __DIR__ . $uri;
if (is_file($rootPath)) {
    return false;
}
require __DIR__ . '/web/index.html';
return true;
