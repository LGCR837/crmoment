<?php
/**
 * CRMoment - Ragemi OAuth 回调入口
 *
 * 这是 Ragemi 授权后重定向回来的地址。
 * 流程：收到 code + state → 换 token → 获取用户信息 → 绑定/登录 → 重定向到前端
 *
 * 回调地址（在 Ragemi 开发者平台注册时填写）：
 *   https://crmoment.ccwu.cc/ragemi-callback.php
 */

require_once __DIR__ . '/api_config.php';
require_once __DIR__ . '/api_helpers.php';

// ----- 工具函数：发送 POST 请求 -----
function ragemiHttpPost(string $url, array $data): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($data),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $body = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['error' => 'http_request_failed', 'error_description' => $error];
    }

    $result = json_decode($body, true);
    if (!$result) {
        return ['error' => 'invalid_response', 'error_description' => '无法解析响应: ' . substr($body, 0, 200)];
    }

    if ($httpCode >= 400) {
        return $result + ['_http_code' => $httpCode];
    }

    return $result;
}

// ----- 工具函数：发送 GET 请求（带 Token）-----
function ragemiHttpGet(string $url, string $accessToken): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $accessToken],
    ]);
    $body = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    $result = json_decode($body, true);
    if (!$result) {
        $result = ['error' => 'invalid_response', 'error_description' => '无法解析响应: ' . substr($body, 0, 200)];
    }
    $result['_debug_http_code'] = $httpCode;
    $result['_debug_curl_error'] = $error;
    $result['_debug_auth_header'] = 'Authorization: Bearer ' . substr($accessToken, 0, 12) . '...(截断)';
    $result['_debug_request_url'] = $url;
    return $result;
}

// ----- 工具函数：重定向到前端 -----
function redirectToWeb(array $params): void {
    $query = http_build_query($params);
    $baseUrl = (defined('SITE_URL') && SITE_URL ? SITE_URL : 'https://crmoment.ccwu.cc');
    header('Location: ' . $baseUrl . '/web/?' . $query);
    exit;
}

// ===== 主逻辑 =====

// 检查配置
if (!RAGEMI_CLIENT_ID || !RAGEMI_CLIENT_SECRET) {
    redirectToWeb(['ragemi_error' => 'OAuth 未配置，请联系管理员']);
}

// 获取 Ragemi 回调参数
$code  = $_GET['code'] ?? '';
$state = $_GET['state'] ?? '';
$error = $_GET['error'] ?? '';

// 用户拒绝授权
if ($error === 'access_denied') {
    redirectToWeb(['ragemi_error' => '你已取消 Ragemi 授权']);
}

// 验证 code
if (!$code) {
    redirectToWeb(['ragemi_error' => '缺少授权码']);
}

// 解码 state（JSON: {action, token}）
$stateData = [];
if ($state) {
    $decoded = base64_decode($state, true);
    if ($decoded) {
        $stateData = json_decode($decoded, true) ?: [];
    }
}

$action = $stateData['action'] ?? 'login'; // bind 或 login

// 1. 用 code 换取 access_token
$tokenResult = ragemiHttpPost('https://ragemi.com/oauth/token', [
    'grant_type'    => 'authorization_code',
    'code'          => $code,
    'client_id'     => RAGEMI_CLIENT_ID,
    'client_secret' => RAGEMI_CLIENT_SECRET,
    'redirect_uri'  => RAGEMI_REDIRECT_URI,
]);

if (!empty($tokenResult['error'])) {
    $errDesc = $tokenResult['error_description'] ?? $tokenResult['error'];
    redirectToWeb(['ragemi_error' => 'Token 换取失败: ' . $errDesc]);
}

$accessToken  = $tokenResult['access_token'] ?? '';
$refreshToken = $tokenResult['refresh_token'] ?? '';

if (!$accessToken) {
    redirectToWeb(['ragemi_error' => '未获取到 access_token']);
}

// 2. 获取用户信息
$userInfo = ragemiHttpGet('https://ragemi.com/api/user_me', $accessToken);

// --- 调试输出 ---
header('Content-Type: text/html; charset=utf-8');
echo '<h2>Ragemi Debug</h2>';
echo '<h3>Token 换取结果</h3>';
echo '<pre>' . htmlspecialchars(json_encode($tokenResult, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
echo '<h3>user_me 响应（请求方式见下方 _debug_auth_header）</h3>';
echo '<pre>' . htmlspecialchars(json_encode($userInfo, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
exit;

// 3. 根据 action 处理
$pdo = getDB();

if ($action === 'bind') {
    // ---- 绑定流程：验证 CRMoment token，关联 ragemi_id ----
    $crmomentToken = $stateData['token'] ?? '';
    if (!$crmomentToken) {
        redirectToWeb(['ragemi_error' => '绑定失败：缺少登录凭证']);
    }

    $userId = validateToken($crmomentToken);
    if (!$userId) {
        redirectToWeb(['ragemi_error' => '绑定失败：登录已过期，请重新登录']);
    }

    // 检查该 ragemi_id 是否已被其他账号绑定
    $stmt = $pdo->prepare('SELECT id FROM users WHERE ragemi_id = ? AND id != ?');
    $stmt->execute([$ragemiId, $userId]);
    if ($stmt->fetch()) {
        redirectToWeb(['ragemi_error' => '该 Ragemi 账号已被其他 CRMoment 账号绑定']);
    }

    // 更新用户 ragemi_id
    $stmt = $pdo->prepare('UPDATE users SET ragemi_id = ? WHERE id = ?');
    $stmt->execute([$ragemiId, $userId]);

    redirectToWeb(['ragemi_bound' => '1']);

} else {
    // ---- 登录流程：通过 ragemi_id 查找用户并登录 ----
    $stmt = $pdo->prepare('SELECT id, username, nickname, avatar, bio FROM users WHERE ragemi_id = ?');
    $stmt->execute([$ragemiId]);
    $user = $stmt->fetch();

    if (!$user) {
        redirectToWeb(['ragemi_error' => '该 Ragemi 账号未绑定任何 CRMoment 账号']);
    }

    // 创建 CRMoment token
    $token = createTokenForUser((int)$user['id']);

    redirectToWeb(['token' => $token]);
}