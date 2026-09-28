[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 3000 })
)

$ruleName = 'BolivasEletroinfo-Dev-API-Inbound'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdministrator) {
    throw 'Execute este script em um PowerShell aberto como Administrador.'
}

$existingRule = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Set-NetFirewallRule -Name $ruleName -Enabled True -Direction Inbound -Action Allow -Profile Private, Public, Domain
    $existingRule | Get-NetFirewallPortFilter | Set-NetFirewallPortFilter -Protocol TCP -LocalPort $Port
    Write-Host "Regra existente atualizada para TCP/$Port nos perfis Private, Public e Domain."
    return
}

New-NetFirewallRule `
    -Name $ruleName `
    -DisplayName 'Bolivas Eletroinfo - API de desenvolvimento' `
    -Description 'Permite acesso local à API de desenvolvimento do Bolivas Eletroinfo.' `
    -Enabled True `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $Port `
    -Profile Private, Public, Domain | Out-Null

Write-Host "Regra criada para TCP/$Port nos perfis Private, Public e Domain."
