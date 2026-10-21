/**
 * API: /api/admin/codes
 * GET: Lists event registration codes and redemption status.
 * POST: CSV Import workflow for event registrations.
 * PATCH: Revoke or reassign codes.
 */

const DB = require('../_db');
const crypto = require('crypto');

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

function generateRegistrationId(prefix = 'NUSC-OS26-') {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    const bytes = crypto.randomBytes(5);
    for (let i = 0; i < 5; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return prefix + code;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    const session = DB.requireAuth(req, res);
    if (!session) return;

    // GET: List codes
    if (req.method === 'GET') {
        try {
            const urlObj = new URL(req.url, 'http://localhost');
            const eventId = urlObj.searchParams.get('eventId') || 'orientation-session-2026';
            const status = urlObj.searchParams.get('status'); // all, redeemed, available, revoked

            let queryUrl = `${SUPABASE_URL}/rest/v1/nusc_event_registrations?select=*&order=created_at.desc`;
            if (eventId !== 'All') {
                queryUrl += `&event_id=eq.${encodeURIComponent(eventId)}`;
            }

            const resRegs = await fetch(queryUrl, { headers: getHeaders() });
            const list = resRegs.ok ? await resRegs.json() : [];

            let filtered = list;
            if (status === 'redeemed') {
                filtered = list.filter(r => r.is_redeemed);
            } else if (status === 'available') {
                filtered = list.filter(r => !r.is_redeemed && r.status !== 'revoked');
            } else if (status === 'revoked') {
                filtered = list.filter(r => r.status === 'revoked');
            }

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({
                success: true,
                total: list.length,
                redeemedCount: list.filter(r => r.is_redeemed).length,
                availableCount: list.filter(r => !r.is_redeemed && r.status !== 'revoked').length,
                revokedCount: list.filter(r => r.status === 'revoked').length,
                codes: filtered
            })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    // POST: CSV Import
    if (req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { records, eventId, defaultWave } = body;

            if (!Array.isArray(records) || records.length === 0) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'No records provided for import.' })) : res.send();
            }

            const targetEvent = eventId || 'orientation-session-2026';
            const wave = defaultWave || 'Wave 1';

            // Fetch existing emails to prevent duplicate insertion
            const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_event_registrations?event_id=eq.${encodeURIComponent(targetEvent)}&select=email,registration_id`, { headers: getHeaders() });
            const existing = existingRes.ok ? await existingRes.json() : [];
            const existingEmails = new Set(existing.map(e => (e.email || '').toLowerCase()));

            const existingCodes = new Set(existing.map(e => (e.registration_id || '').toUpperCase()));

            const inserted = [];
            const skippedDuplicates = [];

            for (const r of records) {
                const cleanEmail = (r.email || '').trim().toLowerCase();
                const cleanName = (r.fullName || r.full_name || r.name || '').trim();
                const cleanPhone = (r.phone || '').trim();
                const cleanFaculty = (r.faculty || 'Computers and AI').trim();
                const cleanYear = (r.academicYear || r.academic_year || 'First Year').trim();
                const rowWave = r.wave || wave;
                const customCode = (r.code || r.registration_id || r.registrationId || '').trim().toUpperCase();

                if (!cleanEmail || !cleanName) continue;

                if (existingEmails.has(cleanEmail)) {
                    skippedDuplicates.push({ email: cleanEmail, name: cleanName, reason: 'Email already exists for this event' });
                    continue;
                }

                if (customCode && existingCodes.has(customCode)) {
                    skippedDuplicates.push({ email: cleanEmail, name: cleanName, reason: `Registration code ${customCode} already exists` });
                    continue;
                }

                const regId = customCode || generateRegistrationId();
                const newRecord = {
                    registration_id: regId,
                    event_id: targetEvent,
                    full_name: cleanName,
                    email: cleanEmail,
                    phone: cleanPhone,
                    academic_year: cleanYear,
                    faculty: cleanFaculty,
                    wave: rowWave,
                    is_nusc_student: true,
                    status: 'confirmed',
                    is_redeemed: false,
                    created_at: new Date().toISOString()
                };

                const postRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_event_registrations`, {
                    method: 'POST',
                    headers: Object.assign({}, getHeaders(), { 'Prefer': 'return=representation' }),
                    body: JSON.stringify(newRecord)
                });

                if (postRes.ok) {
                    existingEmails.add(cleanEmail);
                    existingCodes.add(regId);
                    inserted.push({ code: regId, email: cleanEmail, name: cleanName });
                }
            }

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({
                success: true,
                importedCount: inserted.length,
                skippedCount: skippedDuplicates.length,
                imported: inserted,
                skipped: skippedDuplicates
            })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    // PATCH: Revoke code
    if (req.method === 'PATCH') {
        try {
            const body = await parseBody(req);
            const { registrationId, status } = body;

            if (!registrationId) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'registrationId is required' })) : res.send();
            }

            const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_event_registrations?registration_id=eq.${encodeURIComponent(registrationId)}`, {
                method: 'PATCH',
                headers: Object.assign({}, getHeaders(), { 'Prefer': 'return=representation' }),
                body: JSON.stringify({ status: status || 'revoked' })
            });

            if (!patchRes.ok) throw new Error('Database error updating code.');

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, message: `Code ${registrationId} status updated to ${status || 'revoked'}.` })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end() : res.send();
};
