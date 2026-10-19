$tempProfile = "C:\Users\truck\AppData\Local\Temp\chrome_mobile_test"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$out = "C:\Users\truck\Downloads\real_telemetry_test.png"
if (Test-Path $out) { Remove-Item $out -Force }

$chromeArgs = @(
    "--headless",
    "--disable-gpu",
    "--user-data-dir=$tempProfile",
    "--screenshot=$out",
    "--window-size=393,852",
    "--force-device-scale-factor=3",
    "--hide-scrollbars",
    "--virtual-time-budget=6000",
    "http://localhost:4173/?tab=telemetry"
)

Start-Process -FilePath $chrome -ArgumentList $chromeArgs -Wait -NoNewWindow

Add-Type -AssemblyName System.Drawing
if (Test-Path $out) {
    $img = [System.Drawing.Image]::FromFile($out)
    Write-Host "Captured Telemetry: $($img.Width) x $($img.Height) px"
    $img.Dispose()
}
