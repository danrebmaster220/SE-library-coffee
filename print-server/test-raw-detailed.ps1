# Direct test: Send raw bytes through .NET to the printer
# This bypasses all high-level print APIs

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrint {
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDatatype;
    }

    [DllImport("winspool.drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOA di);

    [DllImport("winspool.drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    public static bool SendRawData(string printerName, byte[] data) {
        IntPtr hPrinter = IntPtr.Zero;
        
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            Console.WriteLine("ERROR: OpenPrinter failed. Error: " + Marshal.GetLastWin32Error());
            return false;
        }
        Console.WriteLine("OpenPrinter OK. Handle: " + hPrinter);

        DOCINFOA di = new DOCINFOA();
        di.pDocName = "RAW Receipt";
        di.pDatatype = "RAW";

        int docId = StartDocPrinter(hPrinter, 1, ref di);
        Console.WriteLine("StartDocPrinter returned: " + docId);
        if (docId == 0) {
            Console.WriteLine("ERROR: StartDocPrinter failed. Error: " + Marshal.GetLastWin32Error());
            ClosePrinter(hPrinter);
            return false;
        }

        bool spOk = StartPagePrinter(hPrinter);
        Console.WriteLine("StartPagePrinter: " + spOk);

        int written = 0;
        bool wpOk = WritePrinter(hPrinter, data, data.Length, out written);
        Console.WriteLine("WritePrinter: " + wpOk + ", bytes written: " + written + " of " + data.Length);
        
        if (!wpOk) {
            Console.WriteLine("ERROR: WritePrinter failed. Error: " + Marshal.GetLastWin32Error());
        }

        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        
        Console.WriteLine("Print job completed. Check printer.");
        return wpOk;
    }
}
"@

# ESC/POS commands
$ESC = [byte]0x1B
$GS  = [byte]0x1D

# Build receipt as raw bytes
$bytes = New-Object System.Collections.Generic.List[byte]

# INIT printer
$bytes.Add($ESC); $bytes.Add([byte][char]'@')

# CENTER align
$bytes.Add($ESC); $bytes.Add([byte][char]'a'); $bytes.Add([byte]1)

# BOLD ON
$bytes.Add($ESC); $bytes.Add([byte][char]'E'); $bytes.Add([byte]1)

# Double height+width
$bytes.Add($GS); $bytes.Add([byte][char]'!'); $bytes.Add([byte]0x30)

# "THE LIBRARY" text
$text1 = [System.Text.Encoding]::ASCII.GetBytes("THE LIBRARY`n")
$bytes.AddRange($text1)

# Normal size
$bytes.Add($GS); $bytes.Add([byte][char]'!'); $bytes.Add([byte]0)

# "Coffee + Study" 
$text2 = [System.Text.Encoding]::ASCII.GetBytes("Coffee + Study`n")
$bytes.AddRange($text2)

# BOLD OFF
$bytes.Add($ESC); $bytes.Add([byte][char]'E'); $bytes.Add([byte]0)

# Separator
$sep = [System.Text.Encoding]::ASCII.GetBytes("--------------------------------`n")
$bytes.AddRange($sep)

# LEFT align
$bytes.Add($ESC); $bytes.Add([byte][char]'a'); $bytes.Add([byte]0)

# Test info
$info = [System.Text.Encoding]::ASCII.GetBytes("PRINTER TEST`nDate: $(Get-Date -Format 'MM/dd/yyyy hh:mm tt')`nThis is a test receipt.`n")
$bytes.AddRange($info)

# Separator
$bytes.AddRange($sep)

# CENTER
$bytes.Add($ESC); $bytes.Add([byte][char]'a'); $bytes.Add([byte]1)

$footer = [System.Text.Encoding]::ASCII.GetBytes("Thank you!`n")
$bytes.AddRange($footer)

# Feed paper
$bytes.Add($ESC); $bytes.Add([byte][char]'d'); $bytes.Add([byte]4)

# Cut paper
$bytes.Add($GS); $bytes.Add([byte][char]'V'); $bytes.Add([byte]1)

$rawData = $bytes.ToArray()
Write-Host "Total bytes: $($rawData.Length)"
Write-Host "First 20 bytes: $($rawData[0..19] -join ', ')"
Write-Host ""
Write-Host "Sending to POS-58..."
Write-Host ""

[RawPrint]::SendRawData("POS-58", $rawData)
