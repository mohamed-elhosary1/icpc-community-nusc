/**
 * API: GET /api/auth/me
 * Retrieves the current authenticated user's profile and active session state.
 */

const StudentService = require('../_student');
const DB = require('../_db');

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
        const err = JSON.stringify({ error: 'Method not allowed' });
        res.end ? res.end(err) : res.send(err);
        return;
    }

    const token = StudentService.extractTokenFromReq(req);
    if (!token) {
        res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
        return res.end ? res.end(JSON.stringify({ error: 'No active session found.' })) : res.send({ error: 'No active session found.' });
    }

    // Check if admin token
    const adminSession = DB.verifySessionToken(token);
    if (adminSession) {
        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        return res.end ? res.end(JSON.stringify({
            authenticated: true,
            isAdmin: true,
            user: {
                id: 'admin_master',
                username: DB.ADMIN_USERNAME,
                fullName: 'ICPC NUSC Administrator',
                role: 'admin',
                email: 'admin@icpc-nusc.org'
            }
        })) : res.send();
    }

    // Verify student token
    const studentSession = StudentService.verifyToken(token);
    if (!studentSession) {
        res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
        return res.end ? res.end(JSON.stringify({ error: 'Session expired or invalid.' })) : res.send({ error: 'Session expired or invalid.' });
    }

    try {
        const user = await StudentService.getUserById(studentSession.sub);
        if (!user || user.status === 'suspended') {
            res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
            return res.end ? res.end(JSON.stringify({ error: 'User account not active.' })) : res.send({ error: 'User account not active.' });
        }

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({
            authenticated: true,
            isAdmin: user.role === 'admin',
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                wave: user.wave,
                registrationCode: user.registration_code,
                codeforcesHandle: user.codeforces_handle,
                cfVerified: user.cf_verified,
                cfVerificationToken: user.cf_verification_token,
                avatarUrl: user.avatar_url,
                bio: user.bio,
                faculty: user.faculty,
                academicYear: user.academic_year,
                createdAt: user.created_at
            }
        });
        res.end ? res.end(out) : res.send(out);

    } catch (e) {
        res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
        res.end ? res.end(JSON.stringify({ error: e.message })) : res.send({ error: e.message });
    }
};
