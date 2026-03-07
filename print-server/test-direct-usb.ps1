# Method: Write directly to USB device using CreateFile on the USBPRINT device path
# This completely bypasses the Windows print spooler

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public class DirectUSB {
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern SafeFileHandle CreateFile(
        string lpFileName, uint dwDesiredAccess, uint dwShareMode,
        IntPtr lpSecurityAttributes, uint dwCreationDisposition,
        uint dwFlagsAndAttributes, IntPtr hTemplateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool WriteFile(
        SafeFileHandle hFile, byte[] lpBuffer, uint nNumberOfBytesToWrite,
        out uint lpNumberOfBytesWritten, IntPtr lpOverlapped);

    public const uint GENERIC_WRITE = 0x40000000;
    public const uint FILE_SHARE_READ = 0x00000001;
    public const uint OPEN_EXISTING = 3;

    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr SetupDiGetClassDevs(
        ref Guid ClassGuid, IntPtr Enumerator, IntPtr hwndParent, uint Flags);

    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool SetupDiEnumDeviceInterfaces(
        IntPtr DeviceInfoSet, IntPtr DeviceInfoData,
        ref Guid InterfaceClassGuid, uint MemberIndex,
        ref SP_DEVICE_INTERFACE_DATA DeviceInterfaceData);

    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool SetupDiGetDeviceInterfaceDetail(
        IntPtr DeviceInfoSet,
        ref SP_DEVICE_INTERFACE_DATA DeviceInterfaceData,
        IntPtr DeviceInterfaceDetailData, uint DeviceInterfaceDetailDataSize,
        out uint RequiredSize, IntPtr DeviceInfoData);

    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool SetupDiGetDeviceInterfaceDetail(
        IntPtr DeviceInfoSet,
        ref SP_DEVICE_INTERFACE_DATA DeviceInterfaceData,
        ref SP_DEVICE_INTERFACE_DETAIL_DATA DeviceInterfaceDetailData,
        uint DeviceInterfaceDetailDataSize,
        out uint RequiredSize, IntPtr DeviceInfoData);

    [DllImport("setupapi.dll", SetLastError = true)]
    public static extern bool SetupDiDestroyDeviceInfoList(IntPtr DeviceInfoSet);

    [StructLayout(LayoutKind.Sequential)]
    public struct SP_DEVICE_INTERFACE_DATA {
        public int cbSize;
        public Guid InterfaceClassGuid;
        public int Flags;
        public IntPtr Reserved;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct SP_DEVICE_INTERFACE_DETAIL_DATA {
        public int cbSize;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string DevicePath;
    }

    public static string[] GetUSBPrinterPaths() {
        // GUID_DEVINTERFACE_USBPRINT
        Guid usbPrintGuid = new Guid("28d78fad-5a12-11d1-ae5b-0000f803a8c2");
        uint DIGCF_PRESENT = 0x02;
        uint DIGCF_DEVICEINTERFACE = 0x10;

        IntPtr devInfoSet = SetupDiGetClassDevs(ref usbPrintGuid, IntPtr.Zero, IntPtr.Zero, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
        
        var paths = new System.Collections.Generic.List<string>();
        uint index = 0;

        while (true) {
            SP_DEVICE_INTERFACE_DATA did = new SP_DEVICE_INTERFACE_DATA();
            did.cbSize = Marshal.SizeOf(typeof(SP_DEVICE_INTERFACE_DATA));

            if (!SetupDiEnumDeviceInterfaces(devInfoSet, IntPtr.Zero, ref usbPrintGuid, index, ref did))
                break;

            uint requiredSize = 0;
            SetupDiGetDeviceInterfaceDetail(devInfoSet, ref did, IntPtr.Zero, 0, out requiredSize, IntPtr.Zero);

            SP_DEVICE_INTERFACE_DETAIL_DATA detail = new SP_DEVICE_INTERFACE_DETAIL_DATA();
            detail.cbSize = IntPtr.Size == 8 ? 8 : 6;

            if (SetupDiGetDeviceInterfaceDetail(devInfoSet, ref did, ref detail, requiredSize, out requiredSize, IntPtr.Zero)) {
                paths.Add(detail.DevicePath);
            }
            index++;
        }

        SetupDiDestroyDeviceInfoList(devInfoSet);
        return paths.ToArray();
    }
}
"@

Write-Host "=== Finding USB Printer device paths ===" -ForegroundColor Cyan
$paths = [DirectUSB]::GetUSBPrinterPaths()

if ($paths.Count -eq 0) {
    Write-Host "No USB printer interfaces found!" -ForegroundColor Red
    exit 1
}

foreach ($p in $paths) {
    Write-Host "  Found: $p" -ForegroundColor Green
}

# Try writing to each one
$ESC = [byte]0x1B
$GS  = [byte]0x1D
$bytes = New-Object System.Collections.Generic.List[byte]

# INIT
$bytes.Add($ESC); $bytes.Add([byte][char]'@')
# Center
$bytes.Add($ESC); $bytes.Add([byte][char]'a'); $bytes.Add([byte]1)
# Text
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("DIRECT USB TEST`n"))
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("================`n"))
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("If you see this,`n"))
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("USB works!`n"))
# Feed
$bytes.Add($ESC); $bytes.Add([byte][char]'d'); $bytes.Add([byte]5)
# Cut
$bytes.Add($GS); $bytes.Add([byte][char]'V'); $bytes.Add([byte]1)

$data = $bytes.ToArray()

foreach ($devicePath in $paths) {
    Write-Host ""
    Write-Host "Trying: $devicePath" -ForegroundColor Yellow
    
    $handle = [DirectUSB]::CreateFile($devicePath, [DirectUSB]::GENERIC_WRITE, [DirectUSB]::FILE_SHARE_READ, [IntPtr]::Zero, [DirectUSB]::OPEN_EXISTING, 0, [IntPtr]::Zero)
    
    if ($handle.IsInvalid) {
        $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Write-Host "  CreateFile FAILED (error: $err)" -ForegroundColor Red
        continue
    }
    
    Write-Host "  Handle opened!" -ForegroundColor Green
    
    $written = [uint32]0
    $ok = [DirectUSB]::WriteFile($handle, $data, [uint32]$data.Length, [ref]$written, [IntPtr]::Zero)
    
    if ($ok) {
        Write-Host "  WriteFile OK! Bytes written: $written" -ForegroundColor Green
    } else {
        $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Write-Host "  WriteFile FAILED (error: $err)" -ForegroundColor Red
    }
    
    $handle.Close()
}

Write-Host ""
Write-Host "CHECK PRINTER NOW!" -ForegroundColor Green
