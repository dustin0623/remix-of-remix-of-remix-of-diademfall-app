Add-Type -AssemblyName System.Drawing
$manifest=Get-Content public/assets/abilities/manifest.json -Raw | ConvertFrom-Json
$active=@($manifest.icons | Where-Object {$_.active -ne $false})
if($active.Count -ne 18){throw 'Expected 18 active ability icons'}
$report=@()
foreach($entry in $manifest.icons){
 $file='public'+$entry.file
 $bitmap=[Drawing.Bitmap]::new((Join-Path (Get-Location).Path $file))
 $valid=$bitmap.Width -eq 150 -and $bitmap.Height -eq 152 -and $bitmap.GetPixel(75,76).A -gt 128
 foreach($corner in @(@(0,0),@(149,0),@(0,151),@(149,151))){if($bitmap.GetPixel($corner[0],$corner[1]).A -ne 0){$valid=$false}}
 $minX=150;$minY=152;$maxX=-1;$maxY=-1
 for($y=0;$y -lt 152;$y+=2){for($x=0;$x -lt 150;$x+=2){
  if($bitmap.GetPixel($x,$y).A -gt 128){$minX=[Math]::Min($minX,$x);$minY=[Math]::Min($minY,$y);$maxX=[Math]::Max($maxX,$x);$maxY=[Math]::Max($maxY,$y)}
 }}
 $ratio=($maxX-$minX+1)/[double]($maxY-$minY+1)
 if($ratio -lt 0.94 -or $ratio -gt 1.06){$valid=$false}
 $hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
 if($hash -ne $entry.sha256){$valid=$false}
 $report+=@{id=$entry.id;valid=$valid;width=150;height=152;transparentCorners=$true;opaqueCenter=$true;artworkAspectRatio=[Math]::Round($ratio,4);sha256=$hash}
 $bitmap.Dispose()
 if(-not $valid){throw ('Invalid ability icon: '+$entry.id)}
}
$report | ConvertTo-Json -Depth 5 | Set-Content docs/ability-rebalance/icon-qa.json
Write-Output ('Verified '+$active.Count+' active copper ability icons and '+($manifest.icons.Count-$active.Count)+' retained illustrations: 150 x 152, transparent corners, opaque faces, circular proportions and matching checksums.')
