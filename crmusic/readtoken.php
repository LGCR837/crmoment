<?php
$token = $_GET['token'] ?? '';
$userInfo = null;
$error = '';

if ($token) {
    require_once '../api_helpers.php';
    
    $userId = validateToken($token);
    if ($userId) {
        $pdo = getDB();
        $stmt = $pdo->prepare('SELECT id, username, nickname, avatar, bio FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $userInfo = $stmt->fetch();
        if ($userInfo) {
            $userInfo['id'] = (int)$userInfo['id'];
        }
    } else {
        $error = 'Token 无效或已过期';
    }
} else {
    $error = '未获取到授权信息';
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>登录中...</title>
    <style>
        body {
            font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", sans-serif;
            background: linear-gradient(180deg, #e8f4fa 0%, #f0f7fb 15%, #fdf6f8 40%, #fafcfe 70%, #f5f0f8 100%);
            color: #4a6075;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            text-align: center;
            padding: 40px;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(126, 200, 227, 0.2);
            border-top-color: #7ec8e3;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 16px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .message {
            font-size: 16px;
            color: #8a9db0;
        }
        .error {
            color: #d4a0a0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <div class="message" id="message"><?php echo $error ? htmlspecialchars($error) : '正在完成登录...'; ?></div>
    </div>

    <script>
        var token = <?php echo $token ? "'" . htmlspecialchars($token, ENT_QUOTES) . "'" : 'null'; ?>;
        var userInfo = <?php echo $userInfo ? json_encode($userInfo) : 'null'; ?>;

        if (token && userInfo) {
            localStorage.setItem('crmoment-token', token);
            localStorage.setItem('crmoment-user', JSON.stringify(userInfo));
            var redirectUrl = '/?token=' + encodeURIComponent(token) + '&user=' + encodeURIComponent(JSON.stringify(userInfo));
            setTimeout(function() {
                window.location.replace(redirectUrl);
            }, 100);
        } else if (token) {
            localStorage.setItem('crmoment-token', token);
            var redirectUrl = '/?token=' + encodeURIComponent(token);
            setTimeout(function() {
                window.location.replace(redirectUrl);
            }, 100);
        } else {
            document.getElementById('message').classList.add('error');
            setTimeout(function() {
                window.location.href = '/';
            }, 2000);
        }
    </script>
</body>
</html>