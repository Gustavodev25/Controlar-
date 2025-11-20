@echo off
echo ========================================
echo  TESTE DE CREDENCIAIS PLUGGY
echo ========================================
echo.
echo Testando autenticacao com Pluggy API...
echo.

curl -X POST https://api.pluggy.ai/auth ^
  -H "Content-Type: application/json" ^
  -H "Accept: application/json" ^
  -d "{\"clientId\": \"d93b0176-0cd8-4563-b9c1-bcb9c6e510bd\", \"clientSecret\": \"2b45852a-9638-4677-8232-6b2da7c54967\"}"

echo.
echo.
echo ========================================
echo  RESULTADO DO TESTE
echo ========================================
echo.
echo Se voce viu um "apiKey" acima:
echo   ✅ SUCESSO! As credenciais estao corretas.
echo   O problema pode ser com domínios permitidos.
echo.
echo Se voce viu um erro 401/403:
echo   ❌ ERRO! As credenciais estao incorretas.
echo   Verifique no dashboard do Pluggy.
echo.
echo Se voce viu "curl: command not found":
echo   ⚠️  curl nao esta instalado.
echo   Use o teste manual no navegador.
echo.
echo ========================================
pause
