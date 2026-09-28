[CmdletBinding()]
param()

$ruleName = 'BolivasEletroinfo-Dev-API-Inbound'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdministrator) {
    throw 'Execute este script em um PowerShell aberto como Administrador.'
}

$existingRule = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
if (-not $existingRule) {
    Write-Host 'A regra da API de desenvolvimento não está instalada.'
    return
}

$existingRule | Remove-NetFirewallRule
Write-Host 'Regra da API de desenvolvimento removida.'
