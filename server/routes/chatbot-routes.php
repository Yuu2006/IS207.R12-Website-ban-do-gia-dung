<?php
declare(strict_types=1);

require_once __DIR__ . '/../controllers/chatbot-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

// Public chatbot reads (catalog search, messages, quick questions) and ADMIN-only FAQ management.
function handleChatbotRoutes(string $method, string $path): bool
{
    if ($path === '/api/chatbot/catalog-search' && $method === 'GET') { chatbotCatalogController($_GET); return true; }
    if ($path === '/api/chatbot/messages' && $method === 'POST') { chatbotMessageController(); return true; }
    if ($path === '/api/chatbot/quick-questions' && $method === 'GET') { chatbotQuickQuestionsController(); return true; }
    $routes = [['GET', '#^/api/admin/chatbot/faqs$#', 'list'], ['POST', '#^/api/admin/chatbot/faqs$#', 'create'], ['PATCH', '#^/api/admin/chatbot/faqs/(\d{1,19})$#', 'update']];
    foreach ($routes as [$verb, $pattern, $action]) {
        if ($method !== $verb || !preg_match($pattern, $path, $matches)) continue;
        $actor = requireAdmin();
        chatbotFaqAdminController($action, isset($matches[1]) ? (int) $matches[1] : 0, $actor);
        return true;
    }
    return false;
}
