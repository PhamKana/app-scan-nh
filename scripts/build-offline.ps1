$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
node scripts/copy-opencv.mjs
if ($LASTEXITCODE -ne 0) { throw 'Copy OpenCV failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
New-Item -ItemType Directory -Force -Path release | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = Join-Path (Get-Location) 'release/site.zip'
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive }
[System.IO.Compression.ZipFile]::CreateFromDirectory((Join-Path (Get-Location) 'out'), $archive)
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:winexe /optimize+ '/out:release\GonScan.exe' '/resource:release\site.zip,site.zip' /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll '.\scripts\OfflineLauncher.cs'
if ($LASTEXITCODE -ne 0) { throw 'Compile launcher failed' }
Get-Item -LiteralPath release/GonScan.exe | Select-Object FullName, Length
