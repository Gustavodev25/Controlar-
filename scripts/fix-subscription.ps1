# Script para corrigir assinaturas com status manual_recheck_needed
# Uso: .\fix-subscription.ps1 -UserId "ID_DO_USUARIO"
# Ou com valor customizado: .\fix-subscription.ps1 -UserId "ID_DO_USUARIO" -Value 35.90

param(
    [Parameter(Mandatory=$true)]
    [string]$UserId,
    
    [Parameter(Mandatory=$false)]
    [double]$Value = 35.90
)

$baseUrl = "http://localhost:3001/api/admin/fix-subscription"

$body = @{
    userId = $UserId
    value = $Value
} | ConvertTo-Json

Write-Host "`n🔧 Corrigindo assinatura para usuário: $UserId" -ForegroundColor Cyan
Write-Host "💰 Valor: R$ $Value" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $baseUrl -Method POST -ContentType "application/json" -Body $body
    
    Write-Host "`n✅ SUCESSO!" -ForegroundColor Green
    Write-Host "📋 ID da Assinatura: $($response.subscription.id)" -ForegroundColor White
    Write-Host "📅 Próxima Cobrança: $($response.subscription.nextDueDate)" -ForegroundColor White
    Write-Host "🔄 Status: $($response.subscription.status)" -ForegroundColor White
    Write-Host "📧 Email: $($response.user.email)" -ForegroundColor White
    
    return $response
} catch {
    $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "`n❌ ERRO!" -ForegroundColor Red
    Write-Host "Detalhes: $($errorDetails.error)" -ForegroundColor Red
    if ($errorDetails.details) {
        Write-Host "API: $($errorDetails.details)" -ForegroundColor Red
    }
}
