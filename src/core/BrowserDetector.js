const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BROWSER_PROFILES = [
  {
    id: 'chrome',
    name: 'Google Chrome',
    winPaths: [
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
    ],
    macPaths: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linuxBins: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  },
  {
    id: 'edge',
    name: 'Microsoft Edge',
    winPaths: [
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ],
    macPaths: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    linuxBins: ['microsoft-edge', 'microsoft-edge-stable']
  },
  {
    id: 'firefox',
    name: 'Mozilla Firefox',
    winPaths: [
      path.join(process.env.PROGRAMFILES || '', 'Mozilla Firefox', 'firefox.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Mozilla Firefox', 'firefox.exe')
    ],
    macPaths: ['/Applications/Firefox.app/Contents/MacOS/firefox'],
    linuxBins: ['firefox']
  },
  {
    id: 'brave',
    name: 'Brave',
    winPaths: [
      path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      path.join(process.env.PROGRAMFILES || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
    ],
    macPaths: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
    linuxBins: ['brave-browser', 'brave']
  },
  {
    id: 'opera',
    name: 'Opera',
    winPaths: [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Opera', 'opera.exe'),
      path.join(process.env.APPDATA || '', 'Opera Software', 'Opera Stable', 'opera.exe')
    ],
    macPaths: ['/Applications/Opera.app/Contents/MacOS/Opera'],
    linuxBins: ['opera']
  }
];

class BrowserDetector {
  constructor() {
    this._cache = null;
    this._cacheTime = 0;
    this._cacheTTL = 30000;
  }

  detect() {
    const now = Date.now();
    if (this._cache !== undefined && (now - this._cacheTime) < this._cacheTTL) {
      return this._cache;
    }

    const platform = process.platform;
    let result = null;

    for (const profile of BROWSER_PROFILES) {
      if (this._isAvailable(profile, platform)) {
        result = { id: profile.id, name: profile.name };
        break;
      }
    }

    this._cache = result;
    this._cacheTime = now;
    return result;
  }

  getCookieArgs() {
    const browser = this.detect();
    if (!browser) return [];
    return ['--cookies-from-browser', browser.id];
  }

  _isAvailable(profile, platform) {
    try {
      if (platform === 'win32') {
        return profile.winPaths.some(p => p && fs.existsSync(p));
      }
      if (platform === 'darwin') {
        return profile.macPaths.some(p => fs.existsSync(p));
      }
      return profile.linuxBins.some(bin => {
        try {
          execSync(`which ${bin}`, { stdio: 'pipe', timeout: 3000 });
          return true;
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  invalidateCache() {
    this._cache = undefined;
    this._cacheTime = 0;
  }
}

module.exports = new BrowserDetector();
