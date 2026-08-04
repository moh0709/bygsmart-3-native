# BygSmart 2.1 — New Server Setup Guide

> This guide covers setting up a fresh Namecheap shared hosting account from scratch.
> Follow every step in order. Takes ~30–45 minutes.
>
> **Platform:** Namecheap shared hosting (cPanel + CloudLinux + LiteSpeed)
> **Domain:** omniware.dk (replace with your domain throughout)
> **cPanel user:** omnifkht (replace with your cPanel username throughout)

---

## 1. SSH Access

### 1.1 — Generate a dedicated SSH key (dev machine)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_namecheap -C "bygsmart-deploy"
```

### 1.2 — Add the public key to cPanel

1. Log in to cPanel: `https://omniware.dk:2083`
2. Go to **Security → SSH Access → Manage SSH Keys**
3. Click **Import Key**, paste the contents of `~/.ssh/id_ed25519_namecheap.pub`
4. Authorize the key

### 1.3 — Add SSH alias to dev machine

Add to `~/.ssh/config`:

```
Host namecheap
  HostName 66.29.132.24
  User omnifkht
  Port 21098
  IdentityFile ~/.ssh/id_ed25519_namecheap
  IdentitiesOnly yes
  ServerAliveInterval 60
  ServerAliveCountMax 5
```

> Find the real IP and SSH port in cPanel under **Security → SSH Access**.

### 1.4 — Test connection

```bash
ssh namecheap 'echo "Connected as $(whoami) on $(hostname)"'
```

---

## 2. Node.js App Registration (CloudLinux Selector)

This registers the backend app with CloudLinux so Node.js v20 is available and the virtual environment is created.

### 2.1 — Via cPanel UI

1. In cPanel, go to **Software → Node.js** (or "Setup Node.js App")
2. Click **Create Application**
3. Fill in:

   | Field | Value |
   |-------|-------|
   | Node.js version | **20** |
   | Application mode | **Production** |
   | Application root | `apps/byggeapp_server` |
   | Application URL | `omniware.dk/byggeapp` |
   | Application startup file | `index.js` |

4. Click **Create** — this generates the virtual environment at `~/nodevenv/apps/byggeapp_server/20/`

### 2.2 — Verify via SSH

```bash
ssh namecheap 'source ~/nodevenv/apps/byggeapp_server/20/bin/activate && node --version && npm --version'
# Expected: v20.x.x and 10.x.x
```

---

## 3. Directory Structure

Create all required directories:

```bash
ssh namecheap '
  mkdir -p ~/apps/byggeapp_server/tmp
  mkdir -p ~/public_html/byggeapp
  mkdir -p ~/public_html/api
  mkdir -p ~/logs
  mkdir -p ~/bin
  echo "Directories created"
'
```

---

## 4. PHP Reverse Proxy Setup

The frontend calls `/api/...` which Apache routes to a PHP script that proxies to the Node.js server on `localhost:3002`.

### 4.1 — Create the PHP proxy

```bash
ssh namecheap 'cat > ~/public_html/api/proxy.php << '"'"'PHP_EOF'"'"'
<?php
$backendBase = '"'"'http://localhost:3002'"'"';

$rawPath = isset($_GET['"'"'__path'"'"']) ? $_GET['"'"'__path'"'"'] : ($_SERVER['"'"'REQUEST_URI'"'"'] ?? '"'"'/'"'"');
if (!isset($_GET['"'"'__path'"'"'])) {
    $rawPath = preg_replace('"'"'#^/api#'"'"', '"'"''"'"', $rawPath);
    $rawPath = $rawPath == '"'"''"'"' ? '"'"'/'"'"' : $rawPath;
}

$path = $rawPath;
if (!preg_match('"'"'#^/(api|admin|uploads|health|static|\.well-known)(/|$)#'"'"', $path)) {
    $path = '"'"'/api'"'"' . (strpos($path, '"'"'/'"'"') == 0 ? $path : '"'"'/'"'"' . $path);
}

$target = rtrim($backendBase, '"'"'/'"'"') . $path;
$method = $_SERVER['"'"'REQUEST_METHOD'"'"'] ?? '"'"'GET'"'"';

$forwardHeaders = [];
foreach (getallheaders() as $name => $value) {
    $normalized = strtolower($name);
    if (in_array($normalized, ['"'"'host'"'"', '"'"'content-length'"'"'])) continue;
    $forwardHeaders[] = "$name: $value";
}

if (!isset($_SERVER['"'"'HTTP_X_FORWARDED_FOR'"'"']) && isset($_SERVER['"'"'REMOTE_ADDR'"'"'])) {
    $forwardHeaders[] = '"'"'X-Forwarded-For: '"'"' . $_SERVER['"'"'REMOTE_ADDR'"'"'];
}

$body = file_get_contents('"'"'php://input'"'"');

$ch = curl_init($target);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $forwardHeaders);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_ENCODING, '"'"''"'"');
curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
if ($body !== '"'"''"'"' && $body !== false) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);

$response = curl_exec($ch);
if ($response === false) {
    http_response_code(502);
    header('"'"'Content-Type: application/json'"'"');
    echo json_encode(['"'"'error'"'"' => '"'"'Bad Gateway'"'"', '"'"'message'"'"' => curl_error($ch)]);
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
    if (strpos($line, '"'"':'"'"') === false) continue;
    list($key, $value) = array_map('"'"'trim'"'"', explode('"'"':'"'"', $line, 2));
    $lk = strtolower($key);
    if (in_array($lk, ['"'"'transfer-encoding'"'"','"'"'connection'"'"','"'"'keep-alive'"'"','"'"'proxy-authenticate'"'"','"'"'proxy-authorization'"'"','"'"'te'"'"','"'"'trailer'"'"','"'"'upgrade'"'"'])) continue;
    header("$key: $value", false);
}

echo $bodyContent;
PHP_EOF
echo "proxy.php created"'
```

> **Alternatively**, just `scp` the file from the repo after first cloning:
> ```bash
> scp public_html/api/proxy.php namecheap:~/public_html/api/
> ```

### 4.2 — Create `/api/.htaccess`

```bash
ssh namecheap 'cat > ~/public_html/api/.htaccess << '"'"'EOF'"'"'
RewriteEngine On
RewriteBase /api/

RewriteCond %{REQUEST_FILENAME} -f
RewriteCond %{REQUEST_URI} !/api/proxy\.php$
RewriteRule ^ - [L]

RewriteRule ^(.*)$ proxy.php?__path=/api/$1 [QSA,L]

<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Vary "Origin"
</IfModule>
EOF
echo ".htaccess created"'
```

---

## 5. Frontend `.htaccess` (SPA Fallback)

The root `.htaccess` makes React Router work (all paths return `index.html`):

```bash
ssh namecheap 'cat > ~/public_html/.htaccess << '"'"'EOF'"'"'
RewriteOptions inherit
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_FILENAME} !-l
RewriteRule . /index.html [L]
EOF
echo "Root .htaccess created"'
```

> **Note:** cPanel may regenerate this file. If routing breaks, check this file first.

---

## 6. Backend `.env` File

SSH into the server and create the env file. **Never commit this file.**

```bash
ssh namecheap 'cat > ~/apps/byggeapp_server/.env << EOF
ALLOWED_ORIGIN=https://omniware.dk
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
GEMINI_API_KEY=YOUR_GEMINI_KEY
AI_KEYS_SECRET=$(openssl rand -base64 32)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_PREMIUM_MONTHLY=price_...
STRIPE_PRICE_PREMIUM_YEARLY=price_...
VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=YOUR_VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:support@omniware.dk
DEMO_LOGIN_EMAIL_DOMAIN=demo.omniware.dk
EOF
echo ".env created"'
```

**Generate VAPID keys** (run once, save the output):
```bash
cd server && npx web-push generate-vapid-keys
```

**Generate `AI_KEYS_SECRET`** (run once):
```bash
openssl rand -base64 32
```

See `.env.example` in the repo for descriptions of every variable.

---

## 7. First Backend Deployment

Upload source files and install dependencies:

```bash
# From project root on dev machine:

# Upload backend source
tar cf - \
  --exclude='server/node_modules' \
  --exclude='server/Dockerfile' \
  --exclude='server/*.test.js' \
  --exclude='server/package-lock.json' \
  server \
| ssh namecheap "tar xf - --strip-components=1 -C ~/apps/byggeapp_server"

scp server/package.json server/package-lock.json namecheap:~/apps/byggeapp_server/

# Install dependencies (CloudLinux uses the nodevenv)
ssh namecheap "
  source ~/nodevenv/apps/byggeapp_server/20/bin/activate
  cd ~/apps/byggeapp_server
  npm ci --omit=dev --ignore-scripts
"
```

---

## 8. Watchdog Script

The watchdog keeps the Node.js server running. It is the **only** process manager — do not rely on Passenger to auto-start the app.

```bash
ssh namecheap 'cat > ~/bin/byggeapp-watchdog.sh << '"'"'WATCHDOG_EOF'"'"'
#!/bin/bash
LOG=/home/omnifkht/logs/byggeapp_server.log
PID_FILE=/home/omnifkht/apps/byggeapp_server/server.pid

is_running() {
    curl -sf --max-time 3 http://localhost:3002/api/health > /dev/null 2>&1 && return 0

    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null && ps -p "$PID" -o args= 2>/dev/null | grep -q "node index.js"; then
            return 0
        fi
    fi

    return 1
}

if ! is_running; then
    echo "[watchdog] $(date): Server not running, starting..." >> "$LOG"
    lsof -ti:3002 2>/dev/null | xargs kill -9 2>/dev/null
    source /home/omnifkht/nodevenv/apps/byggeapp_server/20/bin/activate
    cd /home/omnifkht/apps/byggeapp_server
    nohup node index.js >> "$LOG" 2>&1 &
    echo $! > "$PID_FILE"
    echo "[watchdog] $(date): Server started with PID $!" >> "$LOG"
fi
WATCHDOG_EOF
chmod +x ~/bin/byggeapp-watchdog.sh
echo "Watchdog installed"'
```

> If your cPanel username is not `omnifkht`, replace it throughout the watchdog script.

---

## 9. Crontab Setup

Install two cron entries — one for boot recovery, one for ongoing health:

```bash
ssh namecheap '(crontab -l 2>/dev/null; echo "@reboot /home/omnifkht/bin/byggeapp-watchdog.sh"; echo "*/5 * * * * /home/omnifkht/bin/byggeapp-watchdog.sh") | crontab -'
ssh namecheap 'crontab -l'
```

Expected output:
```
@reboot  /home/omnifkht/bin/byggeapp-watchdog.sh
*/5 * * * *  /home/omnifkht/bin/byggeapp-watchdog.sh
```

---

## 10. First Frontend Deployment

Build and upload the React app:

```bash
# From project root on dev machine:
npm run build
ssh namecheap "rm -rf ~/public_html/byggeapp/assets ~/public_html/byggeapp/index.html"
tar cf - dist | ssh namecheap "tar xf - --strip-components=1 -C ~/public_html/byggeapp"
```

---

## 11. Start the Backend

```bash
ssh namecheap '~/bin/byggeapp-watchdog.sh'
sleep 5
ssh namecheap 'curl -sf http://localhost:3002/api/health && echo "Backend UP" || echo "Backend DOWN — check ~/logs/byggeapp_server.log"'
```

---

## 12. Verification Checklist

Run these checks after setup is complete:

```bash
# 1. Node.js backend health
ssh namecheap 'curl -sf http://localhost:3002/api/health && echo "✅ Backend OK" || echo "❌ Backend DOWN"'

# 2. Public API via PHP proxy
curl -sf https://omniware.dk/api/health && echo "✅ API proxy OK" || echo "❌ API proxy FAILED"

# 3. Frontend SPA loads
curl -sf -o /dev/null -w "%{http_code}" https://omniware.dk/byggeapp/ | grep -q 200 && echo "✅ Frontend OK" || echo "❌ Frontend FAILED"

# 4. Cron installed
ssh namecheap 'crontab -l | grep watchdog && echo "✅ Cron OK" || echo "❌ Cron missing"'

# 5. .env has required variables
ssh namecheap 'grep -c "=" ~/apps/byggeapp_server/.env' # Should be >= 10 lines
```

---

## Troubleshooting

### Backend returns 502

The Node.js server on port 3002 is not running.

```bash
ssh namecheap 'tail -30 ~/logs/byggeapp_server.log'
ssh namecheap '~/bin/byggeapp-watchdog.sh'
```

### EADDRINUSE (port already in use)

A zombie process is holding port 3002. The watchdog handles this automatically, but manually:

```bash
ssh namecheap '
  lsof -ti:3002 | xargs kill -9 2>/dev/null
  rm -f ~/apps/byggeapp_server/server.pid
  sleep 2
  ~/bin/byggeapp-watchdog.sh
'
```

### React Router 404 on page refresh

The root `.htaccess` SPA fallback is missing or broken.

```bash
ssh namecheap 'cat ~/public_html/.htaccess'
# Must contain: RewriteRule . /index.html [L]
```

### Node modules missing or corrupt

CloudLinux stores node_modules as a managed symlink. Re-install:

```bash
ssh namecheap '
  source ~/nodevenv/apps/byggeapp_server/20/bin/activate
  cd ~/apps/byggeapp_server
  npm ci --omit=dev --ignore-scripts
'
```

### Check server logs

```bash
# Application log
ssh namecheap 'tail -50 ~/logs/byggeapp_server.log'

# Apache access log (compressed, current month)
ssh namecheap 'zcat ~/logs/omniware.dk-ssl_log-*.gz 2>/dev/null | grep /api | tail -20'
```

---

## Infrastructure Summary

| Component | Technology | Location |
|-----------|-----------|----------|
| Hosting | Namecheap shared (cPanel) | premium196.web-hosting.com |
| Web server | LiteSpeed + Apache (cPanel managed) | — |
| SSL | cPanel AutoSSL (Let's Encrypt) | Auto-renewed |
| Frontend | Static files (React + Vite build) | `~/public_html/byggeapp/` |
| API routing | PHP reverse proxy | `~/public_html/api/proxy.php` |
| Backend | Node.js v20 (ESM, Express) | `~/apps/byggeapp_server/` |
| Database | Supabase (hosted, external) | supabase.co |
| Process manager | Cron watchdog script | `~/bin/byggeapp-watchdog.sh` |
| Node env | CloudLinux nodevenv | `~/nodevenv/apps/byggeapp_server/20/` |
| Backend port | 3002 (localhost only) | Not exposed externally |
| App log | File-based | `~/logs/byggeapp_server.log` |
