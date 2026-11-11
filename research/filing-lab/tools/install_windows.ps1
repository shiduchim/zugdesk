# ZivugMatch filing lab - one-time setup for Windows 10/11 (64-bit). No admin rights needed.
# Downloads: Python 3.12 + libraries (via uv), llama.cpp (llama-server.exe), and the models.
# After this finishes you can switch the internet off; the lab runs fully offline.
# NOTE: keep this file plain ASCII. Windows PowerShell 5.1 misreads UTF-8 characters such as long dashes.
param(
  [switch]$Gpu,          # use the Vulkan build of llama.cpp (most AMD/NVIDIA/Intel GPUs)
  [switch]$AllModels,    # also download the larger comparison models (several GB)
  [string]$Models = ""   # or a space-separated list of model ids from lab\models.json
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
function Step($t) { Write-Host ""; Write-Host "== $t" -ForegroundColor Cyan }

Step "1/4  uv (Python manager)"
$uv = Get-Command uv -ErrorAction SilentlyContinue
if (-not $uv) {
  Write-Host "Installing uv from astral.sh (official installer) ..."
  Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
  $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
  $uv = Get-Command uv -ErrorAction SilentlyContinue
  if (-not $uv) { throw "uv did not install. Install Python 3.12 from python.org, then run: py -3.12 -m venv .venv" }
}
Write-Host ("uv " + (& uv --version))

Step "2/4  Python 3.12 and libraries (PyTorch CPU, GLiNER2) - about 1 GB"
if (-not (Test-Path ".venv\Scripts\python.exe")) { & uv venv .venv --python 3.12 }
& uv pip install --python .venv\Scripts\python.exe -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "Library install failed." }

Step "3/4  llama.cpp (runs Engine B)"
$dest = Join-Path $Root "tools\llama.cpp"
if (-not (Test-Path (Join-Path $dest "llama-server.exe"))) {
  $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest" -Headers @{ "User-Agent" = "zivugmatch-lab" }
  $arch = "x64"
  if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { $arch = "arm64" }
  if ($Gpu) { $patterns = @("bin-win-vulkan-$arch.zip") } else { $patterns = @("bin-win-cpu-$arch.zip", "bin-win-avx2-$arch.zip", "bin-win-$arch.zip") }
  $asset = $null
  foreach ($p in $patterns) {
    $asset = $rel.assets | Where-Object { $_.name -like "*$p" } | Select-Object -First 1
    if ($asset) { break }
  }
  if (-not $asset) { throw "No Windows build found in llama.cpp release $($rel.tag_name). Download llama-server.exe manually into tools\llama.cpp\" }
  $sizeMB = [math]::Round($asset.size / 1MB)
  Write-Host ("Downloading " + $asset.name + " (" + $sizeMB + " MB) from github.com/ggml-org/llama.cpp ...")
  $zip = Join-Path $env:TEMP $asset.name
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -UseBasicParsing
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Expand-Archive -Path $zip -DestinationPath $dest -Force
  $exe = Get-ChildItem -Path $dest -Recurse -Filter "llama-server.exe" | Select-Object -First 1
  if (-not $exe) { throw "llama-server.exe was not in $($asset.name)." }
  if ($exe.DirectoryName -ne $dest) { Get-ChildItem $exe.DirectoryName | Move-Item -Destination $dest -Force }
  Remove-Item $zip -Force
  Set-Content -Path (Join-Path $dest "VERSION.txt") -Value $rel.tag_name
}
Write-Host "llama-server.exe is in tools\llama.cpp"

Step "4/4  Models (from huggingface.co)"
$modelArgs = @()
if ($AllModels) { $modelArgs += "--all" } elseif ($Models) { $modelArgs += $Models.Split(" ") }
$env:HF_HUB_OFFLINE = "0"
$env:PYTHONIOENCODING = "utf-8"
& .venv\Scripts\python.exe lab\download_models.py @modelArgs
if ($LASTEXITCODE -ne 0) { Write-Host "Some models did not download - the lab will show which. Run INSTALL again to retry." -ForegroundColor Yellow }

Write-Host ""
Write-Host "Done. Start the lab with START-WINDOWS.bat (you can turn the internet off first)." -ForegroundColor Green
