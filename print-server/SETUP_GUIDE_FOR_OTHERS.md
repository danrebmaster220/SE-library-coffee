# 🖨️ Print Server Setup Guide — For Friends / Other Laptops

> This guide is for anyone who wants to use the POS-58 Print Server on their own laptop.
> No coding knowledge needed. Just follow the steps.

---

## Requirements

- **Windows 10 or 11** laptop
- **JK-5802H / POS-58** thermal receipt printer (58mm)
- **USB cable** to connect the printer
- The **`print-server`** folder containing:
  - `PrintServer.ps1`
  - `START_PRINT_SERVER.bat`

---

## Step 1 — Get the Print Server Files

Ask for the `print-server` folder (via USB drive, Google Drive, or download from GitHub).

Save it anywhere on your laptop, for example:
- `C:\print-server\`
- `Desktop\print-server\`

The folder should contain:
```
print-server/
├── PrintServer.ps1        ← The actual print server script
├── START_PRINT_SERVER.bat  ← Double-click this to start
```

---

## Step 2 — Connect the Printer

1. Plug the **USB cable** from the POS-58 printer into your laptop
2. Turn the printer **ON** (power switch is on the side/back)
3. Make sure there is **thermal paper** loaded (the paper should have a slight shine on the print side)
4. Wait **30–60 seconds** for Windows to detect the USB device

---

## Step 3 — Add the Printer in Windows (CRITICAL STEP)

> ⚠️ **This step is required.** Just plugging in the printer is NOT enough.
> Without this, the print server cannot find the printer.

### Open Devices and Printers
1. Press **Windows + R** → type `control printers` → press Enter
2. Or: **Control Panel** → **Hardware and Sound** → **Devices and Printers**

### Check What You See

**If the printer already appears under "Printers"** (as `POS-58` or `Generic / Text Only`):
- ✅ You're good — skip to **Step 4**

**If you only see it under "Unspecified"** (as `USB Printing Support` or `Printer POS-58`):
- ❌ You need to add it manually — continue below

### Add the Printer Manually

1. Click **"Add a printer"** at the top of the window

2. **If Windows finds the printer automatically:**
   - Select it from the list → click **Next** → click **Finish**
   - Done ✅

3. **If Windows does NOT find it** (or says "The printer that I want isn't listed"):
   - Click **"The printer that I want isn't listed"**
   - Select **"Add a local printer or network printer with manual settings"** → Next
   - **Choose a printer port:**
     - Select **"Use an existing port"**
     - Choose **`USB001 (Virtual printer port for USB)`** from the dropdown
     - If you don't see USB001, try `USB002` or `USB003`
     - Click **Next**
   - **Install the printer driver:**
     - Left column (Manufacturer): scroll down and select **`Generic`**
     - Right column (Printers): select **`Generic / Text Only`**
     - Click **Next**
   - **Printer name:**
     - Type: `POS-58` (or any name you want — the name doesn't matter)
     - Click **Next**
   - **Printer sharing:**
     - Select **"Do not share this printer"**
     - Click **Next**
   - Click **Finish**

4. **Verify:** Go back to **Devices and Printers** — you should now see `POS-58` (or whatever you named it) under the **Printers** section.

---

## Step 4 — Verify in Device Manager

1. Right-click the **Start** button → click **Device Manager**
2. Expand **Universal Serial Bus controllers**
3. Look for **`Printer POS-58`** or a similar printer entry

| What You See | Status |
|---|---|
| `Printer POS-58` (no warning icon) | ✅ Good |
| `USB Printing Support` (no warning icon) | ⚠️ Might work — test in Step 6 |
| Any device with a yellow ⚠️ triangle | ❌ Driver issue — right-click → Update Driver → Search automatically |

---

## Step 5 — Start the Print Server

1. Open the `print-server` folder
2. **Right-click** on `START_PRINT_SERVER.bat`
3. Click **"Run as administrator"**

   > If Windows SmartScreen pops up saying "Windows protected your PC":
   > Click **"More info"** → Click **"Run anyway"**

4. A **black terminal window** will open. You should see:

```
==========================================
|   POS-58 Print Server (Direct USB)     |
|   http://localhost:9100                 |
|   Status: READY                        |
==========================================

Keep this window open while using the POS.
Press Ctrl+C to stop.
```

5. ✅ The print server is now running!

> **⚠️ DO NOT close this window.** Keep it open the entire time you're using the POS system. Closing it stops all printing.

---

## Step 6 — Test if the Printer is Detected

1. Open any web browser (Chrome, Edge, Firefox)
2. In the address bar, type: `http://localhost:9100/status`
3. Press Enter

**Expected result:**
```json
{"status":"ok","printer":"POS-58","online":true}
```

| What You See | Meaning | Action |
|---|---|---|
| `"online":true` | ✅ Printer found and ready | Continue to Step 7 |
| `"online":false` | ❌ Printer not detected | Go back to Step 3 and add the printer |
| Page won't load / error | ❌ Print server not running | Go back to Step 5 |

---

## Step 7 — Connect Your POS Web App

1. In your frontend code, make sure print requests go to: `http://localhost:9100`
2. The available endpoints are:

| Method | URL | What It Does |
|---|---|---|
| `GET` | `/status` | Check if printer is online |
| `POST` | `/test` | Print a test receipt |
| `POST` | `/print` | Print order receipt (customer + barista + kitchen) |
| `POST` | `/library-checkin` | Print library check-in receipt |
| `POST` | `/library-extension` | Print library extension receipt |

3. Open your POS web app in the browser on **this same laptop**
4. Process a test order to verify printing works

> **Important:** The browser running your POS app and the print server must be on the **same laptop**. `localhost` means "this computer."

---

## Step 8 — Test Print

### Quick Test (No POS App Needed)
Open a browser and go to:
```
http://localhost:9100/test
```

This will print a test receipt. If paper comes out, everything is working ✅

### Full Test
1. Open your POS web app
2. Create and process a small test order
3. Check the print server terminal — you should see:
   ```
   [12:00:00 PM] Customer receipt #1 OK (xxx bytes)
   ```
4. A receipt should print from the printer

---

## Troubleshooting

### "online":false — Printer Not Found

| Try This | How |
|---|---|
| Is the printer plugged in? | Check the USB cable on both ends |
| Is the printer turned ON? | Check the power switch — the power light should be on |
| Did you add the printer in Windows? | Go back to **Step 3** — this is the most common issue |
| Try a different USB port | Unplug and plug into a different USB port on the laptop |
| Restart the print server | Close the terminal → run `START_PRINT_SERVER.bat` again as admin |

### BAT File Opens and Closes Immediately

- Make sure you **right-clicked** → **Run as administrator**
- If it still closes, open PowerShell as Admin and run:
  ```
  Set-ExecutionPolicy Bypass -Scope LocalMachine
  ```
  Then try the BAT file again.

### Windows SmartScreen Blocks the File

- Click **"More info"** → **"Run anyway"**
- This is normal for downloaded scripts

### Printer is Found but Nothing Prints

- Check if there is paper in the printer
- Check if the paper is loaded correctly (shiny/smooth side facing out)
- Try the test endpoint: `http://localhost:9100/test`
- Restart the printer (turn OFF, wait 5 seconds, turn ON)

### Port 9100 Already in Use

- Another program is using port 9100
- Open **Task Manager** → look for other print server processes → close them
- Then try again

---

## Quick Reference

```
┌─────────────────────────────────────────────┐
│           SETUP CHECKLIST                   │
├─────────────────────────────────────────────┤
│ [ ] Printer USB plugged in + turned ON      │
│ [ ] Printer added in "Devices and Printers" │
│ [ ] No yellow ⚠️ in Device Manager          │
│ [ ] START_PRINT_SERVER.bat running as Admin │
│ [ ] localhost:9100/status → "online":true   │
│ [ ] POS app opened on SAME laptop           │
│ [ ] Test print successful                   │
└─────────────────────────────────────────────┘
```

---

## FAQ

**Q: Do I need to install any software?**
A: No. The print server is a single PowerShell script. Windows has PowerShell built-in.

**Q: Do I need internet for printing?**
A: No. The print server runs locally on your laptop. Printing works offline. (But your POS web app may need internet if it's hosted on Vercel.)

**Q: Can I use a different printer?**
A: It works with any 58mm ESC/POS thermal printer that connects via USB. The printer model doesn't need to be exactly JK-5802H.

**Q: What if I unplug the printer and plug it back in?**
A: The print server will automatically find it again. No restart needed. Just check `/status` to confirm.

**Q: Can two laptops print to the same printer?**
A: No. The printer is USB — it connects to one laptop at a time.
