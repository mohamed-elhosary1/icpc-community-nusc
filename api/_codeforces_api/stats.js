/**
 * API: GET /api/codeforces/stats
 * Returns Codeforces statistics, rating, solved problems, and recent activity.
 */

const CodeforcesService = require('../_codeforces');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    if (req.method !== 'GET') {
        res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
        return res.end ? res.end(JSON.stringify({ error: 'Method not allowed' })) : res.send();
    }

    try {
        const urlObj = new URL(req.url, 'http://localhost');
        const handle = urlObj.searchParams.get('handle');

        if (!handle) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            return res.end ? res.end(JSON.stringify({ error: 'Codeforces handle parameter is required.' })) : res.send();
        }

        const data = await CodeforcesService.getUserInfo(handle);
        if (!data) {
            res.writeHead ? res.writeHead(404, { 'Content-Type': 'application/json' }) : res.status(404);
            return res.end ? res.end(JSON.stringify({ error: 'Codeforces statistics could not be loaded.' })) : res.send();
        }

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        res.end ? res.end(JSON.stringify({ success: true, stats: data })) : res.send({ success: true, stats: data });

    } catch (err) {
        res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
        res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
    }
};
