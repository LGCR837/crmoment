<?php
/**
 * CRMoment - 数据库与基本配置
 */

// 修改为你的数据库连接信息
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', '数据库名称');
define('DB_USER', '数据库用户');
define('DB_PASS', '数据库密码');
define('DB_CHARSET', 'utf8mb4');

// 站点 URL（结尾不要斜杠）
define('SITE_URL', '');

// 上传限制
define('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB
define('MAX_VIDEO_SIZE', 28 * 1024 * 1024); // 28MB
define('ALLOWED_EXTENSIONS', ['jpg', 'jpeg', 'png', 'gif', 'webp']);
define('ALLOWED_VIDEO_EXTENSIONS', ['mp4', 'webm', 'mov', 'avi']);

// 分页默认值
define('PAGE_SIZE', 20);

// Cloudflare Turnstile 人机验证配置（https://developers.cloudflare.com/turnstile/）
// 站点密钥用于前端页面渲染小部件，密钥用于后端服务器端验证
define('TURNSTILE_SITE_KEY', '这里填SiteKey');
define('TURNSTILE_SECRET_KEY', '这里填SecretKey');

// Ragemi OAuth 配置（https://ragemi.com/oauth/docs）
// 在 https://ragemi.com/developer 创建应用后获取 client_id 和 client_secret
define('RAGEMI_CLIENT_ID', '已废弃');
define('RAGEMI_CLIENT_SECRET', '已废弃');
define('RAGEMI_REDIRECT_URI', (defined('SITE_URL') && SITE_URL ? SITE_URL : 'https://crmoment.ccwu.cc') . '/ragemi-callback.php');

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
