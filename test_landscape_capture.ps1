$tempProfile = "C:\Users\truck\AppData\Local\Temp\chrome_mobile_test"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$out = "C:\Users\truck\Downloads\real_app_land_test.png"
if (Test-Path $out) { Remove-Item $out -Force }

$chromeArgs = @(
    "--headless",
    "--disable-gpu",
    "--user-data-dir=$tempProfile",
    "--screenshot=$out",
    "--window-size=852,393",
    "--force-device-scale-factor=3",
    "--hide-scrollbars",
    "--virtual-time-budget=3000",
    "http://localhost:4173/?tab=night-hud"
)

Start-Process -FilePath $chrome -ArgumentList $chromeArgs -Wait -NoNewWindow

Add-Type -AssemblyName System.Drawing
if (Test-Path $out) {
    $img = [System.Drawing.Image]::FromFile($out)
    Write-Host "Captured Landscape: $($img.Width) x $($img.Height) px"
    $img.Dispose()
}
