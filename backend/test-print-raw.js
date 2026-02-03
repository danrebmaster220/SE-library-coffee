/**
 * Windows RAW Print Test
 * Uses PowerShell to send raw data to the thermal printer
 */

const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '@';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const DOUBLE_SIZE = GS + '!' + '\x11';
const NORMAL_SIZE = GS + '!' + '\x00';
const CUT = GS + 'V' + '\x00';
const FEED = ESC + 'd' + '\x03';

// Build test receipt
function buildTestReceipt() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH');
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    
    let receipt = '';
    
    // Initialize printer
    receipt += INIT;
    
    // Header
    receipt += ALIGN_CENTER;
    receipt += DOUBLE_SIZE;
    receipt += BOLD_ON;
    receipt += 'THE LIBRARY\n';
    receipt += NORMAL_SIZE;
    receipt += BOLD_OFF;
    receipt += 'Coffee + Study Hub\n';
    receipt += '================================\n';
    
    // Date/Time
    receipt += ALIGN_LEFT;
    receipt += `Date: ${dateStr}  Time: ${timeStr}\n`;
    receipt += '================================\n';
    
    // Test items
    receipt += BOLD_ON;
    receipt += 'TEST PRINT - SUCCESS!\n';
    receipt += BOLD_OFF;
    receipt += '1x Caffe Latte           P120.00\n';
    receipt += '1x Croissant              P85.00\n';
    receipt += '--------------------------------\n';
    receipt += BOLD_ON;
    receipt += 'TOTAL                    P205.00\n';
    receipt += BOLD_OFF;
    
    receipt += '================================\n';
    receipt += ALIGN_CENTER;
    receipt += 'Thank you for visiting!\n';
    receipt += 'See you again!\n';
    receipt += '\n\n\n';
    
    // Cut paper
    receipt += FEED;
    receipt += CUT;
    
    return receipt;
}

// Method: Use Out-Printer PowerShell cmdlet
async function printWithPowerShell(printerName = 'POS-58') {
    console.log(`\n=== Printing to: ${printerName} ===\n`);
    
    const receipt = buildTestReceipt();
    const tempFile = path.join(__dirname, 'temp_receipt.prn');
    
    // Write binary data to temp file
    fs.writeFileSync(tempFile, receipt, 'binary');
    console.log('Receipt data created');
    
    // PowerShell command to send raw data to printer
    const psCommand = `
        $bytes = [System.IO.File]::ReadAllBytes('${tempFile.replace(/\\/g, '\\\\')}')
        $printerPath = (Get-Printer -Name '${printerName}').PortName
        Write-Host "Printer port: $printerPath"
        
        # Try direct file write to port
        try {
            $port = [System.IO.Ports.SerialPort]::new($printerPath)
            $port.Open()
            $port.Write($bytes, 0, $bytes.Length)
            $port.Close()
            Write-Host "Printed via SerialPort"
        } catch {
            Write-Host "SerialPort method failed: $_"
            
            # Try using raw printer API
            try {
                Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.IO;

public class RawPrinter {
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFO pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string printerName, byte[] bytes) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
        
        DOCINFO di = new DOCINFO();
        di.pDocName = "Receipt";
        di.pDataType = "RAW";
        
        if (StartDocPrinter(hPrinter, 1, ref di) == 0) { ClosePrinter(hPrinter); return false; }
        if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }
        
        int written;
        bool success = WritePrinter(hPrinter, bytes, bytes.Length, out written);
        
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        
        return success && written == bytes.Length;
    }
}
"@
                
                if ([RawPrinter]::SendBytesToPrinter('${printerName}', $bytes)) {
                    Write-Host "SUCCESS: Printed via Windows Raw API!"
                } else {
                    Write-Host "Failed to print via Raw API"
                }
            } catch {
                Write-Host "Raw API error: $_"
            }
        }
    `;
    
    console.log('Sending to printer...');
    
    exec(`powershell -Command "${psCommand.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, 
        { maxBuffer: 1024 * 1024 }, 
        (error, stdout, stderr) => {
            console.log('Output:', stdout);
            if (stderr) console.log('Errors:', stderr);
            if (error) console.log('Exec error:', error.message);
            
            // Cleanup
            setTimeout(() => {
                try { fs.unlinkSync(tempFile); } catch(e) {}
            }, 2000);
        }
    );
}

// Alternative simple method
function printSimple(printerName = 'POS-58') {
    console.log('\n=== Trying Simple Print Method ===\n');
    
    const receipt = buildTestReceipt();
    const tempFile = path.join(__dirname, 'temp_receipt.prn');
    fs.writeFileSync(tempFile, receipt, 'binary');
    
    // Simple PowerShell print command
    const cmd = `powershell -Command "Get-Content -Path '${tempFile}' -Raw -Encoding Byte | Out-Printer -Name '${printerName}'"`;
    
    console.log('Executing print command...');
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.log('Simple method error:', error.message);
        } else {
            console.log('Print command completed!');
        }
        if (stdout) console.log(stdout);
        if (stderr) console.log('stderr:', stderr);
        
        // Cleanup
        setTimeout(() => {
            try { fs.unlinkSync(tempFile); } catch(e) {}
        }, 2000);
    });
}

// Run tests
console.log('=== Windows RAW Print Test ===');
console.log('Printer: POS-58\n');

// Check if printer exists
try {
    const check = execSync('powershell -Command "Get-Printer -Name \'POS-58\'"', { encoding: 'utf8' });
    console.log('Printer found:', check.includes('POS-58'));
} catch (e) {
    console.log('Printer not found! Please install the printer first.');
    process.exit(1);
}

// Try simple method first
printSimple('POS-58');

// Then try with raw API after a delay
setTimeout(() => {
    printWithPowerShell('POS-58');
}, 3000);
