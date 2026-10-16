<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

function uploadImage(): void
{
    if (!isset($_FILES['image'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Vui lòng chọn file ảnh.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    $file = $_FILES['image'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Upload ảnh thất bại.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    // Giới hạn dung lượng 5 MB
    if ($file['size'] <= 0 || $file['size'] > 5 * 1024 * 1024) {
        http_response_code(413);
        echo json_encode([
            'success' => false,
            'message' => 'Ảnh phải có dung lượng từ 1 byte đến 5 MB.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    // Chỉ cho phép các thư mục ảnh đã quy định
    $type = $_POST['type'] ?? '';
    $allowedTypes = [
        'products' => 'products',
        'banners' => 'banners',
        'brands' => 'brands',
        'avatars' => 'avatars'
    ];

    if (!isset($allowedTypes[$type])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Loại ảnh không hợp lệ.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    // Xác minh MIME thực tế, không tin tên file client gửi
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);

    $allowedMimes = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp'
    ];

    if (!isset($allowedMimes[$mime])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    // Xác minh file thực sự giải mã được thành ảnh
    $imageInfo = @getimagesize($file['tmp_name']);

    if ($imageInfo === false || $imageInfo['mime'] !== $mime) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'File ảnh không hợp lệ hoặc bị hỏng.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    // Giới hạn kích thước ảnh để giảm nguy cơ ảnh quá lớn
    if (
        $imageInfo[0] < 1 ||
        $imageInfo[1] < 1 ||
        $imageInfo[0] > 6000 ||
        $imageInfo[1] > 6000
    ) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Kích thước ảnh không hợp lệ hoặc vượt giới hạn 6000x6000.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    $folder = $allowedTypes[$type];
    $uploadDir = __DIR__ . '/../uploads/' . $folder;

    if (
        !is_dir($uploadDir) &&
        !mkdir($uploadDir, 0755, true) &&
        !is_dir($uploadDir)
    ) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể tạo thư mục lưu ảnh.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    // Tên file ngẫu nhiên do server sinh
    $filename = bin2hex(random_bytes(16)) . '.' . $allowedMimes[$mime];
    $destination = $uploadDir . '/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể lưu ảnh.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Upload ảnh thành công.',
        'data' => [
            'type' => $type,
            'filename' => $filename,
            'image_url' => '/uploads/' . $folder . '/' . $filename,
            'mime_type' => $mime,
            'size' => $file['size'],
            'width' => $imageInfo[0],
            'height' => $imageInfo[1]
        ]
    ], JSON_UNESCAPED_UNICODE);
}
