Add-Type -AssemblyName System.Windows.Forms

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

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

Start-Process "npm" -ArgumentList "run", "sync:watch" -WorkingDirectory $projectRoot
Start-Process "npm" -ArgumentList "run", "dev" -WorkingDirectory $projectRoot
Start-Process "http://localhost:3000"

[System.Windows.Forms.MessageBox]::Show("Jarvis Kanban started.\nSync file: $selected", "Jarvis Kanban") | Out-Null
