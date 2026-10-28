<#
  Payariq Oltin Ligasi - zaxira nusxa (Windows).

  Nima qiladi:
    1. PostgreSQL bazasini pg_dump bilan bitta faylga saqlaydi (backups\payariq-YYYY-MM-DD_HHmm.dump).
    2. Yuklangan rasmlar papkasini (logotiplar) zip qilib yoniga qo'yadi.
    3. Eng oxirgi -Keep ta nusxani qoldirib, eskilarini o'chiradi.

  Ulanish ma'lumotlari backend\.env faylidan olinadi (DB_URL, DB_USERNAME, DB_PASSWORD, MEDIA_DIR).
  Parol ekranga chiqarilmaydi va faqat shu jarayon uchun PGPASSWORD sifatida beriladi.

  Ishga tushirish (loyiha papkasida):
    powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
    powershell -ExecutionPolicy Bypass -File scripts\backup.ps1 -Keep 60 -Target D:\Zaxira
#>
param(
  [string]$Target = (Join-Path $PSScriptRoot "..\backups"),
  [int]$Keep = 30,
  [string]$EnvFile = (Join-Path $PSScriptRoot "..\backend\.env")
)
$ErrorActionPreference = "Stop"
$Target = [IO.Path]::GetFullPath($Target)

function Read-EnvFile([string]$path) {
  if (-not (Test-Path $path)) { throw "Sozlamalar fayli topilmadi: $path" }
  $values = @{}
  foreach ($line in Get-Content $path -Encoding UTF8) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { $values[$Matches[1]] = $Matches[2].Trim() }
  }
  return $values
}

$envValues = Read-EnvFile $EnvFile
foreach ($key in "DB_URL", "DB_USERNAME", "DB_PASSWORD") {
  if (-not $envValues[$key]) { throw "$key backend\.env faylida yo'q" }
}
# jdbc:postgresql://host:port/baza?parametrlar
if ($envValues["DB_URL"] -notmatch '^jdbc:postgresql://([^:/]+)(?::(\d+))?/([^?]+)') { throw "DB_URL formati tushunarsiz" }
$dbHost = $Matches[1]
$dbPort = if ($Matches[2]) { $Matches[2] } else { "5432" }
$dbName = $Matches[3]

$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDump) {
  $pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $pgDump) { throw "pg_dump topilmadi. PostgreSQL bin papkasini PATH ga qo'shing." }

New-Item -ItemType Directory -Force $Target | Out-Null
# Zaxirada parol xeshlari va futbolchilar telefonlari bor: papka faqat joriy foydalanuvchi va tizimga ochiq
& icacls $Target /inheritance:r /grant:r "$($env:USERDOMAIN)\$($env:USERNAME):(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Warning "Zaxira papkasi huquqlarini cheklab bo'lmadi (icacls kod $LASTEXITCODE)" }
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$dumpFile = Join-Path $Target "payariq-$stamp.dump"

Write-Host "Baza saqlanmoqda: $dbName ($dbHost`:$dbPort) -> $dumpFile"
$env:PGPASSWORD = $envValues["DB_PASSWORD"]
try {
  & $pgDump --host $dbHost --port $dbPort --username $envValues["DB_USERNAME"] --format=custom --no-owner --file $dumpFile $dbName
  if ($LASTEXITCODE -ne 0) { throw "pg_dump xato bilan tugadi (kod $LASTEXITCODE)" }
} finally {
  $env:PGPASSWORD = $null
}

# Yuklangan rasmlar (logotiplar). MEDIA_DIR berilmagan bo'lsa - backend\uploads
$mediaDir = if ($envValues["MEDIA_DIR"]) { $envValues["MEDIA_DIR"] } else { Join-Path $PSScriptRoot "..\backend\uploads" }
if ((Test-Path $mediaDir) -and (Get-ChildItem $mediaDir -File -ErrorAction SilentlyContinue)) {
  $mediaZip = Join-Path $Target "payariq-media-$stamp.zip"
  Compress-Archive -Path (Join-Path $mediaDir "*") -DestinationPath $mediaZip -Force
  Write-Host "Rasmlar saqlandi: $mediaZip"
}

# Eski nusxalarni tozalash: har turdan oxirgi $Keep tasi qoladi
foreach ($pattern in "payariq-2*.dump", "payariq-media-*.zip") {
  Get-ChildItem $Target -Filter $pattern | Sort-Object Name -Descending | Select-Object -Skip $Keep | Remove-Item -Force
}

$size = [math]::Round((Get-Item $dumpFile).Length / 1KB)
Write-Host "Tayyor: $dumpFile ($size KB)"
