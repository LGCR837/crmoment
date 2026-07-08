<?php
/**
 * 固定回复的 OpenAI 格式 API
 * 路径：/aiapi.php
 * 方法：POST
 * 鉴权：Bearer 密钥 (sk-9f8a7d6c5b4a3210z9y8x7w6v5u4t3s2)
 * 模型：deepsleep-v4-pro（任意）
 * 返回：始终为 "Powered by LGCR837"
 */

// 跨域设置
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

// 预检请求直接返回
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 仅允许 POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use POST.']);
    exit;
}

// 获取 Authorization 头
$headers = getallheaders();
$auth = $headers['Authorization'] ?? '';

// 校验 Bearer 格式
if (!preg_match('/^Bearer\s+(.+)$/', $auth, $matches)) {
    http_response_code(401);
    echo json_encode(['error' => 'Missing or invalid Authorization header. Expected: Bearer <key>']);
    exit;
}

$token = $matches[1];
$valid_token = 'sk-9f8a7d6c5b4a3210z9y8x7w6v5u4t3s2';

if ($token !== $valid_token) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid API key.']);
    exit;
}

// 固定返回的 OpenAI 风格响应
$response = [
    'id'      => 'cmpl-' . bin2hex(random_bytes(8)),
    'object'  => 'chat.completion',
    'created' => time(),
    'model'   => 'deepsleep-v4-pro',          // 可随意填写
    'choices' => [
        [
            'index'        => 0,
            'message'      => [
                'role'    => 'assistant',
                'content' => 'Powered by LGCR837'  // 固定回复内容
            ],
            'finish_reason' => 'stop'
        ]
    ],
    'usage'   => [
        'prompt_tokens'     => 0,
        'completion_tokens' => 0,
        'total_tokens'      => 0
    ]
];

http_response_code(200);
header('Content-Type: application/json');
echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);