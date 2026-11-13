Add-Type -AssemblyName System.Drawing
$project=(Get-Location).Path
$manifest=Get-Content public/assets/cards/manifest.json -Raw | ConvertFrom-Json
$silver=[Drawing.Bitmap]::new((Join-Path $project 'public/assets/raw/frames/common.png'))
$report=@()
foreach($rarity in @('common','uncommon','rare','epic','legendary')){
 $frame=[Drawing.Bitmap]::new((Join-Path $project ('public/assets/raw/frames/'+$rarity+'.png')))
 if($frame.Width -ne 300 -or $frame.Height -ne 420){throw 'Wrong frame size'}
 $different=0
 for($y=0;$y -lt 420;$y++){for($x=0;$x -lt 300;$x++){
  if($x -ge 138 -and $x -le 162 -and $y -ge 6 -and $y -le 30){continue}
  if($frame.GetPixel($x,$y).ToArgb() -ne $silver.GetPixel($x,$y).ToArgb()){$different++}
 }}
 $rail=@(30,75,110,150,190,225,270) | ForEach-Object {
  $start=-1
  for($y=0;$y -le 8;$y++){if($frame.GetPixel($_,$y).A -gt 128){$start=$y;break}}
  $start
 }
 $corners=@(@(1,1),@(298,1),@(1,418),@(298,418)) | ForEach-Object {$frame.GetPixel($_[0],$_[1]).A}
 $square=($corners | Where-Object {$_ -lt 128}).Count -eq 0
 $valid=$different -eq 0 -and $square -and $frame.GetPixel(150,210).A -eq 0 -and ($rail | Where-Object {$_ -lt 0}).Count -eq 0
 $report+=@{rarity=$rarity;valid=$valid;topRailStarts=@($rail);transparentWindow=$frame.GetPixel(150,210).A -eq 0;changedPixelsOutsideSeal=$different;squareCorners=$square;nearCornerAlpha=@($corners)}
 $frame.Dispose()
 if(-not $valid){throw ('Invalid frame: '+$rarity)}
}
$silver.Dispose()
$preview=[Drawing.Bitmap]::new(1500,460)
$g=[Drawing.Graphics]::FromImage($preview)
$g.Clear([Drawing.Color]::FromArgb(24,32,46))
$index=0
foreach($rarity in @('common','uncommon','rare','epic','legendary')){
 $frame=[Drawing.Image]::FromFile((Join-Path $project ('public/assets/raw/frames/'+$rarity+'.png')))
 $g.DrawImage($frame,$index*300,0,300,420)
 $font=[Drawing.Font]::new('Segoe UI',14)
 $g.DrawString($rarity,$font,[Drawing.Brushes]::Ivory,($index*300+85),430)
 $font.Dispose();$frame.Dispose();$index++
}
$preview.Save((Join-Path $project 'docs/card-layers/rarity-frames.png'),[Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$preview.Dispose()
foreach($card in $manifest.cards){
 if(-not $card.layered){throw ('Card not layered: '+$card.id)}
 foreach($asset in @($card.file,$card.layers.portrait,$card.layers.background,$card.layers.frame)){
  $path=Join-Path $project ('public'+$asset)
  $image=[Drawing.Image]::FromFile($path)
  $valid=$image.Width -eq 300 -and $image.Height -eq 420
  $image.Dispose()
  if(-not $valid){throw ('Wrong card layer size: '+$asset)}
 }
 $checksum=(Get-FileHash -LiteralPath (Join-Path $project ('public'+$card.file)) -Algorithm SHA256).Hash.ToLowerInvariant()
 if($checksum -ne $card.sha256){throw ('Checksum mismatch: '+$card.id)}
}
$report | ConvertTo-Json -Depth 5 | Set-Content docs/card-layers/frame-qa.json
$emblemReport=@()
foreach($rarity in @('common','uncommon','rare','epic','legendary')){
 $file='public/assets/raw/rarity-emblems/'+$rarity+'.png'
 $emblem=[Drawing.Bitmap]::new((Join-Path $project $file))
 $valid=$emblem.Width -eq 96 -and $emblem.Height -eq 96 -and $emblem.GetPixel(48,48).A -gt 128
 foreach($corner in @(@(0,0),@(95,0),@(0,95),@(95,95))){if($emblem.GetPixel($corner[0],$corner[1]).A -ne 0){$valid=$false}}
 $emblem.Dispose()
 if(-not $valid){throw ('Invalid rarity emblem: '+$rarity)}
 $emblemReport+=@{rarity=$rarity;width=96;height=96;valid=$valid;sha256=(Get-FileHash -LiteralPath (Join-Path $project $file) -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$emblemReport | ConvertTo-Json -Depth 4 | Set-Content docs/card-layers/rarity-emblem-qa.json
Write-Output ('Verified '+$manifest.cards.Count+' layered cards and 5 identical square silver rims with cleaned flame rarity seals.')
