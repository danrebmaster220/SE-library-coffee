# Test raw printing to POS-58 via the Windows spooler RAW datatype
# This bypasses GDI and sends text directly — works with "Generic / Text Only" driver

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendToPrinter(string printerName, byte[] data) {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Receipt";
        di.pDataType = "RAW";

        if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero)) {
            Console.WriteLine("OpenPrinter failed. Error: " + Marshal.GetLastWin32Error());
            return false;
        }

        if (!StartDocPrinter(hPrinter, 1, di)) {
            Console.WriteLine("StartDocPrinter failed. Error: " + Marshal.GetLastWin32Error());
            ClosePrinter(hPrinter);
            return false;
        }

        if (!StartPagePrinter(hPrinter)) {
            Console.WriteLine("StartPagePrinter failed. Error: " + Marshal.GetLastWin32Error());
            EndDocPrinter(hPrinter);
            ClosePrinter(hPrinter);
            return false;
        }

        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(data.Length);
        Marshal.Copy(data, 0, pUnmanagedBytes, data.Length);

        int written;
        bool ok = WritePrinter(hPrinter, pUnmanagedBytes, data.Length, out written);
        Console.WriteLine("WritePrinter: " + ok + ", bytes written: " + written);

        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        return ok;
    }
}
"@

# ESC/POS commands
$ESC = [char]0x1B
$GS  = [char]0x1D

$receipt = ""
$receipt += "${ESC}@"                          # Initialize
$receipt += "${ESC}a$([char]1)"                # Center align
$receipt += "${ESC}E$([char]1)"                # Bold on
$receipt += "${GS}!$([char]0x11)"              # Double height+width
$receipt += "THE LIBRARY`n"
$receipt += "${GS}!$([char]0)"                 # Normal size
$receipt += "Coffee + Study`n"
$receipt += "${ESC}E$([char]0)"                # Bold off
$receipt += "Pavilion, Nunez St.`n"
$receipt += "Zamboanga City`n"
$receipt += "${ESC}a$([char]0)"                # Left align
$receipt += "--------------------------------`n"
$receipt += "${ESC}a$([char]1)"                # Center
$receipt += "${ESC}E$([char]1)"                # Bold
$receipt += "*** PRINTER TEST ***`n"
$receipt += "${ESC}E$([char]0)"                # Bold off
$receipt += "${ESC}a$([char]0)"                # Left
$receipt += "--------------------------------`n"
$receipt += "Date: $(Get-Date -Format 'MM/dd/yyyy hh:mm tt')`n"
$receipt += "Printer is working!`n"
$receipt += "RAW ESC/POS Mode`n"
$receipt += "--------------------------------`n"
$receipt += "`n`n`n`n"
$receipt += "${GS}V$([char]1)"                 # Partial cut

$bytes = [System.Text.Encoding]::ASCII.GetBytes($receipt)
Write-Host "Sending $($bytes.Length) bytes to POS-58..."
$result = [RawPrinter]::SendToPrinter("POS-58", $bytes)
Write-Host "Result: $result"
