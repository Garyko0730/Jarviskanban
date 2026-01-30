Add-Type -AssemblyName System.Windows.Forms

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$intro = @"
Jarvis Kanban · One-Click Launch

- 选择你的同步 JSON 文件
- 后台自动启动看板与同步代理
- 浏览器会自动打开

提示：工作时保持该窗口开启
"@

Write-Host $intro
[System.Windows.Forms.MessageBox]::Show($intro, "Jarvis Kanban") | Out-Null

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = "Select Jarvis Kanban sync file"
$dialog.Filter = "JSON Files (*.json)|*.json|All Files (*.*)|*.*"
$dialog.InitialDirectory = [Environment]::GetFolderPath('Desktop')

$selected = $null
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  $selected = $dialog.FileName
}

if (-not $selected) {
  [System.Windows.Forms.MessageBox]::Show("No sync file selected.", "Jarvis Kanban") | Out-Null
  exit 1
}

$env:SYNC_FILE = $selected

Start-Process "npm" -ArgumentList "run", "sync:watch" -WorkingDirectory $projectRoot -WindowStyle Minimized
Start-Process "npm" -ArgumentList "run", "dev" -WorkingDirectory $projectRoot -WindowStyle Minimized
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

[System.Windows.Forms.MessageBox]::Show("Jarvis Kanban started.\nSync file: $selected", "Jarvis Kanban") | Out-Null
