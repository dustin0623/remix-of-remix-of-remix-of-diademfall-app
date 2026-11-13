Add-Type -AssemblyName System.Drawing
$records=Get-ChildItem .asset-work/card-layer-jobs -Filter '*.json' | ForEach-Object {Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json}
$exports=@()
foreach($record in $records){
 $key=$record.id.Substring($record.id.IndexOf('_')+1)
 switch($record.kind){
  'frame' {$relative='/assets/raw/frames/'+$key+'.png';$w=300;$h=420}
  'background' {$relative='/assets/raw/frames-background/'+$key+'.png';$w=300;$h=420}
  'stat' {$relative='/assets/stats/'+$key+'.png';$w=96;$h=96}
  'crest' {$relative='/assets/banners/crests/'+$key+'.png';$w=96;$h=96}
  'emblem' {$relative='/assets/raw/rarity-emblems/'+$key+'.png';$w=96;$h=96}
 }
 $source=[Drawing.Image]::FromFile($record.source)
 $bitmap=[Drawing.Bitmap]::new($w,$h,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
 $g=[Drawing.Graphics]::FromImage($bitmap)
 $g.Clear([Drawing.Color]::Transparent)
 $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $g.DrawImage($source,[Drawing.Rectangle]::new(0,0,$w,$h))
 if($record.kind -in @('stat','emblem')){
  if($bitmap.GetPixel(48,48).A -lt 128){throw ('Stat symbol center is transparent: '+$key)}
  foreach($corner in @(@(0,0),@(95,0),@(0,95),@(95,95))){
   if($bitmap.GetPixel($corner[0],$corner[1]).A -ne 0){throw ('Stat symbol exterior is opaque: '+$key)}
  }
 }
 if($record.kind -eq 'crest'){
  if($bitmap.GetPixel(48,48).A -lt 128){throw ('Crest field is transparent: '+$key)}
  foreach($corner in @(@(0,0),@(95,0),@(0,95),@(95,95))){
   if($bitmap.GetPixel($corner[0],$corner[1]).A -ne 0){throw ('Crest exterior is opaque: '+$key)}
  }
 }
 if($record.kind -eq 'frame'){
  # Every rarity uses the exact same silver rim. Only the generated inner seal changes.
  if($record.emblemId){
   $emblemRecord=$records | Where-Object {$_.id -eq $record.emblemId}
   if(-not $emblemRecord){throw ('Missing rarity emblem: '+$key)}
   $emblem=[Drawing.Image]::FromFile($emblemRecord.source)
   $seal=[Drawing.Drawing2D.GraphicsPath]::new()
   $seal.AddEllipse(138,6,24,24)
   $g.SetClip($seal)
   $g.DrawImage($emblem,[Drawing.Rectangle]::new(132,0,36,36))
   $g.ResetClip()
   $seal.Dispose();$emblem.Dispose()
  }elseif($key -ne 'common'){
   $silverRecord=$records | Where-Object {$_.id -eq 'frame_common'}
   $silver=[Drawing.Image]::FromFile($silverRecord.source)
   $g.Clear([Drawing.Color]::Transparent)
   $g.DrawImage($silver,[Drawing.Rectangle]::new(0,0,$w,$h))
   $seal=[Drawing.Drawing2D.GraphicsPath]::new()
   $seal.AddEllipse(138,5,24,24)
   $g.SetClip($seal)
   $g.DrawImage($source,[Drawing.Rectangle]::new(0,0,$w,$h))
   $g.ResetClip()
   $seal.Dispose();$silver.Dispose()
  }
  if($bitmap.GetPixel(150,210).A -ne 0){throw ('Frame interior is opaque: '+$key)}
  foreach($corner in @(@(1,1),@(298,1),@(1,418),@(298,418))){
   if($bitmap.GetPixel($corner[0],$corner[1]).A -lt 128){throw ('Frame corner is not square: '+$key)}
  }
  foreach($railX in @(30,75,110,150,190,225,270)){
   $first=-1
   for($railY=0;$railY -le 8;$railY++){if($bitmap.GetPixel($railX,$railY).A -gt 128){$first=$railY;break}}
   if($first -lt 0){throw ('Top rail gap: '+$key+' at x='+$railX)}
  }
 }
 $target=Join-Path (Get-Location).Path ('public'+$relative)
 New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
 $bitmap.Save($target,[Drawing.Imaging.ImageFormat]::Png)
 $exports+=@{id=$record.id;kind=$record.kind;file=$relative;width=$w;height=$h;generator='built-in image_gen';prompt=$record.prompt;assembly=$(if($record.kind -eq 'frame' -and $record.emblemId){'Shared square-corner silver frame; cleaned flame rarity emblem clipped to the inner seal.'}elseif($record.kind -eq 'frame'){'Shared square-corner silver frame; rarity color edits clipped to the inner disc.'}else{'Resized to production canvas.'})}
 $g.Dispose();$bitmap.Dispose();$source.Dispose()
}
$exports | ConvertTo-Json -Depth 6 | Set-Content public/assets/raw/layers-manifest.json
New-Item -ItemType Directory -Force -Path docs/card-layers | Out-Null
$sheet=[Drawing.Bitmap]::new(1500,1120)
$g=[Drawing.Graphics]::FromImage($sheet)
$g.Clear([Drawing.Color]::FromArgb(24,32,46))
$i=0
foreach($rarity in @('common','uncommon','rare','epic','legendary')){
 $frame=[Drawing.Image]::FromFile((Join-Path (Get-Location).Path ('public/assets/raw/frames/'+$rarity+'.png')))
 $g.DrawImage($frame,$i*300,0,300,420)
 $g.DrawString($rarity,[Drawing.Font]::new('Segoe UI',14),[Drawing.Brushes]::Ivory,($i*300+30),425)
 $frame.Dispose();$i++
}
$i=0
foreach($id in @('mana','health','armor','speed','steel','shot','spell')){
 $img=[Drawing.Image]::FromFile((Join-Path (Get-Location).Path ('public/assets/stats/'+$id+'.png')))
 $g.DrawImage($img,30+$i*180,480,96,96)
 $g.DrawString($id,[Drawing.Font]::new('Segoe UI',12),[Drawing.Brushes]::Ivory,30+$i*180,580)
 $img.Dispose();$i++
}
$i=0
foreach($id in @('bastion_orders','wild_courts','veil_covenant','hollow_legions','skybound_houses','wyrm_clans','wayfarer')){
 $img=[Drawing.Image]::FromFile((Join-Path (Get-Location).Path ('public/assets/banners/crests/'+$id+'.png')))
 $bg=[Drawing.Image]::FromFile((Join-Path (Get-Location).Path ('public/assets/raw/frames-background/'+$id+'.png')))
 $g.DrawImage($bg,30+$i*205,650,180,252)
 $g.DrawImage($img,70+$i*205,915,96,96)
 $g.DrawString($id,[Drawing.Font]::new('Segoe UI',10),[Drawing.Brushes]::Ivory,30+$i*205,1025)
 $img.Dispose();$bg.Dispose();$i++
}
$sheet.Save((Join-Path (Get-Location).Path 'docs/card-layers/layers-preview.png'),[Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$sheet.Dispose()
Write-Output ('Exported '+$exports.Count+' card layers; transparent frame windows verified.')

