Add-Type -AssemblyName System.Drawing

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempProfile = "C:\Users\truck\AppData\Local\Temp\chrome_appstore_capture"
if (-not (Test-Path $tempProfile)) {
    New-Item -ItemType Directory -Path $tempProfile -Force | Out-Null
}

$screens = @(
    @{ Id = "1_Cockpit_NightHUD"; Tab = "night-hud"; Name = "1_Cockpit_NightHUD" },
    @{ Id = "2_HOS_49CFR395_Clocks"; Tab = "hos-clocks"; Name = "2_HOS_49CFR395_Clocks" },
    @{ Id = "3_Bridge_Clearance_Radar54B"; Tab = "radar-54b"; Name = "3_Bridge_Clearance_Radar54B" },
    @{ Id = "4_Vehicle_Telematics_J1939"; Tab = "telemetry"; Name = "4_Vehicle_Telematics_J1939" },
    @{ Id = "5_DOT_Compliance_Vault"; Tab = "vault"; Name = "5_DOT_Compliance_Vault" }
)

# Output directory roots
$destRoots = @(
    "C:\Users\truck\Downloads\TruckWithEase_REAL_AppStore_Screenshots",
    "C:\Users\truck\Downloads\iPhone_6.1_and_6.3_Screenshots",
    "C:\Users\truck\TRUCKWITHEASE-1\AppStore_Assets_iPhone_6.1_and_6.3"
)

# JPEG codec setup
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]98)

# Helper function to resize bitmap
function Resize-ImageFile {
    param(
        [string]$SourcePath,
        [string]$DestPath,
        [int]$TargetWidth,
        [int]$TargetHeight,
        [string]$Format = "PNG"
    )
    $srcImg = [System.Drawing.Image]::FromFile($SourcePath)
    $destBmp = New-Object System.Drawing.Bitmap($TargetWidth, $TargetHeight)
    $destBmp.SetResolution(72, 72)

    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $g.DrawImage($srcImg, 0, 0, $TargetWidth, $TargetHeight)

    if ($Format -eq "JPG") {
        $destBmp.Save($DestPath, $script:jpegCodec, $script:encoderParams)
    } else {
        $destBmp.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }

    $g.Dispose()
    $destBmp.Dispose()
    $srcImg.Dispose()
}

Write-Host "=========================================================="
Write-Host "CAPTURING REAL IN-APP SCREENSHOTS FROM TRUCKWITHEASE..."
Write-Host "=========================================================="

# Staging temp dir for raw captures
$rawCaptureDir = "C:\Users\truck\AppData\Local\Temp\raw_app_captures"
if (-not (Test-Path $rawCaptureDir)) { New-Item -ItemType Directory -Path $rawCaptureDir -Force | Out-Null }

# 1. Capture Portrait 6.1" (393x852 @ 3x = 1179x2556)
# 2. Capture Landscape 6.1" (852x393 @ 3x = 2556x1179)
# 3. Capture Portrait 6.3" (402x874 @ 3x = 1206x2622)
# 4. Capture Landscape 6.3" (874x402 @ 3x = 2622x1206)

foreach ($sc in $screens) {
    Write-Host "Capturing screen: $($sc.Id) (?tab=$($sc.Tab))..."
    $url = "http://localhost:4173/?tab=$($sc.Tab)"

    # Capture 6.1" Portrait (1179 x 2556)
    $rawP61 = Join-Path $rawCaptureDir "$($sc.Name)_p61.png"
    $argsP61 = @(
        "--headless", "--disable-gpu", "--user-data-dir=$tempProfile",
        "--screenshot=$rawP61", "--window-size=393,852", "--force-device-scale-factor=3",
        "--hide-scrollbars", "--virtual-time-budget=6000", $url
    )
    Start-Process -FilePath $chrome -ArgumentList $argsP61 -Wait -NoNewWindow

    # Capture 6.1" Landscape (2556 x 1179)
    $rawL61 = Join-Path $rawCaptureDir "$($sc.Name)_l61.png"
    $argsL61 = @(
        "--headless", "--disable-gpu", "--user-data-dir=$tempProfile",
        "--screenshot=$rawL61", "--window-size=852,393", "--force-device-scale-factor=3",
        "--hide-scrollbars", "--virtual-time-budget=6000", $url
    )
    Start-Process -FilePath $chrome -ArgumentList $argsL61 -Wait -NoNewWindow

    # Capture 6.3" Portrait (1206 x 2622)
    $rawP63 = Join-Path $rawCaptureDir "$($sc.Name)_p63.png"
    $argsP63 = @(
        "--headless", "--disable-gpu", "--user-data-dir=$tempProfile",
        "--screenshot=$rawP63", "--window-size=402,874", "--force-device-scale-factor=3",
        "--hide-scrollbars", "--virtual-time-budget=6000", $url
    )
    Start-Process -FilePath $chrome -ArgumentList $argsP63 -Wait -NoNewWindow

    # Capture 6.3" Landscape (2622 x 1206)
    $rawL63 = Join-Path $rawCaptureDir "$($sc.Name)_l63.png"
    $argsL63 = @(
        "--headless", "--disable-gpu", "--user-data-dir=$tempProfile",
        "--screenshot=$rawL63", "--window-size=874,402", "--force-device-scale-factor=3",
        "--hide-scrollbars", "--virtual-time-budget=6000", $url
    )
    Start-Process -FilePath $chrome -ArgumentList $argsL63 -Wait -NoNewWindow
}

Write-Host "`nAll raw screen captures complete! Formatting and distributing assets..."

foreach ($baseDir in $destRoots) {
    if (-not (Test-Path $baseDir)) { New-Item -ItemType Directory -Path $baseDir -Force | Out-Null }

    # Folders
    $fP61 = Join-Path $baseDir "7_iPhone_6.1_inch_Portrait_1179x2556"
    $fL61 = Join-Path $baseDir "7_iPhone_6.1_inch_Landscape_2556x1179"
    $fP63 = Join-Path $baseDir "6_iPhone_6.3_inch_Portrait_1206x2622"
    $fL63 = Join-Path $baseDir "6_iPhone_6.3_inch_Landscape_2622x1206"
    $fPrevP = Join-Path $baseDir "8_App_Preview_Portrait_886x1920"
    $fPrevL = Join-Path $baseDir "8_App_Preview_Landscape_1920x886"

    foreach ($folder in @($fP61, $fL61, $fP63, $fL63, $fPrevP, $fPrevL)) {
        if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
    }

    foreach ($sc in $screens) {
        $rawP61 = Join-Path $rawCaptureDir "$($sc.Name)_p61.png"
        $rawL61 = Join-Path $rawCaptureDir "$($sc.Name)_l61.png"
        $rawP63 = Join-Path $rawCaptureDir "$($sc.Name)_p63.png"
        $rawL63 = Join-Path $rawCaptureDir "$($sc.Name)_l63.png"

        # 1. iPhone 6.1" Portrait (1179 x 2556)
        Copy-Item $rawP61 (Join-Path $fP61 "$($sc.Name).png") -Force
        Resize-ImageFile -SourcePath $rawP61 -DestPath (Join-Path $fP61 "$($sc.Name).jpg") -TargetWidth 1179 -TargetHeight 2556 -Format "JPG"

        # 2. iPhone 6.1" Landscape (2556 x 1179)
        Copy-Item $rawL61 (Join-Path $fL61 "$($sc.Name).png") -Force
        Resize-ImageFile -SourcePath $rawL61 -DestPath (Join-Path $fL61 "$($sc.Name).jpg") -TargetWidth 2556 -TargetHeight 1179 -Format "JPG"

        # 3. iPhone 6.3" Portrait (1206 x 2622)
        Copy-Item $rawP63 (Join-Path $fP63 "$($sc.Name).png") -Force
        Resize-ImageFile -SourcePath $rawP63 -DestPath (Join-Path $fP63 "$($sc.Name).jpg") -TargetWidth 1206 -TargetHeight 2622 -Format "JPG"

        # 4. iPhone 6.3" Landscape (2622 x 1206)
        Copy-Item $rawL63 (Join-Path $fL63 "$($sc.Name).png") -Force
        Resize-ImageFile -SourcePath $rawL63 -DestPath (Join-Path $fL63 "$($sc.Name).jpg") -TargetWidth 2622 -TargetHeight 1206 -Format "JPG"

        # 5. App Preview Portrait (886 x 1920)
        Resize-ImageFile -SourcePath $rawP61 -DestPath (Join-Path $fPrevP "$($sc.Name).png") -TargetWidth 886 -TargetHeight 1920 -Format "PNG"
        Resize-ImageFile -SourcePath $rawP61 -DestPath (Join-Path $fPrevP "$($sc.Name).jpg") -TargetWidth 886 -TargetHeight 1920 -Format "JPG"

        # 6. App Preview Landscape (1920 x 886)
        Resize-ImageFile -SourcePath $rawL61 -DestPath (Join-Path $fPrevL "$($sc.Name).png") -TargetWidth 1920 -TargetHeight 886 -Format "PNG"
        Resize-ImageFile -SourcePath $rawL61 -DestPath (Join-Path $fPrevL "$($sc.Name).jpg") -TargetWidth 1920 -TargetHeight 886 -Format "JPG"
    }
}

# Also update Downloads/TruckWithEase_AppStore_Screenshots directly
$legacyDir = "C:\Users\truck\Downloads\TruckWithEase_AppStore_Screenshots"
if (Test-Path $legacyDir) {
    Copy-Item -Path "C:\Users\truck\Downloads\iPhone_6.1_and_6.3_Screenshots\*" -Destination $legacyDir -Recurse -Force
}

Write-Host "`n=========================================================="
Write-Host "REAL APP STORE SCREENSHOT ASSETS COMPLETE!"
Write-Host "=========================================================="
