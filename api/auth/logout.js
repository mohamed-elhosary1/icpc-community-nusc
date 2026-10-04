/**
 * API: POST /api/auth/logout
 * Invalidate Admin Session
 */

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Set-Cookie', 'nusc_admin_token=; Path=/; HttpOnly; Max-Age=0');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        res.end ? res.end() : res.send();
        return;
    }

    res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
    const out = JSON.stringify({ success: true, message: 'Logged out successfully.' });
    res.end ? res.end(out) : res.send(out);
};
