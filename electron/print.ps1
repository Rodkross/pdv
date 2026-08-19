param(
    [string]$filePath,
    [string]$printerName
)

if (-not (Test-Path $filePath)) {
    Write-Error "Arquivo não encontrado: $filePath"
    exit 1
}

# Se não foi informado o nome da impressora, tenta obter a impressora térmica ou padrão do Windows
if (-not $printerName -or $printerName.Trim() -eq "") {
    try {
        if (Get-Command Get-Printer -ErrorAction SilentlyContinue) {
            $thermal = Get-Printer | Where-Object { $_.Name -match "ELGIN|POS|BEMATECH|DARUMA|EPSON|CUPOM|TERMICA|80mm|58mm" } | Select-Object -First 1
            if ($thermal) { $printerName = $thermal.Name }
            else {
                $defaultPrinterObj = Get-Printer | Where-Object { $_.IsDefault } | Select-Object -First 1
                if ($defaultPrinterObj) { $printerName = $defaultPrinterObj.Name }
            }
        }
    } catch {}
}

if (-not $printerName -or $printerName.Trim() -eq "") {
    $printerName = "ELGIN i8"
}

$printerName = $printerName.Trim()

# Se for porta LPT/COM ou compartilhamento de rede (\\)
if ($printerName -like "\\*" -or $printerName -like "LPT*" -or $printerName -like "COM*") {
    cmd.exe /c "copy /b `"$filePath`" `"$printerName`""
    exit $LASTEXITCODE
}

# Método 1: Impressão NATIVA via .NET System.Drawing.Printing.PrintDocument (GDI Windows - Ultra Estável)
try {
    Add-Type -Assembly System.Drawing -ErrorAction SilentlyContinue
    $texto = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::GetEncoding("iso-8859-1"))
    
    $pd = New-Object System.Drawing.Printing.PrintDocument
    $pd.PrinterSettings.PrinterName = $printerName
    $pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController
    
    # Zerar margens para evitar deslocamento à direita ou corte inferior
    $pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
    $pd.OriginAtMargins = $false

    # Ajusta altura do papel dinamicamente conforme a quantidade de linhas do cupom
    $linhasCount = ($texto -split "`r`n|`n").Count
    $alturaEstimada = [Math]::Max(1200, ($linhasCount * 22) + 150)
    
    # 80mm ~ 315 milésimos de polegada (3.15 pol)
    $pd.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize("Bobina80mm", 315, $alturaEstimada)

    # Fonte monoespaçada de tamanho ajustado (8.5pt Bold)
    $font = New-Object System.Drawing.Font("Courier New", 8.5, [System.Drawing.FontStyle]::Bold)
    
    $pd.add_PrintPage({
        param($sender, $ev)
        $ev.Graphics.DrawString($texto, $font, [System.Drawing.Brushes]::Black, 0, 0)
        $ev.HasMorePages = $false
    })
    
    $pd.Print()
    Write-Host "Impresso via .NET PrintDocument com sucesso para $printerName"
    exit 0
} catch {
    # Se falhar via GDI, tenta fallbacks
}


# Método 2: Out-Printer (Cmdlet nativo PowerShell)
try {
    Get-Content -Path $filePath -Raw | Out-Printer -Name $printerName
    Write-Host "Impresso via Out-Printer com sucesso para $printerName"
    exit 0
} catch {}

# Método 3: copy /b
try {
    cmd.exe /c "copy /b `"$filePath`" `"$printerName`""
    exit 0
} catch {
    Write-Error "Falha ao imprimir na impressora $printerName"
    exit 1
}



