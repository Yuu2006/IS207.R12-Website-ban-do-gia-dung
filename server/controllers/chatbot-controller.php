<?php
declare(strict_types=1);

require_once __DIR__ . '/../models/chatbot-model.php';
require_once __DIR__ . '/../services/chatbot-service.php';
require_once __DIR__ . '/../config/database.php';

// Read a bounded JSON object body; nested context stays an associative array for strict validation.
function chatbotJsonInput(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 16385);
    if ($raw === false || strlen($raw) > 16384) throw new ApiException('Request quá lớn.', 413);
    try { $decoded = json_decode($raw, true, 16, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new ApiException('JSON chưa hợp lệ.', 400); }
    if (!is_array($decoded) || (array_is_list($decoded) && $decoded !== [])) throw new ApiException('Request phải là JSON object.', 422);
    return $decoded;
}

// Return catalog search results with server-owned SKU price and stock values.
function chatbotCatalogController(array $query): void
{
    $service = new ChatbotService(new ChatbotModel(db()));
    respondJson($service->searchCatalog($query), 'Đã tra cứu catalog.');
}

function chatbotMessageController(): void
{
    $service = new ChatbotService(new ChatbotModel(db()));
    respondJson($service->reply(chatbotJsonInput()), 'Đã xử lý câu hỏi.');
}

function chatbotQuickQuestionsController(): void
{
    respondJson((new ChatbotService(new ChatbotModel(db())))->quickQuestions());
}

// ADMIN FAQ management; the actor id always comes from the session.
function chatbotFaqAdminController(string $action, int $id, array $actor): void
{
    $service = new ChatbotService(new ChatbotModel(db()));
    $data = match ($action) {
        'list' => $service->listFaqs(),
        'create' => $service->createFaq(chatbotJsonInput(), (int) $actor['id']),
        'update' => $service->updateFaq($id, chatbotJsonInput(), (int) $actor['id']),
    };
    respondJson($data, 'Thành công.', $action === 'create' ? 201 : 200);
}
