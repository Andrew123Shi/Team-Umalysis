# Recreates "Team Umalysis [DEV].lnk" in the project root (run after moving the repo).
$projectRoot = Split-Path -Parent $PSScriptRoot
$batPath = Join-Path $projectRoot "Team Umalysis [DEV].bat"
$lnkPath = Join-Path $projectRoot "Team Umalysis [DEV].lnk"
$iconPath = Join-Path $projectRoot "public\icon.ico"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = $batPath
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = "Start Team Umalysis dashboard (dev)"
if ($iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
}
$shortcut.Save()

Write-Host "Created: $lnkPath"
