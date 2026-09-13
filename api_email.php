<?php
/**
 * CRMoment - 邮箱绑定 API
 *
 * 提供邮箱绑定/解绑/状态查询功能。
 * 验证流程：发送验证链接到邮箱 → 用户点击链接 → 验证 token → 绑定完成
 */

/**
 * 发送邮件（通过 SendCloud API）
 * 
 * @param string $to      收件人邮箱（多个用英文逗号分隔）
 * @param string $subject 邮件主题
 * @param string $body    邮件正文（纯文本）
 * @param string $fromName 发件人显示名称（默认为 "CRMoment"）
 * 
 * @return array [
 *     'success' => bool,        // 是否发送成功
 *     'message' => string,      // 状态信息或错误详情
 *     'emailId' => string|null  // 成功时的邮件ID（可选）
 * ]
 */
function sendMail($to, $subject, $body, $fromName = 'CRMoment', $fromEmail = null) {
    // ===== SendCloud 邮件服务凭证 =====
    $apiUser = 'crmomentsystememail';
    $apiKey  = '5f3c1bae18152f9a49c45a607e61c10e';
    if ($fromEmail === null) {
        $fromEmail = $apiUser . '@mail.crweb.ccwu.cc'; // 默认发件人地址
    }
    // ====================================

    // 初始化 cURL
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api2.sendcloud.net/api/mail/send');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    // 构建 POST 参数
    $postFields = [
        'apiUser'  => $apiUser,
        'apiKey'   => $apiKey,
        'from'     => $fromEmail,
        'fromName' => $fromName,
        'to'       => $to,
        'subject'  => $subject,
        'plain'    => $body,
    ];
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);

    // 执行请求
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    // 检查 cURL 错误
    if ($curlError) {
        return [
            'success' => false,
            'message' => 'cURL 错误: ' . $curlError,
            'emailId' => null
        ];
    }

    // 检查 HTTP 状态码
    if ($httpCode !== 200) {
        return [
            'success' => false,
            'message' => 'HTTP 状态码异常: ' . $httpCode,
            'emailId' => null
        ];
    }

    // 解析 JSON 响应
    $result = json_decode($response, true);
    if (!isset($result['result'])) {
        return [
            'success' => false,
            'message' => 'API 响应格式异常: ' . $response,
            'emailId' => null
        ];
    }

    // 判断业务结果
    if ($result['result'] === true) {
        $emailId = $result['info']['emailIdList'][0] ?? null;
        return [
            'success' => true,
            'message' => '发送成功',
            'emailId' => $emailId
        ];
    } else {
        $errorMsg = $result['message'] ?? '未知错误';
        return [
            'success' => false,
            'message' => '发送失败: ' . $errorMsg,
            'emailId' => null
        ];
    }
}

/**
 * 生成验证 URL
 */
function getEmailVerifyUrl(string $token): string {
    $baseUrl = (defined('SITE_URL') && SITE_URL ? SITE_URL : 'https://crmoment.ccwu.cc');
    return $baseUrl . '/email-verify.php?token=' . urlencode($token);
}

/**
 * POST /auth/email/send-code
 * 发送邮箱验证邮件
 * 
 * Body: { "email": "user@example.com" }
 * 如果用户已绑定邮箱，则发送到新邮箱（换绑流程）
 */
function handleEmailSendCode(): void {
    assertMethod('POST');
    $userId = requireLogin();
    $data   = getJsonBody();
    $email  = trim($data['email'] ?? '');

    if (!$email) {
        error('请输入邮箱地址');
    }

    // 验证邮箱格式
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error('邮箱格式不正确');
    }

    $pdo = getDB();

    // 检查该邮箱是否已被其他用户绑定
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND email_verified = 1 AND id != ?');
    $stmt->execute([$email, $userId]);
    if ($stmt->fetch()) {
        error('该邮箱已被其他账号绑定');
    }

    // 检查该邮箱是否近期已发送过验证（防刷，同一邮箱 60 秒内不可重复发送）
    $stmt = $pdo->prepare(
        'SELECT id FROM email_verifications WHERE email = ? AND used = 0 AND created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND)'
    );
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        error('验证邮件已发送，请稍后再试');
    }

    // 生成验证 token
    $token = bin2hex(random_bytes(32)); // 64 字符
    $verifyUrl = getEmailVerifyUrl($token);

    // 构建邮件正文
    $body = "CRMoment 系统通知\n";
    $body .= "您正在进行邮箱绑定操作，如果不是您在操作，请忽略本邮件。\n";
    $body .= $verifyUrl . "\n";
    $body .= "链接有效期 30min\n\n";
    $body .= date('Y.n.j H:i');

    // 发送邮件
    $result = sendMail($email, 'CRMoment 系统通知', $body);
    if (!$result['success']) {
        error('邮件发送失败: ' . $result['message']);
    }

    // 将之前对该邮箱未使用的 token 标记为已使用
    $stmt = $pdo->prepare('UPDATE email_verifications SET used = 1 WHERE email = ? AND used = 0');
    $stmt->execute([$email]);

    // 保存验证记录
    $expiresAt = date('Y-m-d H:i:s', time() + 1800); // 30 分钟后过期
    $stmt = $pdo->prepare(
        'INSERT INTO email_verifications (user_id, email, token, expires_at, created_at)
         VALUES (?, ?, ?, ?, NOW())'
    );
    $stmt->execute([$userId, $email, $token, $expiresAt]);

    success(null, '验证邮件已发送，请检查您的邮箱（包括垃圾邮件）');
}

/**
 * GET /auth/email/status
 * 查询当前登录用户的邮箱绑定状态
 * 返回：{ bound: bool, email: string|null, verified: bool }
 */
function handleEmailStatus(): void {
    assertMethod('GET');
    $userId = requireLogin();

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT email, email_verified FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user || !$user['email']) {
        success(['bound' => false, 'email' => null, 'verified' => false]);
        return;
    }

    success([
        'bound'    => true,
        'email'    => $user['email'],
        'verified' => (bool)$user['email_verified'],
    ]);
}

/**
 * POST /auth/email/unbind
 * 解绑邮箱
 */
function handleEmailUnbind(): void {
    assertMethod('POST');
    $userId = requireLogin();

    $pdo  = getDB();
    $stmt = $pdo->prepare('UPDATE users SET email = NULL, email_verified = 0 WHERE id = ?');
    $stmt->execute([$userId]);

    // 同时清理该用户未使用的验证记录
    $stmt = $pdo->prepare('UPDATE email_verifications SET used = 1 WHERE user_id = ? AND used = 0');
    $stmt->execute([$userId]);

    success(null, '邮箱已解绑');
}