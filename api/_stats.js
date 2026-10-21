/**
 * API: /api/stats
 * Real-time Dashboard Statistics
 * Calculated dynamically from actual production database records in PostgreSQL.
 */

const CloudDB = require('./_cloud');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        res.end ? res.end() : res.send();
        return;
    }

    if (req.method !== 'GET') {
        res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
        res.end ? res.end(JSON.stringify({ error: 'Method not allowed' })) : res.send({ error: 'Method not allowed' });
        return;
    }

    try {
        const stats = await CloudDB.getCalculatedStats();
        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify(stats);
        res.end ? res.end(out) : res.send(out);
    } catch (err) {
        console.error('[API stats Error]:', err.message);
        res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
        res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
    }
};
