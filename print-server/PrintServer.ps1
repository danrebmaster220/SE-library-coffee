# POS-58 Direct USB Print Server
# Runs on localhost:9100, writes ESC/POS receipts directly to USB printer
# Works on ANY Windows laptop - just plug in POS-58 and run this script
#
# Usage: powershell -ExecutionPolicy Bypass -File PrintServer.ps1
# Or double-click START_PRINT_SERVER.bat

# ============================================
# Direct USB Printer Access (bypasses Windows spooler)
# ============================================
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public class USBPrinter {
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

    public static string FindPrinter() {
        Guid usbPrintGuid = new Guid("28d78fad-5a12-11d1-ae5b-0000f803a8c2");
        uint DIGCF_PRESENT = 0x02;
        uint DIGCF_DEVICEINTERFACE = 0x10;
        IntPtr devInfoSet = SetupDiGetClassDevs(ref usbPrintGuid, IntPtr.Zero, IntPtr.Zero, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);

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
                SetupDiDestroyDeviceInfoList(devInfoSet);
                return detail.DevicePath;
            }
            index++;
        }
        SetupDiDestroyDeviceInfoList(devInfoSet);
        return null;
    }

    public static int SendData(string devicePath, byte[] data) {
        SafeFileHandle handle = CreateFile(devicePath, GENERIC_WRITE, FILE_SHARE_READ, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
        if (handle.IsInvalid) return -1;
        uint written = 0;
        bool ok = WriteFile(handle, data, (uint)data.Length, out written, IntPtr.Zero);
        handle.Close();
        return ok ? (int)written : -1;
    }
}
"@

# ============================================
# ESC/POS Helpers
# ============================================
$script:ESC = [byte]0x1B
$script:GS  = [byte]0x1D
$script:WIDTH = 32

function Add-Bytes([System.Collections.Generic.List[byte]]$buf, [byte[]]$bytes) {
    $buf.AddRange($bytes)
}
function Add-Str([System.Collections.Generic.List[byte]]$buf, [string]$text) {
    $buf.AddRange([System.Text.Encoding]::ASCII.GetBytes($text))
}
function Str-Center([string]$t) {
    $p = [Math]::Max(0, [Math]::Floor(($script:WIDTH - $t.Length) / 2))
    return (' ' * $p) + $t
}
function Str-LR([string]$l, [string]$r) {
    $s = [Math]::Max(1, $script:WIDTH - $l.Length - $r.Length)
    return $l + (' ' * $s) + $r
}
function Fmt-Money([double]$a) { return 'P' + $a.ToString('F2') }

# ============================================
# Receipt Builders
# ============================================
function Build-Receipt($data) {
    $b = New-Object System.Collections.Generic.List[byte]
    $SEP = '-' * $script:WIDTH

    # INIT
    Add-Bytes $b @($script:ESC, [byte][char]'@')

    # HEADER — double-height only (0x10) so "THE LIBRARY" fits on 58mm paper
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0x10)
    Add-Str $b "THE LIBRARY`n"
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0)
    Add-Str $b "Coffee + Study`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Str $b "Pavilion, Nunez St.`n"
    Add-Str $b "Zamboanga City`n"

    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]0)
    Add-Str $b "$SEP`n"

    # Transaction info
    $txnId = 'ORD-' + ([string]($data.transaction_id)).PadLeft(6, [char]'0')
    $dateStr = try { ([DateTime]$data.created_at).ToString('MM/dd/yyyy hh:mm tt') } catch { (Get-Date).ToString('MM/dd/yyyy hh:mm tt') }

    Add-Str $b "$(Str-LR 'Date:' $dateStr)`n"
    Add-Str $b "$(Str-LR 'Txn #:' $txnId)`n"
    if ($data.beeper_number) { Add-Str $b "$(Str-LR 'Order #:' ([string]$data.beeper_number))`n" }
    # cashier_name: same display as app (first/middle/last from API JSON; not layout-specific)
    if ($data.cashier_name)  { Add-Str $b "$(Str-LR 'Cashier:' $data.cashier_name)`n" }
    Add-Str $b "$SEP`n"

    # ITEMS
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Str $b "ITEMS:`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)

    if ($data.items) {
        foreach ($item in $data.items) {
            $name = if ($item.name) { $item.name } elseif ($item.item_name) { $item.item_name } else { 'Item' }
            $qty = if ($item.quantity) { [int]$item.quantity } else { 1 }
            $price = if ($item.unit_price) { [double]$item.unit_price } else { 0 }
            $total = $price * $qty

            Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
            Add-Str $b "${qty}x ${name}`n"
            Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)

            if ($item.customizations) {
                foreach ($c in $item.customizations) {
                    $cName = if ($c.option_name) { $c.option_name } elseif ($c.name) { $c.name } else { '' }
                    $cPrice = if ($c.total_price) { [double]$c.total_price } elseif ($c.unit_price) { [double]$c.unit_price } else { 0 }
                    if ($cPrice -gt 0) { Add-Str $b "  + $cName (+$(Fmt-Money $cPrice))`n" }
                    elseif ($cName) { Add-Str $b "  [$cName]`n" }
                }
            }
            Add-Str $b "  @ $(Fmt-Money $price) = $(Fmt-Money $total)`n"
        }
    }
    Add-Str $b "$SEP`n"

    # LIBRARY BOOKING
    if ($data.library_booking) {
        $lb = $data.library_booking
        Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
        Add-Str $b "STUDY AREA BOOKING:`n"
        Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
        Add-Str $b "Table $($lb.table_number), Seat $($lb.seat_number)`n"
        $hrs = [Math]::Floor([double]$lb.duration_minutes / 60)
        $mins = [int]$lb.duration_minutes % 60
        $dur = "${hrs}h"; if ($mins -gt 0) { $dur += " ${mins}m" }
        Add-Str $b "Duration: $dur`n"
        Add-Str $b "$(Str-LR 'Study Area:' (Fmt-Money ([double]$lb.amount)))`n"
        Add-Str $b "$SEP`n"
    }

    # TOTALS
    $subtotal = if ($data.subtotal) { [double]$data.subtotal } else { 0 }
    $totalAmt = if ($data.total_amount) { [double]$data.total_amount } else { 0 }
    $discAmt  = if ($data.discount_amount) { [double]$data.discount_amount } else { 0 }

    Add-Str $b "$(Str-LR 'Subtotal:' (Fmt-Money $subtotal))`n"
    if ($discAmt -gt 0) {
        $dl = if ($data.discount_name) { "Disc ($($data.discount_name)):" } else { 'Discount:' }
        Add-Str $b "$(Str-LR $dl ('-' + (Fmt-Money $discAmt)))`n"
    }
    Add-Str $b "$('=' * $script:WIDTH)`n"

    # TOTAL — double-height only (0x10) so it stays within 58mm paper width
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0x10)
    Add-Str $b "$(Str-LR 'TOTAL:' (Fmt-Money $totalAmt))`n"
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)

    if ($data.cash_tendered) {
        Add-Str $b "$(Str-LR 'Cash:' (Fmt-Money ([double]$data.cash_tendered)))`n"
        $ch = if ($data.change_due) { [double]$data.change_due } else { 0 }
        Add-Str $b "$(Str-LR 'Change:' (Fmt-Money $ch))`n"
    }
    Add-Str $b "$SEP`n"

    # FOOTER
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
    Add-Str $b "Thank you for visiting!`n"
    Add-Str $b "Please wait for your order`n"
    Add-Str $b "number to be called.`n"
    Add-Str $b "$SEP`n"
    Add-Str $b "NOT AN OFFICIAL RECEIPT`n"

    Add-Bytes $b @($script:ESC, [byte][char]'d', [byte]4)
    Add-Bytes $b @($script:GS,  [byte][char]'V', [byte]1)

    return ,$b.ToArray()
}

function Build-TestReceipt {
    $b = New-Object System.Collections.Generic.List[byte]
    $SEP = '-' * $script:WIDTH
    Add-Bytes $b @($script:ESC, [byte][char]'@')
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0x10)
    Add-Str $b "THE LIBRARY`n"
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0)
    Add-Str $b "Coffee + Study`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Str $b "$SEP`n"
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]0)
    Add-Str $b "PRINTER TEST`n"
    Add-Str $b "Date: $((Get-Date).ToString('MM/dd/yyyy hh:mm tt'))`n"
    Add-Str $b "Status: Connected`n"
    Add-Str $b "$SEP`n"
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
    Add-Str $b "Printer is working!`n"
    Add-Bytes $b @($script:ESC, [byte][char]'d', [byte]4)
    Add-Bytes $b @($script:GS,  [byte][char]'V', [byte]1)
    return ,$b.ToArray()
}

function Build-BaristaTicket($data) {
    $b = New-Object System.Collections.Generic.List[byte]
    $SEP = '-' * $script:WIDTH

    # Filter barista items (station = 'barista' or no station)
    $baristaItems = @()
    if ($data.items) {
        $baristaItems = @($data.items | Where-Object { $_.station -eq 'barista' -or -not $_.station })
    }
    if ($baristaItems.Count -eq 0) { return $null }

    Add-Bytes $b @($script:ESC, [byte][char]'@')

    # Header
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Str $b "*** BARISTA ***`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Str $b "$SEP`n"

    # Order number — double-height so it stands out
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0x10)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Str $b "ORDER #$($data.beeper_number)`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0)

    $dateStr = try { ([DateTime]$data.created_at).ToString('MM/dd/yyyy hh:mm tt') } catch { (Get-Date).ToString('MM/dd/yyyy hh:mm tt') }
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]0)
    Add-Str $b "$(Str-LR 'Time:' $dateStr)`n"
    if ($data.cashier_name) { Add-Str $b "$(Str-LR 'Cashier:' $data.cashier_name)`n" }
    Add-Str $b "$SEP`n"

    # Barista items
    foreach ($item in $baristaItems) {
        $name = if ($item.name) { $item.name } elseif ($item.item_name) { $item.item_name } else { 'Item' }
        $qty  = if ($item.quantity) { [int]$item.quantity } else { 1 }

        Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
        Add-Str $b "${qty}x ${name}`n"
        Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)

        if ($item.customizations) {
            foreach ($c in $item.customizations) {
                $groupName = if ($c.group_name) { $c.group_name.ToLower() } else { '' }
                $cName = if ($c.option_name) { $c.option_name } elseif ($c.name) { $c.name } else { '' }
                if (-not $cName) { continue }
                if ($groupName -match 'temp') {
                    Add-Str $b "  >> $($cName.ToUpper())`n"
                } else {
                    $cQty = if ($c.quantity -gt 1) { "$($c.quantity)x " } else { '' }
                    Add-Str $b "  + ${cQty}${cName}`n"
                }
            }
        }
        Add-Str $b "`n"
    }

    # Study area notice (if library booking exists)
    if ($data.library_booking) {
        $lb = $data.library_booking
        Add-Str $b "$SEP`n"
        Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
        Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
        Add-Str $b "STUDY AREA: T$($lb.table_number)-S$($lb.seat_number)`n"
        Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
        Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]0)
    }

    Add-Str $b "$SEP`n"
    Add-Bytes $b @($script:ESC, [byte][char]'d', [byte]3)
    Add-Bytes $b @($script:GS,  [byte][char]'V', [byte]1)

    return ,$b.ToArray()
}

function Build-KitchenTicket($data) {
    $b = New-Object System.Collections.Generic.List[byte]
    $SEP = '-' * $script:WIDTH

    # Filter kitchen items only
    $kitchenItems = @()
    if ($data.items) {
        $kitchenItems = @($data.items | Where-Object { $_.station -eq 'kitchen' })
    }
    if ($kitchenItems.Count -eq 0) { return $null }

    Add-Bytes $b @($script:ESC, [byte][char]'@')

    # Header
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Str $b "*** KITCHEN ***`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Str $b "$SEP`n"

    # Order number — double-height so it stands out
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0x10)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Str $b "ORDER #$($data.beeper_number)`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0)

    $dateStr = try { ([DateTime]$data.created_at).ToString('MM/dd/yyyy hh:mm tt') } catch { (Get-Date).ToString('MM/dd/yyyy hh:mm tt') }
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]0)
    Add-Str $b "$(Str-LR 'Time:' $dateStr)`n"
    if ($data.cashier_name) { Add-Str $b "$(Str-LR 'Cashier:' $data.cashier_name)`n" }
    Add-Str $b "$SEP`n"

    # Kitchen items
    foreach ($item in $kitchenItems) {
        $name = if ($item.name) { $item.name } elseif ($item.item_name) { $item.item_name } else { 'Item' }
        $qty  = if ($item.quantity) { [int]$item.quantity } else { 1 }

        Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
        Add-Str $b "${qty}x ${name}`n"
        Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)

        if ($item.customizations) {
            foreach ($c in $item.customizations) {
                $cName = if ($c.option_name) { $c.option_name } elseif ($c.name) { $c.name } else { '' }
                if (-not $cName) { continue }
                $cQty = if ($c.quantity -gt 1) { "$($c.quantity)x " } else { '' }
                Add-Str $b "  + ${cQty}${cName}`n"
            }
        }
        Add-Str $b "`n"
    }

    Add-Str $b "$SEP`n"
    Add-Bytes $b @($script:ESC, [byte][char]'d', [byte]3)
    Add-Bytes $b @($script:GS,  [byte][char]'V', [byte]1)

    return ,$b.ToArray()
}

function Build-LibraryCheckin($session) {
    $b = New-Object System.Collections.Generic.List[byte]
    $SEP = '-' * $script:WIDTH

    Add-Bytes $b @($script:ESC, [byte][char]'@')

    # Header — double-height only
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0x10)
    Add-Str $b "THE LIBRARY`n"
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0)
    Add-Str $b "Study Space Check-in`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Str $b "$SEP`n"

    # Session info
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]0)
    $dateStr = (Get-Date).ToString('MM/dd/yyyy hh:mm tt')
    Add-Str $b "$(Str-LR 'Date:' $dateStr)`n"
    if ($session.session_id) {
        $sessionNum = 'LIB-' + ([string]$session.session_id).PadLeft(6, [char]'0')
        Add-Str $b "$(Str-LR 'Session #:' $sessionNum)`n"
    }
    Add-Str $b "$(Str-LR 'Table:' ([string]$session.table_number))`n"
    Add-Str $b "$(Str-LR 'Seat:' ([string]$session.seat_number))`n"
    Add-Str $b "$SEP`n"

    # Customer
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Str $b "Customer: $($session.customer_name)`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    if ($session.cashier_name) { Add-Str $b "$(Str-LR 'Cashier:' $session.cashier_name)`n" }
    Add-Str $b "$SEP`n"

    # Session details
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Str $b "SESSION DETAILS:`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Str $b "$(Str-LR 'Start Time:' $dateStr)`n"
    $durationMins = if ($session.paid_minutes) { [int]$session.paid_minutes } elseif ($session.duration_minutes) { [int]$session.duration_minutes } else { 120 }
    $hrs  = [Math]::Floor($durationMins / 60)
    $mins = $durationMins % 60
    $dur  = "${hrs} hour$(if ($hrs -ne 1) { 's' })"
    if ($mins -gt 0) { $dur += " ${mins} mins" }
    Add-Str $b "$(Str-LR 'Duration:' $dur)`n"
    Add-Str $b "$SEP`n"

    # Payment — double-height for amount
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0x10)
    $amtPaid = if ($session.amount_paid) { [double]$session.amount_paid } else { 100 }
    Add-Str $b "$(Fmt-Money $amtPaid)`n"
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]0)

    if ($session.cash_tendered) {
        Add-Str $b "$(Str-LR 'Cash:' (Fmt-Money ([double]$session.cash_tendered)))`n"
        $ch = if ($session.change_due) { [double]$session.change_due } else { 0 }
        Add-Str $b "$(Str-LR 'Change:' (Fmt-Money $ch))`n"
    }
    Add-Str $b "$SEP`n"

    # Footer
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
    Add-Str $b "Extension: P50.00 per 30 mins`n"
    Add-Str $b "$SEP`n"
    Add-Str $b "Thank you!`n"
    Add-Str $b "Enjoy your study session.`n"
    Add-Str $b "$SEP`n"
    Add-Str $b "NOT AN OFFICIAL RECEIPT`n"

    Add-Bytes $b @($script:ESC, [byte][char]'d', [byte]4)
    Add-Bytes $b @($script:GS,  [byte][char]'V', [byte]1)

    return ,$b.ToArray()
}

function Build-LibraryExtension($session) {
    $b = New-Object System.Collections.Generic.List[byte]
    $SEP = '-' * $script:WIDTH

    Add-Bytes $b @($script:ESC, [byte][char]'@')

    # Header — double-height only
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0x10)
    Add-Str $b "THE LIBRARY`n"
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0)
    Add-Str $b "Session Extension`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Str $b "$SEP`n"

    # Session info
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]0)
    $dateStr = (Get-Date).ToString('MM/dd/yyyy hh:mm tt')
    Add-Str $b "$(Str-LR 'Date:' $dateStr)`n"
    if ($session.session_id) {
        $sessionNum = 'LIB-' + ([string]$session.session_id).PadLeft(6, [char]'0')
        Add-Str $b "$(Str-LR 'Session #:' $sessionNum)`n"
    }
    Add-Str $b "$(Str-LR 'Table:' ([string]$session.table_number))`n"
    Add-Str $b "$(Str-LR 'Seat:' ([string]$session.seat_number))`n"
    Add-Str $b "$(Str-LR 'Customer:' $session.customer_name)`n"
    if ($session.cashier_name) { Add-Str $b "$(Str-LR 'Cashier:' $session.cashier_name)`n" }
    Add-Str $b "$SEP`n"

    # Extension details
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Str $b "EXTENSION:`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Str $b "$(Str-LR 'Added Time:' "+$($session.added_minutes) minutes")`n"
    $extFee = if ($session.extension_fee) { [double]$session.extension_fee } else { 0 }
    Add-Str $b "$(Str-LR 'Extension Fee:' (Fmt-Money $extFee))`n"
    Add-Str $b "$SEP`n"

    # Updated session
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Str $b "UPDATED SESSION:`n"
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Str $b "$(Str-LR 'Total Time:' "$($session.new_total_minutes) minutes")`n"
    Add-Str $b "$(Str-LR 'Remaining:' "$($session.remaining_minutes) minutes")`n"
    Add-Str $b "$SEP`n"

    # Payment — double-height for amount
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]1)
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0x10)
    Add-Str $b "$(Fmt-Money $extFee)`n"
    Add-Bytes $b @($script:GS,  [byte][char]'!', [byte]0)
    Add-Bytes $b @($script:ESC, [byte][char]'E', [byte]0)
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]0)

    if ($session.cash_tendered) {
        Add-Str $b "$(Str-LR 'Cash:' (Fmt-Money ([double]$session.cash_tendered)))`n"
        $ch = if ($session.change_due) { [double]$session.change_due } else { 0 }
        Add-Str $b "$(Str-LR 'Change:' (Fmt-Money $ch))`n"
    }
    Add-Str $b "$SEP`n"

    # Footer
    Add-Bytes $b @($script:ESC, [byte][char]'a', [byte]1)
    Add-Str $b "Thank you for extending!`n"
    Add-Str $b "$SEP`n"
    Add-Str $b "NOT AN OFFICIAL RECEIPT`n"

    Add-Bytes $b @($script:ESC, [byte][char]'d', [byte]4)
    Add-Bytes $b @($script:GS,  [byte][char]'V', [byte]1)

    return ,$b.ToArray()
}

# ============================================
# HTTP Server
# ============================================
$port = 9100
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$port/")

$printerPath = [USBPrinter]::FindPrinter()
if (-not $printerPath) {
    Write-Host ""
    Write-Host "  ERROR: No USB printer found!" -ForegroundColor Red
    Write-Host "  Make sure POS-58 is plugged in and powered on." -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}

try { $listener.Start() } catch {
    Write-Host "  ERROR: Could not start on port $port" -ForegroundColor Red
    Write-Host "  $_" -ForegroundColor Red
    Write-Host "  Try running as Administrator." -ForegroundColor Yellow
    Read-Host "  Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "  |   POS-58 Print Server (Direct USB)     |" -ForegroundColor Cyan
Write-Host "  |   http://localhost:$port                 |" -ForegroundColor Cyan
Write-Host "  |   Status: READY                        |" -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Keep this window open while using the POS." -ForegroundColor White
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

function Send-Resp($ctx, [int]$code, [string]$json) {
    $r = $ctx.Response
    $r.StatusCode = $code
    $r.ContentType = "application/json"
    $r.AddHeader("Access-Control-Allow-Origin", "*")
    $r.AddHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    $r.AddHeader("Access-Control-Allow-Headers", "Content-Type")
    $buf = [System.Text.Encoding]::UTF8.GetBytes($json)
    $r.ContentLength64 = $buf.Length
    $r.OutputStream.Write($buf, 0, $buf.Length)
    $r.OutputStream.Close()
}

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $url = $req.Url.LocalPath
        $method = $req.HttpMethod
        $ts = (Get-Date).ToString('hh:mm:ss tt')

        if ($method -eq 'OPTIONS') { Send-Resp $ctx 204 ''; continue }

        if ($method -eq 'GET' -and $url -eq '/status') {
            $pp = [USBPrinter]::FindPrinter()
            $on = if ($pp) { 'true' } else { 'false' }
            Send-Resp $ctx 200 "{`"status`":`"ok`",`"printer`":`"POS-58`",`"online`":$on}"
            continue
        }

        if ($method -eq 'POST' -and $url -eq '/test') {
            Write-Host "  [$ts] Test print..." -ForegroundColor Yellow
            $pp = [USBPrinter]::FindPrinter()
            if (-not $pp) { Send-Resp $ctx 500 '{"success":false,"error":"Printer not found"}'; continue }
            $d = Build-TestReceipt
            $w = [USBPrinter]::SendData($pp, $d)
            if ($w -gt 0) {
                Send-Resp $ctx 200 '{"success":true,"message":"Test print sent!"}'
                Write-Host "  [$ts] Test OK ($w bytes)" -ForegroundColor Green
            } else {
                Send-Resp $ctx 500 '{"success":false,"error":"Write failed"}'
                Write-Host "  [$ts] FAILED" -ForegroundColor Red
            }
            continue
        }

        if ($method -eq 'POST' -and $url -eq '/print') {
            Write-Host "  [$ts] Order receipt print..." -ForegroundColor Yellow
            $pp = [USBPrinter]::FindPrinter()
            if (-not $pp) { Send-Resp $ctx 500 '{"success":false,"error":"Printer not found"}'; continue }
            $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
            $body = $reader.ReadToEnd(); $reader.Close()
            try {
                $rd = $body | ConvertFrom-Json
                $orderLabel = if ($rd.beeper_number) { " #$($rd.beeper_number)" } else { '' }
                $allOk = $true

                # 1. Customer receipt (always)
                $d = Build-Receipt $rd
                $w = [USBPrinter]::SendData($pp, $d)
                if ($w -gt 0) {
                    Write-Host "  [$ts] Customer receipt$orderLabel OK ($w bytes)" -ForegroundColor Green
                } else {
                    Write-Host "  [$ts] Customer receipt FAILED" -ForegroundColor Red
                    $allOk = $false
                }

                # 2. Barista ticket (if any barista items exist)
                $bd = Build-BaristaTicket $rd
                if ($bd -ne $null) {
                    Start-Sleep -Milliseconds 1500
                    $pp2 = [USBPrinter]::FindPrinter()
                    if ($pp2) {
                        $w2 = [USBPrinter]::SendData($pp2, $bd)
                    } else { $w2 = -1 }
                    if ($w2 -gt 0) {
                        Write-Host "  [$ts] Barista ticket$orderLabel OK ($w2 bytes)" -ForegroundColor Green
                    } else {
                        Write-Host "  [$ts] Barista ticket FAILED" -ForegroundColor Red
                        $allOk = $false
                    }
                }

                # 3. Kitchen ticket (if any kitchen items exist)
                $kd = Build-KitchenTicket $rd
                if ($kd -ne $null) {
                    Start-Sleep -Milliseconds 1500
                    $pp3 = [USBPrinter]::FindPrinter()
                    if ($pp3) {
                        $w3 = [USBPrinter]::SendData($pp3, $kd)
                    } else { $w3 = -1 }
                    if ($w3 -gt 0) {
                        Write-Host "  [$ts] Kitchen ticket$orderLabel OK ($w3 bytes)" -ForegroundColor Green
                    } else {
                        Write-Host "  [$ts] Kitchen ticket FAILED" -ForegroundColor Red
                        $allOk = $false
                    }
                }

                if ($allOk) {
                    Send-Resp $ctx 200 '{"success":true,"message":"All receipts printed!"}'
                } else {
                    Send-Resp $ctx 500 '{"success":false,"error":"One or more receipts failed"}'
                }
            } catch {
                Send-Resp $ctx 500 "{`"success`":false,`"error`":`"Parse error`"}"
                Write-Host "  [$ts] ERROR: $_" -ForegroundColor Red
            }
            continue
        }

        if ($method -eq 'POST' -and $url -eq '/library-checkin') {
            Write-Host "  [$ts] Library check-in receipt..." -ForegroundColor Yellow
            $pp = [USBPrinter]::FindPrinter()
            if (-not $pp) { Send-Resp $ctx 500 '{"success":false,"error":"Printer not found"}'; continue }
            $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
            $body = $reader.ReadToEnd(); $reader.Close()
            try {
                $sd = $body | ConvertFrom-Json
                $d = Build-LibraryCheckin $sd
                $w = [USBPrinter]::SendData($pp, $d)
                if ($w -gt 0) {
                    Send-Resp $ctx 200 '{"success":true,"message":"Check-in receipt printed!"}'
                    Write-Host "  [$ts] Library check-in OK ($w bytes)" -ForegroundColor Green
                } else {
                    Send-Resp $ctx 500 '{"success":false,"error":"Write failed"}'
                    Write-Host "  [$ts] FAILED" -ForegroundColor Red
                }
            } catch {
                Send-Resp $ctx 500 "{`"success`":false,`"error`":`"Parse error`"}"
                Write-Host "  [$ts] ERROR: $_" -ForegroundColor Red
            }
            continue
        }

        if ($method -eq 'POST' -and $url -eq '/library-extension') {
            Write-Host "  [$ts] Library extension receipt..." -ForegroundColor Yellow
            $pp = [USBPrinter]::FindPrinter()
            if (-not $pp) { Send-Resp $ctx 500 '{"success":false,"error":"Printer not found"}'; continue }
            $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
            $body = $reader.ReadToEnd(); $reader.Close()
            try {
                $sd = $body | ConvertFrom-Json
                $d = Build-LibraryExtension $sd
                $w = [USBPrinter]::SendData($pp, $d)
                if ($w -gt 0) {
                    Send-Resp $ctx 200 '{"success":true,"message":"Extension receipt printed!"}'
                    Write-Host "  [$ts] Library extension OK ($w bytes)" -ForegroundColor Green
                } else {
                    Send-Resp $ctx 500 '{"success":false,"error":"Write failed"}'
                    Write-Host "  [$ts] FAILED" -ForegroundColor Red
                }
            } catch {
                Send-Resp $ctx 500 "{`"success`":false,`"error`":`"Parse error`"}"
                Write-Host "  [$ts] ERROR: $_" -ForegroundColor Red
            }
            continue
        }

        Send-Resp $ctx 404 '{"error":"Not found"}'
    } catch {
        if ($listener.IsListening) { Write-Host "  Error: $_" -ForegroundColor Red }
    }
}
