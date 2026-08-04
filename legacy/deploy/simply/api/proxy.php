<?php
// ─────────────────────────────────────────────────────────────────────────────
// BygSmart API reverse proxy (simply.com / app.bygsmart.com)
//
//   Browser → https://app.bygsmart.com/api/*  → api/.htaccess → THIS FILE
//           → http://127.0.0.1:3002/api/*      (background Node/Express process)
//
// Adapted from the proven omniware proxy. Only change: backend host is pinned to
// 127.0.0.1 (NOT "localhost") so PHP's curl never resolves to IPv6 ::1 while Node
// listens on IPv4 — that mismatch silently 502s. Keep it 127.0.0.1.
//
// The raw request body is forwarded untouched (file_get_contents('php://input'))
// so Stripe webhook signature verification still works.
// ─────────────────────────────────────────────────────────────────────────────

$backendBase = 'http://127.0.0.1:3002';   // Node/Express bind address:port

$rawPath = isset($_GET['__path']) ? $_GET['__path'] : ($_SERVER['REQUEST_URI'] ?? '/');
if (!isset($_GET['__path'])) {
    $rawPath = preg_replace('#^/api#', '', $rawPath);
    $rawPath = $rawPath == '' ? '/' : $rawPath;
}

$path = $rawPath;
if (!preg_match('#^/(api|admin|uploads|health|static|\.well-known)(/|$)#', $path)) {
    $path = '/api' . (strpos($path, '/') == 0 ? $path : '/' . $path);
}

$target = rtrim($backendBase, '/') . $path;
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$forwardHeaders = [];
foreach (getallheaders() as $name => $value) {
    $normalized = strtolower($name);
    if (in_array($normalized, ['host', 'content-length'])) continue;
    $forwardHeaders[] = "$name: $value";
}

if (!isset($_SERVER['HTTP_X_FORWARDED_FOR']) && isset($_SERVER['REMOTE_ADDR'])) {
    $forwardHeaders[] = 'X-Forwarded-For: ' . $_SERVER['REMOTE_ADDR'];
}

$body = file_get_contents('php://input');

$ch = curl_init($target);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $forwardHeaders);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_ENCODING, '');
curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
if ($body !== '' && $body !== false) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);

$response = curl_exec($ch);
if ($response === false) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Bad Gateway', 'message' => curl_error($ch)]);
    curl_close($ch);
    exit;
}

$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$headerBlock = substr($response, 0, $headerSize);
$bodyContent = substr($response, $headerSize);

http_response_code($status ?: 500);

$headerLines = explode("\r\n", $headerBlock);
foreach ($headerLines as $line) {
    if (strpos($line, ':') === false) continue;
    list($key, $value) = array_map('trim', explode(':', $line, 2));
    $lk = strtolower($key);
    if (in_array($lk, ['transfer-encoding','connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','upgrade'])) continue;

    // false = allow multiple headers of the same name (e.g. Set-Cookie)
    header("$key: $value", false);
}

echo $bodyContent;
?>
