# PowerShell script to print raw bytes to thermal printer

param(
    [string]$PrinterName = "POS-58",
    [string]$FilePath
)

Write-Host "=== Raw Printer Script ===" -ForegroundColor Cyan
Write-Host "Printer: $PrinterName"
Write-Host "File: $FilePath"

# Add the raw printer type
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFOW
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinterW(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int StartDocPrinterW(IntPtr hPrinter, int Level, ref DOCINFOW pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string printerName, byte[] bytes)
    {
        IntPtr hPrinter;
        if (!OpenPrinterW(printerName, out hPrinter, IntPtr.Zero))
        {
            Console.WriteLine("Failed to open printer");
            return false;
        }

        DOCINFOW di = new DOCINFOW();
        di.pDocName = "Receipt";
        di.pDataType = "RAW";

        if (StartDocPrinterW(hPrinter, 1, ref di) == 0)
        {
            Console.WriteLine("Failed to start document");
            ClosePrinter(hPrinter);
            return false;
        }

        if (!StartPagePrinter(hPrinter))
        {
            Console.WriteLine("Failed to start page");
            EndDocPrinter(hPrinter);
            ClosePrinter(hPrinter);
            return false;
        }

        int written;
        bool success = WritePrinter(hPrinter, bytes, bytes.Length, out written);

        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);

        Console.WriteLine("Bytes written: " + written + " / " + bytes.Length);
        return success && written == bytes.Length;
    }
}
"@

# Read the file
if (Test-Path $FilePath) {
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    Write-Host "Read $($bytes.Length) bytes from file"
    
    $result = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes)
    
    if ($result) {
        Write-Host "SUCCESS: Print job sent!" -ForegroundColor Green
    } else {
        Write-Host "FAILED: Could not send print job" -ForegroundColor Red
        Write-Host "Last Error: $([System.Runtime.InteropServices.Marshal]::GetLastWin32Error())"
    }
} else {
    Write-Host "File not found: $FilePath" -ForegroundColor Red
}
