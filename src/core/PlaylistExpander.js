const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const browserDetector = require('./BrowserDetector');
const logger = require('./Logger');

const log = logger.child('PlaylistExpander');

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
            log.info(`Spawning yt-dlp (intento ${attempt + 1}/${PLAYLIST_RETRY.MAX_ATTEMPTS + 1})`);
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
                    log.warn(`Código ${code}:`, errMsg.substring(0, 200));
                    if (
                        attempt < PLAYLIST_RETRY.MAX_ATTEMPTS &&
                        (stderr.toLowerCase().includes('429') ||
                         stderr.toLowerCase().includes('timeout') ||
                         stderr.toLowerCase().includes('connection reset'))
                    ) {
                        const delay = PLAYLIST_RETRY.BASE_DELAY_MS * (0.75 + Math.random() * 0.5);
                        log.info(`Retry playlist en ${Math.round(delay)}ms`);
                        setTimeout(() => {
                            this._spawnWithRetry(args, attempt + 1).then(resolve, reject);
                        }, delay);
                    } else {
                        log.error('Error fatal en playlist:', errMsg.substring(0, 300));
                        reject(new Error(errMsg));
                    }
                }
            });

            ytdlp.on('error', (error) => {
                log.error('Spawn error en playlist:', error.message);
                reject(error);
            });
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

        log.info('Expandiendo playlist:', url.substring(0, 80));
        const { stdout } = await this._spawnWithRetry(args);

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
            log.warn('Playlist excede límite:', videos.length);
            throw new Error(`Playlist too large: ${videos.length} videos (max ${this.maxPlaylistSize})`);
        }

        log.info(`Playlist expandida: ${videos.length} videos`);
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

        log.info('Obteniendo info de playlist:', url.substring(0, 80));
        const { stdout } = await this._spawnWithRetry(args);

        const lines = stdout.trim().split('\n');
        const info = {
            count: parseInt(lines[0]) || 0,
            title: lines[1] || 'Unknown Playlist'
        };

        log.info(`Playlist: "${info.title}" (${info.count} videos)`);
        return info;
    }
}

module.exports = PlaylistExpander;
