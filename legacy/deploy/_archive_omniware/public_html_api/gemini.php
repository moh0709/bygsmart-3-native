<?php
declare(strict_types=1);

/* CORS */
header('Access-Control-Allow-Origin: https://omniware.dk');
header('Vary: Origin');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 600');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

/* ---- Load API key (env first, then private file) ---- */
$API_KEY = getenv('GEMINI_API_KEY');
if (!$API_KEY && isset($_ENV['GEMINI_API_KEY']))  $API_KEY = $_ENV['GEMINI_API_KEY'];
if (!$API_KEY && isset($_SERVER['GEMINI_API_KEY'])) $API_KEY = $_SERVER['GEMINI_API_KEY'];

if (!$API_KEY) {
  // Try absolute path first (shared hosts often lack $_SERVER['HOME'])
  $candidates = [
    '/home/omnifkht/private/omniware_secrets.php',
  ];
  if (!empty($_SERVER['HOME'])) {
    $candidates[] = rtrim($_SERVER['HOME'], '/').'/home/omnifkht/private/omniware_secrets.php';
  }
  foreach ($candidates as $p) {
    if ($p && is_readable($p)) {
      $secrets = @include $p;
      if (is_array($secrets) && !empty($secrets['GEMINI_API_KEY'])) {
        $API_KEY = $secrets['GEMINI_API_KEY'];
        break;
      }
    }
  }
}

if (!$API_KEY) {
  header('Content-Type: application/json');
  http_response_code(500);
  echo json_encode([
    'error' => 'Server misconfigured: GEMINI_API_KEY missing',
    'hint'  => 'SetEnv GEMINI_API_KEY in .htaccess or ensure /home/omnifkht/private/omniware_secrets.php is readable and contains ["GEMINI_API_KEY"=>"..."].'
  ]);
  exit;
}

/* ---- Only POST allowed ---- */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  header('Content-Type: application/json');
  http_response_code(405);
  echo json_encode(['error' => 'Method Not Allowed']);
  exit;
}

/* ---- Parse body ---- */
$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) {
  header('Content-Type: application/json');
  http_response_code(400);
  echo json_encode(['error' => 'Invalid JSON']);
  exit;
}

/* ---- Model allowlist ---- */
$requestedModel = (string)($payload['model'] ?? '');
$allowedModels = ['gemini-2.5-flash','gemini-2.5-pro','gemini-2.0-flash','gemini-2.0-pro'];
$model = in_array($requestedModel, $allowedModels, true) ? $requestedModel : 'gemini-2.5-flash';

/* ---- Build upstream body with safe keys ---- */
$allowKeys = ['contents','system_instruction','safetySettings','generationConfig','tools','toolConfig','clientContext'];
$forward = [];
foreach ($allowKeys as $k) if (array_key_exists($k, $payload)) $forward[$k] = $payload[$k];

if (empty($forward['contents']) || !is_array($forward['contents'])) {
  header('Content-Type: application/json');
  http_response_code(400);
  echo json_encode(['error' => 'Missing or invalid "contents"']);
  exit;
}

/* ---- Call Gemini ---- */
$endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$API_KEY}";
$ch = curl_init($endpoint);
curl_setopt_array($ch, [
  CURLOPT_POST           => true,
  CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS     => json_encode($forward, JSON_UNESCAPED_UNICODE),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT        => 45,
]);
$respBody = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$err      = curl_error($ch);
curl_close($ch);

header('Content-Type: application/json');
if ($respBody === false) {
  http_response_code(502);
  echo json_encode(['error' => 'Upstream call failed', 'detail' => $err ?: 'curl_exec false']);
  exit;
}
if ($httpCode < 200 || $httpCode >= 300) {
  http_response_code($httpCode);
  $asJson = json_decode($respBody, true);
  echo json_encode(['error' => 'Upstream error', 'status' => $httpCode, 'upstream' => $asJson ?? $respBody], JSON_UNESCAPED_UNICODE);
  exit;
}
http_response_code($httpCode ?: 200);
echo $respBody;
