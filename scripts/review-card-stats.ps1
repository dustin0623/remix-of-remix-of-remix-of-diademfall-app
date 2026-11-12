Add-Type -AssemblyName System.Drawing
$project=(Get-Location).Path
$ids=@('mana','health','armor','speed','steel','shot','spell')
$labels=@('Mana crystal','Health / heart','Armor / shield','Speed / boot','Melee / swords','Ranged / target','Magic / spark')
$values=@(6,6,3,1,2,4,3)
$report=@()
$sheet=[Drawing.Bitmap]::new(1120,260)
$g=[Drawing.Graphics]::FromImage($sheet)
$g.Clear([Drawing.Color]::FromArgb(20,27,40))
$g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
$titleFont=[Drawing.Font]::new('Segoe UI',15,[Drawing.FontStyle]::Bold)
$font=[Drawing.Font]::new('Segoe UI',10)
$g.DrawString('SIMPLE COMBAT STAT SYMBOLS',$titleFont,[Drawing.Brushes]::Ivory,20,12)
for($i=0;$i -lt $ids.Count;$i++){
 $id=$ids[$i]
 $file='public/assets/stats/'+$id+'.png'
 $icon=[Drawing.Bitmap]::new((Join-Path $project $file))
 $valid=$icon.Width -eq 96 -and $icon.Height -eq 96 -and $icon.GetPixel(48,48).A -gt 128
 foreach($corner in @(@(0,0),@(95,0),@(0,95),@(95,95))){if($icon.GetPixel($corner[0],$corner[1]).A -ne 0){$valid=$false}}
 if(-not $valid){throw ('Invalid stat symbol: '+$id)}
 $x=$i*160
 $g.DrawImage($icon,($x+32),44,96,96)
 $g.DrawString($labels[$i],$font,[Drawing.Brushes]::Ivory,($x+14),147)
 $g.DrawImage($icon,($x+37),180,48,48)
 $g.DrawImage($icon,($x+108),195,20,20)
 $path=[Drawing.Drawing2D.GraphicsPath]::new()
 $format=[Drawing.StringFormat]::new()
 $format.Alignment=[Drawing.StringAlignment]::Center
 $format.LineAlignment=[Drawing.StringAlignment]::Center
 $offsetX=if($id -eq 'speed'){4}else{0}
 $offsetY=if($id -eq 'speed'){-1.5}elseif($id -eq 'steel'){1.5}else{0}
 $path.AddString([string]$values[$i],[Drawing.FontFamily]::new('Georgia'),[int][Drawing.FontStyle]::Bold,23,[Drawing.RectangleF]::new(($x+37+$offsetX),(180+$offsetY),48,48),$format)
 $pen=[Drawing.Pen]::new([Drawing.Color]::FromArgb(11,13,20),2)
 $pen.LineJoin=[Drawing.Drawing2D.LineJoin]::Round
 $g.DrawPath($pen,$path)
 $g.FillPath([Drawing.Brushes]::White,$path)
 $pen.Dispose();$path.Dispose();$format.Dispose();$icon.Dispose()
 $report+=@{stat=$id;width=96;height=96;transparentExterior=$true;opaqueCenter=$true;valid=$valid;sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$g.DrawString('Production: 96 px. Below: 48 px with sample values, and 20 px without values.',$font,[Drawing.Brushes]::LightSteelBlue,20,238)
$sheet.Save((Join-Path $project 'docs/card-layers/stat-symbols.png'),[Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$sheet.Dispose();$titleFont.Dispose();$font.Dispose()
$report | ConvertTo-Json -Depth 5 | Set-Content docs/card-layers/stat-qa.json
Write-Output 'Verified 7 transparent 96 x 96 stat symbols; small-size value preview saved.'
