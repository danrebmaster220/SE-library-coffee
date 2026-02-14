# 🚀 Cloud Deployment Guide

## Library Coffee + Study System - Complete Hosting Tutorial

This guide covers deploying the backend to **Render** and the POS-Web to **Vercel** for your SE2 mock defense.

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Database Setup (Cloud MySQL)](#database-setup-cloud-mysql)
3. [Backend Deployment to Render](#backend-deployment-to-render)
4. [POS-Web Deployment to Vercel](#pos-web-deployment-to-vercel)
5. [Print Agent Setup](#print-agent-setup)
6. [Testing & Verification](#testing--verification)
7. [Troubleshooting](#troubleshooting)

---

## 🔍 Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] GitHub account (your code is already on GitHub: `danrebmaster220/SE-library-coffee`)
- [ ] Render account (free tier)
- [ ] Vercel account (free tier)
- [ ] Cloud database (we'll use Render's free PostgreSQL OR Railway MySQL)
- [ ] All local testing completed

### Required Environment Variables

**Backend (.env):**
```env
NODE_ENV=production
PORT=3000
DB_HOST=<your-cloud-db-host>
DB_PORT=3306
DB_USER=<your-cloud-db-user>
DB_PASS=<your-cloud-db-password>
DB_NAME=coffee_db
JWT_SECRET=<generate-a-secure-random-string>
CORS_ORIGINS=https://your-pos-web.vercel.app,https://your-app.onrender.com
```

**POS-Web (.env.production):**
```env
VITE_API_URL=https://your-backend.onrender.com
```

---

## 🗄️ Database Setup (Cloud MySQL)

### Option A: Railway MySQL (Recommended - True MySQL/MariaDB)

#### Step 1: Create Railway Account
1. Go to **https://railway.app**
2. Click **"Start a New Project"**
3. Sign up with **GitHub** (easiest)
4. Authorize Railway to access your GitHub

#### Step 2: Create MySQL Database
1. In Railway dashboard, click **"New Project"**
2. Click **"Provision MySQL"** (or search for MySQL)
3. Wait for the database to provision (30 seconds)
4. Click on the MySQL service
5. Go to **"Variables"** tab

#### Step 3: Get Connection Details
You'll see these variables:
```
MYSQL_HOST=containers-us-west-xxx.railway.app
MYSQL_PORT=xxxx (usually not 3306)
MYSQL_USER=root
MYSQL_PASSWORD=xxxxxxxxxxxx
MYSQL_DATABASE=railway
```

**⚠️ Important:** Railway uses a random port, not 3306!

#### Step 4: Import Your Database Schema
1. Open your local MySQL client or terminal
2. Connect to Railway MySQL:
   ```bash
   mysql -h containers-us-west-xxx.railway.app -P xxxxx -u root -p railway < coffee_database.sql
   ```
3. Or use **MySQL Workbench** / **DBeaver** to connect and import

---

### Option B: PlanetScale (Serverless MySQL)

1. Go to **https://planetscale.com**
2. Sign up for free
3. Create a new database called `coffee_db`
4. Go to **Connect** → **Connect with:** → **Node.js**
5. Copy the connection string
6. Note: PlanetScale requires `ssl: { rejectUnauthorized: true }` in your db.js

---

## 🖥️ Backend Deployment to Render

### Step 1: Create Render Account

1. Go to **https://render.com**
2. Click **"Get Started for Free"**
3. Sign up with **GitHub** (recommended for easy deployment)
4. Verify your email
5. Complete the onboarding (you can skip adding payment)

### Step 2: Create New Web Service

1. From your Render dashboard, click **"New +"** button (top right)
2. Select **"Web Service"**
3. Connect your GitHub repository:
   - If first time: Click **"Connect GitHub"**
   - Authorize Render to access your repositories
   - Search for **"SE-library-coffee"**
   - Click **"Connect"**

### Step 3: Configure the Web Service

Fill in these settings:

| Setting | Value |
|---------|-------|
| **Name** | `library-coffee-api` (or your choice) |
| **Region** | Singapore (closest to PH) or Oregon |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Instance Type** | Free |

### Step 4: Add Environment Variables

Scroll down to **"Environment Variables"** section and add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DB_HOST` | `containers-us-west-xxx.railway.app` (from Railway) |
| `DB_PORT` | `xxxxx` (from Railway, NOT 3306) |
| `DB_USER` | `root` |
| `DB_PASS` | `your-railway-password` |
| `DB_NAME` | `railway` (or `coffee_db` if you created it) |
| `JWT_SECRET` | `your-super-secret-key-minimum-32-characters-long` |
| `CORS_ORIGINS` | `https://library-coffee-pos.vercel.app,http://localhost:5173` |
| `PRINTER_NAME` | `POS-58` (not used in cloud, but keep for compatibility) |

**💡 Tip:** Generate a secure JWT_SECRET:
```javascript
// Run in browser console or Node:
require('crypto').randomBytes(32).toString('hex')
```

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait for the build (2-5 minutes)
3. Watch the logs for any errors
4. Once deployed, you'll get a URL like: `https://library-coffee-api.onrender.com`

### Step 6: Verify Deployment

1. Visit: `https://library-coffee-api.onrender.com/health`
2. You should see:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "environment": "production"
   }
   ```

### ⚠️ Render Free Tier Limitations

- **Spins down after 15 minutes of inactivity**
- First request after sleep takes 30-60 seconds (cold start)
- 750 free hours/month (enough for demos)
- For mock defense: Access your site 5 minutes before to "wake it up"

---

## 🌐 POS-Web Deployment to Vercel

### Step 1: Create Vercel Account

1. Go to **https://vercel.com**
2. Click **"Start Deploying"** or **"Sign Up"**
3. Sign up with **GitHub** (recommended)
4. Authorize Vercel to access your repositories

### Step 2: Import Project

1. From Vercel dashboard, click **"Add New..."** → **"Project"**
2. Find **"SE-library-coffee"** repository
3. Click **"Import"**

### Step 3: Configure Project

| Setting | Value |
|---------|-------|
| **Project Name** | `library-coffee-pos` |
| **Framework Preset** | Vite |
| **Root Directory** | Click "Edit" → type `pos-web` → Click "Continue" |
| **Build Command** | `npm run build` (auto-detected) |
| **Output Directory** | `dist` (auto-detected) |
| **Install Command** | `npm install` (auto-detected) |

### Step 4: Add Environment Variables

Click **"Environment Variables"** and add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://library-coffee-api.onrender.com` |

**⚠️ Important:** The variable MUST start with `VITE_` for Vite to expose it!

### Step 5: Deploy

1. Click **"Deploy"**
2. Wait for build (1-2 minutes)
3. Vercel will give you a URL like: `https://library-coffee-pos.vercel.app`

### Step 6: Update CORS on Render

After getting your Vercel URL, update Render's CORS:

1. Go to Render Dashboard → Your Web Service → Environment
2. Update `CORS_ORIGINS` to include your Vercel URL:
   ```
   https://library-coffee-pos.vercel.app,http://localhost:5173
   ```
3. Click "Save Changes" → Service will auto-redeploy

### Step 7: Verify Deployment

1. Visit your Vercel URL
2. Try logging in with your credentials
3. Check browser console for any CORS errors

---

## 🖨️ Print Agent Setup

Since printing requires a physical USB connection, you need to run the Print Agent locally.

### Step 1: Install Dependencies

```powershell
cd backend/print-agent
npm install
```

### Step 2: Configure Print Agent

Create `.env` file in the `print-agent` folder:

```env
# Your Render backend URL
PRINT_AGENT_SERVER=https://library-coffee-api.onrender.com

# Location identifier
PRINTER_LOCATION=main-counter

# Windows printer name
PRINTER_NAME=POS-58
```

### Step 3: Run Print Agent

```powershell
cd backend/print-agent
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
   Socket ID: abc123xyz
🖨️ Print Agent registered: main-counter (POS-58)
```

### Step 4: Keep Print Agent Running

For your mock defense:
1. Start Print Agent before the demo
2. Keep the terminal window open
3. It will automatically reconnect if connection drops

---

## ✅ Testing & Verification

### Test Checklist

1. **Backend Health Check:**
   ```
   https://library-coffee-api.onrender.com/health
   ```

2. **API Test:**
   ```
   https://library-coffee-api.onrender.com/api/menu/categories
   ```

3. **POS-Web:**
   - Open `https://library-coffee-pos.vercel.app`
   - Login with credentials
   - Navigate through pages
   - Create a test order

4. **Print Agent:**
   - Ensure it shows "Connected to cloud backend"
   - Process an order and verify receipt prints

### Pre-Defense Checklist

- [ ] Wake up Render backend 5 minutes before demo
- [ ] Verify POS-Web loads correctly
- [ ] Start Print Agent on local PC
- [ ] Test one complete order flow
- [ ] Have backup screenshots/video in case of network issues

---

## 🔧 Troubleshooting

### Common Issues

#### 1. CORS Error in Browser Console
```
Access to XMLHttpRequest blocked by CORS policy
```
**Fix:** Update `CORS_ORIGINS` on Render to include your Vercel URL

#### 2. 502 Bad Gateway on Render
**Cause:** App crashed or failed to start
**Fix:** Check Render logs, verify all environment variables are correct

#### 3. Database Connection Failed
**Cause:** Wrong credentials or DB not accessible
**Fix:** 
- Verify Railway database is running
- Check DB_HOST, DB_PORT, DB_USER, DB_PASS
- Note: Railway uses random port, NOT 3306

#### 4. Render App Sleeping (Slow Response)
**Cause:** Free tier spins down after 15 minutes
**Fix:** Visit health endpoint to wake it up before demo

#### 5. Print Agent Not Connecting
**Cause:** WebSocket blocked or wrong URL
**Fix:**
- Verify PRINT_AGENT_SERVER URL is correct
- Check that Render app is awake
- Ensure firewall isn't blocking WebSocket

#### 6. "Module not found" Error
**Cause:** Dependencies not installed
**Fix:** Run `npm install` in the correct directory

---

## 📱 Kiosk Note

For the Kiosk app (React Native/Expo):
- The APK connects to whatever URL is in `kiosk/config/environment.js`
- For mock defense, you can either:
  1. Build a new APK with the Render URL
  2. Keep using local backend for kiosk, cloud for POS-Web demo

---

## 🎓 Mock Defense Tips

1. **Wake Up Services:** Access Render backend 5-10 minutes before your presentation
2. **Have Backup:** Prepare screenshots/screen recording of the system working
3. **Test Network:** Ensure stable internet connection at venue
4. **Local Fallback:** Keep your local setup ready as backup
5. **Know Your System:** Be ready to explain the architecture (local printing, cloud backend, etc.)

---

## 📞 Quick Reference

| Service | URL |
|---------|-----|
| Render Dashboard | https://dashboard.render.com |
| Vercel Dashboard | https://vercel.com/dashboard |
| Railway Dashboard | https://railway.app/dashboard |
| Your Backend | https://library-coffee-api.onrender.com |
| Your POS-Web | https://library-coffee-pos.vercel.app |
| Health Check | https://library-coffee-api.onrender.com/health |

---

**Good luck with your SE2 mock defense! 🎉**
