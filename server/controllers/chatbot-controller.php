<?php
declare(strict_types=1);

require_once __DIR__ . '/../models/chatbot-model.php';
require_once __DIR__ . '/../services/chatbot-service.php';
require_once __DIR__ . '/../config/database.php';

// Return catalog search results with server-owned SKU price and stock values.
function chatbotCatalogController(array $query): void
{
    $service = new ChatbotService(new ChatbotModel(db()));
    respondJson($service->searchCatalog($query), 'Đã tra cứu catalog.');
}
