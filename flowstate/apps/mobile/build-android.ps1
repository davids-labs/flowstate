#!/usr/bin/env pwsh
# build-android.ps1 — Build a signed release APK for FlowState (Android)
#
# Usage:
#   cd apps/mobile
#   .\build-android.ps1
#
# Output:
#   android/app/build/outputs/apk/release/app-release.apk
#
# Prerequisites:
#   - Java 17 (Zulu) at C:\Program Files\Zulu\zulu-17
#   - Android SDK at C:\Users\<user>\AppData\Local\Android\Sdk
#   - NDK 27.1.12297006 installed via SDK Manager
#   - android/local.properties must contain: sdk.dir=C:\\Users\\<user>\\AppData\\Local\\Android\\Sdk
#   - Optional for a true release key:
#       FLOWSTATE_UPLOAD_STORE_FILE
#       FLOWSTATE_UPLOAD_STORE_PASSWORD
#       FLOWSTATE_UPLOAD_KEY_ALIAS
#       FLOWSTATE_UPLOAD_KEY_PASSWORD
#     If these are not supplied, Gradle falls back to the debug keystore for local-only release packaging.

Set-StrictMode -Off
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

# ── Environment ───────────────────────────────────────────────────────────────
$env:JAVA_HOME  = "C:\Program Files\Zulu\zulu-17"
$env:NODE_ENV   = "production"
# Tell Expo CLI explicitly where the mobile project root is, so it never
# autodiscovers the monorepo root (which also has a package.json with expo).
$env:EXPO_PROJECT_ROOT = $ScriptDir
# expo-router needs this in a monorepo so its babel plugin can find the app/
# directory relative to the Metro server root (monorepoRoot). Without it,
# require.context resolves to the wrong directory and "No routes found" is thrown.
$env:EXPO_ROUTER_APP_ROOT = "$ScriptDir\app"
# Force Metro to use the mobile project root instead of the workspace root.
$env:EXPO_NO_METRO_WORKSPACE_ROOT = "1"

# ── Build ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "FlowState Android Release Build" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "$ScriptDir\android"

Write-Host "Cleaning previous build artifacts..." -ForegroundColor Yellow
# Remove both build dirs — 'gradlew clean' misses android/build which contains
# autolinking.json and causes stale package name errors.
Remove-Item -Recurse -Force "$ScriptDir\android\build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$ScriptDir\android\app\build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$ScriptDir\android\.gradle" -ErrorAction SilentlyContinue

# Stop any running Gradle daemon so the next build starts a fresh JVM that
# inherits the current environment (EXPO_PROJECT_ROOT, etc.).
Write-Host "Stopping Gradle daemons..." -ForegroundColor Yellow
& "$ScriptDir\android\gradlew.bat" --stop 2>$null

# Clear the Metro bundler cache — stale caches from previous failed builds
# (where the project root was misconfigured) cause phantom resolution errors.
Write-Host "Clearing Metro bundler cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Temp\metro-*" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:USERPROFILE\.metro" -ErrorAction SilentlyContinue

Write-Host "Running Gradle assembleRelease..." -ForegroundColor Yellow
# Temporarily lower ErrorActionPreference so that Gradle's deprecation warnings
# written to stderr don't get promoted to terminating PowerShell errors.
# Actual build failures are still detected via $LASTEXITCODE.
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
.\gradlew assembleRelease
$ErrorActionPreference = $prevEAP
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "BUILD FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

# ── Done ──────────────────────────────────────────────────────────────────────
$apk = Resolve-Path "app\build\outputs\apk\release\app-release.apk"
$sizeMb = [math]::Round((Get-Item $apk).Length / 1MB, 1)

Write-Host ""
Write-Host "BUILD SUCCESSFUL" -ForegroundColor Green
Write-Host "APK: $apk ($sizeMb MB)" -ForegroundColor Green
Write-Host ""
Write-Host "To install on a connected device:" -ForegroundColor Cyan
Write-Host "  adb install -r `"$apk`"" -ForegroundColor White
Write-Host ""
Write-Host "To push an OTA update (JS-only change):" -ForegroundColor Cyan
Write-Host "  eas update --channel production --message `"your message`"" -ForegroundColor White
Write-Host ""
