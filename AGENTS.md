<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Local Instructions

Do not use rg, always use PowerShell.
Khi viết code thì luôn phải viết nội dung bằng tiếng Việt và là tiếng Việt có dấu.

## Image Generation

Use the CodexHub Image API when asked to generate images. Do not hard-code API keys in commands or files. Read the key from the `CODEXHUB_API_KEY` environment variable.

PowerShell example for JSON/base64 responses:

```powershell
$key = $env:CODEXHUB_API_KEY
if (-not $key) { $key = [Environment]::GetEnvironmentVariable("CODEXHUB_API_KEY", "User") }
if (-not $key) { throw "CODEXHUB_API_KEY is missing" }

$headers = @{
  Authorization = "Bearer $key"
  "Content-Type" = "application/json"
}

$body = @{
  model = "cx/gpt-5.4-image"
  prompt = "A premium 9Router neon dashboard, cinematic lighting"
  size = "1024x1024"
} | ConvertTo-Json -Compress

Invoke-WebRequest `
  -Uri "https://api.codexhub.click/v1/images/generations" `
  -Method Post `
  -Headers $headers `
  -Body $body
```

PowerShell example for downloading a PNG directly:

```powershell
$key = $env:CODEXHUB_API_KEY
if (-not $key) { $key = [Environment]::GetEnvironmentVariable("CODEXHUB_API_KEY", "User") }
if (-not $key) { throw "CODEXHUB_API_KEY is missing" }

$headers = @{
  Authorization = "Bearer $key"
  "Content-Type" = "application/json"
}

$body = @{
  model = "cx/gpt-5.4-image"
  prompt = "A futuristic codex robot drawing an image"
  size = "1024x1024"
} | ConvertTo-Json -Compress

Invoke-WebRequest `
  -Uri "https://api.codexhub.click/v1/images/generations?response_format=binary" `
  -Method Post `
  -Headers $headers `
  -Body $body `
  -OutFile "output\imagegen\image.png"
```
