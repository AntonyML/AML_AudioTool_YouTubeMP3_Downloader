// PlaylistExpander.js - Expande playlists en canciones individuales
// Evita saturación del sistema con múltiples playlists

const { spawn } = require('child_process');

class PlaylistExpander {
    constructor(maxPlaylistSize = 100) {
        this.maxPlaylistSize = maxPlaylistSize;
    }

    async expandPlaylist(url) {
        return new Promise((resolve, reject) => {
            const args = [
                '--flat-playlist',
                '--print', 'url',
                '--print', 'title',
                url
            ];

            const ytdlp = spawn('yt-dlp', args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            ytdlp.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            ytdlp.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(stderr || `Failed to expand playlist (code ${code})`));
                }

                try {
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
                        return reject(new Error(`Playlist too large: ${videos.length} videos (max ${this.maxPlaylistSize})`));
                    }

                    resolve(videos);
                } catch (error) {
                    reject(new Error(`Failed to parse playlist: ${error.message}`));
                }
            });

            ytdlp.on('error', (error) => {
                reject(error);
            });
        });
    }

    async getPlaylistInfo(url) {
        return new Promise((resolve, reject) => {
            const args = [
                '--flat-playlist',
                '--print', '%(playlist_count)s',
                '--print', '%(playlist_title)s',
                url
            ];

            const ytdlp = spawn('yt-dlp', args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            ytdlp.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            ytdlp.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(stderr || `Failed to get playlist info (code ${code})`));
                }

                const lines = stdout.trim().split('\n');
                resolve({
                    count: parseInt(lines[0]) || 0,
                    title: lines[1] || 'Unknown Playlist'
                });
            });

            ytdlp.on('error', (error) => {
                reject(error);
            });
        });
    }
}

module.exports = PlaylistExpander;
