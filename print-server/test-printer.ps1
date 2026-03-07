Add-Type -AssemblyName System.Drawing

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = 'POS-58'

Write-Host "Printer Valid: $($doc.PrinterSettings.IsValid)"
Write-Host "Default Paper: $($doc.DefaultPageSettings.PaperSize)"

# Try printing a simple text page
$lineNum = 0
$lines = @(
    "",
    "    THE LIBRARY",
    "    Coffee + Study",
    "    Pavilion, Nunez St.",
    "    Zamboanga City",
    "--------------------------------",
    "    *** PRINTER TEST ***",
    "--------------------------------",
    "Date: $(Get-Date -Format 'MM/dd/yyyy hh:mm tt')",
    "Printer is working!",
    "--------------------------------",
    "",
    "",
    ""
)

$doc.add_PrintPage({
    param($sender, $e)
    $font = New-Object System.Drawing.Font("Courier New", 8)
    $brush = [System.Drawing.Brushes]::Black
    $y = 0
    foreach ($line in $lines) {
        $e.Graphics.DrawString($line, $font, $brush, 0, $y)
        $y += 12
    }
})

Write-Host "Sending print job..."
$doc.Print()
Write-Host "Print job sent!"
