# Next Steps for macOS Code Signing

## 1. Get Apple Developer Account

- Go to [developer.apple.com](https://developer.apple.com)
- Sign up for paid account ($99/year)
- Wait for approval (usually same day)

## 2. Create Your Certificate

- Sign in to [Apple Developer](https://developer.apple.com/account)
- Go to Certificates → Create new certificate
- Choose "Developer ID Application"
- Follow the prompts to create and download
- Double-click the .cer file to install it

## 3. Set Up Your Computer

Add these to your `~/.zshrc`:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="your-email@icloud.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # app-specific password
export APPLE_TEAM_ID="YOURTEAMID"
```

To get app-specific password:

- Go to [appleid.apple.com](https://appleid.apple.com)
- Sign-In & Security → App-Specific Passwords → Generate

## 4. Test Locally

First check your setup:

```bash
./scripts/check-signing-setup.sh
```

Then try building (if build works):

```bash
./scripts/test-tauri-signing.sh
```

## 5. Set Up GitHub

Add these secrets to your repo (Settings → Secrets → Actions):

- `APPLE_CERTIFICATE` (base64 encoded .p12 file)
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

## 6. Create a Release

```bash
git tag app-v1.0.0
git push origin app-v1.0.0
```

GitHub Actions will automatically build, sign, notarize, and release your app.

---

That's it! The app will be properly signed and notarized for distribution.
