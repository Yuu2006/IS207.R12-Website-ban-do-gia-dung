<?php
declare(strict_types=1);

require_once __DIR__ . '/../controllers/chatbot-controller.php';

// Public read-only chatbot action that searches active catalog SKUs and live stock.
function handleChatbotRoutes(string $method, string $path): bool
{
    if ($path !== '/api/chatbot/catalog-search' || $method !== 'GET') return false;
    chatbotCatalogController($_GET);
    return true;
}
