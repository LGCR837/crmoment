<?php
/**
 * 简单文件上传 - 拖拽上传获取直链
 * 文件保存到 uploads/file/
 */

// 上传目录
$uploadDir = __DIR__ . '/uploads/file/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$maxSize = 100 * 1024 * 1024; // 100MB

$isAjax = !empty($_SERVER['HTTP_X_REQUESTED_WITH']) && $_SERVER['HTTP_X_REQUESTED_WITH'] === 'XMLHttpRequest';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_FILES['file'])) {
    $file = $_FILES['file'];
    $result = null;

    if ($file['error'] !== UPLOAD_ERR_OK) {
        $result = ['ok' => false, 'error' => '上传失败，错误码: ' . $file['error']];
    } elseif ($file['size'] > $maxSize) {
        $result = ['ok' => false, 'error' => '文件不能超过 100MB'];
    } elseif ($file['size'] == 0) {
        $result = ['ok' => false, 'error' => '文件为空'];
    } else {
        $origName = $file['name'];
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $filename = bin2hex(random_bytes(16)) . ($ext ? '.' . $ext : '');
        $dest = $uploadDir . $filename;

        if (move_uploaded_file($file['tmp_name'], $dest)) {
            $url = '/uploads/file/' . $filename;
            $result = [
                'ok'   => true,
                'url'  => $url,
                'name' => $origName,
                'size' => $file['size'],
            ];
        } else {
            $result = ['ok' => false, 'error' => '文件保存失败，请检查目录权限'];
        }
    }

    if ($isAjax) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文件上传 - 获取直链</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #f0f2f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            background: #fff;
            border-radius: 16px;
            padding: 40px;
            width: 520px;
            max-width: 94vw;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
        }
        h1 {
            font-size: 22px;
            font-weight: 600;
            margin-bottom: 6px;
            color: #1a1a1a;
        }
        .sub {
            font-size: 14px;
            color: #888;
            margin-bottom: 24px;
        }
        .drop-zone {
            border: 2px dashed #ccc;
            border-radius: 12px;
            padding: 50px 20px;
            text-align: center;
            cursor: pointer;
            transition: .2s;
            background: #fafafa;
            position: relative;
        }
        .drop-zone:hover,
        .drop-zone.drag-over {
            border-color: #4f8cff;
            background: #f0f6ff;
        }
        .drop-zone .icon {
            font-size: 48px;
            color: #bbb;
            margin-bottom: 12px;
        }
        .drop-zone p {
            color: #666;
            font-size: 15px;
        }
        .drop-zone .hint {
            font-size: 12px;
            color: #aaa;
            margin-top: 8px;
        }
        .drop-zone input[type="file"] {
            display: none;
        }

        /* 状态提示 */
        .status {
            margin-top: 16px;
            padding: 12px 16px;
            border-radius: 10px;
            display: none;
            font-size: 14px;
        }
        .status.show {
            display: block;
        }
        .status.loading {
            background: #eef3ff;
            color: #4f8cff;
        }
        .status.success {
            background: #e8f8ed;
            color: #16a34a;
        }
        .status.error {
            background: #fee9e7;
            color: #dc2626;
        }

        /* 结果卡片 */
        .result {
            margin-top: 16px;
            border: 1px solid #e8edf4;
            border-radius: 10px;
            padding: 16px;
            display: none;
        }
        .result.show {
            display: block;
        }
        .result .label {
            font-size: 12px;
            color: #999;
            margin-bottom: 4px;
        }
        .result .url-box {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .result .url-box input {
            flex: 1;
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 8px 10px;
            font-size: 14px;
            color: #1a1a1a;
            background: #f9f9f9;
            outline: none;
            cursor: default;
        }
        .result .url-box .copy-btn {
            background: #4f8cff;
            color: #fff;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 14px;
            cursor: pointer;
            transition: .15s;
            white-space: nowrap;
        }
        .result .url-box .copy-btn:hover {
            background: #3b75e0;
        }
        .result .url-box .copy-btn.copied {
            background: #16a34a;
        }
        .result .file-info {
            font-size: 12px;
            color: #aaa;
            margin-top: 8px;
        }

        /* 上传进度 */
        .progress-bar {
            margin-top: 12px;
            height: 4px;
            border-radius: 4px;
            background: #e8edf4;
            overflow: hidden;
            display: none;
        }
        .progress-bar.show {
            display: block;
        }
        .progress-bar .bar {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #4f8cff, #6ba3ff);
            border-radius: 4px;
            transition: width .3s;
        }
    </style>
</head>
<body>

<div class="container">
    <h1>📁 文件上传</h1>
    <p class="sub">拖拽文件到下方区域，或点击选择文件</p>

    <!-- 拖拽区域 -->
    <div class="drop-zone" id="dropZone">
        <div class="icon">☁️</div>
        <p>拖拽文件到此处</p>
        <p class="hint">或点击选择 &middot; 支持任意格式 &middot; 最大 100MB</p>
        <input type="file" id="fileInput">
    </div>

    <!-- 状态 -->
    <div class="status" id="status"></div>

    <!-- 进度条 -->
    <div class="progress-bar" id="progressBar">
        <div class="bar" id="progressFill"></div>
    </div>

    <!-- 结果 -->
    <div class="result" id="result">
        <div class="label">直链（已自动复制到剪贴板）</div>
        <div class="url-box">
            <input type="text" id="urlInput" readonly spellcheck="false">
            <button class="copy-btn" id="copyBtn">复制</button>
        </div>
        <div class="file-info" id="fileInfo"></div>
    </div>
</div>

<script>
(function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const statusEl = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const resultEl = document.getElementById('result');
    const urlInput = document.getElementById('urlInput');
    const copyBtn = document.getElementById('copyBtn');
    const fileInfo = document.getElementById('fileInfo');

    let uploading = false;

    function setStatus(msg, type) {
        statusEl.textContent = msg;
        statusEl.className = 'status show ' + type;
    }

    function clearStatus() {
        statusEl.className = 'status';
    }

    function setProgress(pct) {
        progressBar.className = 'progress-bar show';
        progressFill.style.width = pct + '%';
    }

    function showResult(url, name, size) {
        const proto = location.protocol;
        const host = location.host;
        const fullUrl = proto + '//' + host + url;
        urlInput.value = fullUrl;
        fileInfo.textContent = name + ' · ' + formatSize(size);
        resultEl.className = 'result show';
        // 自动复制
        copyToClipboard(fullUrl);
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.textContent = '已复制';
                copyBtn.className = 'copy-btn copied';
                setTimeout(() => {
                    copyBtn.textContent = '复制';
                    copyBtn.className = 'copy-btn';
                }, 2000);
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        urlInput.select();
        try {
            document.execCommand('copy');
            copyBtn.textContent = '已复制';
            copyBtn.className = 'copy-btn copied';
            setTimeout(() => {
                copyBtn.textContent = '复制';
                copyBtn.className = 'copy-btn';
            }, 2000);
        } catch (e) {
            // ignore
        }
    }

    // 点击复制按钮
    copyBtn.addEventListener('click', function() {
        copyToClipboard(urlInput.value);
    });

    // 点击拖拽区域 → 打开文件选择
    dropZone.addEventListener('click', function() {
        if (!uploading) fileInput.click();
    });

    // 文件选择变化
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            uploadFile(this.files[0]);
            this.value = '';
        }
    });

    // 拖拽事件
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', function() {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (uploading) return;
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadFile(files[0]);
        }
    });

    function uploadFile(file) {
        if (uploading) return;
        uploading = true;
        resultEl.className = 'result';
        clearStatus();
        setProgress(0);

        setStatus('正在上传 ' + file.name + ' ...', 'loading');

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                setProgress(pct);
            }
        });

        xhr.addEventListener('load', function() {
            uploading = false;
            setProgress(0);
            progressBar.className = 'progress-bar';

            try {
                const resp = JSON.parse(xhr.responseText);
                if (resp.ok && resp.url) {
                    setStatus('✅ 上传成功！', 'success');
                    showResult(resp.url, resp.name, resp.size);
                } else {
                    setStatus(resp.error || '上传失败', 'error');
                }
            } catch (e) {
                setStatus('服务器返回数据异常', 'error');
            }
        });

        xhr.addEventListener('error', function() {
            uploading = false;
            setProgress(0);
            progressBar.className = 'progress-bar';
            setStatus('网络错误，上传失败', 'error');
        });

        xhr.addEventListener('abort', function() {
            uploading = false;
            setProgress(0);
            progressBar.className = 'progress-bar';
            setStatus('上传已取消', 'error');
        });

        xhr.open('POST', '', true);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.send(formData);
    }
})();
</script>
</body>
</html>
