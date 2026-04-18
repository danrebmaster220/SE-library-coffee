# 🖨️ Print Server Setup Guide — Your Own Laptop (Defense Day)

> This guide is for when YOU move from your desktop to a different laptop for the defense presentation.
> You already know the system — this is a quick checklist so you don't miss anything.

---

## What to Bring

- [ ] JK-5802H / POS-58 thermal printer
- [ ] USB cable for the printer
- [ ] USB flash drive with the `print-server` folder (or just clone from GitHub)
- [ ] Thermal paper roll (bring a spare!)

---

## Step 1 — Copy Files to the Laptop

Copy the entire `print-server` folder to the laptop:

```
print-server/
├── PrintServer.ps1
├── START_PRINT_SERVER.bat
```

You can put it anywhere — Desktop, Documents, or a USB drive. The path doesn't matter.

**Alternative:** If the laptop has internet, just clone your repo:
```
git clone https://github.com/danrebmaster220/SE-library-coffee.git
```

---

## Step 2 — Plug In the Printer

1. Connect the USB cable from the **JK-5802H** to the laptop
2. Turn the printer **ON** (power switch on the side)
3. Wait **30–60 seconds** for Windows to detect it

---

## Step 3 — Check Device Manager

1. Right-click **Start** → **Device Manager**
2. Look under **Universal Serial Bus controllers**
3. You should see one of:
   - `Printer POS-58` ✅ — good to go
   - `USB Printing Support` ✅ — might work, test in Step 5
   - ⚠️ Yellow triangle on any USB device — driver issue, see Troubleshooting below

---

## Step 4 — Add the Printer (IMPORTANT — Do This Every Time)

> This is the step you did months ago on your desktop but forgot about.
> **Always do this on a new laptop to guarantee it works.**

1. Open **Control Panel** → **Hardware and Sound** → **Devices and Printers**
2. Click **"Add a printer"** at the top
3. **If Windows finds the printer automatically:**
   - Select it → Next → Finish ✅
4. **If it says "The printer that I want isn't listed":**
   - Click that link
   - Select **"Add a local printer or network printer with manual settings"**
   - Port: Choose **`USB001 (Virtual printer port for USB)`**
   - Manufacturer: **Generic**
   - Printer: **Generic / Text Only**
   - Name it: `POS-58`
   - Click **Finish**

5. Verify: In **Devices and Printers**, you should now see `POS-58` under the **Printers** section

---

## Step 5 — Run the Print Server

1. Navigate to the `print-server` folder
2. **Right-click** `START_PRINT_SERVER.bat` → **Run as administrator**
3. A terminal window opens. You should see:

```
==========================================
|   POS-58 Print Server (Direct USB)     |
|   http://localhost:9100                 |
|   Status: READY                        |
==========================================
```

4. **Keep this window open the entire defense!** Closing it = no printing.

---

## Step 6 — Verify the Printer is Detected

Open any browser tab on the **same laptop** and go to:

```
http://localhost:9100/status
```

| Response | Meaning |
|---|---|
| `{"status":"ok","printer":"POS-58","online":true}` | ✅ Printer found, ready to print |
| `{"status":"ok","printer":"POS-58","online":false}` | ❌ Printer not detected — go back to Step 4 |
| Page won't load | ❌ Print server not running — go back to Step 5 |

---

## Step 7 — Open the POS Web App

1. Open the browser on **the same laptop** where the print server is running
2. Go to your Vercel URL: `https://your-app.vercel.app`
3. The POS app will send print jobs to `http://localhost:9100` automatically

> ⚠️ The browser and print server MUST be on the **same laptop**. `localhost` means "this machine."

---

## Step 8 — Test Print

1. In the POS app, process a small test order
2. The print server terminal should show:
   ```
   [12:00:00 PM] Customer receipt #1 OK (xxx bytes)
   ```
3. A receipt should come out of the printer ✅

---

## Quick Defense Day Checklist

```
[ ] Printer plugged in + turned ON
[ ] Printer added via "Add a printer" in Control Panel
[ ] Device Manager: no yellow triangles
[ ] START_PRINT_SERVER.bat running as Admin
[ ] localhost:9100/status → "online":true
[ ] POS web app opened in browser on SAME laptop
[ ] Test order printed successfully
[ ] Spare thermal paper roll ready
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Yellow ⚠️ in Device Manager | Right-click → Update Driver → Search automatically |
| `"online":false` | Printer not added — do Step 4 |
| BAT opens and closes instantly | Right-click → Run as Administrator |
| PowerShell execution policy error | Open PowerShell as Admin → `Set-ExecutionPolicy Bypass -Scope LocalMachine` |
| Port 9100 already in use | Another program using port 9100 — close it, or check Task Manager |
| Browser can't reach localhost:9100 | Windows Firewall blocking it — allow port 9100 for private network |
| Receipt text is cut off | Already fixed in latest PrintServer.ps1 — make sure you have the latest version |

---

## How It Works (For Your Reference)

- `PrintServer.ps1` runs an HTTP server on `localhost:9100`
- It finds the printer via the **USB Printer Class GUID** (`28d78fad-5a12-11d1-ae5b-0000f803a8c2`)
- It sends raw **ESC/POS** bytes directly to the USB device (bypasses Windows spooler)
- The POS web app sends JSON to `/print`, `/library-checkin`, or `/library-extension`
- The script builds the receipt bytes and writes them to the printer

**Endpoints:**
| Endpoint | Purpose |
|---|---|
| `GET /status` | Check if printer is online |
| `POST /test` | Print a test receipt |
| `POST /print` | Print customer receipt + barista ticket + kitchen ticket |
| `POST /library-checkin` | Print library check-in receipt |
| `POST /library-extension` | Print library extension receipt |
| `POST /library-checkout` | Print library checkout/session summary receipt |
| `POST /refund` | Print refund receipt |
