<?php
/**
 * CRMoment - Ragemi OAuth 绑定 API
 *
 * 提供 API 端点供前端调用，管理 Ragemi 账号的绑定/解绑/查询。
 * 实际的 OAuth 回调流程在 ragemi-callback.php 中处理。
 */

/**
 * GET /auth/ragemi/url
 * 返回 Ragemi 授权 URL，前端可直接跳转
 *
 * 参数（可选）：
 *   action: bind | login（默认 login）
 *     当 action=bind 时，state 中会携带当前用户的 token 用于回调后自动绑定
 */
function handleRagemiAuthUrl(): void {
    assertMethod('GET');

    if (!RAGEMI_CLIENT_ID) {
        error('Ragemi OAuth 未配置，请联系管理员', 500);
    }

    $action = getParam('action', 'login');

    // 构造 state（base64 编码的 JSON）
    $stateData = [
        'action' => $action,
    ];

    // 如果是绑定操作，需要传入当前用户的 token 用于回调后验证身份
    if ($action === 'bind') {
        $token = getTokenFromRequest();
        if (!$token) {
            error('绑定需要先登录', 401);
        }
        // 验证 token 有效性
        $userId = validateToken($token);
        if (!$userId) {
            error('登录已过期，请重新登录', 401);
        }
        $stateData['token'] = $token;
    }

    $state = base64_encode(json_encode($stateData));

    // 构建授权 URL
    $params = http_build_query([
        'client_id'     => RAGEMI_CLIENT_ID,
        'redirect_uri'  => RAGEMI_REDIRECT_URI,
        'response_type' => 'code',
        'scope'         => 'basic',
        'state'         => $state,
    ]);

    $url = 'https://ragemi.com/oss?' . $params;

    success(['url' => $url]);
}

/**
 * GET /auth/ragemi/status
 * 查询当前登录用户是否已绑定 Ragemi 账号
 * 返回：{ bound: bool, ragemi_username: string|null, ragemi_nickname: string|null }
 */
function handleRagemiStatus(): void {
    assertMethod('GET');
    $userId = requireLogin();

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT ragemi_id FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user || !$user['ragemi_id']) {
        success(['bound' => false]);
        return;
    }

    // 尝试获取 Ragemi 用户信息（从缓存 — 目前只存了 ID，前端显示"已绑定"即可）
    success([
        'bound'           => true,
        'ragemi_username' => null,
        'ragemi_nickname' => null,
    ]);
}

/**
 * POST /auth/ragemi/bind
 * 用授权码绑定 Ragemi 账号到当前用户
 * Body: { code: "授权码" }
 *
 * 注意：这是纯 API 方式（前端通过回调页面处理居多），
 * 但也可以用于前端在回调页面中获取 code 后通过 AJAX 绑定。
 */
function handleRagemiBind(): void {
    assertMethod('POST');
    $userId = requireLogin();
    $data   = getJsonBody();
    $code   = trim($data['code'] ?? '');

    if (!$code) {
        error('缺少授权码');
    }

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
        error('Token 换取失败: ' . $errDesc);
    }

    $accessToken = $tokenResult['access_token'] ?? '';
    if (!$accessToken) {
        error('未获取到 access_token');
    }

    // 2. 获取用户信息
    $userInfo = ragemiHttpGet('https://ragemi.com/api/user_me', $accessToken);

    if (!empty($userInfo['error'])) {
        $errDesc = $userInfo['error_description'] ?? $userInfo['msg'] ?? $userInfo['error'];
        error('获取用户信息失败: ' . $errDesc);
    }

    $ragemiId = $userInfo['id'] ?? $userInfo['user_id'] ?? '';
    if (!$ragemiId) {
        error('未获取到 Ragemi 用户 ID，原始响应: ' . json_encode($userInfo, JSON_UNESCAPED_UNICODE));
    }

    $pdo = getDB();

    // 3. 检查该 ragemi_id 是否已被其他账号绑定
    $stmt = $pdo->prepare('SELECT id FROM users WHERE ragemi_id = ? AND id != ?');
    $stmt->execute([$ragemiId, $userId]);
    if ($stmt->fetch()) {
        error('该 Ragemi 账号已被其他 CRMoment 账号绑定');
    }

    // 4. 绑定
    $stmt = $pdo->prepare('UPDATE users SET ragemi_id = ? WHERE id = ?');
    $stmt->execute([$ragemiId, $userId]);

    success(null, 'Ragemi 账号绑定成功');
}

/**
 * POST /auth/ragemi/unbind
 * 解绑 Ragemi 账号
 */
function handleRagemiUnbind(): void {
    assertMethod('POST');
    $userId = requireLogin();

    $pdo  = getDB();
    $stmt = $pdo->prepare('UPDATE users SET ragemi_id = NULL WHERE id = ?');
    $stmt->execute([$userId]);

    success(null, 'Ragemi 账号已解绑');
}

// ====== 工具函数（与 ragemi-callback.php 共享） ======

if (!function_exists('ragemiHttpPost')) {
    /**
     * 发送 POST 请求到 Ragemi OAuth API
     */
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
}

if (!function_exists('ragemiHttpGet')) {
    /**
     * GET 请求 Ragemi API，Access Token 放在 Authorization: Bearer 请求头中
     * （官方文档：https://ragemi.com/oauth/docs —— 调用 API 需在请求头携带 token）
     */
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
}