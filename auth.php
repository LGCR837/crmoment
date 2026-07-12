<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CRMoment 授权登录</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", sans-serif;
            background: linear-gradient(180deg, #e8f4fa 0%, #f0f7fb 15%, #fdf6f8 40%, #fafcfe 70%, #f5f0f8 100%);
            color: #4a6075;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1.5;
        }

        .container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.8);
            box-shadow: 0 8px 32px rgba(150, 170, 190, 0.25);
            max-width: min(480px, calc(100% - 32px));
            width: 100%;
            padding: 32px;
        }

        .logo {
            text-align: center;
            margin-bottom: 24px;
        }

        .logo-img {
            width: 180px;
            height: auto;
            margin-bottom: 12px;
        }

        .logo-title {
            font-size: 20px;
            font-weight: 600;
            background: linear-gradient(135deg, #4a9fc7, #7ec8e3);
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
        }

        .subtitle {
            font-size: 14px;
            color: #8a9db0;
            text-align: center;
            margin-bottom: 24px;
        }

        .auth-tabs {
            display: flex;
            gap: 0;
            margin-bottom: 20px;
            border-bottom: 1px solid rgba(150, 170, 190, 0.2);
        }

        .auth-tab {
            flex: 1;
            padding: 10px;
            border: none;
            background: none;
            font-size: 14px;
            font-weight: 500;
            color: #8a9db0;
            cursor: pointer;
            transition: color 0.2s, border-bottom-color 0.2s;
            font-family: inherit;
            border-bottom: 2px solid transparent;
        }

        .auth-tab.active {
            color: #4a9fc7;
            border-bottom-color: #7ec8e3;
        }

        .field-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 16px;
            transition: opacity 0.2s ease, max-height 0.2s ease, margin-bottom 0.2s ease;
            overflow: hidden;
        }

        .field-group.hidden {
            display: none;
        }

        .field-group.collapsed {
            opacity: 0;
            max-height: 0;
            margin-bottom: 0;
            pointer-events: none;
        }

        .field-label {
            font-size: 13px;
            font-weight: 500;
            color: #5a6f84;
        }

        .field-input {
            width: 100%;
            padding: 12px 14px;
            border: 2px solid rgba(150, 170, 190, 0.3);
            border-radius: 10px;
            font-size: 14px;
            font-family: inherit;
            color: #4a6075;
            background: rgba(255, 255, 255, 0.6);
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            box-sizing: border-box;
        }

        .field-input:focus {
            border-color: #7ec8e3;
            box-shadow: 0 0 0 3px rgba(126, 200, 227, 0.2);
        }

        .field-input::placeholder {
            color: #a0b8cc;
        }

        .error-message {
            color: #d4a0a0;
            font-size: 13px;
            padding: 4px 0;
            display: none;
        }

        .btn-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            width: 100%;
            padding: 12px 20px;
            border-radius: 20px;
            border: none;
            background: #7ec8e3;
            color: #fff;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
            font-family: inherit;
            margin-top: 8px;
        }

        .btn-primary:hover {
            background: #4a9fc7;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(126, 200, 227, 0.3);
        }

        .btn-primary:disabled {
            background: #a0b8cc;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .btn-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            width: 100%;
            padding: 12px 20px;
            border-radius: 20px;
            border: 1px solid #7ec8e3;
            background: transparent;
            color: #4a9fc7;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
            font-family: inherit;
            margin-top: 8px;
        }

        .btn-secondary:hover {
            background: rgba(126, 200, 227, 0.1);
        }

        .grant-section {
            text-align: center;
            padding: 24px 0;
        }

        .grant-icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(126, 200, 227, 0.1);
            border-radius: 50%;
            font-size: 32px;
            border: 2px solid rgba(126, 200, 227, 0.2);
        }

        .grant-title {
            font-size: 18px;
            font-weight: 600;
            color: #4a6075;
            margin-bottom: 8px;
        }

        .grant-desc {
            font-size: 14px;
            color: #8a9db0;
            margin-bottom: 24px;
            line-height: 1.6;
        }

        .grant-user {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 24px;
            padding: 16px;
            background: rgba(126, 200, 227, 0.05);
            border-radius: 12px;
        }

        .grant-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            object-fit: cover;
            background: #e0e0e0;
            border: 2px solid rgba(126, 200, 227, 0.4);
        }

        .grant-user-info {
            text-align: left;
        }

        .grant-nickname {
            font-weight: 500;
            font-size: 15px;
            color: #4a6075;
        }

        .grant-username {
            font-size: 13px;
            color: #8a9db0;
        }

        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .loading-text {
            font-size: 14px;
            color: #8a9db0;
            text-align: center;
            padding: 24px 0;
        }

        @media (max-width: 480px) {
            .container {
                padding: 24px;
                border-radius: 16px;
            }

            .logo-img {
                width: 140px;
            }
        }
    </style>
</head>
<body>
    <div class="container" id="container">
        <div class="logo">
            <img src="/web/crmomentlogo.png" alt="CRMoment" class="logo-img">
        </div>

        <div class="subtitle" id="subtitle">授权登录</div>

        <div id="loading" style="display:none">
            <div class="loading-text">
                <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px">
                    <div class="spinner" style="border-top-color:#7ec8e3;border-color:rgba(126,200,227,0.2)"></div>
                    <span>加载中...</span>
                </div>
            </div>
        </div>

        <div id="auth-form" style="display:none">
            <div class="grant-icon">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#7ec8e3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
                    <line x1="12" y1="22" x2="12" y2="15.5"/>
                    <polyline points="22 8.5 12 15.5 2 8.5"/>
                    <polyline points="2 15.5 12 8.5 22 15.5"/>
                    <line x1="12" y1="2" x2="12" y2="8.5"/>
                </svg>
            </div>
            <div class="auth-tabs">
                <button class="auth-tab active" id="tab-login">登录</button>
                <button class="auth-tab" id="tab-register">注册</button>
            </div>

            <div class="field-group">
                <label class="field-label">用户名</label>
                <input type="text" id="username" class="field-input" placeholder="请输入用户名" autocomplete="username">
            </div>

            <div class="field-group collapsed" id="nickname-group">
                <label class="field-label">昵称</label>
                <input type="text" id="nickname" class="field-input" placeholder="请输入昵称">
            </div>

            <div class="field-group">
                <label class="field-label">密码</label>
                <input type="password" id="password" class="field-input" placeholder="请输入密码" autocomplete="current-password">
            </div>

            <div class="field-group collapsed" id="password-confirm-group">
                <label class="field-label">确认密码</label>
                <input type="password" id="password-confirm" class="field-input" placeholder="请再次输入密码" autocomplete="new-password">
            </div>

            <div id="error-message" class="error-message"></div>

            <button class="btn-primary" id="submit-btn">登录</button>
        </div>

        <div id="grant-page" style="display:none">
            <div class="grant-section">
                <div class="grant-icon">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#7ec8e3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
                        <line x1="12" y1="22" x2="12" y2="15.5"/>
                        <polyline points="22 8.5 12 15.5 2 8.5"/>
                        <polyline points="2 15.5 12 8.5 22 15.5"/>
                        <line x1="12" y1="2" x2="12" y2="8.5"/>
                    </svg>
                </div>
                <div class="grant-title">授权登录</div>
                <div class="grant-desc">
                    CRMusic Neo 请求使用您的 CRMoment 账号进行登录<br>
                    授权后将获得您的基本信息访问权限
                </div>
                <div class="grant-user" id="grant-user">
                    <img id="user-avatar" src="/uploads/avatars/default.svg" class="grant-avatar">
                    <div class="grant-user-info">
                        <div class="grant-nickname" id="user-nickname"></div>
                        <div class="grant-username" id="user-username"></div>
                    </div>
                </div>
                <div style="display:flex;gap:12px">
                    <button class="btn-secondary" id="btn-deny">拒绝</button>
                    <button class="btn-primary" id="btn-allow">允许</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get('url') || '';

        let authMode = 'login';

        function showError(msg) {
            const el = document.getElementById('error-message');
            el.textContent = msg;
            el.style.display = 'block';
        }

        function hideError() {
            document.getElementById('error-message').style.display = 'none';
        }

        function switchAuthMode(mode) {
            authMode = mode;
            document.getElementById('tab-login').classList.toggle('active', mode === 'login');
            document.getElementById('tab-register').classList.toggle('active', mode === 'register');
            document.getElementById('submit-btn').textContent = mode === 'login' ? '登录' : '注册';
            
            const nicknameGroup = document.getElementById('nickname-group');
            const passwordConfirmGroup = document.getElementById('password-confirm-group');
            
            if (mode === 'register') {
                nicknameGroup.classList.remove('hidden');
                passwordConfirmGroup.classList.remove('hidden');
                requestAnimationFrame(() => {
                    nicknameGroup.classList.remove('collapsed');
                    passwordConfirmGroup.classList.remove('collapsed');
                });
            } else {
                nicknameGroup.classList.add('collapsed');
                passwordConfirmGroup.classList.add('collapsed');
                setTimeout(() => {
                    nicknameGroup.classList.add('hidden');
                    passwordConfirmGroup.classList.add('hidden');
                }, 200);
            }
            hideError();
        }

        document.getElementById('tab-login').addEventListener('click', () => switchAuthMode('login'));
        document.getElementById('tab-register').addEventListener('click', () => switchAuthMode('register'));

        async function submitAuth() {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const nickname = document.getElementById('nickname').value.trim();
            const passwordConfirm = document.getElementById('password-confirm').value;

            hideError();

            if (!username || !password) {
                showError('用户名和密码不能为空');
                return;
            }

            if (authMode === 'register') {
                if (password !== passwordConfirm) {
                    showError('两次密码输入不一致');
                    return;
                }
                if (!nickname) {
                    showError('请填写昵称');
                    return;
                }
            }

            const btn = document.getElementById('submit-btn');
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner"></div> 处理中...';

            try {
                const endpoint = authMode === 'login' ? '/api.php?route=/auth/login' : '/api.php?route=/auth/register';
                const body = authMode === 'login' 
                    ? JSON.stringify({ username, password })
                    : JSON.stringify({ username, nickname, password });

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: body
                });

                const data = await res.json();

                if (data.code !== 0) {
                    showError(data.message || '操作失败');
                    btn.disabled = false;
                    btn.textContent = authMode === 'login' ? '登录' : '注册';
                    return;
                }

                const token = data.data.token;
                localStorage.setItem('crmoment-token', token);
                completeAuth(token);

            } catch (e) {
                showError('网络错误，请稍后重试');
                btn.disabled = false;
                btn.textContent = authMode === 'login' ? '登录' : '注册';
            }
        }

        document.getElementById('submit-btn').addEventListener('click', submitAuth);

        async function checkLogin() {
            document.getElementById('loading').style.display = 'block';

            try {
                const token = localStorage.getItem('crmoment-token');
                if (!token) {
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('auth-form').style.display = 'block';
                    return;
                }

                const res = await fetch(`/api.php?route=/user/me&token=${encodeURIComponent(token)}`);
                const data = await res.json();

                if (data.code !== 0) {
                    localStorage.removeItem('crmoment-token');
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('auth-form').style.display = 'block';
                    return;
                }

                const user = data.data;
                document.getElementById('user-avatar').src = user.avatar || '/uploads/avatars/default.svg';
                document.getElementById('user-nickname').textContent = user.nickname || user.username;
                document.getElementById('user-username').textContent = '@' + user.username;

                document.getElementById('loading').style.display = 'none';
                document.getElementById('grant-page').style.display = 'block';

            } catch (e) {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('auth-form').style.display = 'block';
            }
        }

        function completeAuth(token) {
            if (redirectUrl) {
                const url = new URL(redirectUrl);
                url.searchParams.set('token', token);
                window.location.href = url.toString();
            } else {
                window.location.href = '/web/';
            }
        }

        document.getElementById('btn-allow').addEventListener('click', () => {
            const token = localStorage.getItem('crmoment-token');
            if (token) {
                completeAuth(token);
            }
        });

        document.getElementById('btn-deny').addEventListener('click', () => {
            if (redirectUrl) {
                window.location.href = redirectUrl;
            } else {
                window.location.href = '/web/';
            }
        });

        checkLogin();
    </script>
</body>
</html>