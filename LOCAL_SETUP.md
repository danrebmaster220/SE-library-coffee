# 🚀 Library Coffee Shop - Complete Setup Guide# 🚀 Library Coffee Shop - Complete Setup Guide# Library Coffee Shop - Local Setup Guide# Library Coffee Shop - Local Setup Guide



Follow these steps **in order** to run the project on your laptop.



---Follow these steps **in order** to run the project on your laptop.



## ✅ What You Need First



Install these on your computer before starting:---## Prerequisites## Prerequisites

- [ ] **Node.js** v18 or higher → https://nodejs.org/

- [ ] **Git** → https://git-scm.com/downloads

- [ ] **VS Code** → https://code.visualstudio.com/

## ✅ What You Need First- Node.js v18+- Node.js v18+

---



## 📥 STEP 1: Get the Project

Before starting, make sure you have:- Git- Git

Open **PowerShell** and run:

- [ ] **Node.js** v18 or higher - Download: https://nodejs.org/

```powershell

git clone https://github.com/danrebmaster220/SE-library-coffee.git- [ ] **Git** - Download: https://git-scm.com/downloads- MariaDB portable (included in project)- MariaDB/MySQL

```

- [ ] **Code Editor** (VS Code recommended) - Download: https://code.visualstudio.com/

Then go inside the project folder:



```powershell

cd SE-library-coffee---

```

## Quick Setup Steps## Quick Setup Steps

✅ **Done! You now have the project.**

## 📥 STEP 1: Get the Project

---



## 💾 STEP 2: Get MariaDB (Database)

Open PowerShell or Command Prompt and run:

You need a `mariadb` folder inside your project.

### 1. Clone Repository### 1. Clone Repository

**Option A — Copy from USB (easiest):**

If your teammate already has MariaDB working, they can copy their```bash

`mariadb` folder to USB. Paste it inside `SE-library-coffee/` so it looks like:

git clone https://github.com/danrebmaster220/SE-library-coffee.git```bash```bash

```

SE-library-coffee/cd SE-library-coffee

├── backend/

├── pos-web/```git clone https://github.com/danrebmaster220/SE-library-coffee.gitgit clone https://github.com/danrebmaster220/SE-library-coffee.git

├── kiosk/

├── mariadb/       ← paste it here

```

✅ **You should now see the project files in your folder**cd SE-library-coffeecd SE-library-coffee

> ⚠️ **If the USB copy already has a `data` folder inside it,

> you can SKIP Step 3 and go straight to Step 4.**

> The `data` folder means it was already initialized.

---``````

**Option B — Download fresh:**

1. Go to: https://mariadb.org/download/

2. Download the **ZIP** version (not MSI installer)

3. Extract the ZIP## 💾 STEP 2: Setup Database (MariaDB)

4. Rename the extracted folder to `mariadb`

5. Move it inside `SE-library-coffee/`



✅ **Done! You now have MariaDB.**### Part A: Get MariaDB### 2. Setup MariaDB Database### 2. Start Database



---



## 🔨 STEP 3: Initialize Database (First Time Only)**If you don't have a `mariadb` folder in your project:**```powershell



> ⚠️ **Skip this step if your `mariadb` folder already has a `data` subfolder.**



Open **PowerShell** and go to the mariadb folder:1. Download MariaDB Portable ZIP: https://mariadb.org/download/#### First Time Setup (IMPORTANT!)cd mariadb



```powershell2. Extract the ZIP file

cd SE-library-coffee/mariadb

```3. Rename the folder to `mariadb`.\bin\mysqld.exe --console



Run this command:4. Move it into your project folder: `SE-library-coffee/mariadb/`



```powershell**Step 2.1: Download MariaDB (if not in project)**```

.\bin\mariadb-install-db.exe --datadir=./data

```**If you already have the `mariadb` folder, skip to Part B.**



**You should see:**1. Download MariaDB portable: https://mariadb.org/download/Keep this terminal open.

```

Creating MariaDB system tables...---

Done!

```2. Extract and rename folder to `mariadb`



Check: You should now see a `data` folder inside `mariadb/`.### Part B: Initialize Database (First Time Only!)



✅ **Done! Database is initialized.**3. Place in project root: `SE-library-coffee/mariadb/`### 3. Create Database



---**This creates the database system. Only do this ONCE when setting up.**



## 🟢 STEP 4: Start the Database ServerOpen new terminal:



> ⚠️ **READ THIS CAREFULLY — This is where most people get confused!**Open PowerShell in your project folder:



Open **PowerShell** and go to the mariadb folder:**Step 2.2: Initialize MariaDB (REQUIRED FIRST TIME!)**```powershell



```powershell```powershell

cd SE-library-coffee/mariadb

```cd mariadb```powershell.\mariadb\bin\mysql.exe -u root



Run this command:.\bin\mariadb-install-db.exe --datadir=./data



```powershell```cd mariadb```

.\bin\mysqld.exe --console

```



**You should see something like:****What you should see:**.\bin\mariadb-install-db.exe --datadir=./data

```

Version: '11.2.2-MariaDB'```

...

Ready for connectionsCreating MariaDB system tables...```Run these commands:

```

Done!

### 🚨 THE TERMINAL WILL LOOK "FROZEN" — THIS IS NORMAL! 🚨

``````sql

**The database is now running as a server.** It will NOT give you

a new command prompt. It will NOT let you type anything.

It just sits there waiting for connections. **THAT IS CORRECT.**

✅ **This created a `data` folder inside `mariadb/`****Expected output:**CREATE DATABASE coffee_shop;

**Rules:**

- ❌ Do NOT press Ctrl+C (that kills the database)

- ❌ Do NOT close this window

- ❌ Do NOT try to type anything here---```USE coffee_shop;

- ✅ Just LEAVE THIS WINDOW OPEN and move on



> 📌 **Think of it like this:** This terminal is now a "database machine."

> It needs to keep running in the background. You will do all your### Part C: Start Database ServerCreating MariaDB system tables in './data' ...SOURCE backend/config/coffee_database.sql;

> next work in a DIFFERENT terminal window.



✅ **Done! Database server is running. Leave this window alone.**

**Run this command (still in the mariadb folder):**2024-02-16 10:30:45 0 [Note] .\bin\mysqld.exe: ready for connections.EXIT;

---



## 📊 STEP 5: Create the Database Tables

```powershellDone!```

### 👉 Open a BRAND NEW PowerShell window

.\bin\mysqld.exe --console

**How:** Right-click the PowerShell icon in your taskbar → click "Windows PowerShell"

(Or press `Win` key, type "PowerShell", click it)``````



**You now have 2 windows:**

| Window 1 | Window 2 (NEW) |

|----------|----------------|**What you should see:**### 4. Setup Backend

| Database running (frozen-looking) | You type here |

```

In the **NEW window**, go to the project folder:

Version: '11.2.2-MariaDB'This creates the `data` folder needed by MariaDB.```powershell

```powershell

cd SE-library-coffeeReady for connections on port 3306

```

```cd backend

Connect to the database:



```powershell

.\mariadb\bin\mysql.exe -u root✅ **Database server is running!****Step 2.3: Start MariaDB Server**npm install

```



> ⚠️ **This command only works from the project root folder** (SE-library-coffee).

> If you're inside the `mariadb` folder, use `.\bin\mysql.exe -u root` instead.⚠️ **IMPORTANT: DO NOT CLOSE THIS WINDOW!** ```powershell```



**You should see:** `MariaDB [(none)]>`The database needs to stay running. Keep this terminal open.



Now type these commands **one at a time**, pressing Enter after each:.\bin\mysqld.exe --console



```sql---

CREATE DATABASE coffee_shop;

``````Create backend/.env:

→ You should see: `Query OK, 1 row affected`

## 📊 STEP 3: Create Database & Tables

```sql

USE coffee_shop;```

```

→ You should see: `Database changed`**Open a NEW PowerShell window** (don't close the database one!)



```sql**Expected output:**DB_HOST=localhost

SOURCE backend/config/coffee_database.sql;

```Navigate back to your project:

→ You'll see many `Query OK` messages. Wait for it to finish.

```DB_PORT=3306

```sql

EXIT;```powershell

```

→ You're back to PowerShell.cd SE-library-coffeeVersion: '11.2.2-MariaDB'  socket: ''  port: 3306DB_USER=root



✅ **Done! All database tables are created.**```



---Ready for connections.DB_PASSWORD=



## 🔧 STEP 6: Setup the Backend**Connect to the database:**



**Stay in the same PowerShell window (Window 2).** Go to backend folder:```DB_NAME=coffee_shop



```powershell```powershell

cd backend

```.\mariadb\bin\mysql.exe -u rootDB_SSL=false



Install packages:```



```powershell**KEEP THIS TERMINAL OPEN!** The database server is running.JWT_SECRET=local-secret-key-12345

npm install

```You should see: `MariaDB [(none)]>`



Wait for it to finish (1-2 minutes).PORT=3000



---**Copy and paste these commands ONE BY ONE:**



### Create the .env File### 3. Create Database & TablesNODE_ENV=development



The backend needs a settings file. Create it:```sql



```powershellCREATE DATABASE coffee_shop;```

notepad .env

``````



Notepad will open. **Paste this EXACTLY:**Press Enter. You should see: `Query OK, 1 row affected`**Open a NEW terminal:**



```

DB_HOST=localhost

DB_PORT=3306```sqlSeed users and start:

DB_USER=root

DB_PASSWORD=USE coffee_shop;

DB_NAME=coffee_shop

DB_SSL=false``````powershell```powershell

JWT_SECRET=local-secret-key-12345

PORT=3000Press Enter. You should see: `Database changed`

NODE_ENV=development

```# Connect to MariaDBnode config/seed_users.js



Click **File → Save**, then close Notepad.```sql



---SOURCE backend/config/coffee_database.sql;.\mariadb\bin\mysql.exe -u rootnpm start



### Create Default Users```



Still in the backend folder:Press Enter. You'll see many `Query OK` messages (this creates all tables).``````



```powershell

node config/seed_users.js

``````sql



**You should see:**EXIT;

```

✅ User created: admin```**Inside MySQL prompt, run:**Backend: http://localhost:3000

✅ User created: cashier

✅ User created: baristaPress Enter. You're back to PowerShell.

```

```sql

---

✅ **Database and all tables are now created!**

### Start the Backend

CREATE DATABASE coffee_shop;### 5. Setup Frontend

```powershell

npm start---

```

USE coffee_shop;New terminal:

**You should see:**

```## 🔧 STEP 4: Setup Backend (API Server)

🚀 Library Coffee + Study API Server

✅ Database connected successfullySOURCE backend/config/coffee_database.sql;```powershell

Port: 3000

```**In the same PowerShell window:**



### 🚨 AGAIN — THE TERMINAL WILL LOOK "FROZEN" — THIS IS NORMAL!EXIT;cd pos-web



Same as the database — the backend is now running as a server.```powershell

**Leave this window open. Do not type here. Do not close it.**

cd backend```npm install

**You now have 2 windows running:**

| Window 1 | Window 2 |npm install

|----------|----------|

| Database server (frozen) | Backend server (frozen) |```npm run dev



✅ **Done! Backend is running.**



---This will take 1-2 minutes. Wait for it to finish.**Expected output:**```



## 🎨 STEP 7: Setup the Frontend



### 👉 Open a THIRD PowerShell window---```



Yes, another new one. **You need 3 windows total.**



In the **new window**:### Create Configuration FileQuery OK, 1 row affectedFrontend: http://localhost:5173



```powershell

cd SE-library-coffee/pos-web

```You need to create a file called `.env` in the `backend` folder.Database changed



Install packages:



```powershell**Option 1: Using Notepad**Query OK, 0 rows affected### 6. Login

npm install

``````powershell



Wait for it to finish (1-2 minutes).notepad .env...- Username: admin



Start the frontend:```



```powershellBye- Password: admin123

npm run dev

```**Option 2: Using VS Code**



**You should see:**- Open VS Code```

```

  VITE ready- Open the `backend` folder



  ➜  Local:   http://localhost:5173/- Create new file called `.env`## Default Users

```



✅ **Done! Frontend is running.**

**Copy this EXACTLY into the .env file:**### 4. Setup Backend| Role | Username | Password |

---



## 🎉 STEP 8: Open the App!

```|------|----------|----------|

1. Open your **web browser** (Chrome, Edge, etc.)

2. Go to: **http://localhost:5173**DB_HOST=localhost

3. You should see the **login page**

DB_PORT=3306```powershell| Admin | admin | admin123 |

**Login with:**

DB_USER=root

| Username | Password |

|----------|----------|DB_PASSWORD=cd backend| Cashier | cashier | cashier123 |

| admin    | admin123 |

DB_NAME=coffee_shop

✅ **If you can login, EVERYTHING IS WORKING!** 🎉

DB_SSL=falsenpm install| Barista | barista | barista123 |

---

JWT_SECRET=local-secret-key-12345

## 📝 What Your Screen Should Look Like

PORT=3000```

You should have **3 PowerShell windows** open:

NODE_ENV=development

```

┌─────────────────────┐```## Troubleshooting

│  WINDOW 1           │

│  MariaDB Database   │  ← Looks frozen, that's OK

│  (mysqld.exe)       │

└─────────────────────┘**Save the file.** ✅**Create `backend/.env` file:**



┌─────────────────────┐

│  WINDOW 2           │

│  Backend Server     │  ← Looks frozen, that's OK---```env**Database connection failed?**

│  (npm start)        │

└─────────────────────┘



┌─────────────────────┐### Create Default UsersDB_HOST=localhost- Check MariaDB is running

│  WINDOW 3           │

│  Frontend           │  ← Shows "VITE ready"

│  (npm run dev)      │

└─────────────────────┘Still in the backend folder, run:DB_PORT=3306- Verify .env settings

```



**All 3 must stay open! Closing any of them breaks the app.**

```powershellDB_USER=root

---

node config/seed_users.js

## 🔄 Next Day — Starting Everything Again

```DB_PASSWORD=**Port in use?**

You DON'T need to install or create anything again.

Just start the 3 servers:



**Window 1:****What you should see:**DB_NAME=coffee_shop```powershell

```powershell

cd SE-library-coffee/mariadb```

.\bin\mysqld.exe --console

```✅ Database connected successfullyDB_SSL=falsenetstat -ano | findstr :3000

(Leave it frozen)

✅ User created: admin

**Window 2 (new window):**

```powershell✅ User created: cashierJWT_SECRET=local-secret-key-12345taskkill /PID <PID> /F

cd SE-library-coffee/backend

npm start✅ User created: barista

```

(Leave it frozen)Done!PORT=3000```



**Window 3 (new window):**```

```powershell

cd SE-library-coffee/pos-webNODE_ENV=development

npm run dev

```✅ **Default users are created!**



Then open **http://localhost:5173** in your browser.```## Quick Checklist



------



## 📌 Login Accounts- [ ] Repository cloned



| Role     | Username | Password     |### Start Backend Server

|----------|----------|--------------|

| Admin    | admin    | admin123     |**Seed default users:**- [ ] Database running

| Cashier  | cashier  | cashier123   |

| Barista  | barista  | barista123   |```powershell



---npm start```powershell- [ ] Database created



## 🔄 Getting Code Updates```



When someone pushes new code to GitHub:node config/seed_users.js- [ ] Users seeded



```powershell**What you should see:**

# Stop all 3 servers first (Ctrl+C in each window)

``````- [ ] Backend .env created

# Then in any PowerShell:

cd SE-library-coffee╔════════════════════════════════════════════╗

git pull origin main

║    🚀 Library Coffee + Study API Server    ║- [ ] Backend running

cd backend

npm install║  ✅ Status:      Running                    ║



cd ../pos-web║  🔗 Port:        3000                      ║**Expected output:**- [ ] Frontend running

npm install

╚════════════════════════════════════════════╝

# Then start the 3 servers again (see "Next Day" section)

```✅ Database connected successfully```- [ ] Can login



---```



## 🆘 Troubleshooting✅ Database connected successfully



### ❌ "Can't find data directory"✅ **Backend is running at http://localhost:3000**

You skipped Step 3. Run:

```powershell✅ User created: adminFor cloud deployment see: DEPLOYMENT_GUIDE.md

cd SE-library-coffee/mariadb

.\bin\mariadb-install-db.exe --datadir=./data⚠️ **DO NOT CLOSE THIS WINDOW!** Keep backend running.

```

✅ User created: cashier

### ❌ "mysql.exe is not recognized"

You're in the wrong folder. Make sure you're in the project root:---✅ User created: barista

```powershell

cd SE-library-coffeeDone! Login with credentials

.\mariadb\bin\mysql.exe -u root

```## 🎨 STEP 5: Setup Frontend (Web Interface)```

OR if you're inside the mariadb folder:

```powershell

.\bin\mysql.exe -u root

```**Open ANOTHER NEW PowerShell window****Start backend server:**



### ❌ "Port 3306 already in use"```powershell

Another database is running. Stop it:

- Press `Win + R`, type `services.msc````powershellnpm start

- Find MySQL or MariaDB → click **Stop**

cd SE-library-coffee/pos-web```

### ❌ "Database connection failed"

- Is Window 1 (database) still open? If you closed it, start it again.npm install

- Did you create the `.env` file? Check `backend/.env` exists.

```Backend runs at: **http://localhost:3000**

### ❌ "Port 3000 already in use"

```powershell

netstat -ano | findstr :3000

taskkill /PID <the_number> /FThis will take 1-2 minutes. Wait for it to finish.### 5. Setup Frontend (POS-Web)

```



### ❌ Frontend shows blank page

- Is Window 2 (backend) still open?**Start the frontend:****Open a NEW terminal:**

- Open http://localhost:3000/health in browser

- Should show: `{"status":"healthy","database":"connected"}`



---```powershell```powershell



## 🗂️ Project Foldersnpm run devcd pos-web



``````npm install

SE-library-coffee/

├── backend/           ← API Server (Node.js)npm run dev

│   └── .env          ← YOU create this file (Step 6)

├── pos-web/          ← Website (React + Vite)**What you should see:**```

├── kiosk/            ← Kiosk App (React Native / Expo)

├── mariadb/          ← Database```

│   ├── bin/          ← Programs

│   └── data/         ← Created after initialization  VITE ready in 1234 msFrontend runs at: **http://localhost:5173**

└── LOCAL_SETUP.md    ← This guide

```



---  ➜  Local:   http://localhost:5173/### 6. Login & Test



## ✅ Checklist```



- [ ] Node.js installedOpen browser: **http://localhost:5173**

- [ ] Project cloned from GitHub

- [ ] `mariadb` folder exists in project (USB or download)✅ **Frontend is running at http://localhost:5173**

- [ ] Ran `mariadb-install-db.exe` (data folder created)

- [ ] Window 1: `mysqld.exe --console` running (looks frozen = OK)**Login with:**

- [ ] Window 2: Connected with `mysql.exe -u root`

- [ ] Created database and tables (CREATE DATABASE, SOURCE...)---- **Username:** `admin`

- [ ] Ran `npm install` in backend

- [ ] Created `backend/.env` file- **Password:** `admin123`

- [ ] Ran `node config/seed_users.js`

- [ ] Window 2: `npm start` running (looks frozen = OK)## 🎉 STEP 6: Open & Test!

- [ ] Window 3: `npm run dev` running in pos-web

- [ ] Browser: http://localhost:5173 shows login page## Default Users

- [ ] Can login with admin / admin123

1. Open your web browser

**All done? You're ready to code!** 🎉

2. Go to: **http://localhost:5173**| Role | Username | Password |

3. You should see the login page|------|----------|----------|

| Admin | admin | admin123 |

**Login with these credentials:**| Cashier | cashier | cashier123 |

| Barista | barista | barista123 |

| Username | Password |

|----------|----------|## Common Issues & Solutions

| admin    | admin123 |

### MariaDB Issues

✅ **If you can login, everything is working!**

**❌ Error: "Can't find data directory"**

---

**Solution:** Initialize MariaDB first!

## 📝 Summary - What Should Be Running```powershell

cd mariadb

You should have **3 terminal windows open:**.\bin\mariadb-install-db.exe --datadir=./data

```

1. **MariaDB** - Running `mysqld.exe --console`

2. **Backend** - Running `npm start` (port 3000)---

3. **Frontend** - Running `npm run dev` (port 5173)

**❌ Error: "Port 3306 already in use"**

**All 3 must stay open while using the app!**

**Solution:** Another MySQL/MariaDB is running

---- Option 1: Stop it (Services → MySQL/MariaDB → Stop)

- Option 2: Change port in `backend/.env`: `DB_PORT=3307`

## 🆘 Troubleshooting

---

### Problem: "Can't find data directory"

**❌ MariaDB won't start?**

**Solution:**

```powershell**Check if data folder exists:**

cd mariadb```powershell

.\bin\mariadb-install-db.exe --datadir=./dataTest-Path mariadb/data

``````



---**If False, run initialization:**

```powershell

### Problem: "Port 3306 already in use"cd mariadb

.\bin\mariadb-install-db.exe --datadir=./data

**Solution:** Another database is running. ```



**Option 1:** Stop other MySQL/MariaDB:---

- Windows: Press `Win + R`, type `services.msc`

- Find MySQL or MariaDB, click Stop### Backend Issues



**Option 2:** Use different port in `backend/.env`:**❌ Database connection failed**

```

DB_PORT=3307**Check:**

```1. MariaDB is running (`mysqld.exe --console` terminal is open)

2. `.env` file exists in `backend/` folder

---3. `DB_HOST=localhost` and `DB_PORT=3306`



### Problem: "Port 3000 already in use"---



**Solution:** Find and kill the process:**❌ Port 3000 already in use**

```powershell

netstat -ano | findstr :3000```powershell

taskkill /PID <NUMBER> /F# Find process using port 3000

```netstat -ano | findstr :3000

(Replace `<NUMBER>` with the PID shown)

# Kill the process (replace <PID> with actual number)

---taskkill /PID <PID> /F

```

### Problem: Backend says "Database connection failed"

---

**Check:**

1. Is MariaDB window still open and running?### Frontend Issues

2. Did you create the `.env` file in `backend` folder?

3. Try restarting MariaDB:**❌ Can't connect to backend**

   - Close the mysqld window (Ctrl+C)

   - Run `.\bin\mysqld.exe --console` again**Check:**

1. Backend is running on http://localhost:3000

---2. Open http://localhost:3000/health in browser

3. Should see: `{"status":"healthy","database":"connected"}`

### Problem: Frontend can't connect

---

1. Check backend is running: Open http://localhost:3000/health

2. Should show: `{"status":"healthy","database":"connected"}`**❌ Port 5173 already in use**

3. If not, restart backend (Step 4)

```powershell

---netstat -ano | findstr :5173

taskkill /PID <PID> /F

## 🔄 Working on the Project Again (Next Day)```



**You don't need to reinstall everything!** Just start the servers:---



**Terminal 1 - Start Database:**## Updating Code

```powershell

cd SE-library-coffee/mariadbWhen pulling latest changes from GitHub:

.\bin\mysqld.exe --console

``````bash

# Stop all running servers (Ctrl+C in each terminal)

**Terminal 2 - Start Backend:**

```powershell# Pull latest code

cd SE-library-coffee/backendgit pull origin main

npm start

```# Update backend

cd backend

**Terminal 3 - Start Frontend:**npm install

```powershell

cd SE-library-coffee/pos-web# Update frontend

npm run devcd ../pos-web

```npm install



**Then open http://localhost:5173**# Restart servers (follow steps 4 & 5 again)

```

---

## Project Structure

## 📌 Default Login Accounts

```

| Role     | Username | Password     |SE-library-coffee/

|----------|----------|--------------|├── backend/              # Node.js API Server

| Admin    | admin    | admin123     |│   ├── config/          # Database config & SQL files

| Cashier  | cashier  | cashier123   |│   ├── controllers/     # Business logic

| Barista  | barista  | barista123   |│   ├── routes/          # API endpoints

│   ├── middleware/      # Authentication

---│   ├── .env            # Environment variables (YOU CREATE THIS)

│   └── server.js        # Main entry point

## 🔄 Getting Updates from GitHub│

├── pos-web/             # React Frontend (Vite)

When your team pushes new code:│   ├── src/

│   │   ├── pages/       # App pages

```bash│   │   ├── components/  # Reusable components

# 1. Stop all servers (Ctrl+C in each window)│   │   └── styles/      # CSS files

│   └── .env.development # Auto-created by Vite

# 2. Pull latest code│

git pull origin main├── kiosk/               # React Native Kiosk App (Optional)

│   └── app/             # App screens

# 3. Update backend│

cd backend├── mariadb/             # Portable MariaDB Database

npm install│   ├── bin/             # Executables (mysqld.exe, mysql.exe, etc.)

│   └── data/            # Database files (created after init)

# 4. Update frontend│

cd ../pos-web└── LOCAL_SETUP.md       # This file

npm install```



# 5. Restart servers (see "Working on the Project Again" above)## Quick Checklist

```

- [ ] Repository cloned

---- [ ] MariaDB folder in project root

- [ ] ✅ **MariaDB initialized** (`mariadb-install-db.exe` ran)

## 🗂️ Project Folders Explained- [ ] ✅ **MariaDB server running** (`mysqld.exe --console`)

- [ ] Database `coffee_shop` created

```- [ ] Tables loaded (`coffee_database.sql`)

SE-library-coffee/- [ ] Default users seeded

│- [ ] Backend `.env` file created

├── backend/           ← API Server (Node.js)- [ ] Backend dependencies installed (`npm install`)

│   ├── .env          ← YOU CREATE THIS FILE- [ ] Backend running on port 3000

│   └── server.js     ← Main server file- [ ] Frontend dependencies installed

│- [ ] Frontend running on port 5173

├── pos-web/          ← Website (React)- [ ] Can login with admin credentials

│   └── src/          ← Code files

│## Environment Files Reference

├── mariadb/          ← Database

│   ├── bin/          ← Programs (mysqld.exe, mysql.exe)**backend/.env:**

│   └── data/         ← Database files (created after init)```env

│DB_HOST=localhost

└── LOCAL_SETUP.md    ← This guideDB_PORT=3306

```DB_USER=root

DB_PASSWORD=

---DB_NAME=coffee_shop

DB_SSL=false

## ✅ Complete Setup ChecklistJWT_SECRET=local-secret-key-12345

PORT=3000

Go through this checklist in order:NODE_ENV=development

```

- [ ] Node.js installed on computer

- [ ] Git installed on computer**pos-web/.env.development (auto-created):**

- [ ] Project cloned from GitHub```env

- [ ] MariaDB folder exists in projectVITE_API_URL=http://localhost:3000

- [ ] Ran `mariadb-install-db.exe` (creates data folder)```

- [ ] Started `mysqld.exe --console` (terminal stays open)

- [ ] Connected with `mysql.exe -u root`**pos-web/.env.production:**

- [ ] Ran `CREATE DATABASE coffee_shop;````env

- [ ] Ran `USE coffee_shop;`VITE_API_URL=https://library-coffee-api.onrender.com

- [ ] Ran `SOURCE backend/config/coffee_database.sql;````

- [ ] Ran `npm install` in backend folder

- [ ] Created `backend/.env` file with correct settings---

- [ ] Ran `node config/seed_users.js`

- [ ] Started backend with `npm start` (terminal stays open)## For Cloud Deployment

- [ ] Ran `npm install` in pos-web folder

- [ ] Started frontend with `npm run dev` (terminal stays open)See: **DEPLOYMENT_GUIDE.md**

- [ ] Opened http://localhost:5173 in browser

- [ ] Can login with admin/admin123---



**If all checkboxes are done, you're ready to code!** 🎉**Need Help?** Check the Troubleshooting section above or check:

- Backend terminal for error messages

---- Browser console (F12) for frontend errors

- MariaDB console for database errors

## 📞 Still Need Help?

**Check these:**
1. All 3 terminal windows are open and running
2. No error messages in red text
3. Browser console (press F12) shows no errors

**Common mistakes:**
- Forgetting to run `mariadb-install-db.exe` first
- Closing the database or backend terminal
- Not creating the `.env` file
- Wrong username/password in `.env`

---

**For cloud deployment (Render + Vercel), see:** `DEPLOYMENT_GUIDE.md`
