param([switch]$RequireAll)
Add-Type -AssemblyName System.Drawing
$project=(Get-Location).Path
$manifest=Get-Content public/assets/cards/manifest.json -Raw | ConvertFrom-Json
$report=@();$ready=0;$problems=@()
for($batch=0;$batch -lt 6;$batch++){
 $sheet=[Drawing.Bitmap]::new(900,1300)
 $g=[Drawing.Graphics]::FromImage($sheet)
 $g.Clear([Drawing.Color]::FromArgb(20,27,40))
 $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 for($cell=0;$cell -lt 25;$cell++){
  $index=$batch*25+$cell
  if($index -ge $manifest.cards.Count){break}
  $card=$manifest.cards[$index]
  $relative='/assets/raw/portraits/'+$card.banner+'/'+$card.rarity+'/'+$card.kind+'/'+$card.id+'.png'
  $file=Join-Path $project ('public'+$relative)
  $x=($cell%5)*180;$y=[Math]::Floor($cell/5)*260
  for($cy=0;$cy -lt 224;$cy+=16){for($cx=0;$cx -lt 160;$cx+=16){
   $color=if((($cx/16)+($cy/16))%2 -eq 0){[Drawing.Color]::FromArgb(218,226,235)}else{[Drawing.Color]::FromArgb(163,176,192)}
   $brush=[Drawing.SolidBrush]::new($color)
   $g.FillRectangle($brush,[int]($x+$cx),[int]($y+$cy),16,16);$brush.Dispose()
  }}
  if(Test-Path -LiteralPath $file){
   $bitmap=[Drawing.Bitmap]::new($file)
   $transparent=0;$samples=0
   for($py=0;$py -lt $bitmap.Height;$py+=10){for($px=0;$px -lt $bitmap.Width;$px+=10){
    if($bitmap.GetPixel($px,$py).A -lt 8){$transparent++};$samples++
   }}
   $fraction=[Math]::Round($transparent/[double]$samples,4)
   $valid=$bitmap.Width -eq 300 -and $bitmap.Height -eq 420 -and $fraction -gt 0.01
   if(-not $valid){$problems+=$card.id}
   $report+=@{id=$card.id;file=$relative;width=$bitmap.Width;height=$bitmap.Height;transparentFraction=$fraction;valid=$valid}
   $g.DrawImage($bitmap,[int]$x,[int]$y,160,224)
   $bitmap.Dispose();$ready++
   $label=$card.id+'  '+[int]($fraction*100)+'% alpha'
  }else{$report+=@{id=$card.id;file=$relative;status='pending'};$label=$card.id+' (pending)'}
  $g.DrawString($label,[Drawing.Font]::new('Segoe UI',8),[Drawing.Brushes]::Ivory,[single]$x,[single]($y+227))
 }
 $sheet.Save((Join-Path $project ('docs/card-layers/cutouts-'+$batch+'.png')),[Drawing.Imaging.ImageFormat]::Png)
 $g.Dispose();$sheet.Dispose()
}
$report | ConvertTo-Json -Depth 6 | Set-Content docs/card-layers/portrait-alpha.json
Write-Output ('Reviewed exports: '+$ready+'/150; alpha/size problems: '+$problems.Count)
if($RequireAll -and ($ready -ne 150 -or $problems.Count -gt 0)){throw ('Portrait QA incomplete: '+($problems -join ', '))}
