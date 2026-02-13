# 📱 Library Cafe Kiosk - APK Build Guide

## Prerequisites

1. **Node.js** installed (you already have this)
2. **Expo account** - Create one at https://expo.dev
3. **EAS CLI** - Install globally

## Step 1: Install EAS CLI

Open terminal in the kiosk folder and run:

```bash
npm install -g eas-cli
```

## Step 2: Login to Expo

```bash
eas login
```

Enter your Expo account credentials.

## Step 3: Configure Your Project

```bash
eas build:configure
```

This will set up your project for building. It may ask you some questions - just follow the prompts.

## Step 4: Build APK

### For Testing (Preview Build):
```bash
eas build -p android --profile preview
```

### For Production:
```bash
eas build -p android --profile production
```

### For Google Play Store (AAB format):
```bash
eas build -p android --profile production-aab
```

## Step 5: Download APK

After the build completes (usually 10-20 minutes), you'll get a download link in your terminal or at https://expo.dev

## 🔧 Configuration Files

### Environment Setup (`config/environment.js`)
Change the API URL here to match your backend server IP:

```javascript
const ENV = {
  development: {
    API_URL: 'http://YOUR_COMPUTER_IP:3000/api',
  },
  production: {
    API_URL: 'http://YOUR_COMPUTER_IP:3000/api',
  },
};
```

To find your computer's IP:
- Open Command Prompt
- Run: `ipconfig`
- Look for "IPv4 Address" under your WiFi adapter

### App Settings (`app.json`)
- `name`: Display name on device
- `version`: App version (update for each release)
- `android.versionCode`: Must increment for each Play Store upload

## 🖼️ Required Assets

Before building, add these images to `assets/images/`:

| File | Size | Description |
|------|------|-------------|
| `icon.png` | 1024x1024 | App icon |
| `adaptive-icon.png` | 1024x1024 | Android adaptive icon (foreground) |
| `splash-icon.png` | 200x200 | Splash screen logo |
| `favicon.png` | 48x48 | Web favicon |

## 📋 Build Profiles

| Profile | Output | Use Case |
|---------|--------|----------|
| `preview` | APK | Testing on devices |
| `production` | APK | Direct installation |
| `production-aab` | AAB | Google Play Store upload |

## ⚠️ Important Notes

### For In-Store Kiosk Use:
- The APK will work on any Android tablet
- The tablet must be connected to the same WiFi as your backend server
- Make sure your backend computer has a static IP address

### For Google Play Store:
1. You need a Google Play Developer account ($25 one-time fee)
2. Your backend must be hosted publicly with HTTPS
3. You need a privacy policy URL
4. First upload should use AAB format (`production-aab` profile)

## 🐛 Troubleshooting

### "Cannot connect to server"
- Check if backend is running
- Verify the IP address in `config/environment.js`
- Ensure tablet and backend are on same WiFi

### Build fails
- Run `npx expo-doctor` to check for issues
- Ensure all dependencies are installed: `npm install`

### Icons not showing
- Make sure all required images exist in `assets/images/`
- Images must be PNG format
- Adaptive icon should have transparent background

## 📞 Quick Commands Reference

```bash
# Check project health
npx expo-doctor

# Start development server
npm start

# Build preview APK
eas build -p android --profile preview

# Build production APK
eas build -p android --profile production

# Build for Play Store
eas build -p android --profile production-aab

# Check build status
eas build:list
```
