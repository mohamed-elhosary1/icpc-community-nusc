/**
 * API: POST /api/auth/validate-code
 * Validates orientation / participant event access codes before registration.
 */

const StudentService = require('../_student');

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
        res.end ? res.end() : res.send();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
        const err = JSON.stringify({ error: 'Method not allowed' });
        res.end ? res.end(err) : res.send(err);
        return;
    }

    try {
        const body = await parseBody(req);
        const { code } = body;

        if (!code) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            return res.end ? res.end(JSON.stringify({ error: 'Please enter your event registration code.' })) : res.send({ error: 'Please enter your event registration code.' });
        }

        const result = await StudentService.validateCode(code);

        if (!result.valid) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            return res.end ? res.end(JSON.stringify(result)) : res.send(result);
        }

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({
            success: true,
            valid: true,
            code: result.code,
            fullName: result.fullName,
            maskedEmail: result.maskedEmail,
            faculty: result.faculty,
            academicYear: result.academicYear,
            wave: result.wave
        });
        res.end ? res.end(out) : res.send(out);

    } catch (err) {
        console.error('[validate-code Error]:', err.message);
        res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
        res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
    }
};
