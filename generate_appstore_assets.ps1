Add-Type -AssemblyName System.Drawing

$srcPortraitDir = "C:\Users\truck\Downloads\TruckWithEase_AppStore_Screenshots\1_iPhone_6.7_inch_Portrait"
$srcLandscapeDir = "C:\Users\truck\Downloads\TruckWithEase_AppStore_Screenshots\1_iPhone_6.7_inch_Landscape"

$destBaseDirs = @(
    "C:\Users\truck\Downloads\TruckWithEase_AppStore_Screenshots",
    "C:\Users\truck\TRUCKWITHEASE-1\AppStore_Assets_iPhone_6.1_and_6.3",
    "C:\Users\truck\Downloads\iPhone_6.1_and_6.3_Screenshots"
)

# Target configurations specified by Apple App Store Connect:
# - iPhone 6.1" display: 1179 x 2556 (portrait) and 2556 x 1179 (landscape)
# - iPhone 6.3" display: 1206 x 2622 (portrait) and 2622 x 1206 (landscape)
# - App Previews: 886 x 1920 (portrait) and 1920 x 886 (landscape)

$targets = @(
    @{
        Folder = "6_iPhone_6.3_inch_Portrait_1206x2622"
        Width = 1206
        Height = 2622
        SourceDir = $srcPortraitDir
        Orientation = "Portrait"
    },
    @{
        Folder = "6_iPhone_6.3_inch_Landscape_2622x1206"
        Width = 2622
        Height = 1206
        SourceDir = $srcLandscapeDir
        Orientation = "Landscape"
    },
    @{
        Folder = "7_iPhone_6.1_inch_Portrait_1179x2556"
        Width = 1179
        Height = 2556
        SourceDir = $srcPortraitDir
        Orientation = "Portrait"
    },
    @{
        Folder = "7_iPhone_6.1_inch_Landscape_2556x1179"
        Width = 2556
        Height = 1179
        SourceDir = $srcLandscapeDir
        Orientation = "Landscape"
    },
    @{
        Folder = "8_App_Preview_Portrait_886x1920"
        Width = 886
        Height = 1920
        SourceDir = $srcPortraitDir
        Orientation = "Portrait"
    },
    @{
        Folder = "8_App_Preview_Landscape_1920x886"
        Width = 1920
        Height = 886
        SourceDir = $srcLandscapeDir
        Orientation = "Landscape"
    }
)

# Helper for JPEG encoder with 98% quality
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]98)

$sourceFiles = @(
    "1_Cockpit_NightHUD.jpg",
    "2_Fleet_Command_Radar.jpg",
    "3_InCab_Telematics.jpg",
    "4_Highway_Routing.jpg"
)

Write-Host "Starting App Store Asset Generation for iPhone 6.1`" and 6.3`"..."

foreach ($baseDir in $destBaseDirs) {
    if (-not (Test-Path $baseDir)) {
        New-Item -ItemType Directory -Path $baseDir -Force | Out-Null
    }

    foreach ($target in $targets) {
        $folderPath = Join-Path $baseDir $target.Folder
        if (-not (Test-Path $folderPath)) {
            New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
        }

        foreach ($fileName in $sourceFiles) {
            $srcPath = Join-Path $target.SourceDir $fileName
            if (-not (Test-Path $srcPath)) {
                Write-Warning "Source file not found: $srcPath"
                continue
            }

            $srcImg = [System.Drawing.Image]::FromFile($srcPath)
            $destBmp = New-Object System.Drawing.Bitmap($target.Width, $target.Height)
            $destBmp.SetResolution(72, 72)

            $g = [System.Drawing.Graphics]::FromImage($destBmp)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

            # Draw image scaled to exact pixel canvas
            $g.DrawImage($srcImg, 0, 0, $target.Width, $target.Height)

            # Save JPG
            $destJpgPath = Join-Path $folderPath $fileName
            $destBmp.Save($destJpgPath, $jpegCodec, $encoderParams)

            # Save PNG as well for maximum Apple compatibility
            $pngName = [System.IO.Path]::ChangeExtension($fileName, ".png")
            $destPngPath = Join-Path $folderPath $pngName
            $destBmp.Save($destPngPath, [System.Drawing.Imaging.ImageFormat]::Png)

            $g.Dispose()
            $destBmp.Dispose()
            $srcImg.Dispose()

            Write-Host "Generated: $destJpgPath [$($target.Width) x $($target.Height)]"
        }
    }
}

Write-Host "All assets generated successfully!"
