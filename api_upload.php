<?php
/**
 * CRMoment - 文件上传处理器
 */

/**
 * POST /upload/image
 * multipart/form-data: image (单张)
 * 返回图片 URL
 */
function handleUploadImage(): void {
    assertMethod('POST');
    $userId = requireLogin();

    $file = $_FILES['image'] ?? null;
    if (!$file) {
        error('请选择要上传的图片');
    }

    $ext = validateImageFile($file);
    $filename = randomFileName($ext);
    $dest = getUploadDir('post') . '/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        error('图片保存失败', 500);
    }

    $url = getUploadUrl('post', $filename);

    success(['url' => $url], '上传成功');
}

/**
 * POST /upload/video
 * multipart/form-data: video (单文件)
 * 返回视频 URL
 */
function handleUploadVideo(): void {
    assertMethod('POST');
    $userId = requireLogin();

    $file = $_FILES['video'] ?? null;
    if (!$file) {
        error('请选择要上传的视频');
    }

    if ($file['error'] !== UPLOAD_ERR_OK) {
        error('文件上传失败，错误码: ' . $file['error']);
    }
    if ($file['size'] > MAX_VIDEO_SIZE) {
        error('视频文件大小不能超过 28MB');
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ALLOWED_VIDEO_EXTENSIONS, true)) {
        error('仅支持 mp4, webm, mov, avi 格式');
    }

    // 验证 MIME 类型（优先 finfo，不可用时靠扩展名推断）
    $allowedMime = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    $mime = '';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
    }
    if (!$mime) {
        $mimeMap = ['mp4' => 'video/mp4', 'webm' => 'video/webm', 'mov' => 'video/quicktime', 'avi' => 'video/x-msvideo'];
        $mime = $mimeMap[$ext] ?? '';
    }
    if (!in_array($mime, $allowedMime, true)) {
        error('文件不是有效的视频');
    }

    $filename = randomFileName($ext);
    $dest = getUploadDir('video') . '/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        error('视频保存失败', 500);
    }

    $url = getUploadUrl('video', $filename);

    success(['url' => $url], '上传成功');
}
