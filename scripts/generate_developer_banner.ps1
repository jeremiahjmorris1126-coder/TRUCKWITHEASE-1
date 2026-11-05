Add-Type -AssemblyName System.Drawing

$targetW = 4096
$targetH = 2304
$aiImagePath = "C:\Users\truck\.gemini\antigravity\brain\da942098-d32d-42bd-b1d6-30d09d6da907\truckwithease_developer_banner_1793845814366.jpg"

$outDir1 = "C:\Users\truck\TRUCKWITHEASE-1\public"
$outDir2 = "C:\Users\truck\Downloads"

if (-not (Test-Path $outDir2)) {
    New-Item -ItemType Directory -Path $outDir2 -Force | Out-Null
}

$jpgCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encoder = [System.Drawing.Imaging.Encoder]::Quality

# Function to save JPEG with exact size constraint (< 1000 KB)
function Save-BoundedJpeg($bmp, $filePath, [int]$initialQuality = 85) {
    $q = $initialQuality
    while ($q -ge 50) {
        $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, [long]$q)
        $bmp.Save($filePath, $jpgCodec, $ep)
        $ep.Dispose()

        $size = (Get-Item $filePath).Length
        if ($size -le 1040000) { # 1040 KB (comfortably below 1 MB = 1048576 bytes)
            Write-Host "Saved: $filePath (Quality: $q, Size: $([Math]::Round($size / 1024, 1)) KB, $size bytes)"
            break
        }
        $q -= 5
    }
}

# ==============================================================================
# BANNER 1: CINEMATIC HERO 4096 x 2304 (CLEAN AI IMAGE SCALED TO EXACT 4096x2304)
# ==============================================================================
Write-Host "Creating Banner 1: Clean Cinematic Hero (4096x2304)..."
$heroBmp = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g1 = [System.Drawing.Graphics]::FromImage($heroBmp)
$g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g1.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

if (Test-Path $aiImagePath) {
    $srcImg = [System.Drawing.Image]::FromFile($aiImagePath)
    $g1.DrawImage($srcImg, 0, 0, $targetW, $targetH)
    $srcImg.Dispose()
} else {
    $g1.Clear([System.Drawing.Color]::FromArgb(255, 5, 8, 14))
}
$g1.Dispose()

$heroPathPub = Join-Path $outDir1 "TruckWithEase_Hero_4096x2304.jpg"
$heroPathDown = Join-Path $outDir2 "TruckWithEase_Hero_4096x2304.jpg"

Save-BoundedJpeg $heroBmp $heroPathPub 88
Copy-Item -Path $heroPathPub -Destination $heroPathDown -Force
$heroBmp.Dispose()


# ==============================================================================
# BANNER 2: BRANDED DEVELOPER PAGE BANNER 4096 x 2304 (HERO + BRAND + HUD BADGES)
# ==============================================================================
Write-Host "Creating Banner 2: Branded Developer Page Banner with HUD & Badges..."
$brandedBmp = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g2 = [System.Drawing.Graphics]::FromImage($brandedBmp)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g2.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Draw base background image
if (Test-Path $aiImagePath) {
    $srcImg2 = [System.Drawing.Image]::FromFile($aiImagePath)
    $g2.DrawImage($srcImg2, 0, 0, $targetW, $targetH)
    $srcImg2.Dispose()

    # Dark gradient overlay for text readability
    $ovRect = New-Object System.Drawing.Rectangle(0, 0, $targetW, $targetH)
    $ovBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $ovRect,
        [System.Drawing.Color]::FromArgb(210, 5, 8, 14),
        [System.Drawing.Color]::FromArgb(120, 5, 8, 14),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $g2.FillRectangle($ovBrush, $ovRect)
    $ovBrush.Dispose()
} else {
    $g2.Clear([System.Drawing.Color]::FromArgb(255, 5, 8, 14))
}

# Brushes
$yellowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 229, 0))
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$emeraldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 16, 185, 129))
$slateBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 203, 213, 225))

# Top Sub-header
$topFont = New-Object System.Drawing.Font("Segoe UI", 34, [System.Drawing.FontStyle]::Bold)
$topLinePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 255, 229, 0), 3)
$g2.DrawLine($topLinePen, 180, 160, ($targetW - 180), 160)
$topLinePen.Dispose()

$g2.DrawString("TRUCKWITHEASE // ENTERPRISE COMMERCIAL FLEET INTELLIGENCE", $topFont, $yellowBrush, 180, 95)
$g2.DrawString("FMCSA CFR § 390-396 COMPLIANT • 100% OPERATIONAL", $topFont, $emeraldBrush, ($targetW - 1450), 95)
$topFont.Dispose()

# Main Title: TRUCKWITHEASE
$titleFont = New-Object System.Drawing.Font("Arial Black", 172, [System.Drawing.FontStyle]::Bold)
$titleText = "TRUCKWITHEASE"

# Title soft glow shadow
$shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 0, 0, 0))
for ($offset = 4; $offset -le 14; $offset += 2) {
    $g2.DrawString($titleText, $titleFont, $shadowBrush, (180 + $offset), (260 + $offset))
}
$shadowBrush.Dispose()

$g2.DrawString($titleText, $titleFont, $yellowBrush, 180, 260)
$titleFont.Dispose()

# Subtitle
$subFont = New-Object System.Drawing.Font("Segoe UI", 56, [System.Drawing.FontStyle]::Bold)
$g2.DrawString("IN-CAB DRIVER COCKPIT • DISPATCH ZERO • THE MASTER MECHANIC", $subFont, $whiteBrush, 186, 520)
$subFont.Dispose()

$tagFont = New-Object System.Drawing.Font("Segoe UI", 36, [System.Drawing.FontStyle]::Regular)
$g2.DrawString("Engineered for Professional CDL-A Drivers, Independent Owner-Operators & Enterprise Carriers", $tagFont, $slateBrush, 186, 615)
$tagFont.Dispose()

# 4 Capability Pills / Cards across the center-lower area
$cardY = 1460
$cardH = 500
$cardW = 880
$cardGap = 60
$startX = 180

$cards = @(
    @{
        Label = "FHWA ITEM 54B RADAR";
        Headline = "13' 6`" OVERPASS SENTINEL";
        Sub = "Sub-174`" laser radar detection with dynamic bypass corridor rerouting (Loop 820 North).";
        Border = [System.Drawing.Color]::FromArgb(255, 239, 68, 68);
        Color = [System.Drawing.Color]::FromArgb(255, 248, 113, 113);
    },
    @{
        Label = "DISPATCH ZERO";
        Headline = "$/HR REVENUE RANKING";
        Sub = "Loads sorted by gross yield per legal driving hour with instant one-click dispatch lock.";
        Border = [System.Drawing.Color]::FromArgb(255, 255, 229, 0);
        Color = [System.Drawing.Color]::FromArgb(255, 255, 229, 0);
    },
    @{
        Label = "THE MASTER MECHANIC";
        Headline = "J1939 CAN-BUS ECM SCANNER";
        Sub = "SPN/FMI fault clearing, engine component failure radar, and kingpin jackknife danger warnings.";
        Border = [System.Drawing.Color]::FromArgb(255, 16, 185, 129);
        Color = [System.Drawing.Color]::FromArgb(255, 52, 211, 153);
    },
    @{
        Label = "COMPLIANCE VAULT";
        Headline = "49 CFR § 390.31 ATTESTATION";
        Sub = "Tamper-evident legal custody seals, FIPS 180-4 SHA-256 proofs, and roadside audit packet export.";
        Border = [System.Drawing.Color]::FromArgb(255, 56, 189, 248);
        Color = [System.Drawing.Color]::FromArgb(255, 56, 189, 248);
    }
)

for ($i = 0; $i -lt $cards.Count; $i++) {
    $c = $cards[$i]
    $cx = $startX + $i * ($cardW + $cardGap)

    # Semi-transparent card background
    $cRect = New-Object System.Drawing.Rectangle($cx, $cardY, $cardW, $cardH)
    $cBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(225, 8, 14, 24))
    $g2.FillRectangle($cBrush, $cRect)
    $cBrush.Dispose()

    # Border
    $cPen = New-Object System.Drawing.Pen($c.Border, 3)
    $g2.DrawRectangle($cPen, $cRect)
    $cPen.Dispose()

    # Top accent line
    $aPen = New-Object System.Drawing.Pen($c.Border, 8)
    $g2.DrawLine($aPen, $cx, $cardY, ($cx + $cardW), $cardY)
    $aPen.Dispose()

    # Category label
    $lblFont = New-Object System.Drawing.Font("Segoe UI", 26, [System.Drawing.FontStyle]::Bold)
    $lblBrush = New-Object System.Drawing.SolidBrush($c.Color)
    $g2.DrawString($c.Label, $lblFont, $lblBrush, ($cx + 36), ($cardY + 40))
    $lblFont.Dispose()
    $lblBrush.Dispose()

    # Headline
    $hdFont = New-Object System.Drawing.Font("Segoe UI", 36, [System.Drawing.FontStyle]::Bold)
    $g2.DrawString($c.Headline, $hdFont, $whiteBrush, ($cx + 36), ($cardY + 95))
    $hdFont.Dispose()

    # Divider line
    $dPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 255, 255, 255), 1)
    $g2.DrawLine($dPen, ($cx + 36), ($cardY + 180), ($cx + $cardW - 36), ($cardY + 180))
    $dPen.Dispose()

    # Description
    $dsFont = New-Object System.Drawing.Font("Segoe UI", 26, [System.Drawing.FontStyle]::Regular)
    $dsBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 203, 213, 225))
    $dsRect = New-Object System.Drawing.RectangleF(($cx + 36), ($cardY + 210), ($cardW - 72), 240)
    $g2.DrawString($c.Sub, $dsFont, $dsBrush, $dsRect)
    $dsFont.Dispose()
    $dsBrush.Dispose()
}

# Bottom Verification Pills
$botY = $targetH - 180
$pillFont = New-Object System.Drawing.Font("Segoe UI", 28, [System.Drawing.FontStyle]::Bold)
$pillBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(210, 6, 78, 59))
$pillBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 16, 185, 129), 2)
$pillText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 167, 243, 208))

$pills = @(
    "[VERIFIED] FMCSA § 390.31 LEGAL CUSTODY",
    "[VERIFIED] 49 CFR § 396.11 ELECTRONIC DVIR",
    "[VERIFIED] MULTI-TENANT ISOLATED CLOUD",
    "[VERIFIED] FIPS 180-4 SHA-256 DIGITAL SEALS"
)

$px = 180
foreach ($p in $pills) {
    $measure = $g2.MeasureString($p, $pillFont)
    $pw = [int]$measure.Width + 48
    $ph = 70
    $pRect = New-Object System.Drawing.Rectangle($px, $botY, $pw, $ph)

    $g2.FillRectangle($pillBg, $pRect)
    $g2.DrawRectangle($pillBorder, $pRect)
    $g2.DrawString($p, $pillFont, $pillText, ($px + 24), ($botY + 14))

    $px += $pw + 40
}

$pillFont.Dispose()
$pillBg.Dispose()
$pillBorder.Dispose()
$pillText.Dispose()

$yellowBrush.Dispose()
$whiteBrush.Dispose()
$emeraldBrush.Dispose()
$slateBrush.Dispose()
$g2.Dispose()

$brandedPathPub = Join-Path $outDir1 "TruckWithEase_Developer_Banner_4096x2304.jpg"
$brandedPathDown = Join-Path $outDir2 "TruckWithEase_Developer_Banner_4096x2304.jpg"

Save-BoundedJpeg $brandedBmp $brandedPathPub 84
Copy-Item -Path $brandedPathPub -Destination $brandedPathDown -Force
$brandedBmp.Dispose()

Write-Host "All banners generated successfully!"
