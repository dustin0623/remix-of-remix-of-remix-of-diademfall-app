param([string]$Manifest='.asset-work/icon-generation.local.json')
Add-Type -AssemblyName System.Drawing
$icons=Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
$destination=Join-Path (Get-Location).Path 'public/assets/abilities'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$sheet=[Drawing.Bitmap]::new(1080,920,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sg=[Drawing.Graphics]::FromImage($sheet)
$sg.Clear([Drawing.ColorTranslator]::FromHtml('#101827'))
$sg.DrawString('DIADEMFALL  /  SHARED ABILITIES',[Drawing.Font]::new('Segoe UI',20,[Drawing.FontStyle]::Bold),[Drawing.Brushes]::Ivory,20,12)
$i=0
foreach($entry in $icons){
  $source=[Drawing.Image]::FromFile($entry.source)
  $bitmap=[Drawing.Bitmap]::new(150,152,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g=[Drawing.Graphics]::FromImage($bitmap)
  $g.Clear([Drawing.Color]::Transparent)
  $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingQuality=[Drawing.Drawing2D.CompositingQuality]::HighQuality
  $scale=[Math]::Min(150.0/$source.Width,150.0/$source.Height)
  $w=[int][Math]::Round($source.Width*$scale); $h=[int][Math]::Round($source.Height*$scale)
  $g.DrawImage($source,[Drawing.Rectangle]::new([int]((150-$w)/2),[int]((152-$h)/2),$w,$h))
  $target=Join-Path $destination ($entry.id+'.png')
  $bitmap.Save($target,[Drawing.Imaging.ImageFormat]::Png)
  if($bitmap.GetPixel(0,0).A -ne 0){throw ('Opaque corner: '+$entry.id)}
  $x=20+($i%6)*180; $y=60+[Math]::Floor($i/6)*210
  $sg.DrawImage($bitmap,[int]$x,[int]$y,150,152)
  $label=$entry.id.Replace('_',' ')
  $sg.DrawString($label,[Drawing.Font]::new('Segoe UI',11,[Drawing.FontStyle]::Bold),[Drawing.Brushes]::Ivory,[single]$x,[single]($y+155))
  $sg.DrawImage($bitmap,[int]$x,[int]($y+180),24,24)
  $sg.DrawImage($bitmap,[int]($x+30),[int]($y+176),32,32)
  $g.Dispose(); $bitmap.Dispose(); $source.Dispose()
  $i++
}
$sheet.Save((Join-Path (Get-Location).Path 'docs/ability-rebalance/icon-contact-sheet.png'),[Drawing.Imaging.ImageFormat]::Png)
$sg.Dispose(); $sheet.Dispose()
Write-Output ('Exported and verified '+$i+' transparent 150 x 152 icons')
