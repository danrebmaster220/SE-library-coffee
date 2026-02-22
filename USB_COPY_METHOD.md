# 🚀 EASIEST Setup: USB Copy Method

**For team members setting up on a new laptop.**

Follow these steps **IN ORDER**. Don't skip anything.

---

## ✅ Prerequisites - Install First

Before starting, install these on the NEW laptop:

1. **Node.js** v18+ → https://nodejs.org/ (download and install)
2. **Git** → https://git-scm.com/downloads (download and install)

**Restart your laptop after installing both.**

---

## 📋 STEP-BY-STEP GUIDE

### 🔵 STEP 1: On the WORKING Laptop

**The laptop where the project already works:**

1. Open File Explorer
2. Go to your project folder: `SE-library-coffee/`
3. Find the `mariadb` folder
4. Right-click → Copy
5. Plug in USB drive
6. Paste the `mariadb` folder into the USB

**✅ USB now has the `mariadb` folder**

---

### 🔵 STEP 2: On the NEW Laptop - Get the Project

Open **PowerShell**:

```powershell
cd Desktop
git clone https://github.com/danrebmaster220/SE-library-coffee.git
cd SE-library-coffee
```

**✅ Project is now on Desktop**

---

### 🔵 STEP 3: Copy MariaDB from USB

1. Plug USB into new laptop
2. Open File Explorer → open USB drive
3. Copy the `mariadb` folder from USB
4. Go to `Desktop/SE-library-coffee/`
5. Paste the `mariadb` folder here

**Check:** You should see `Desktop/SE-library-coffee/mariadb/`

**✅ MariaDB is now in your project**

---

### 🔵 STEP 4: Start Database Server

Open **PowerShell** in project folder:

```powershell
cd Desktop/SE-library-coffee/mariadb
.\bin\mysqld.exe --console
```

**You will see:**
```
Ready for connections
Listening on port 3306
```

### 🚨 TERMINAL WILL LOOK "FROZEN" — THIS IS NORMAL! 🚨

**DO NOT:**
- ❌ Close this window
- ❌ Press Ctrl+C
- ❌ Type anything

**JUST LEAVE IT OPEN — Move to next step.**

**✅ Database server is running (Window 1)**

---

### 🔵 STEP 5: Create Database and Tables

**Open a NEW PowerShell window** (keep Window 1 open!):

**How to open 2nd window:**
- Press `Win` key
- Type "PowerShell"
- Click "Windows PowerShell" again

In the **NEW window**:

```powershell
cd Desktop/SE-library-coffee
```

Connect to database:

```powershell
.\mariadb\bin\mysql.exe -u root
```

**You should see:** `MariaDB [(none)]>`

Now run these commands **one at a time** (press Enter after each):

**Command 1:**
```sql
CREATE DATABASE coffee_shop;
```
→ Wait for: `Query OK, 1 row affected`

**Command 2:**
```sql
USE coffee_shop;
```
→ Wait for: `Database changed`

**Command 3:**
```sql
SOURCE backend/config/coffee_database.sql;
```
→ You'll see MANY `Query OK` messages scrolling (this creates all 23 tables automatically)
→ Wait for it to finish (about 5 seconds)

**Command 4:**
```sql
EXIT;
```
→ You're back to PowerShell

**✅ Database and all 23 tables are created**

---

### 🔵 STEP 6: Install Backend Packages

**Stay in Window 2** (the PowerShell where you just typed EXIT):

```powershell
cd backend
npm install
```

**Wait 1-2 minutes** for packages to install.

**✅ Backend packages installed**

---

### 🔵 STEP 7: Create Backend Settings File

Still in Window 2:

```powershell
notepad .env
```

**Notepad will open.** Copy and paste this EXACTLY:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=coffee_shop
DB_SSL=false
JWT_SECRET=local-secret-key-12345
PORT=3000
NODE_ENV=development
```

Click **File → Save**, then close Notepad.

**✅ .env file created**

---

### 🔵 STEP 8: Create Default Users

Still in Window 2, in the backend folder:

```powershell
node config/seed_users.js
```

**You should see:**
```
✅ User created: admin
✅ User created: cashier
✅ User created: barista
```

**✅ Default users are in database**

---

### 🔵 STEP 9: Start Backend Server

Still in Window 2:

```powershell
npm start
```

**You should see:**
```
╔════════════════════════════════════════════╗
║    🚀 Library Coffee + Study API Server    ║
║  ✅ Database connected successfully         ║
╚════════════════════════════════════════════╝
```

### 🚨 TERMINAL WILL LOOK "FROZEN" AGAIN — THIS IS NORMAL! 🚨

**DO NOT close this window. DO NOT press Ctrl+C.**

**You now have 2 windows running:**
- Window 1: Database (mysqld.exe)
- Window 2: Backend (npm start)

**✅ Backend is running (Window 2)**

---

### 🔵 STEP 10: Install Frontend Packages

**Open a THIRD PowerShell window:**

```powershell
cd Desktop/SE-library-coffee/pos-web
npm install
```

**Wait 1-2 minutes** for packages to install.

**✅ Frontend packages installed**

---

### 🔵 STEP 11: Start Frontend

Still in Window 3:

```powershell
npm run dev
```

**You should see:**
```
  VITE v5.x.x ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  press h + enter to show help
```

**✅ Frontend is running (Window 3)**

---

### 🔵 STEP 12: TEST IT!

1. Open your **web browser** (Chrome, Edge, Firefox)
2. Go to: **http://localhost:5173**
3. You should see the **Library Coffee login page**

**Login with:**
- Username: `admin`
- Password: `admin123`

**✅ If you can login and see the dashboard, YOU'RE DONE!** 🎉

---

## 📊 Summary - What Should Be Running

You should have **3 PowerShell windows** open:

```
┌─────────────────────────────────┐
│ Window 1: mysqld.exe --console  │
│ Status: Looks frozen ← NORMAL   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Window 2: npm start             │
│ Status: Looks frozen ← NORMAL   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Window 3: npm run dev           │
│ Status: Shows "VITE ready"      │
└─────────────────────────────────┘
```

**All 3 must stay open while using the app!**

---

## 🔄 Next Time (Tomorrow, Next Week, etc.)

You **DON'T** need to do everything again. Just:

**Window 1:**
```powershell
cd Desktop/SE-library-coffee/mariadb
.\bin\mysqld.exe --console
```

**Window 2 (new):**
```powershell
cd Desktop/SE-library-coffee/backend
npm start
```

**Window 3 (new):**
```powershell
cd Desktop/SE-library-coffee/pos-web
npm run dev
```

Then open **http://localhost:5173**

---

## 📌 Login Credentials

| Role     | Username | Password     |
|----------|----------|--------------|
| Admin    | admin    | admin123     |
| Cashier  | cashier  | cashier123   |
| Barista  | barista  | barista123   |

---

## 🆘 Troubleshooting

### ❌ "mysql.exe is not recognized"

**Cause:** You're in the wrong folder.

**Fix:** Make sure you're in `Desktop/SE-library-coffee/`:
```powershell
cd Desktop/SE-library-coffee
.\mariadb\bin\mysql.exe -u root
```

---

### ❌ "Port 3306 already in use"

**Cause:** Another database is running.

**Fix:**
1. Press `Win + R`
2. Type `services.msc`
3. Find MySQL or MariaDB
4. Right-click → Stop

---

### ❌ "Database connection failed"

**Cause:** Window 1 (database) was closed.

**Fix:** Open Window 1 again:
```powershell
cd Desktop/SE-library-coffee/mariadb
.\bin\mysqld.exe --console
```

---

### ❌ "Port 3000 already in use"

**Fix:**
```powershell
netstat -ano | findstr :3000
taskkill /PID <number_shown> /F
```

---

### ❌ Frontend shows blank page

**Check:**
1. Is Window 2 (backend) still open?
2. Open: http://localhost:3000/health
3. Should show: `{"status":"healthy","database":"connected"}`

---

## ✅ Complete Checklist

Go through this to make sure you did everything:

- [ ] Node.js installed on new laptop
- [ ] Git installed on new laptop
- [ ] Project cloned: `Desktop/SE-library-coffee/`
- [ ] MariaDB folder copied from USB to project
- [ ] Window 1: Ran `mysqld.exe --console` (frozen = OK)
- [ ] Window 2: Opened NEW PowerShell window
- [ ] Ran `mysql.exe -u root`
- [ ] Ran `CREATE DATABASE coffee_shop;`
- [ ] Ran `USE coffee_shop;`
- [ ] Ran `SOURCE backend/config/coffee_database.sql;`
- [ ] Ran `EXIT;`
- [ ] Ran `cd backend`
- [ ] Ran `npm install` in backend
- [ ] Created `.env` file with settings
- [ ] Ran `node config/seed_users.js`
- [ ] Ran `npm start` (frozen = OK)
- [ ] Window 3: Opened THIRD PowerShell window
- [ ] Ran `npm install` in pos-web
- [ ] Ran `npm run dev`
- [ ] Browser shows login page at http://localhost:5173
- [ ] Can login with admin/admin123

**All checked? You're done!** 🎉

---

## ❓ FAQ

**Q: Do I need to create tables manually?**
**A:** NO. The command `SOURCE backend/config/coffee_database.sql;` automatically creates all 23 tables for you. Just run that one line.

**Q: Why does the terminal freeze?**
**A:** It's not frozen. `mysqld.exe` and `npm start` are servers — they keep running in the terminal. That's normal. Just open new windows for other commands.

**Q: Can I close the windows?**
**A:** NO. All 3 windows must stay open while you use the app. Closing any window breaks the system.

**Q: What if I restart my laptop?**
**A:** You need to start the 3 servers again. See the "Next Time" section above.

---

**For cloud deployment, see:** `DEPLOYMENT_GUIDE.md`
