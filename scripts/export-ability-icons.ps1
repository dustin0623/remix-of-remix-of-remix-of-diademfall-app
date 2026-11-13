param([string]$Manifest='.asset-work/icon-generation.local.json',[string]$Destination='public/assets/abilities',[string]$ContactSheet='docs/ability-rebalance/icon-contact-sheet.png',[int]$ExpectedCount=24)
Add-Type -AssemblyName System.Drawing
$icons=Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
$destination=Join-Path (Get-Location).Path $Destination
if($icons.Count -ne $ExpectedCount){throw ('Expected '+$ExpectedCount+' icons, received '+$icons.Count)}
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$sheet=[Drawing.Bitmap]::new(1080,920,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sg=[Drawing.Graphics]::FromImage($sheet)
$sg.Clear([Drawing.ColorTranslator]::FromHtml('#101827'))
$sg.DrawString('DIADEMFALL  /  SHARED ABILITIES',[Drawing.Font]::new('Segoe UI',20,[Drawing.FontStyle]::Bold),[Drawing.Brushes]::Ivory,20,12)
$i=0
foreach($entry in $icons){
  $source=[Drawing.Bitmap]::new($entry.source)
  $bitmap=[Drawing.Bitmap]::new(150,152,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g=[Drawing.Graphics]::FromImage($bitmap)
  $g.Clear([Drawing.Color]::Transparent)
  $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingQuality=[Drawing.Drawing2D.CompositingQuality]::HighQuality
  $sourceRect=[Drawing.Rectangle]::new(0,0,$source.Width,$source.Height)
  if($entry.trimToArtwork){
    # Models can return a round badge inside a tall canvas. Trim alpha padding, then fit without stretching.
    $minX=$source.Width;$minY=$source.Height;$maxX=-1;$maxY=-1
    for($sy=0;$sy -lt $source.Height;$sy+=4){for($sx=0;$sx -lt $source.Width;$sx+=4){
      if($source.GetPixel($sx,$sy).A -gt 128){$minX=[Math]::Min($minX,$sx);$minY=[Math]::Min($minY,$sy);$maxX=[Math]::Max($maxX,$sx);$maxY=[Math]::Max($maxY,$sy)}
    }}
    if($maxX -lt 0){throw ('Empty icon master: '+$entry.id)}
    $minX=[Math]::Max(0,$minX-6);$minY=[Math]::Max(0,$minY-6)
    $maxX=[Math]::Min($source.Width-1,$maxX+6);$maxY=[Math]::Min($source.Height-1,$maxY+6)
    $sourceRect=[Drawing.Rectangle]::new($minX,$minY,($maxX-$minX+1),($maxY-$minY+1))
  }
  $edge=if($entry.trimToArtwork){142.0}else{150.0}
  $scale=[Math]::Min($edge/$sourceRect.Width,$edge/$sourceRect.Height)
  $w=[int][Math]::Round($sourceRect.Width*$scale); $h=[int][Math]::Round($sourceRect.Height*$scale)
  $g.DrawImage($source,[Drawing.Rectangle]::new([int]((150-$w)/2),[int]((152-$h)/2),$w,$h),$sourceRect,[Drawing.GraphicsUnit]::Pixel)
  $target=Join-Path $destination ($entry.id+'.png')
  $bitmap.Save($target,[Drawing.Imaging.ImageFormat]::Png)
  foreach($corner in @(@(0,0),@(149,0),@(0,151),@(149,151))){if($bitmap.GetPixel($corner[0],$corner[1]).A -ne 0){throw ('Opaque corner: '+$entry.id)}}
  if($bitmap.GetPixel(75,76).A -lt 128){throw ('Transparent icon center: '+$entry.id)}
  $x=20+($i%6)*180; $y=60+[Math]::Floor($i/6)*210
  $sg.DrawImage($bitmap,[int]$x,[int]$y,150,152)
  $label=$entry.id.Replace('_',' ')
  $sg.DrawString($label,[Drawing.Font]::new('Segoe UI',11,[Drawing.FontStyle]::Bold),[Drawing.Brushes]::Ivory,[single]$x,[single]($y+155))
  $sg.DrawImage($bitmap,[int]$x,[int]($y+180),24,24)
  $sg.DrawImage($bitmap,[int]($x+30),[int]($y+176),32,32)
  $g.Dispose(); $bitmap.Dispose(); $source.Dispose()
  $i++
}
$sheet.Save((Join-Path (Get-Location).Path $ContactSheet),[Drawing.Imaging.ImageFormat]::Png)
$sg.Dispose(); $sheet.Dispose()
Write-Output ('Exported and verified '+$i+' transparent 150 x 152 icons')
