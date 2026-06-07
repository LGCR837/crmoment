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
