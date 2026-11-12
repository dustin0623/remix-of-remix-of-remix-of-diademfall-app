param([switch]$RequireAll)
Add-Type -AssemblyName System.Drawing
$project=(Get-Location).Path
$cardsRoot=Join-Path $project 'public/assets/cards'
$manifestPath=Join-Path $cardsRoot 'manifest.json'
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$frames=@{};$backgrounds=@{};$crests=@{}
foreach($rarity in @('common','uncommon','rare','epic','legendary')){
 $frames[$rarity]=[Drawing.Image]::FromFile((Join-Path $project ('public/assets/raw/frames/'+$rarity+'.png')))
}
foreach($banner in @('bastion_orders','wild_courts','veil_covenant','hollow_legions','skybound_houses','wyrm_clans','wayfarer')){
 $backgrounds[$banner]=[Drawing.Image]::FromFile((Join-Path $project ('public/assets/raw/frames-background/'+$banner+'.png')))
 $crests[$banner]=[Drawing.Image]::FromFile((Join-Path $project ('public/assets/banners/crests/'+$banner+'.png')))
}
$mana=[Drawing.Image]::FromFile((Join-Path $project 'public/assets/stats/mana.png'))
$count=0;$missing=@()
foreach($card in $manifest.cards){
 $portraitFile='/assets/raw/portraits/'+$card.banner+'/'+$card.rarity+'/'+$card.kind+'/'+$card.id+'.png'
 $portraitPath=Join-Path $project ('public'+$portraitFile)
 if(-not (Test-Path -LiteralPath $portraitPath)){ $missing+=$card.id;continue }
 $target=[IO.Path]::GetFullPath((Join-Path $project ('public'+$card.file)))
 if(-not $target.StartsWith($cardsRoot+'\')){throw 'Card destination escaped assets/cards'}
 $portrait=[Drawing.Image]::FromFile($portraitPath)
 if($portrait.Width -ne 300 -or $portrait.Height -ne 420){throw ('Wrong portrait size: '+$card.id)}
 $bitmap=[Drawing.Bitmap]::new(300,420,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
 $g=[Drawing.Graphics]::FromImage($bitmap)
 $g.Clear([Drawing.Color]::Transparent)
 $g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
 $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $clip=[Drawing.Drawing2D.GraphicsPath]::new()
 $clip.AddPolygon([Drawing.PointF[]]@(
  [Drawing.PointF]::new(15,8),[Drawing.PointF]::new(285,8),[Drawing.PointF]::new(294,21),[Drawing.PointF]::new(294,399),
  [Drawing.PointF]::new(282,412),[Drawing.PointF]::new(18,412),[Drawing.PointF]::new(6,399),[Drawing.PointF]::new(6,21)))
 $g.SetClip($clip)
 $g.DrawImage($backgrounds[$card.banner],0,0,300,420)
 $g.DrawImage($portrait,0,0,300,420)
 $shade=[Drawing.Drawing2D.LinearGradientBrush]::new([Drawing.Rectangle]::new(0,230,300,190),[Drawing.Color]::FromArgb(0,8,12,20),[Drawing.Color]::FromArgb(232,8,12,20),90.0)
 $g.FillRectangle($shade,0,230,300,190)
 $g.ResetClip()
 $g.DrawImage($frames[$card.rarity],0,0,300,420)
 $g.DrawImage($crests[$card.banner],252,10,39,39)
 $g.DrawImage($mana,3,4,57,57)
 $bitmap.Save($target,[Drawing.Imaging.ImageFormat]::Png)
 if(-not $card.PSObject.Properties['sourceWidth']){
  $card | Add-Member sourceWidth $card.width
  $card | Add-Member sourceHeight $card.height
  $card | Add-Member sourceSha256 $card.sha256
 }
 $card.width=300;$card.height=420
 $card | Add-Member -NotePropertyName layered -NotePropertyValue $true -Force
 $card | Add-Member -NotePropertyName layers -NotePropertyValue @{portrait=$portraitFile;frame=('/assets/raw/frames/'+$card.rarity+'.png');background=('/assets/raw/frames-background/'+$card.banner+'.png');crest=('/assets/banners/crests/'+$card.banner+'.png');mana='/assets/stats/mana.png'} -Force
 $card | Add-Member -NotePropertyName sha256 -NotePropertyValue ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()) -Force
 $g.Dispose();$bitmap.Dispose();$portrait.Dispose();$clip.Dispose();$shade.Dispose()
 $count++
}
foreach($image in @($frames.Values)+@($backgrounds.Values)+@($crests.Values)){$image.Dispose()}
$mana.Dispose()
$manifest.version=2
$manifest.generator='built-in image_gen; deterministic layer composition'
$manifest | Add-Member -NotePropertyName canvas -NotePropertyValue @{width=300;height=420} -Force
$manifest | Add-Member -NotePropertyName overlays -NotePropertyValue 'Names, stat values and abilities are live UI overlays. The PNG contains the background, cutout, frame, banner crest and empty mana badge.' -Force
$manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $manifestPath
Write-Output ('Composed '+$count+' / '+$manifest.cards.Count+' card textures at 300 x 420.')
if($RequireAll -and $missing.Count -gt 0){throw ('Missing '+$missing.Count+' cutouts: '+($missing -join ', '))}
