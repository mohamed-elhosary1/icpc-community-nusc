/**
 * API: /api/registrations
 * Event Registrations Endpoint (Supabase PostgreSQL Persistence)
 * Handles real event signups, server-side university validation, duplicate prevention,
 * unique registration ID issuance, and authorized admin data retrieval.
 */

const DB = require('./_db');
const CloudDB = require('./_cloud');

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

function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
}

function validatePhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const clean = phone.replace(/[\s\-\(\)\+]/g, '');
    return clean.length >= 8 && clean.length <= 16;
}

const ALLOWED_FACULTIES = [
    'Vet',
    'Pharmacy',
    'Science',
    'Computers and AI',
    'Business',
    'Tourism',
    'Sports'
];

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        res.end ? res.end() : res.send();
        return;
    }

    // GET /api/registrations?eventId=... -> Admin View
    if (req.method === 'GET') {
        const session = DB.requireAuth(req, res);
        if (!session) return;

        try {
            const url = new URL(req.url, 'http://localhost');
            const eventId = url.searchParams.get('eventId');
            const code = url.searchParams.get('code');

            if (code) {
                const single = await CloudDB.getRegistrationByCode(code);
                res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
                res.end ? res.end(JSON.stringify({ registration: single })) : res.send({ registration: single });
                return;
            }

            const regs = await CloudDB.getEventRegistrations(eventId);
            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            const out = JSON.stringify({
                registrations: regs,
                count: regs.length,
                eventId: eventId || 'all'
            });
            res.end ? res.end(out) : res.send(out);
        } catch (err) {
            console.error('[API registrations GET Error]:', err.message);
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: 'Database read failed: ' + err.message })) : res.send({ error: err.message });
        }
        return;
    }

    // POST /api/registrations -> Public Signup for Event
    if (req.method === 'POST') {
        const body = await parseBody(req);
        const {
            fullName,
            phone,
            email,
            academicYear,
            faculty,
            isNuscStudent,
            eventId
        } = body;

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

        // 4. Validate Academic Year
        if (!academicYear || typeof academicYear !== 'string' || !academicYear.trim()) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Please select your academic level / year.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        // 5. Validate Faculty (Strictly matching required faculties)
        if (!faculty || !ALLOWED_FACULTIES.includes(faculty.trim())) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({
                error: `Please select a valid faculty from the allowed list: ${ALLOWED_FACULTIES.join(', ')}`
            });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        // 6. Strict University Restriction (National University of Sadat City)
        if (isNuscStudent !== true && body.is_nusc_student !== true) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({
                error: 'Registration is restricted exclusively to students of the National University of Sadat City (NUSC).'
            });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        const targetEventId = eventId || 'orientation-session-2026';

        try {
            const savedRecord = await CloudDB.saveEventRegistration({
                fullName: fullName.trim(),
                phone: phone.trim(),
                email: email.trim().toLowerCase(),
                academicYear: academicYear.trim(),
                faculty: faculty.trim(),
                isNuscStudent: true,
                eventId: targetEventId
            });

            res.writeHead ? res.writeHead(201, { 'Content-Type': 'application/json' }) : res.status(201);
            const out = JSON.stringify({
                success: true,
                registrationId: savedRecord.registration_id,
                registration: savedRecord
            });
            res.end ? res.end(out) : res.send(out);
        } catch (err) {
            console.error('[API registrations POST Error]:', err.message);
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
