# WagWalk Mobile App Publishing Guide

## Overview
WagWalk is configured with Capacitor to be published as a native mobile app on the Apple App Store and Google Play Store.

## Prerequisites

### For iOS (App Store)
- Apple Developer Account ($99/year) - https://developer.apple.com
- Mac computer with Xcode installed
- iOS device or simulator for testing

### For Android (Play Store)  
- Google Play Developer Account ($25 one-time) - https://play.google.com/console
- Android Studio installed
- Android device or emulator for testing

---

## Step 1: Build the Web App

```bash
cd /app/frontend
yarn build
```

## Step 2: Initialize Native Projects

### Add iOS Project
```bash
yarn cap:add:ios
```

### Add Android Project
```bash
yarn cap:add:android
```

## Step 3: Sync Web Assets
```bash
yarn cap:sync
```

---

## iOS App Store Submission

### 1. Open Xcode
```bash
yarn cap:open:ios
```

### 2. Configure App in Xcode
- Select your Team (Apple Developer account)
- Set Bundle Identifier: `com.wagwalk.app`
- Set Version: `1.0.0`
- Set Build: `1`

### 3. Replace App Icons
- Open `ios/App/App/Assets.xcassets/AppIcon.appiconset`
- Replace placeholder icons with your final designs
- Required sizes: 20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024

### 4. Create App Store Connect Listing
1. Go to https://appstoreconnect.apple.com
2. Create new app
3. Fill in app details:
   - Name: WagWalk - Pet Care
   - Subtitle: Dog Walking & Pet Sitting
   - Category: Business / Lifestyle
   - Privacy Policy URL (required)
4. Upload screenshots for each device size

### 5. Archive & Submit
1. In Xcode: Product → Archive
2. Distribute App → App Store Connect
3. Submit for Review

**Review Time:** 1-7 days typically

---

## Android Play Store Submission

### 1. Open Android Studio
```bash
yarn cap:open:android
```

### 2. Configure App
- Update `android/app/build.gradle`:
  - applicationId: "com.wagwalk.app"
  - versionCode: 1
  - versionName: "1.0.0"

### 3. Replace App Icons
- Open `android/app/src/main/res`
- Replace icons in mipmap folders:
  - mipmap-mdpi (48x48)
  - mipmap-hdpi (72x72)
  - mipmap-xhdpi (96x96)
  - mipmap-xxhdpi (144x144)
  - mipmap-xxxhdpi (192x192)

### 4. Generate Signed APK/Bundle
1. In Android Studio: Build → Generate Signed Bundle/APK
2. Create new keystore (save securely!)
3. Select "Android App Bundle"
4. Choose "release" build variant

### 5. Create Play Console Listing
1. Go to https://play.google.com/console
2. Create new app
3. Fill in store listing:
   - App name: WagWalk - Pet Care
   - Short description: Professional dog walking & pet sitting management
   - Full description: (detailed app description)
   - Category: Business
   - Privacy Policy URL (required)
4. Upload screenshots and feature graphic

### 6. Upload & Submit
1. Upload AAB file to Production track
2. Complete Content Rating questionnaire
3. Set up Pricing (Free with in-app purchases)
4. Submit for Review

**Review Time:** 1-3 days typically

---

## App Icon Requirements

### iOS
- 1024x1024 App Store icon (no alpha)
- Various sizes for device icons

### Android
- 512x512 Play Store icon
- Adaptive icon with foreground/background layers

### Design Tips
- Use the WagWalk orange (#f97316)
- Include paw print logo
- Ensure icon is recognizable at small sizes

---

## In-App Purchases Setup

### iOS (App Store Connect)
1. Go to Features → In-App Purchases
2. Create subscription:
   - Reference Name: WagWalk Premium Monthly
   - Product ID: com.wagwalk.premium.monthly
   - Price: $14.99
3. Create yearly:
   - Reference Name: WagWalk Premium Yearly
   - Product ID: com.wagwalk.premium.yearly
   - Price: $149.00

### Android (Play Console)
1. Go to Monetize → Products → Subscriptions
2. Create subscription:
   - Product ID: premium_monthly
   - Name: WagWalk Premium Monthly
   - Price: $14.99/month
3. Create yearly:
   - Product ID: premium_yearly
   - Name: WagWalk Premium Yearly  
   - Price: $149.00/year

---

## Testing Before Submission

### TestFlight (iOS)
1. Archive app and upload to App Store Connect
2. Add internal/external testers
3. Distribute TestFlight build

### Internal Testing (Android)
1. Upload to Internal Testing track
2. Add testers via email
3. Share opt-in link

---

## Support & Updates

After approval:
- Monitor crash reports
- Respond to user reviews
- Push updates via same process
- Maintain Privacy Policy

---

## Capacitor Configuration

The app is configured in `capacitor.config.json`:
- App ID: `com.wagwalk.app`
- App Name: `WagWalk`
- Theme Color: `#f97316` (WagWalk Orange)

## Files Modified for Mobile
- `/public/manifest.json` - PWA manifest
- `/public/index.html` - Mobile meta tags
- `/public/service-worker.js` - Offline support
- `/public/icons/` - App icons
- `/capacitor.config.json` - Capacitor config
