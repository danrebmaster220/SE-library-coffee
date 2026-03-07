# Minimal test of HttpListener
Write-Host "Creating listener..."
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:9100/")

Write-Host "Starting..."
try {
    $listener.Start()
    Write-Host "IsListening: $($listener.IsListening)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Waiting for request on port 9100... (send a request to test)"
try {
    $ctx = $listener.GetContext()
    Write-Host "Got request: $($ctx.Request.HttpMethod) $($ctx.Request.Url.LocalPath)" -ForegroundColor Green
    
    $resp = $ctx.Response
    $resp.StatusCode = 200
    $resp.ContentType = "application/json"
    $resp.AddHeader("Access-Control-Allow-Origin", "*")
    $buf = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok"}')
    $resp.ContentLength64 = $buf.Length
    $resp.OutputStream.Write($buf, 0, $buf.Length)
    $resp.OutputStream.Close()
    Write-Host "Response sent!" -ForegroundColor Green
} catch {
    Write-Host "ERROR in GetContext: $_" -ForegroundColor Red
}

$listener.Stop()
Write-Host "Done."
