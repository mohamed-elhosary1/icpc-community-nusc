/**
 * API: /api/participants
 * Participant Training Recruitment Registration & Management
 * Integrated with Supabase PostgreSQL (public.nusc_participants).
 */

const DB = require('./_db');
const CloudDB = require('./_cloud');

const ALLOWED_FACULTIES = [
    'Computers and AI',
    'Science',
    'Vet',
    'Pharmacy',
    'Business',
    'Tourism',
    'Sports'
];

function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
}

function validatePhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    const re = /^(\+?20|0020)?0?1[0125]\d{8}$/; // Egyptian mobile standard
    const intlRe = /^\+?[1-9]\d{7,14}$/; // International fallback
    return re.test(cleaned) || intlRe.test(cleaned);
}

function parseBody(req) {
    return new Promise((resolve) => {
        if (req.body && typeof req.body === 'object') {
            return resolve(req.body);
        }
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch (e) {
                resolve({});
            }
        });
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        res.end ? res.end() : res.send();
        return;
    }

    // GET /api/participants
    if (req.method === 'GET') {
        const urlObj = new URL(req.url, 'http://localhost');
        const lookup = urlObj.searchParams.get('id') || urlObj.searchParams.get('lookup') || urlObj.searchParams.get('email') || urlObj.searchParams.get('phone');

        // Public Participant Lookup / Status Check
        if (lookup) {
            try {
                const part = await CloudDB.getParticipantByQuery(lookup);
                if (!part) {
                    res.writeHead ? res.writeHead(404, { 'Content-Type': 'application/json' }) : res.status(404);
                    const out = JSON.stringify({ error: 'No participant registration found matching this query.' });
                    res.end ? res.end(out) : res.send(out);
                    return;
                }
                res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
                const out = JSON.stringify({ success: true, participant: part });
                res.end ? res.end(out) : res.send(out);
                return;
            } catch (err) {
                console.error('[API participant lookup error]:', err.message);
                res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
                res.end ? res.end(JSON.stringify({ error: 'Lookup failed: ' + err.message })) : res.send({ error: err.message });
                return;
            }
        }

        // Admin Listing (Auth required)
        const session = DB.requireAuth(req, res);
        if (!session) return;

        try {
            const list = await CloudDB.getParticipants();
            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            const out = JSON.stringify({
                success: true,
                participants: list,
                count: list.length
            });
            res.end ? res.end(out) : res.send(out);
        } catch (err) {
            console.error('[API participants GET Error]:', err.message);
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: 'Database read failed: ' + err.message })) : res.send({ error: err.message });
        }
        return;
    }

    // POST /api/participants -> Public Registration for Participants
    if (req.method === 'POST') {
        const body = await parseBody(req);
        const {
            fullName,
            phone,
            email,
            faculty,
            academicYear,
            codeforcesHandle,
            level,
            universityConfirmed
        } = body;

        // University Restriction Validation (Server-side enforced)
        if (universityConfirmed !== true && universityConfirmed !== 'true') {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Registration is restricted to students of National University of Sadat City. You must confirm your enrollment to proceed.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        // 1. Validate Full Name
        if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 3) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Please enter your full name (minimum 3 characters).' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        // 2. Validate Phone
        if (!validatePhone(phone)) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Please enter a valid phone number (e.g. 010xxxxxxxx or international format).' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        // 3. Validate Email
        if (!validateEmail(email)) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Please enter a valid email address.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        // 4. Validate Faculty
        if (!faculty || !ALLOWED_FACULTIES.includes(faculty.trim())) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({
                error: `Please select a valid faculty from the allowed list: ${ALLOWED_FACULTIES.join(', ')}`
            });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        // 5. Validate Academic Year
        if (!academicYear || typeof academicYear !== 'string' || !academicYear.trim()) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Please select your academic year / level.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        // 6. Validate Level
        if (!level || typeof level !== 'string' || !level.trim()) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Please select your target training level (Level 1, Level 2, or Level 3).' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        const cleanCf = codeforcesHandle && typeof codeforcesHandle === 'string' ? codeforcesHandle.trim() : null;

        try {
            const savedRecord = await CloudDB.saveParticipant({
                fullName: fullName.trim(),
                phone: phone.trim(),
                email: email.trim().toLowerCase(),
                faculty: faculty.trim(),
                academicYear: academicYear.trim(),
                codeforcesHandle: cleanCf,
                level: level.trim()
            });

            // Local fallback persistence
            try {
                DB.saveRegistration('participant-recruitment-2026', {
                    registrationId: savedRecord.registration_id,
                    fullName: savedRecord.full_name,
                    phone: savedRecord.phone,
                    email: savedRecord.email,
                    faculty: savedRecord.faculty,
                    academicYear: savedRecord.academic_year,
                    codeforcesHandle: savedRecord.codeforces_handle,
                    level: savedRecord.level
                });
            } catch (e) {}

            res.writeHead ? res.writeHead(201, { 'Content-Type': 'application/json' }) : res.status(201);
            const out = JSON.stringify({
                success: true,
                registrationId: savedRecord.registration_id,
                participant: savedRecord
            });
            res.end ? res.end(out) : res.send(out);
        } catch (err) {
            console.error('[API participants POST Error]:', err.message);
            const statusCode = (err.code === 'DUPLICATE_REGISTRATION') ? 409 : 500;
            res.writeHead ? res.writeHead(statusCode, { 'Content-Type': 'application/json' }) : res.status(statusCode);
            const errResponse = JSON.stringify({
                error: err.message,
                code: err.code || 'DB_ERROR',
                existingRegistrationId: err.existingRegistrationId || null
            });
            res.end ? res.end(errResponse) : res.send(errResponse);
        }
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end(JSON.stringify({ error: 'Method not allowed' })) : res.send({ error: 'Method not allowed' });
};
