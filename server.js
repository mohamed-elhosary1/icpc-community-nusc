/**
 * ICPC NUSC — Unified Local Node.js Development Server
 * Serves static files and routes /api/* to serverless handlers.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.otf': 'font/otf',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(reqUrl.pathname);

    // 1. Route API Requests
    if (pathname.startsWith('/api/')) {
        const cleanApiPath = pathname.replace('/api/', '').replace(/\/$/, '');
        
        let handlerFile = null;
        const candidateFiles = [
            path.join(BASE_DIR, 'api', cleanApiPath + '.js'),
            path.join(BASE_DIR, 'api', cleanApiPath, 'index.js'),
            path.join(BASE_DIR, 'api', cleanApiPath)
        ];

        for (const cand of candidateFiles) {
            try {
                if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
                    handlerFile = cand;
                    break;
                }
            } catch (e) {}
        }

        // Legacy alias fallbacks
        if (!handlerFile) {
            if (cleanApiPath.startsWith('applications')) handlerFile = path.join(BASE_DIR, 'api', 'applications.js');
            else if (cleanApiPath.startsWith('events')) handlerFile = path.join(BASE_DIR, 'api', 'events.js');
            else if (cleanApiPath.startsWith('registrations')) handlerFile = path.join(BASE_DIR, 'api', 'registrations.js');
            else if (cleanApiPath.startsWith('participants')) handlerFile = path.join(BASE_DIR, 'api', 'participants.js');
            else if (cleanApiPath.startsWith('questions')) handlerFile = path.join(BASE_DIR, 'api', 'questions.js');
            else if (cleanApiPath === 'stats') handlerFile = path.join(BASE_DIR, 'api', 'stats.js');
        }

        if (handlerFile) {
            try {
                // Clear require cache in development for instant hot-reload
                delete require.cache[require.resolve(handlerFile)];
                const handler = require(handlerFile);
                return await handler(req, res);
            } catch (err) {
                console.error('API Error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Internal server error', details: err.message }));
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'API endpoint not found' }));
        }
    }

    // 2. Redirect /events to home
    if (pathname === '/events' || pathname.startsWith('/events/')) {
        res.writeHead(302, { 'Location': '/' });
        return res.end();
    }

    // 3. Route Static Files
    let filePath = path.join(BASE_DIR, pathname);

    // Clean URL / trailing slash handling
    try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        } else if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
            filePath = filePath + '.html';
        }
    } catch (e) {}

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    } else {
        // 404 Fallback
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 Not Found</h1><p>The requested file does not exist.</p>');
    }
});

server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  ICPC NUSC Server running at http://localhost:${PORT}`);
    console.log(`  Admin Login:  http://localhost:${PORT}/admin/login`);
    console.log(`  Admin Portal: http://localhost:${PORT}/admin`);
    console.log(`  Public Site:  http://localhost:${PORT}/`);
    console.log(`======================================================\n`);
});
