/**
 * API: /api/admin/codeforces
 * Admin endpoint for Codeforces Official API Key, Group Management, and Live Testing.
 */

const DB = require('../_db');
const CodeforcesService = require('../_codeforces');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gpzwlxbmgpmydgywxtdo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zbshKRcot5UDfjvtMJx4gQ_c9a9-of9';

function getHeaders() {
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    };
}

function parseBody(req) {
    return new Promise((resolve) => {
        if (req.body && typeof req.body === 'object') return resolve(req.body);
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try { resolve(JSON.parse(data || '{}')); }
            catch (e) { resolve({}); }
        });
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    const session = DB.requireAuth(req, res);
    if (!session) return;

    // GET /api/admin/codeforces: Retrieve status & config
    if (req.method === 'GET') {
        try {
            const config = await CodeforcesService.getGroupConfig();
            const health = await CodeforcesService.testApiCredentials();

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({
                success: true,
                config,
                health
            })) : res.send({ success: true, config, health });
        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send({ error: e.message });
        }
        return;
    }

    // POST /api/admin/codeforces: Save or test
    if (req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { action, apiKey, apiSecret, groupId, managerHandle, contestId } = body;

            // 1. Live Test
            if (action === 'test') {
                const testResult = await CodeforcesService.testApiCredentials({
                    apiKey,
                    apiSecret,
                    managerHandle
                });
                res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
                return res.end ? res.end(JSON.stringify({ success: true, result: testResult })) : res.send({ success: true, result: testResult });
            }

            // 2. Save Configuration
            if (action === 'save') {
                // If API Key/Secret supplied, verify first
                if (apiKey && apiSecret) {
                    const verification = await CodeforcesService.testApiCredentials({ apiKey, apiSecret, managerHandle });
                    if (!verification.valid) {
                        res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                        return res.end ? res.end(JSON.stringify({
                            error: `Codeforces rejected this API Key and Secret: ${verification.message}`
                        })) : res.send();
                    }
                }

                const saved = await CodeforcesService.saveGroupConfig({
                    apiKey,
                    apiSecret,
                    groupId,
                    managerHandle
                });

                res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
                return res.end ? res.end(JSON.stringify({
                    success: true,
                    message: 'Codeforces Group and API configuration saved successfully.',
                    config: saved
                })) : res.send();
            }

            // 3. Sync all students
            if (action === 'sync-all') {
                const stuRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_users?status=eq.active&select=id,full_name,codeforces_handle`, { headers: getHeaders() });
                const students = stuRes.ok ? await stuRes.json() : [];
                const withHandle = students.filter(s => s.codeforces_handle);

                let syncedCount = 0;
                for (const s of withHandle) {
                    try {
                        await CodeforcesService.getUserInfo(s.codeforces_handle);
                        syncedCount++;
                    } catch (err) {}
                }

                res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
                return res.end ? res.end(JSON.stringify({
                    success: true,
                    message: `Synchronized ${syncedCount} of ${withHandle.length} students from Codeforces.`,
                    total: withHandle.length,
                    synced: syncedCount
                })) : res.send();
            }

            // 4. Fetch Group Standings
            if (action === 'standings') {
                if (!contestId) {
                    res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                    return res.end ? res.end(JSON.stringify({ error: 'contestId is required.' })) : res.send();
                }
                const standings = await CodeforcesService.getGroupStandings(contestId, { asManager: true });
                res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
                return res.end ? res.end(JSON.stringify({ success: true, standings })) : res.send();
            }

            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            res.end ? res.end(JSON.stringify({ error: 'Unknown action specified.' })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send({ error: e.message });
        }
    }
};
