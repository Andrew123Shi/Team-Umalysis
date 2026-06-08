$projectRoot = Split-Path -Parent $PSScriptRoot
$targetBat = Join-Path $projectRoot "scripts\update-gamedata\update.bat"
$shortcutPath = Join-Path $projectRoot "UPDATE_gamedata.lnk"

if (-not (Test-Path $targetBat)) {
    throw "Missing update script: $targetBat"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetBat
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = "Update Team Umalysis game data from local Uma Musume master.mdb"
$shortcut.Save()

Write-Host "Created shortcut: $shortcutPath"
Write-Host "Target: $targetBat"
