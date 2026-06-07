<?php
/**
 * CRMoment - 数据库与 Session 配置
 */

// 修改为你的数据库连接信息
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'serad2nim77d3wq');
define('DB_USER', 'serad2nim77d3wq');
define('DB_PASS', '4JZQTTQHSHP8');
define('DB_CHARSET', 'utf8mb4');

// 站点 URL（结尾不要斜杠）
define('SITE_URL', 'https://crmoment.ccwu.cc');

// 上传限制
define('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB
define('ALLOWED_EXTENSIONS', ['jpg', 'jpeg', 'png', 'gif', 'webp']);

// 分页默认值
define('PAGE_SIZE', 20);

/**
 * 获取 PDO 数据库连接
 */
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', DB_HOST, DB_PORT, DB_NAME, DB_CHARSET);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

/**
 * 启动 Session（配置安全 Cookie）
 */
function initSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}
