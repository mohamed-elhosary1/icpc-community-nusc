/**
 * API: POST /api/codeforces/link
 * Links and optionally verifies a Codeforces handle for the authenticated student.
 */

const StudentService = require('../_student');
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    if (req.method !== 'POST') {
        res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
        return res.end ? res.end(JSON.stringify({ error: 'Method not allowed' })) : res.send();
    }

    const token = StudentService.extractTokenFromReq(req);
    const session = StudentService.verifyToken(token);
    if (!session || !session.sub) {
        res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
        return res.end ? res.end(JSON.stringify({ error: 'Authentication required to link Codeforces handle.' })) : res.send();
    }

    try {
        const body = await parseBody(req);
        const { handle } = body;

        if (!handle || typeof handle !== 'string' || handle.trim().length === 0) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            return res.end ? res.end(JSON.stringify({ error: 'Please enter a valid Codeforces handle.' })) : res.send();
        }

        const cleanHandle = handle.trim();

        // 1. Check if another student has already claimed and verified this handle
        const checkUrl = `${SUPABASE_URL}/rest/v1/nusc_users?codeforces_handle=ilike.${encodeURIComponent(cleanHandle)}&id=neq.${encodeURIComponent(session.sub)}&select=id,full_name&limit=1`;
        const checkRes = await fetch(checkUrl, { headers: getHeaders() });
        if (checkRes.ok) {
            const existing = await checkRes.json();
            if (Array.isArray(existing) && existing.length > 0) {
                res.writeHead ? res.writeHead(409, { 'Content-Type': 'application/json' }) : res.status(409);
                return res.end ? res.end(JSON.stringify({
                    error: `The handle "${cleanHandle}" is already linked to another student account. If you believe this is an error, please contact community coaches.`
                })) : res.send();
            }
        }

        // 2. Fetch CF user data to confirm it exists
        const cfData = await CodeforcesService.getUserInfo(cleanHandle);
        if (!cfData) {
            res.writeHead ? res.writeHead(404, { 'Content-Type': 'application/json' }) : res.status(404);
            return res.end ? res.end(JSON.stringify({ error: `Codeforces user "${cleanHandle}" could not be found.` })) : res.send();
        }

        // 3. Retrieve student's verification token
        const user = await StudentService.getUserById(session.sub);
        const challengeToken = user ? user.cf_verification_token : null;

        // 4. Test ownership verification challenge
        let isVerified = false;
        let verifyDetails = null;

        if (challengeToken) {
            const verifyCheck = await CodeforcesService.verifyOwnership(cleanHandle, challengeToken);
            isVerified = verifyCheck.verified;
            verifyDetails = verifyCheck;
        }

        // 5. Update student profile in PostgreSQL
        const patchUrl = `${SUPABASE_URL}/rest/v1/nusc_users?id=eq.${encodeURIComponent(session.sub)}`;
        const patchRes = await fetch(patchUrl, {
            method: 'PATCH',
            headers: Object.assign({}, getHeaders(), { 'Prefer': 'return=representation' }),
            body: JSON.stringify({
                codeforces_handle: cfData.handle,
                cf_verified: isVerified
            })
        });

        if (!patchRes.ok) {
            throw new Error('Database error saving linked handle.');
        }

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        res.end ? res.end(JSON.stringify({
            success: true,
            handle: cfData.handle,
            verified: isVerified,
            rating: cfData.rating,
            rank: cfData.rank,
            solvedCount: cfData.solved_count,
            verificationDetails: verifyDetails
        })) : res.send();

    } catch (err) {
        console.error('[codeforces/link Error]:', err.message);
        res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
        res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
    }
};
