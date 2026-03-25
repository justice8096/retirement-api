# setup-backup-schedule.ps1 — Create Windows Task Scheduler job for daily DB backups
#
# Run as Administrator:
#   powershell -ExecutionPolicy Bypass -File tools/setup-backup-schedule.ps1
#
# Creates a daily task at 2:00 AM that runs backup-db.sh

$TaskName = "RetirementDB-DailyBackup"
$Description = "Daily PostgreSQL backup of retirement_saas to Google Drive"
$ScriptPath = "D:\retirement-api\tools\backup-db.sh"
$BashPath = "C:\Program Files\Git\bin\bash.exe"

# Remove existing task if present
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Create trigger: daily at 2:00 AM
$Trigger = New-ScheduledTaskTrigger -Daily -At "2:00AM"

# Create action: run bash script
$Action = New-ScheduledTaskAction `
    -Execute $BashPath `
    -Argument "-l -c 'export PGPASSWORD=postgres; bash D:/retirement-api/tools/backup-db.sh >> D:/backups/retirement-db/backup.log 2>&1'" `
    -WorkingDirectory "D:\retirement-api"

# Settings: run whether logged in or not, don't stop if on battery
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

# Register task (runs as current user)
Register-ScheduledTask `
    -TaskName $TaskName `
    -Description $Description `
    -Trigger $Trigger `
    -Action $Action `
    -Settings $Settings `
    -RunLevel Highest

Write-Host ""
Write-Host "Task '$TaskName' created successfully!" -ForegroundColor Green
Write-Host "  Schedule: Daily at 2:00 AM"
Write-Host "  Script:   $ScriptPath"
Write-Host "  Log:      D:\backups\retirement-db\backup.log"
Write-Host ""
Write-Host "To test now:  schtasks /Run /TN '$TaskName'"
Write-Host "To view:      schtasks /Query /TN '$TaskName' /V"
Write-Host "To remove:    schtasks /Delete /TN '$TaskName' /F"
