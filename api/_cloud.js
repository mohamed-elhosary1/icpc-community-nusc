/**
 * ICPC NUSC — Production Database Layer (Supabase PostgreSQL)
 * Reliable persistence for applications, event registrations, and statistics.
 * No local disk mocks or ephemeral in-memory variables.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables if not present
try {
    const envFile = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envFile)) {
        const lines = fs.readFileSync(envFile, 'utf8').split('\n');
        for (const l of lines) {
            const match = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
            if (match && !process.env[match[1]]) {
                let val = (match[2] || '').trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                process.env[match[1]] = val;
            }
        }
    }
} catch (e) {}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gpzwlxbmgpmydgywxtdo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zbshKRcot5UDfjvtMJx4gQ_c9a9-of9';

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

/**
 * Generate human-readable, collision-resistant Registration Reference
 * Format: NUSC-OS26-XXXXX (e.g. NUSC-OS26-K7M2X)
 */
function generateRegistrationId(prefix = 'NUSC-OS26-') {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude ambiguous 0,1,I,O
    let code = '';
    const bytes = crypto.randomBytes(5);
    for (let i = 0; i < 5; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return prefix + code;
}

const CloudDB = {
    url: SUPABASE_URL,

    /**
     * Save an event registration with strict validation and unique ID generation.
     */
    saveEventRegistration: async function(regData) {
        if (!regData.fullName || !regData.email || !regData.phone || !regData.faculty || !regData.academicYear) {
            throw new Error('Missing required registration fields.');
        }

        if (regData.isNuscStudent !== true && regData.is_nusc_student !== true) {
            throw new Error('Registration is strictly restricted to students of National University of Sadat City.');
        }

        const eventId = regData.eventId || regData.event_id || 'orientation-session-2026';
        const cleanEmail = String(regData.email).trim().toLowerCase();

        // 1. Check for duplicate registration for this event
        const checkUrl = `${SUPABASE_URL}/rest/v1/nusc_event_registrations?event_id=eq.${encodeURIComponent(eventId)}&email=ilike.${encodeURIComponent(cleanEmail)}&select=registration_id,full_name,created_at`;
        const checkRes = await fetch(checkUrl, { headers: getHeaders(false) });
        if (checkRes.ok) {
            const existing = await checkRes.json();
            if (Array.isArray(existing) && existing.length > 0) {
                const err = new Error('You have already registered for this event.');
                err.code = 'DUPLICATE_REGISTRATION';
                err.existingRegistrationId = existing[0].registration_id;
                throw err;
            }
        }

        // 2. Generate unique registration ID and insert
        let attempts = 0;
        let savedRecord = null;

        while (attempts < 3 && !savedRecord) {
            attempts++;
            const regId = generateRegistrationId();
            const record = {
                registration_id: regId,
                event_id: eventId,
                full_name: String(regData.fullName || regData.full_name).trim(),
                email: cleanEmail,
                phone: String(regData.phone).trim(),
                academic_year: String(regData.academicYear || regData.academic_year).trim(),
                faculty: String(regData.faculty).trim(),
                is_nusc_student: true,
                status: 'confirmed',
                metadata: regData.metadata || {}
            };

            const postUrl = `${SUPABASE_URL}/rest/v1/nusc_event_registrations`;
            const postRes = await fetch(postUrl, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify(record)
            });

            if (postRes.ok) {
                const result = await postRes.json();
                savedRecord = Array.isArray(result) ? result[0] : result;
            } else if (postRes.status === 409) {
                // Collision on code; retry
                continue;
            } else {
                const errBody = await postRes.text();
                throw new Error(`Database error saving registration: ${errBody}`);
            }
        }

        if (!savedRecord) {
            throw new Error('Failed to generate a unique registration code. Please try again.');
        }

        return savedRecord;
    },

    /**
     * Retrieve event registrations (ordered by created_at desc)
     */
    getEventRegistrations: async function(eventId = null) {
        let queryUrl = `${SUPABASE_URL}/rest/v1/nusc_event_registrations?select=*&order=created_at.desc`;
        if (eventId) {
            queryUrl += `&event_id=eq.${encodeURIComponent(eventId)}`;
        }

        const res = await fetch(queryUrl, { headers: getHeaders(false) });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Database query failed: ${errText}`);
        }

        return await res.json();
    },

    /**
     * Find single registration by registration_id
     */
    getRegistrationByCode: async function(code) {
        if (!code) return null;
        const queryUrl = `${SUPABASE_URL}/rest/v1/nusc_event_registrations?registration_id=eq.${encodeURIComponent(code.trim())}&select=*`;
        const res = await fetch(queryUrl, { headers: getHeaders(false) });
        if (!res.ok) return null;
        const list = await res.json();
        return (Array.isArray(list) && list.length > 0) ? list[0] : null;
    },

    /**
     * Save organizing team application
     */
    saveApplication: async function(appData) {
        if (!appData.fullName || !appData.email) {
            throw new Error('Full Name and Email are required.');
        }

        const cleanEmail = String(appData.email).trim().toLowerCase();
        const id = appData.id || `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const record = {
            id: id,
            full_name: String(appData.fullName).trim(),
            email: cleanEmail,
            phone: appData.phone ? String(appData.phone).trim() : null,
            university: appData.university || 'National University of Sadat City',
            academic_year: appData.academicYear || appData.academic_year || '',
            first_preference: appData.firstPreference || appData.first_preference || '',
            second_preference: appData.secondPreference || appData.second_preference || '',
            final_department: appData.finalDepartment || null,
            status: appData.status || 'new',
            review: appData.review || {},
            internal_notes: appData.internalNotes || [],
            answers_snapshot: appData.answersSnapshot || {},
            raw_data: appData.rawData || {}
        };

        const postUrl = `${SUPABASE_URL}/rest/v1/nusc_applications`;
        const res = await fetch(postUrl, {
            method: 'POST',
            headers: getHeaders(true),
            body: JSON.stringify(record)
        });

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Database error saving application: ${errBody}`);
        }

        const result = await res.json();
        return Array.isArray(result) ? result[0] : result;
    },

    /**
     * Retrieve all organizing team applications
     */
    getApplications: async function() {
        const queryUrl = `${SUPABASE_URL}/rest/v1/nusc_applications?select=*&order=submitted_at.desc`;
        const res = await fetch(queryUrl, { headers: getHeaders(false) });
        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Database query failed: ${errBody}`);
        }
        const rows = await res.json();
        
        // Normalize keys for frontend compatibility
        return rows.map(r => ({
            id: r.id,
            fullName: r.full_name,
            email: r.email,
            phone: r.phone,
            university: r.university,
            academicYear: r.academic_year,
            firstPreference: r.first_preference,
            secondPreference: r.second_preference,
            finalDepartment: r.final_department,
            status: r.status,
            review: r.review,
            internalNotes: r.internal_notes,
            answersSnapshot: r.answers_snapshot,
            submittedAt: r.submitted_at
        }));
    },

    /**
     * Update organizing team application
     */
    updateApplication: async function(id, updates) {
        const payload = {};
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.finalDepartment !== undefined) payload.final_department = updates.finalDepartment;
        if (updates.review !== undefined) payload.review = updates.review;
        if (updates.internalNotes !== undefined) payload.internal_notes = updates.internalNotes;
        if (updates.answersSnapshot !== undefined) payload.answers_snapshot = updates.answersSnapshot;

        const patchUrl = `${SUPABASE_URL}/rest/v1/nusc_applications?id=eq.${encodeURIComponent(id)}`;
        const res = await fetch(patchUrl, {
            method: 'PATCH',
            headers: getHeaders(true),
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Database update failed: ${errBody}`);
        }

        const result = await res.json();
        const r = Array.isArray(result) ? result[0] : result;
        if (!r) return null;

        return {
            id: r.id,
            fullName: r.full_name,
            email: r.email,
            phone: r.phone,
            university: r.university,
            academicYear: r.academic_year,
            firstPreference: r.first_preference,
            secondPreference: r.second_preference,
            finalDepartment: r.final_department,
            status: r.status,
            review: r.review,
            internalNotes: r.internal_notes,
            answersSnapshot: r.answers_snapshot,
            submittedAt: r.submitted_at
        };
    },

    /**
     * Delete application
     */
    deleteApplication: async function(id) {
        const delUrl = `${SUPABASE_URL}/rest/v1/nusc_applications?id=eq.${encodeURIComponent(id)}`;
        const res = await fetch(delUrl, {
            method: 'DELETE',
            headers: getHeaders(false)
        });
        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Database delete failed: ${errBody}`);
        }
        return true;
    },

    /**
     * Calculate live aggregate statistics directly from PostgreSQL
     */
    getCalculatedStats: async function() {
        const [appsRes, regRes] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/nusc_applications?select=status,first_preference,final_department`, { headers: getHeaders(false) }),
            fetch(`${SUPABASE_URL}/rest/v1/nusc_event_registrations?select=event_id`, { headers: getHeaders(false) })
        ]);

        const apps = appsRes.ok ? await appsRes.json() : [];
        const regs = regRes.ok ? await regRes.json() : [];

        return {
            totalApplications: apps.length,
            new: apps.filter(a => a.status === 'new').length,
            underReview: apps.filter(a => a.status === 'under_review').length,
            shortlisted: apps.filter(a => a.status === 'shortlisted').length,
            interview: apps.filter(a => a.status === 'interview').length,
            accepted: apps.filter(a => a.status === 'accepted').length,
            rejected: apps.filter(a => a.status === 'rejected').length,
            deptCounts: {
                Technical: apps.filter(a => a.first_preference === 'Technical' || a.final_department === 'Technical').length,
                Marketing: apps.filter(a => a.first_preference === 'Marketing' || a.final_department === 'Marketing').length,
                Media: apps.filter(a => a.first_preference === 'Media' || a.final_department === 'Media').length,
                HR: apps.filter(a => a.first_preference === 'HR' || a.final_department === 'HR').length
            },
            activeEvents: 1,
            totalRegistrations: regs.length,
            orientationRegistrations: regs.filter(r => r.event_id === 'orientation-session-2026').length
        };
    }
};

module.exports = CloudDB;
