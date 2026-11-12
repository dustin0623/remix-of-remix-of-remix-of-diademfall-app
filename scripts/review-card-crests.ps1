Add-Type -AssemblyName System.Drawing
$project=(Get-Location).Path
$banners=@('bastion_orders','wild_courts','veil_covenant','hollow_legions','skybound_houses','wyrm_clans','wayfarer')
$labels=@('Bastion','Wild Courts','Veil','Hollow','Skybound','Wyrm','Wayfarer')
$samples=@('bastion_orders/rare/summoner/regular_aldric_stonebanner.png','wild_courts/epic/normal/regular_antler_guardian.png','veil_covenant/legendary/normal/regular_the_unremembered_face.png','hollow_legions/legendary/normal/regular_the_bell_beneath.png','skybound_houses/legendary/normal/regular_thunder_roc_ancient.png','wyrm_clans/legendary/normal/regular_first_blood_wyrm.png','wayfarer/common/normal/regular_pebble_familiar.png')
$report=@()
$sheet=[Drawing.Bitmap]::new(1120,410)
$g=[Drawing.Graphics]::FromImage($sheet)
$g.Clear([Drawing.Color]::FromArgb(20,27,40))
$g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$titleFont=[Drawing.Font]::new('Segoe UI',15,[Drawing.FontStyle]::Bold)
$font=[Drawing.Font]::new('Segoe UI',11)
$smallFont=[Drawing.Font]::new('Segoe UI',9)
$g.DrawString('SILVER SHIELD CRESTS',$titleFont,[Drawing.Brushes]::Ivory,20,12)
for($i=0;$i -lt $banners.Count;$i++){
 $banner=$banners[$i]
 $crest=[Drawing.Bitmap]::new((Join-Path $project ('public/assets/banners/crests/'+$banner+'.png')))
 $valid=$crest.Width -eq 96 -and $crest.Height -eq 96 -and $crest.GetPixel(48,48).A -gt 128
 foreach($corner in @(@(0,0),@(95,0),@(0,95),@(95,95))){if($crest.GetPixel($corner[0],$corner[1]).A -ne 0){$valid=$false}}
 if(-not $valid){throw ('Invalid crest: '+$banner)}
 $report+=@{banner=$banner;width=96;height=96;transparentExterior=$true;opaqueField=$true;cardDisplaySize=39;valid=$valid;sha256=(Get-FileHash -LiteralPath ('public/assets/banners/crests/'+$banner+'.png') -Algorithm SHA256).Hash.ToLowerInvariant()}
 $x=$i*160
 $g.DrawImage($crest,($x+20),50,120,120)
 $g.DrawString($labels[$i],$font,[Drawing.Brushes]::Ivory,($x+25),177)
 $g.DrawString('39 px on card',$smallFont,[Drawing.Brushes]::LightSteelBlue,($x+33),205)
 # Inspect the exported card corner at native card resolution, including its real portrait and rim.
 $card=[Drawing.Image]::FromFile((Join-Path $project ('public/assets/cards/'+$samples[$i])))
 $destination=[Drawing.Rectangle]::new(($x+20),230,120,120)
 $g.DrawImage($card,$destination,180,0,120,120,[Drawing.GraphicsUnit]::Pixel)
 $card.Dispose();$crest.Dispose()
}
$g.DrawString('Shared broad silver bevel, dark inner edge, colored banner field. Actual card corners shown below.',$smallFont,[Drawing.Brushes]::LightSteelBlue,20,378)
$sheet.Save((Join-Path $project 'docs/card-layers/silver-shield-crests.png'),[Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$sheet.Dispose();$titleFont.Dispose();$font.Dispose();$smallFont.Dispose()
$report | ConvertTo-Json -Depth 5 | Set-Content docs/card-layers/crest-qa.json
Write-Output ('Verified '+$banners.Count+' transparent 96 x 96 shield crests; card-corner preview saved.')
