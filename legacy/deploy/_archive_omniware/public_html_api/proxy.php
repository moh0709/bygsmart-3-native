<?php
$backendBase = 'http://localhost:3002';

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
    
    // Use false for the second parameter to allow multiple headers of the same type (like Set-Cookie)
    header("$key: $value", false);
}

echo $bodyContent;
?>
