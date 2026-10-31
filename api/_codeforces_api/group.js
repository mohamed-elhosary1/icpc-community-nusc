/**
 * API: GET /api/codeforces/group
 * Returns public/portal group details, official link, and optional group contest standings.
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
        const config = await CodeforcesService.getGroupConfig();
        const urlObj = new URL(req.url, 'http://localhost');
        const contestId = urlObj.searchParams.get('contestId');

        let standings = null;
        if (contestId) {
            try {
                standings = await CodeforcesService.getGroupStandings(contestId, { asManager: true });
            } catch (err) {
                // Return null standings on failure
            }
        }

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        res.end ? res.end(JSON.stringify({
            success: true,
            group: {
                groupId: config.groupId,
                groupUrl: config.groupUrl,
                managerHandle: config.managerHandle,
                isConfigured: config.configured
            },
            standings
        })) : res.send({
            success: true,
            group: {
                groupId: config.groupId,
                groupUrl: config.groupUrl,
                managerHandle: config.managerHandle,
                isConfigured: config.configured
            },
            standings
        });

    } catch (e) {
        res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
        res.end ? res.end(JSON.stringify({ error: e.message })) : res.send({ error: e.message });
    }
};
