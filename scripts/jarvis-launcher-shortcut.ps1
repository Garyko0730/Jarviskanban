$projectRoot = Split-Path -Parent $PSScriptRoot
$target = Join-Path $projectRoot "scripts\jarvis-launcher.cmd"
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "Jarvis Kanban (Launcher).lnk"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = $projectRoot
$shortcut.IconLocation = "$target,0"
$shortcut.Save()

Write-Host "Shortcut created: $shortcutPath"
