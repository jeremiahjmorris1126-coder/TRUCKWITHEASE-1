$tempProfile = "C:\Users\truck\AppData\Local\Temp\chrome_mobile_test"
if (-not (Test-Path $tempProfile)) {
    New-Item -ItemType Directory -Path $tempProfile -Force | Out-Null
}
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$out = "C:\Users\truck\Downloads\mobile_scale3_test.png"
if (Test-Path $out) { Remove-Item $out -Force }

$chromeArgs = @(
    "--headless",
    "--disable-gpu",
    "--user-data-dir=$tempProfile",
    "--screenshot=$out",
    "--window-size=393,852",
    "--force-device-scale-factor=3",
    "--hide-scrollbars",
    "http://localhost:4173/"
)

Start-Process -FilePath $chrome -ArgumentList $chromeArgs -Wait -NoNewWindow

Add-Type -AssemblyName System.Drawing
if (Test-Path $out) {
    $img = [System.Drawing.Image]::FromFile($out)
    Write-Host "Captured Image: $($img.Width) x $($img.Height) px"
    $img.Dispose()
} else {
    Write-Warning "File not created: $out"
}
