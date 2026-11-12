param([Parameter(Mandatory)][string]$Source,[Parameter(Mandatory)][string]$Id,[ValidateSet('bastion_orders','wild_courts','veil_covenant','hollow_legions','skybound_houses','wyrm_clans','wayfarer')][string]$Banner,[ValidateSet('common','uncommon','rare','epic','legendary')][string]$Rarity,[ValidateSet('normal','summoner')][string]$Kind)
Add-Type -AssemblyName System.Drawing
if($Id -notmatch '^[a-z0-9_]+$'){throw 'Unsafe card identifier'}
$folder=Join-Path (Get-Location).Path ('public/assets/raw/portraits/'+$Banner+'/'+$Rarity+'/'+$Kind)
New-Item -ItemType Directory -Force -Path $folder | Out-Null
$sourceImage=[Drawing.Image]::FromFile($Source)
$bitmap=[Drawing.Bitmap]::new(300,420,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g=[Drawing.Graphics]::FromImage($bitmap)
$g.Clear([Drawing.Color]::Transparent)
$g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.CompositingQuality=[Drawing.Drawing2D.CompositingQuality]::HighQuality
$scale=[Math]::Min(300.0/$sourceImage.Width,420.0/$sourceImage.Height)
$w=[int][Math]::Round($sourceImage.Width*$scale)
$h=[int][Math]::Round($sourceImage.Height*$scale)
$g.DrawImage($sourceImage,[Drawing.Rectangle]::new([int]((300-$w)/2),[int]((420-$h)/2),$w,$h))
$target=Join-Path $folder ($Id+'.png')
$bitmap.Save($target,[Drawing.Imaging.ImageFormat]::Png)
$corners=@($bitmap.GetPixel(0,0).A,$bitmap.GetPixel(299,0).A,$bitmap.GetPixel(0,419).A,$bitmap.GetPixel(299,419).A)
$g.Dispose();$bitmap.Dispose();$sourceImage.Dispose()
@{file=('/assets/raw/portraits/'+$Banner+'/'+$Rarity+'/'+$Kind+'/'+$Id+'.png');width=300;height=420;cornerAlpha=$corners}|ConvertTo-Json -Compress
