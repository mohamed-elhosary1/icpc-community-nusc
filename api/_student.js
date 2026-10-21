/**
 * ICPC NUSC — Student & Community Data Engine
 * Handles student authentication, code verification, waves, Codeforces sync,
 * sessions, attendance, mentor feedback, and community chat.
 */

const crypto = require('crypto');
const CloudDB = require('./_cloud');
const DB = require('./_db');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gpzwlxbmgpmydgywxtdo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zbshKRcot5UDfjvtMJx4gQ_c9a9-of9';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'nusc_sec_2026_98741352_auth_secret_key';

function getHeaders(preferRepresentation = true) {
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    };
    if (preferRepresentation) {
        headers['Prefer'] = 'return=representation';
    }
    return headers;
}

function hashPassword(password, salt = null) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

function verifyPassword(password, hash, salt) {
    const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(hash, 'hex'));
}

function createStudentToken(user) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        sub: user.id,
        email: user.email,
        role: user.role || 'student',
        wave: user.wave || 'Wave 1',
        fullName: user.full_name,
        cfHandle: user.codeforces_handle || null,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60) // 14 days
    })).toString('base64url');

    const signature = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');

    return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSig = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');

    if (signature !== expectedSig) return null;

    try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
            return null; // Expired
        }
        return decoded;
    } catch (e) {
        return null;
    }
}

function extractTokenFromReq(req) {
    const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const t = authHeader.substring(7).trim();
        if (t && t !== 'null' && t !== 'undefined' && t !== '""') {
            return t;
        }
    }
    const cookieHeader = req.headers && req.headers.cookie;
    if (cookieHeader) {
        const match = cookieHeader.match(/nusc_session_token=([^;]+)/) || cookieHeader.match(/nusc_admin_token=([^;]+)/);
        if (match && match[1]) {
            const t = match[1].trim();
            if (t && t !== 'null' && t !== 'undefined') return t;
        }
    }
    return null;
}

function maskEmail(email) {
    if (!email || !email.includes('@')) return '***@***.com';
    const [user, domain] = email.split('@');
    const maskedUser = user.length <= 2 ? user[0] + '***' : user[0] + '***' + user[user.length - 1];
    return `${maskedUser}@${domain}`;
}

const StudentService = {
    hashPassword,
    verifyPassword,
    createStudentToken,
    verifyToken,
    extractTokenFromReq,
    maskEmail,

    /**
     * Validate an orientation or participant code before registration
     */
    validateCode: async function (rawCode) {
        if (!rawCode || typeof rawCode !== 'string') {
            return { valid: false, error: 'Registration code is required.' };
        }
        const code = rawCode.trim().toUpperCase();

        // Check if code exists in event registrations
        const regUrl = `${SUPABASE_URL}/rest/v1/nusc_event_registrations?registration_id=eq.${encodeURIComponent(code)}&select=*&limit=1`;
        const regRes = await fetch(regUrl, { headers: getHeaders(false) });
        if (!regRes.ok) {
            return { valid: false, error: 'Database connection error during code verification.' };
        }
        const records = await regRes.json();
        if (!Array.isArray(records) || records.length === 0) {
            return { valid: false, error: 'Invalid access code. Please verify the code issued during orientation or participant registration.' };
        }

        const reg = records[0];

        // Check if already marked redeemed
        if (reg.is_redeemed) {
            return { valid: false, error: 'This registration code has already been redeemed to create an account.' };
        }

        // Check if a user account already exists with this code
        const userUrl = `${SUPABASE_URL}/rest/v1/nusc_users?registration_code=eq.${encodeURIComponent(code)}&select=id&limit=1`;
        const userRes = await fetch(userUrl, { headers: getHeaders(false) });
        if (userRes.ok) {
            const users = await userRes.json();
            if (Array.isArray(users) && users.length > 0) {
                return { valid: false, error: 'An account is already active for this registration code.' };
            }
        }

        // Determine Wave based on registration data or academic year
        let wave = reg.wave || 'Wave 1';
        if (reg.level) {
            if (reg.level.includes('2')) wave = 'Wave 2';
            else if (reg.level.includes('3')) wave = 'Wave 3';
        }

        return {
            valid: true,
            code: reg.registration_id,
            eventId: reg.event_id,
            fullName: reg.full_name,
            registeredEmail: reg.email,
            maskedEmail: maskEmail(reg.email),
            phone: reg.phone,
            faculty: reg.faculty,
            academicYear: reg.academic_year,
            wave: wave
        };
    },

    /**
     * Register a new student using their event code
     */
    registerStudent: async function ({ code, email, password, fullName, phone, faculty, academicYear }) {
        if (!code || !email || !password) {
            throw new Error('Code, email, and password are required.');
        }

        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long.');
        }

        // 1. Validate Code
        const check = await this.validateCode(code);
        if (!check.valid) {
            throw new Error(check.error);
        }

        const cleanEmail = email.trim().toLowerCase();
        const originalEmail = (check.registeredEmail || '').trim().toLowerCase();

        // 2. Strict Email Verification against registration record
        if (originalEmail && originalEmail !== cleanEmail) {
            throw new Error(`Email mismatch. You must register using the email submitted during event registration (${check.maskedEmail}).`);
        }

        // 3. Ensure email is not already taken in nusc_users
        const emailCheckUrl = `${SUPABASE_URL}/rest/v1/nusc_users?email=ilike.${encodeURIComponent(cleanEmail)}&select=id&limit=1`;
        const emailRes = await fetch(emailCheckUrl, { headers: getHeaders(false) });
        if (emailRes.ok) {
            const existingUsers = await emailRes.json();
            if (Array.isArray(existingUsers) && existingUsers.length > 0) {
                throw new Error('An account with this email address already exists. Please sign in instead.');
            }
        }

        // 4. Hash password
        const { hash, salt } = hashPassword(password);

        // Generate Codeforces verification challenge token
        const cfToken = 'NUSC-CF-' + crypto.randomBytes(3).toString('hex').toUpperCase();

        const userRecord = {
            email: cleanEmail,
            password_hash: hash,
            password_salt: salt,
            role: 'student',
            full_name: (fullName || check.fullName).trim(),
            phone: (phone || check.phone || '').trim(),
            faculty: (faculty || check.faculty || '').trim(),
            academic_year: (academicYear || check.academicYear || '').trim(),
            wave: check.wave || 'Wave 1',
            registration_code: check.code,
            cf_verified: false,
            cf_verification_token: cfToken,
            status: 'active',
            created_at: new Date().toISOString()
        };

        const postUserUrl = `${SUPABASE_URL}/rest/v1/nusc_users`;
        const postRes = await fetch(postUserUrl, {
            method: 'POST',
            headers: getHeaders(true),
            body: JSON.stringify(userRecord)
        });

        if (!postRes.ok) {
            const errText = await postRes.text();
            throw new Error(`Account creation failed: ${errText}`);
        }

        const createdResult = await postRes.json();
        const createdUser = Array.isArray(createdResult) ? createdResult[0] : createdResult;

        // 5. Mark code as redeemed in nusc_event_registrations
        try {
            const patchRegUrl = `${SUPABASE_URL}/rest/v1/nusc_event_registrations?registration_id=eq.${encodeURIComponent(check.code)}`;
            await fetch(patchRegUrl, {
                method: 'PATCH',
                headers: getHeaders(false),
                body: JSON.stringify({
                    is_redeemed: true,
                    redeemed_by: createdUser.id,
                    redeemed_at: new Date().toISOString(),
                    wave: check.wave
                })
            });
        } catch (e) {
            console.warn('[StudentService] Warning updating code redemption status:', e.message);
        }

        // Return token and safe user payload
        const token = createStudentToken(createdUser);
        return {
            token,
            user: {
                id: createdUser.id,
                email: createdUser.email,
                fullName: createdUser.full_name,
                role: createdUser.role,
                wave: createdUser.wave,
                registrationCode: createdUser.registration_code,
                codeforcesHandle: createdUser.codeforces_handle,
                cfVerified: createdUser.cf_verified,
                cfVerificationToken: createdUser.cf_verification_token,
                faculty: createdUser.faculty,
                academicYear: createdUser.academic_year
            }
        };
    },

    /**
     * Authenticate student or admin
     */
    login: async function ({ identifier, password }) {
        if (!identifier || !password) {
            throw new Error('Email/Username and password are required.');
        }

        const cleanId = identifier.trim();

        // 1. Check if matches Super Admin credentials
        if (DB.verifyCredentials(cleanId, password)) {
            const token = DB.createSessionToken(cleanId);
            return {
                token,
                isAdmin: true,
                user: {
                    id: 'admin_master',
                    username: DB.ADMIN_USERNAME,
                    fullName: 'ICPC NUSC Administrator',
                    role: 'admin',
                    email: 'admin@icpc-nusc.org'
                }
            };
        }

        // 2. Query student user from PostgreSQL (by Email, Registration Code, or Codeforces Handle)
        const cleanEnc = encodeURIComponent(cleanId);
        const queryUrl = `${SUPABASE_URL}/rest/v1/nusc_users?or=(email.ilike.${cleanEnc},registration_code.ilike.${cleanEnc},codeforces_handle.ilike.${cleanEnc})&select=*&limit=1`;
        const res = await fetch(queryUrl, { headers: getHeaders(false) });
        if (!res.ok) {
            throw new Error('Database authentication service unavailable.');
        }

        const users = await res.json();
        if (!Array.isArray(users) || users.length === 0) {
            throw new Error('Invalid login credentials (Email, Registration ID, or Codeforces Handle / Password).');
        }

        const user = users[0];

        if (user.status === 'suspended') {
            throw new Error('Your account has been suspended by community administrators. Please contact support.');
        }

        // 3. Verify password hash
        const isMatch = verifyPassword(password, user.password_hash, user.password_salt);
        if (!isMatch) {
            throw new Error('Invalid email or password.');
        }

        // 4. Update last_login_at
        try {
            const patchUrl = `${SUPABASE_URL}/rest/v1/nusc_users?id=eq.${encodeURIComponent(user.id)}`;
            await fetch(patchUrl, {
                method: 'PATCH',
                headers: getHeaders(false),
                body: JSON.stringify({ last_login_at: new Date().toISOString() })
            });
        } catch (e) {}

        const token = createStudentToken(user);
        return {
            token,
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
                academicYear: user.academic_year
            }
        };
    },

    /**
     * Get user profile by ID
     */
    getUserById: async function (userId) {
        if (!userId) return null;
        if (userId === 'admin' || String(userId).startsWith('admin_') || userId === DB.ADMIN_USERNAME || userId === 'cassidy') {
            return {
                id: userId,
                full_name: 'Administrator (Cassidy)',
                email: 'admin@icpc-nusc.com',
                role: 'admin',
                wave: 'Wave 1',
                codeforces_handle: null,
                cf_verified: true,
                status: 'active'
            };
        }
        const url = `${SUPABASE_URL}/rest/v1/nusc_users?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`;
        const res = await fetch(url, { headers: getHeaders(false) });
        if (!res.ok) return null;
        const list = await res.json();
        return (Array.isArray(list) && list.length > 0) ? list[0] : null;
    },

    /**
     * Update user profile
     */
    updateUserProfile: async function (userId, updates) {
        const allowed = ['avatar_url', 'bio', 'phone', 'faculty', 'academic_year'];
        const payload = {};
        for (const k of allowed) {
            if (updates[k] !== undefined) payload[k] = updates[k];
        }

        const url = `${SUPABASE_URL}/rest/v1/nusc_users?id=eq.${encodeURIComponent(userId)}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: getHeaders(true),
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to update profile.');
        const result = await res.json();
        return Array.isArray(result) ? result[0] : result;
    },

    /**
     * Request Password Reset Token
     */
    requestPasswordReset: async function (email) {
        if (!email) throw new Error('Email is required.');
        const cleanEmail = email.trim().toLowerCase();

        const queryUrl = `${SUPABASE_URL}/rest/v1/nusc_users?email=ilike.${encodeURIComponent(cleanEmail)}&select=id&limit=1`;
        const res = await fetch(queryUrl, { headers: getHeaders(false) });
        if (!res.ok) throw new Error('Error processing password reset.');
        const users = await res.json();

        // If email doesn't exist, return success anyway to prevent email enumeration
        if (!Array.isArray(users) || users.length === 0) {
            return { success: true, message: 'If an account exists with this email, a reset token has been generated.' };
        }

        const user = users[0];
        const token = crypto.randomBytes(24).toString('hex');
        const exp = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

        const patchUrl = `${SUPABASE_URL}/rest/v1/nusc_users?id=eq.${encodeURIComponent(user.id)}`;
        await fetch(patchUrl, {
            method: 'PATCH',
            headers: getHeaders(false),
            body: JSON.stringify({ reset_token: token, reset_token_exp: exp })
        });

        return {
            success: true,
            resetToken: token, // In local/dev environments or displayed directly to student
            message: 'Password reset link generated. You may now reset your password.'
        };
    },

    /**
     * Reset Password using token
     */
    resetPassword: async function (token, newPassword) {
        if (!token || !newPassword) throw new Error('Token and new password are required.');
        if (newPassword.length < 8) throw new Error('Password must be at least 8 characters long.');

        const queryUrl = `${SUPABASE_URL}/rest/v1/nusc_users?reset_token=eq.${encodeURIComponent(token.trim())}&select=*&limit=1`;
        const res = await fetch(queryUrl, { headers: getHeaders(false) });
        if (!res.ok) throw new Error('Invalid or expired reset token.');
        const users = await res.json();
        if (!Array.isArray(users) || users.length === 0) {
            throw new Error('Invalid or expired reset token.');
        }

        const user = users[0];
        if (user.reset_token_exp && new Date(user.reset_token_exp) < new Date()) {
            throw new Error('Reset token has expired. Please request a new one.');
        }

        const { hash, salt } = hashPassword(newPassword);
        const patchUrl = `${SUPABASE_URL}/rest/v1/nusc_users?id=eq.${encodeURIComponent(user.id)}`;
        const patchRes = await fetch(patchUrl, {
            method: 'PATCH',
            headers: getHeaders(false),
            body: JSON.stringify({
                password_hash: hash,
                password_salt: salt,
                reset_token: null,
                reset_token_exp: null
            })
        });

        if (!patchRes.ok) throw new Error('Failed to update password.');
        return { success: true, message: 'Password updated successfully. You can now sign in.' };
    }
};

module.exports = StudentService;
