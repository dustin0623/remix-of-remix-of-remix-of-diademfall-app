param([string]$Samples='.asset-work/stat-preview-cards.json')
Add-Type -AssemblyName System.Drawing
$project=(Get-Location).Path
$cards=Get-Content -LiteralPath $Samples -Raw | ConvertFrom-Json
$icons=@{}
foreach($stat in @('mana','health','armor','speed','steel','shot','spell')){
 $icons[$stat]=[Drawing.Image]::FromFile((Join-Path $project ('public/assets/stats/'+$stat+'.png')))
}
function Draw-Stat($Graphics,[string]$Stat,[int]$Value,[float]$X,[float]$Y,[float]$Size,[float]$FontSize=24){
 $Graphics.DrawImage($icons[$Stat],[Drawing.RectangleF]::new($X,$Y,$Size,$Size))
 $offsetX=if($Stat -eq 'speed'){$Size*0.08}else{0}
 $offsetY=if($Stat -eq 'speed'){$Size*-0.03}elseif($Stat -eq 'steel'){$Size*0.03}else{0}
 $path=[Drawing.Drawing2D.GraphicsPath]::new()
 $format=[Drawing.StringFormat]::new()
 $format.Alignment=[Drawing.StringAlignment]::Center
 $format.LineAlignment=[Drawing.StringAlignment]::Center
 $family=[Drawing.FontFamily]::new('Georgia')
 $path.AddString([string]$Value,$family,[int][Drawing.FontStyle]::Bold,$FontSize,[Drawing.RectangleF]::new(($X+$offsetX),($Y+$offsetY),$Size,$Size),$format)
 $pen=[Drawing.Pen]::new([Drawing.Color]::FromArgb(11,13,20),2.2)
 $pen.LineJoin=[Drawing.Drawing2D.LineJoin]::Round
 $Graphics.DrawPath($pen,$path)
 $Graphics.FillPath([Drawing.Brushes]::White,$path)
 $family.Dispose();$format.Dispose();$path.Dispose();$pen.Dispose()
}
$sheet=[Drawing.Bitmap]::new(960,402)
$g=[Drawing.Graphics]::FromImage($sheet)
$g.Clear([Drawing.Color]::FromArgb(20,27,40))
$g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$title=[Drawing.Font]::new('Segoe UI',14,[Drawing.FontStyle]::Bold)
$font=[Drawing.Font]::new('Segoe UI',12)
$small=[Drawing.Font]::new('Segoe UI',9)
$g.DrawString('STAT OVERLAYS / ASSET PREVIEW',$title,[Drawing.Brushes]::Ivory,20,12)
for($i=0;$i -lt $cards.Count;$i++){
 $u=$cards[$i]
 $file='public/assets/cards/'+$u.banner+'/'+$u.rarity+'/normal/regular_'+$u.id+'.png'
 $texture=[Drawing.Image]::FromFile((Join-Path $project $file))
 $card=[Drawing.Bitmap]::new(300,420)
 $cg=[Drawing.Graphics]::FromImage($card)
 $cg.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $cg.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
 $cg.DrawImage($texture,0,0,300,420)
 Draw-Stat $cg 'mana' $u.mana 3 4 57 30
 $position=0
 foreach($stat in @('steel','shot','spell')){
  if($u.$stat -le 0){continue}
  Draw-Stat $cg $stat $u.$stat 1.5 (126+$position*55.5) 51
  $position++
 }
 $position=0
 foreach($stat in @('armor','health','speed')){
  if($stat -eq 'armor' -and $u.armor -le 0){continue}
  Draw-Stat $cg $stat $u.$stat 247.5 (117.6+$position*55.5) 51
  $position++
 }
 $cg.Dispose();$texture.Dispose()
 $g.DrawImage($card,[Drawing.Rectangle]::new((20+$i*315),48,300,300),0,0,300,300,[Drawing.GraphicsUnit]::Pixel)
 $g.DrawString($u.name,$font,[Drawing.Brushes]::Ivory,(20+$i*315),352)
 $card.Dispose()
}
$g.DrawString('Native 300 px card crops with sample values. Asset composition preview, not a browser screenshot.',$small,[Drawing.Brushes]::LightSteelBlue,20,382)
$sheet.Save((Join-Path $project 'docs/card-layers/stat-card-overlays.png'),[Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$sheet.Dispose();$title.Dispose();$font.Dispose();$small.Dispose()
foreach($icon in $icons.Values){$icon.Dispose()}
Write-Output 'Saved stat overlays on three native-resolution card crops.'
