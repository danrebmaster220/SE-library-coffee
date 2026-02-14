# 🖨️ Library Coffee Print Agent

A local Windows service that connects to the cloud-hosted backend and handles thermal receipt printing.

## Why Do I Need This?

When you host your backend on **Render/Railway/Vercel**, the server runs in the cloud and doesn't have access to your local USB printer. The Print Agent solves this by:

1. Running on your **local Windows PC** (with the printer connected)
2. Connecting to the **cloud backend** via WebSocket
3. Receiving print jobs from the cloud and printing locally

```
┌─────────────────┐     WebSocket     ┌─────────────────┐
│   Cloud Backend │ ◄──────────────► │   Print Agent   │
│    (Render)     │     (Internet)    │  (Your PC)      │
└─────────────────┘                   └────────┬────────┘
        ▲                                      │ USB
        │ HTTP/WebSocket                       ▼
┌───────┴───────┐                     ┌─────────────────┐
│   POS-Web     │                     │  Thermal Printer │
│   (Vercel)    │                     │   (JK-5802H)    │
└───────────────┘                     └─────────────────┘
```

## Quick Start

### 1. Install Dependencies

```powershell
cd backend/print-agent
npm install
```

### 2. Configure

Create a `.env` file in this folder:

```env
# Your deployed backend URL (Render)
PRINT_AGENT_SERVER=https://library-coffee-api.onrender.com

# Identifier for this print station
PRINTER_LOCATION=main-counter

# Windows printer name (if using fallback method)
PRINTER_NAME=POS-58
```

### 3. Run

```powershell
npm start
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║           🖨️  Library Coffee Print Agent                   ║
╠════════════════════════════════════════════════════════════╣
║  Server:   https://library-coffee-api.onrender.com         ║
║  Location: main-counter                                     ║
╚════════════════════════════════════════════════════════════╝

✅ Connected to cloud backend
🖨️ Print Agent registered: main-counter (JK-5802H)
```

## How It Works

1. **Connection**: Print Agent connects to the cloud backend via Socket.IO
2. **Registration**: It registers itself as a print agent with its location and capabilities
3. **Listening**: It listens for print job events (`print-customer-receipt`, `print-barista-ticket`, etc.)
4. **Printing**: When a job arrives, it uses the existing `printerService.js` to print via USB
5. **Confirmation**: It sends a success/failure response back to the cloud

## Supported Print Jobs

| Event | Description |
|-------|-------------|
| `print-customer-receipt` | Customer receipt with order details |
| `print-barista-ticket` | Barista prep ticket |
| `print-library-receipt` | Library check-in/checkout receipt |
| `test-print` | Test print for debugging |

## Troubleshooting

### "Cannot connect to server"
- Make sure your Render backend is running (not sleeping)
- Verify the URL in `.env` is correct
- Check your internet connection

### "Printer not found"
- Ensure the printer is connected via USB
- Verify Zadig driver is installed
- Check that `USB_VENDOR_ID` and `USB_PRODUCT_ID` match your printer

### "USB module not available"
- Run `npm install` to install dependencies
- You may need to install Windows Build Tools:
  ```
  npm install --global windows-build-tools
  ```

## Running as a Windows Service (Optional)

For production use, you might want to run this as a Windows Service:

1. Install PM2:
   ```powershell
   npm install -g pm2
   npm install -g pm2-windows-service
   ```

2. Start with PM2:
   ```powershell
   pm2 start index.js --name print-agent
   pm2 save
   ```

3. Install as Windows Service:
   ```powershell
   pm2-service-install
   ```

Now it will start automatically when Windows boots.

## For Development/Demo

Just keep the terminal window open while running your demo:

```powershell
npm start
```

Press `Ctrl+C` to stop.
