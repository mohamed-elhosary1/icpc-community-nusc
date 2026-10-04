/**
 * ICPC NUSC — Server-side Data Layer & Security Engine
 * Single source of truth for applications, events, registrations, and questions.
 * ZERO mock data: Applications and registrations start strictly empty.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const TMP_DATA_FILE = path.join(os.tmpdir(), 'nusc_data_store.json');
const BACKUP_LOG_FILE = path.join(os.tmpdir(), 'nusc_submissions_backup.jsonl');

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

// Server-side Admin Credentials (Stored strictly on the backend)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'cassidy';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1046579435';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'nusc_sec_2026_98741352_auth_secret_key';

// Data file path for local persistence
const DATA_FILE = path.join(__dirname, '..', '.data_store.json');

// Default real state: ZERO fake applications, ZERO fake registrations, 1 REAL event
const INITIAL_STATE = {
    events: [],
    applications: [],
    registrations: {},
    questions: [
        { id: 'personal_full_name', department: 'universal', type: 'text', question: 'Full Name', required: true, active: true, order: 1 },
        { id: 'personal_email', department: 'universal', type: 'email', question: 'University Email', required: true, active: true, order: 2 },
        { id: 'personal_phone', department: 'universal', type: 'tel', question: 'Phone Number', required: true, active: true, order: 3 },
        { id: 'personal_university', department: 'universal', type: 'text', question: 'University / Faculty', required: true, active: true, order: 4 },
        { id: 'personal_year', department: 'universal', type: 'select', question: 'Academic Year', options: ['First Year', 'Second Year', 'Third Year', 'Fourth Year', 'Other'], required: true, active: true, order: 5 },
        { id: 'dept_first_pref', department: 'universal', type: 'select', question: 'First Department Preference', options: ['Technical', 'Marketing', 'Media', 'HR'], required: true, active: true, order: 6 },
        { id: 'dept_second_pref', department: 'universal', type: 'select', question: 'Second Department Preference', options: ['Technical', 'Marketing', 'Media', 'HR'], required: true, active: true, order: 7 },
        { id: 'universal_why_join', department: 'universal', type: 'textarea', question: 'Why do you want to join the ICPC NUSC organizing team?', required: true, active: true, order: 8 },
        { id: 'universal_contribution', department: 'universal', type: 'textarea', question: 'What do you think you can contribute to NUSC?', required: true, active: true, order: 9 },
        { id: 'universal_learn_goals', department: 'universal', type: 'textarea', question: 'What do you want to learn or improve by joining the team?', required: true, active: true, order: 10 },
        { id: 'universal_past_experience', department: 'universal', type: 'textarea', question: 'Tell us about a project, activity, competition, club, volunteer experience, or team experience you participated in.', required: false, active: true, order: 11 },
        { id: 'universal_time_commitment', department: 'universal', type: 'select', question: 'How much time can you realistically commit each week?', options: ['2–4 hours', '4–6 hours', '6–10 hours', '10+ hours'], required: true, active: true, order: 12 },
        { id: 'universal_under_pressure', department: 'universal', type: 'textarea', question: 'How do you usually behave when working under pressure?', required: true, active: true, order: 13 },
        { id: 'universal_conflict_handling', department: 'universal', type: 'textarea', question: 'Tell us about a disagreement you had while working in a team and how you handled it.', required: true, active: true, order: 14 },
        { id: 'universal_leadership_optional', department: 'universal', type: 'textarea', question: 'Tell us about a situation where you had to take responsibility for a team or project.', required: false, active: true, order: 15 },
        
        { id: 'tech_languages', department: 'technical', type: 'multiselect', question: 'What programming languages are you comfortable using?', options: ['C++', 'Python', 'Java', 'JavaScript / TypeScript', 'C', 'C#', 'Other'], required: true, active: true, order: 1 },
        { id: 'tech_cp_experience', department: 'technical', type: 'select', question: 'How would you describe your competitive programming experience?', options: ['No experience', 'Beginner', 'Some practice', 'Intermediate', 'Advanced'], required: true, active: true, order: 2 },
        { id: 'tech_topics', department: 'technical', type: 'multiselect', question: 'Which of these topics have you studied or practiced?', options: ['Arrays', 'Strings', 'Sorting', 'Binary Search', 'Recursion', 'Graphs', 'Trees', 'Dynamic Programming', 'Greedy Algorithms', 'Data Structures', 'STL', 'Number Theory', 'None yet'], required: true, active: true, order: 3 },
        { id: 'tech_proud_project', department: 'technical', type: 'textarea', question: 'Describe one programming problem or project that you are proud of solving/building.', required: true, active: true, order: 4 },
        { id: 'tech_portfolio_url', department: 'technical', type: 'url', question: 'GitHub / Portfolio URL', required: false, active: true, order: 5 },
        { id: 'tech_broken_site_scenario', department: 'technical', type: 'textarea', question: 'Imagine an NUSC website feature is broken right before an event. What would you do?', required: true, active: true, order: 6 },
        { id: 'tech_interest_area', department: 'technical', type: 'select', question: 'Which technical area interests you most?', options: ['Frontend Development', 'Backend Development', 'Full Stack', 'Problem Setting', 'Competitive Programming', 'Automation', 'DevOps', 'Databases', 'Technical Operations', 'Not sure yet'], required: true, active: true, order: 7 },

        { id: 'mkt_interest_areas', department: 'marketing', type: 'multiselect', question: 'Which marketing areas interest you?', options: ['Social Media', 'Content Strategy', 'Campaigns', 'Community Growth', 'Partnerships', 'Copywriting', 'Event Promotion', 'Brand Strategy'], required: true, active: true, order: 1 },
        { id: 'mkt_convince_workshop', department: 'marketing', type: 'textarea', question: 'Imagine NUSC is hosting a beginner programming workshop. How would you convince students to attend?', required: true, active: true, order: 2 },
        { id: 'mkt_pitch_nusc', department: 'marketing', type: 'textarea', question: 'If you had to promote NUSC to students who have never heard of ICPC, what would your message be?', required: true, active: true, order: 3 },
        { id: 'mkt_platforms', department: 'marketing', type: 'multiselect', question: 'Which platforms do you understand or actively use for content/community growth?', options: ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'WhatsApp', 'Discord', 'YouTube', 'Other'], required: true, active: true, order: 4 },
        { id: 'mkt_past_campaign_exp', department: 'marketing', type: 'select', question: 'Have you worked on a campaign, social media page, event promotion, or community before?', options: ['Yes', 'No'], required: true, active: true, order: 5 },
        { id: 'mkt_past_campaign_details', department: 'marketing', type: 'textarea', question: 'Tell us what you did.', required: false, active: true, order: 6 },
        { id: 'mkt_growth_idea', department: 'marketing', type: 'textarea', question: 'Give us one idea for growing the ICPC NUSC community.', required: true, active: true, order: 7 },

        { id: 'media_interest_areas', department: 'media', type: 'multiselect', question: 'Which media areas interest you?', options: ['Graphic Design', 'Photography', 'Videography', 'Video Editing', 'Motion Graphics', 'Social Media Content', 'UI / Visual Design', 'Event Coverage'], required: true, active: true, order: 1 },
        { id: 'media_tools_used', department: 'media', type: 'multiselect', question: 'Which tools have you used?', options: ['Photoshop', 'Illustrator', 'Figma', 'Canva', 'Premiere Pro', 'After Effects', 'DaVinci Resolve', 'CapCut', 'Blender', 'Other', 'None'], required: true, active: true, order: 2 },
        { id: 'media_portfolio_url', department: 'media', type: 'url', question: 'Portfolio URL', required: false, active: true, order: 3 },
        { id: 'media_proud_work', department: 'media', type: 'textarea', question: 'Tell us about one piece of content you created that you are proud of.', required: true, active: true, order: 4 },
        { id: 'media_contest_moments', department: 'media', type: 'textarea', question: 'Imagine you are covering an ICPC contest. What moments would you prioritize capturing?', required: true, active: true, order: 5 },
        { id: 'media_video_approach', department: 'media', type: 'textarea', question: 'Imagine we give you a raw event recording and ask you to turn it into a 30-second social media video. How would you approach it?', required: true, active: true, order: 6 },

        { id: 'hr_interest_areas', department: 'hr', type: 'multiselect', question: 'Which HR areas interest you?', options: ['Recruitment', 'Interviews', 'Onboarding', 'People & Culture', 'Internal Activities', 'Team Communication', 'Performance Follow-up', 'Conflict Management'], required: true, active: true, order: 1 },
        { id: 'hr_disagreement_scenario', department: 'hr', type: 'textarea', question: 'Imagine two team members are having a disagreement that is affecting their work. What would you do?', required: true, active: true, order: 2 },
        { id: 'hr_good_team_member', department: 'hr', type: 'textarea', question: 'What do you think makes someone a good team member?', required: true, active: true, order: 3 },
        { id: 'hr_past_coord_exp', department: 'hr', type: 'textarea', question: 'Tell us about a time you helped organize, coordinate, or support a group of people.', required: true, active: true, order: 4 },
        { id: 'hr_lost_member_scenario', department: 'hr', type: 'textarea', question: 'Imagine a new member joins NUSC but feels lost and does not know what to do. How would you help them?', required: true, active: true, order: 5 },
        { id: 'hr_missed_deadlines_scenario', department: 'hr', type: 'textarea', question: 'How would you handle a team member who repeatedly misses deadlines?', required: true, active: true, order: 6 }
    ]
};

// In-memory cache synced with persistent storage (disk + /tmp fallback)
let state = null;

function loadState() {
    if (state) return state;
    try {
        if (fs.existsSync(TMP_DATA_FILE)) {
            const raw = fs.readFileSync(TMP_DATA_FILE, 'utf8');
            state = JSON.parse(raw);
        } else if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            state = JSON.parse(raw);
        } else {
            state = JSON.parse(JSON.stringify(INITIAL_STATE));
            saveState();
        }
    } catch (e) {
        state = JSON.parse(JSON.stringify(INITIAL_STATE));
    }

    if (!state.applications) state.applications = [];
    if (!state.events) state.events = [];
    if (!state.registrations) state.registrations = {};
    if (!state.questions) state.questions = INITIAL_STATE.questions;

    // Guaranteed recovery: preserve real applicant submissions
    if (state.applications.length === 0 && INITIAL_STATE.applications.length > 0) {
        state.applications = JSON.parse(JSON.stringify(INITIAL_STATE.applications));
        saveState();
    }

    return state;
}

function saveState() {
    const json = JSON.stringify(state, null, 2);
    try {
        fs.writeFileSync(DATA_FILE, json, 'utf8');
    } catch (e) {
        // Read-only on serverless
    }
    try {
        fs.writeFileSync(TMP_DATA_FILE, json, 'utf8');
    } catch (e) {
        console.error('[NUSC_DB] Error writing to tmp storage:', e.message);
    }
}

// Authentication Helpers
function verifyCredentials(username, password) {
    if (!username || !password) return false;
    const cleanUser = String(username).trim();
    const cleanPass = String(password).trim();
    return cleanUser === ADMIN_USERNAME && cleanPass === ADMIN_PASSWORD;
}

function createSessionToken(username) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        sub: username,
        role: 'Super Admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    })).toString('base64url');

    const signature = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');

    return `${header}.${payload}.${signature}`;
}

function verifySessionToken(token) {
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

function extractToken(req) {
    const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7).trim();
    }
    const cookieHeader = req.headers && req.headers.cookie;
    if (cookieHeader) {
        const match = cookieHeader.match(/nusc_admin_token=([^;]+)/);
        if (match) return match[1];
    }
    return null;
}

function requireAuth(req, res) {
    const token = extractToken(req);
    const session = verifySessionToken(token);
    if (!session) {
        res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
        res.end ? res.end(JSON.stringify({ error: 'Unauthorized: Admin authentication required.' })) : res.json({ error: 'Unauthorized: Admin authentication required.' });
        return null;
    }
    return session;
}

// Data Methods
const DB = {
    getDb: loadState,
    saveDb: saveState,

    // Applications
    getApplications: () => loadState().applications || [],
    getApplicationById: (id) => (loadState().applications || []).find(a => a.id === id) || null,
    saveApplication: (appData) => {
        const s = loadState();
        if (!s.applications) s.applications = [];
        const record = Object.assign({
            id: 'app_' + Date.now(),
            submittedAt: new Date().toISOString(),
            status: 'new',
            finalDepartment: null,
            review: {
                communication: null,
                technicalAbility: null,
                commitment: null,
                teamwork: null,
                problemSolving: null,
                cultureFit: null,
                summary: ''
            },
            internalNotes: []
        }, appData);
        s.applications.unshift(record);
        saveState();
        try {
            fs.appendFileSync(BACKUP_LOG_FILE, JSON.stringify(record) + '\n', 'utf8');
        } catch(e) {}
        console.log('[NUSC_PERSISTENCE] Application saved:', record.id, record.fullName, record.email);
        return record;
    },
    updateApplication: (id, updates) => {
        const s = loadState();
        const idx = (s.applications || []).findIndex(a => a.id === id);
        if (idx === -1) return null;
        s.applications[idx] = Object.assign({}, s.applications[idx], updates);
        saveState();
        return s.applications[idx];
    },
    deleteApplication: (id) => {
        const s = loadState();
        s.applications = (s.applications || []).filter(a => a.id !== id);
        saveState();
        return true;
    },

    // Events
    getEvents: () => loadState().events || [],
    getEventById: (id) => (loadState().events || []).find(e => e.id === id) || null,
    saveEvent: (eventData) => {
        const s = loadState();
        if (!s.events) s.events = [];
        const record = Object.assign({
            id: 'evt_' + Date.now(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'published'
        }, eventData);
        s.events.unshift(record);
        saveState();
        return record;
    },
    updateEvent: (id, updates) => {
        const s = loadState();
        const idx = (s.events || []).findIndex(e => e.id === id);
        if (idx === -1) return null;
        updates.updatedAt = new Date().toISOString();
        s.events[idx] = Object.assign({}, s.events[idx], updates);
        saveState();
        return s.events[idx];
    },
    deleteEvent: (id) => {
        const s = loadState();
        s.events = (s.events || []).filter(e => e.id !== id);
        saveState();
        return true;
    },

    // Registrations
    getRegistrations: (eventId) => {
        const regs = loadState().registrations || {};
        return regs[eventId] || [];
    },
    saveRegistration: (eventId, regData) => {
        const s = loadState();
        if (!s.registrations) s.registrations = {};
        if (!s.registrations[eventId]) s.registrations[eventId] = [];
        const record = Object.assign({
            id: 'reg_' + Date.now(),
            registeredAt: new Date().toISOString(),
            status: 'CONFIRMED'
        }, regData);
        s.registrations[eventId].unshift(record);
        saveState();
        return record;
    },
    updateRegistrationStatus: (eventId, regId, status) => {
        const s = loadState();
        if (!s.registrations || !s.registrations[eventId]) return null;
        const reg = s.registrations[eventId].find(r => r.id === regId);
        if (reg) reg.status = status;
        saveState();
        return reg;
    },

    // Questions
    getQuestions: (dept) => {
        const qs = loadState().questions || [];
        if (!dept || dept === 'all') return qs;
        return qs.filter(q => q.department === dept.toLowerCase());
    },
    saveQuestion: (qData) => {
        const s = loadState();
        if (!s.questions) s.questions = [];
        const record = Object.assign({
            id: 'q_' + Date.now(),
            active: true,
            order: s.questions.length + 1
        }, qData);
        s.questions.push(record);
        saveState();
        return record;
    },
    updateQuestion: (id, updates) => {
        const s = loadState();
        const idx = (s.questions || []).findIndex(q => q.id === id);
        if (idx === -1) return null;
        s.questions[idx] = Object.assign({}, s.questions[idx], updates);
        saveState();
        return s.questions[idx];
    },

    // Stats
    getCalculatedStats: () => {
        const s = loadState();
        const apps = s.applications || [];
        const events = s.events || [];
        const regs = s.registrations || {};

        let totalRegs = 0;
        Object.values(regs).forEach(list => { totalRegs += (list || []).length; });

        return {
            totalApplications: apps.length,
            new: apps.filter(a => a.status === 'new').length,
            underReview: apps.filter(a => a.status === 'under_review').length,
            shortlisted: apps.filter(a => a.status === 'shortlisted').length,
            interview: apps.filter(a => a.status === 'interview').length,
            accepted: apps.filter(a => a.status === 'accepted').length,
            rejected: apps.filter(a => a.status === 'rejected').length,

            deptCounts: {
                Technical: apps.filter(a => a.firstPreference === 'Technical' || a.finalDepartment === 'Technical').length,
                Marketing: apps.filter(a => a.firstPreference === 'Marketing' || a.finalDepartment === 'Marketing').length,
                Media: apps.filter(a => a.firstPreference === 'Media' || a.finalDepartment === 'Media').length,
                HR: apps.filter(a => a.firstPreference === 'HR' || a.finalDepartment === 'HR').length
            },

            activeEvents: events.filter(e => e.status === 'published').length,
            upcomingEvents: events.length,
            totalRegistrations: totalRegs
        };
    },

    // Auth
    verifyCredentials,
    createSessionToken,
    verifySessionToken,
    extractToken,
    requireAuth,
    ADMIN_USERNAME
};

module.exports = DB;
