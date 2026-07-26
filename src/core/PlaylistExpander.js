const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const browserDetector = require('./BrowserDetector');

const PLAYLIST_RETRY = {
  MAX_ATTEMPTS: 2,
  BASE_DELAY_MS: 3000
};

function resolveYtdlpPath() {
    const inResources = process.resourcesPath
        ? path.join(process.resourcesPath, 'yt-dlp.exe')
        : null;
    if (inResources && fs.existsSync(inResources)) return inResources;
    const devPath = path.join(__dirname, '..', '..', 'bin', 'yt-dlp.exe');
    if (fs.existsSync(devPath)) return devPath;
    try {
        execSync('yt-dlp --version', { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
        return 'yt-dlp';
    } catch {
        return null;
    }
}

class PlaylistExpander {
    constructor(maxPlaylistSize = 100) {
        this.maxPlaylistSize = maxPlaylistSize;
    }

    _buildAuthArgs() {
        const cookieArgs = browserDetector.getCookieArgs();
        return [
            ...cookieArgs,
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            '--extractor-args', 'youtube:player_client=android,web',
            '--socket-timeout', '30',
            '--retries', '3'
        ];
    }

    _spawnWithRetry(args, attempt = 0) {
        return new Promise((resolve, reject) => {
            const cmd = resolveYtdlpPath() || 'yt-dlp';
            const ytdlp = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

            let stdout = '';
            let stderr = '';

            ytdlp.stdout.on('data', (data) => { stdout += data.toString(); });
            ytdlp.stderr.on('data', (data) => { stderr += data.toString(); });

            ytdlp.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    const errMsg = stderr || `Process exited with code ${code}`;
                    if (
                        attempt < PLAYLIST_RETRY.MAX_ATTEMPTS &&
                        (stderr.toLowerCase().includes('429') ||
                         stderr.toLowerCase().includes('timeout') ||
                         stderr.toLowerCase().includes('connection reset'))
                    ) {
                        const delay = PLAYLIST_RETRY.BASE_DELAY_MS * (0.75 + Math.random() * 0.5);
                        setTimeout(() => {
                            this._spawnWithRetry(args, attempt + 1).then(resolve, reject);
                        }, delay);
                    } else {
                        reject(new Error(errMsg));
                    }
                }
            });

            ytdlp.on('error', reject);
        });
    }

    async expandPlaylist(url) {
        const authArgs = this._buildAuthArgs();
        const args = [
            '--flat-playlist',
            '--print', 'url',
            '--print', 'title',
            ...authArgs,
            url
        ];

        const { stdout, stderr } = await this._spawnWithRetry(args);

        const lines = stdout.trim().split('\n').filter(line => line.trim());
        const videos = [];

        for (let i = 0; i < lines.length; i += 2) {
            if (i + 1 < lines.length) {
                videos.push({
                    url: lines[i].trim(),
                    title: lines[i + 1].trim()
                });
            }
        }

        if (videos.length > this.maxPlaylistSize) {
            throw new Error(`Playlist too large: ${videos.length} videos (max ${this.maxPlaylistSize})`);
        }

        return videos;
    }

    async getPlaylistInfo(url) {
        const authArgs = this._buildAuthArgs();
        const args = [
            '--flat-playlist',
            '--print', '%(playlist_count)s',
            '--print', '%(playlist_title)s',
            ...authArgs,
            url
        ];

        const { stdout } = await this._spawnWithRetry(args);

        const lines = stdout.trim().split('\n');
        return {
            count: parseInt(lines[0]) || 0,
            title: lines[1] || 'Unknown Playlist'
        };
    }
}

module.exports = PlaylistExpander;
