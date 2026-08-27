# Consulta o status "real" das impressoras instaladas no Windows.
#
# O status padrão do spooler (dwStatus / Win32_Printer.PrinterStatus) NAO eh
# confiavel para detectar impressora termica desconectada fisicamente,
# especialmente quando ela esta instalada como "Generica / Somente Texto"
# numa porta COM (USB-Serial) - caso comum de ELGIN/BEMATECH/DARUMA no Brasil.
# O Windows so percebe que algo esta errado quando um trabalho de impressao
# de fato falha; ate la o status fica "Pronta" mesmo com o cabo desconectado.
#
# Por isso, alem do status do spooler, aqui verificamos se a PORTA atribuida
# a impressora ainda existe de verdade no sistema:
#   - Porta COMx  -> confere contra [System.IO.Ports.SerialPort]::GetPortNames()
#   - Porta USBxxx (USB Printing Support / classe nativa) -> confere contra
#     Win32_Printer.WorkOffline, que o Windows atualiza via eventos de
#     Plug & Play para impressoras USB nativas (nao seriais)
#
# Saida: JSON (array), um objeto por impressora:
#   { "Name": "...", "PortName": "...", "WorkOffline": bool, "PortaAtiva": bool }

$ErrorActionPreference = 'SilentlyContinue'

$portasSerial = @([System.IO.Ports.SerialPort]::GetPortNames())

$impressoras = Get-CimInstance -ClassName Win32_Printer

$resultado = @()
foreach ($imp in $impressoras) {
    $portName = [string]$imp.PortName
    $portaAtiva = $true

    if ($portName -match '^COM\d+$') {
        # Porta serial (USB-Serial): só está ativa se o Windows a enxerga
        # como porta disponível agora.
        $portaAtiva = $portasSerial -contains $portName
    }

    $resultado += [PSCustomObject]@{
        Name        = $imp.Name
        PortName    = $portName
        WorkOffline = [bool]$imp.WorkOffline
        PortaAtiva  = $portaAtiva
    }
}

# -InputObject explícito (em vez de pipe) evita o comportamento clássico do
# PowerShell de "achatar" um array de 1 elemento em objeto solto ao passar
# pelo pipeline — com só 1 impressora instalada (comum em comércio pequeno),
# `$resultado | ConvertTo-Json` geraria `{...}` em vez de `[{...}]`, quebrando
# o JSON.parse do lado do Node. $resultado já é um array real (@() + +=),
# então isso funciona corretamente também com 0 ou 1 elemento.
ConvertTo-Json -Compress -InputObject $resultado
