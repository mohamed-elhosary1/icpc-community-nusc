/**
 * ICPC NUSC — Client Data Store & API Bridge
 * Communicates with backend /api endpoints.
 * ZERO mock data: starts 100% empty until real users apply or register.
 * ZERO hardcoded passwords.
 */

(function (window) {
    'use strict';

    const STORAGE_KEY_PREFIX = 'NUSC_REAL_';
    const APPS_KEY = STORAGE_KEY_PREFIX + 'APPLICATIONS';
    const EVENTS_KEY = STORAGE_KEY_PREFIX + 'EVENTS';
    const REGISTRATIONS_KEY = STORAGE_KEY_PREFIX + 'REGISTRATIONS';
    const QUESTIONS_KEY = STORAGE_KEY_PREFIX + 'QUESTIONS';
    const TOKEN_KEY = STORAGE_KEY_PREFIX + 'AUTH_TOKEN';
    const USER_KEY = STORAGE_KEY_PREFIX + 'AUTH_USER';

    // REAL APPLICATIONS STORE (Blank slate, 0 applications)
    const SEEDED_APPLICATIONS = [];
    const REAL_EVENTS = [];

    const REAL_QUESTIONS = [
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
    ];

    function loadLocal(key, defaultVal) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return defaultVal;
            return JSON.parse(raw);
        } catch (e) {
            return defaultVal;
        }
    }

    function saveLocal(key, val) {
        try {
            localStorage.setItem(key, JSON.stringify(val));
            return true;
        } catch (e) {
            return false;
        }
    }

    // Initialize local cache with real base
    if (!localStorage.getItem(EVENTS_KEY)) {
        saveLocal(EVENTS_KEY, REAL_EVENTS);
    }
    if (!localStorage.getItem(QUESTIONS_KEY)) {
        saveLocal(QUESTIONS_KEY, REAL_QUESTIONS);
    }
    if (!localStorage.getItem(APPS_KEY)) {
        saveLocal(APPS_KEY, SEEDED_APPLICATIONS);
    } else {
        // If local storage has 0 applications but we have seeded real applications, restore them
        const existing = loadLocal(APPS_KEY, []);
        if (existing.length === 0 && SEEDED_APPLICATIONS.length > 0) {
            saveLocal(APPS_KEY, SEEDED_APPLICATIONS);
        }
    }
    if (!localStorage.getItem(REGISTRATIONS_KEY)) {
        saveLocal(REGISTRATIONS_KEY, { 'evt_programming_basics': [] }); // Zero fake registrations
    }

    // DATA STORE (Zero Fake Data, Server Synced)
    const NUSC_DATA_STORE = {
        getApplications: function () {
            return loadLocal(APPS_KEY, SEEDED_APPLICATIONS);
        },

        getApplicationById: function (id) {
            const apps = this.getApplications();
            return apps.find(a => a.id === id) || null;
        },

        /**
         * Fetch live real applications from backend API
         * Merges server applications with local client storage
         */
        fetchApplications: async function () {
            try {
                const token = NUSC_AUTH.getToken();
                const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
                const res = await fetch('/api/applications', { headers });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.applications)) {
                        const serverApps = data.applications;
                        const localApps = loadLocal(APPS_KEY, []);
                        
                        // Merge by id (server is source of truth)
                        const map = new Map();
                        serverApps.forEach(a => map.set(a.id, a));
                        localApps.forEach(a => {
                            if (!map.has(a.id)) map.set(a.id, a);
                        });
                        
                        const merged = Array.from(map.values());
                        merged.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
                        saveLocal(APPS_KEY, merged);
                        return merged;
                    }
                } else if (res.status === 401) {
                    console.warn('[NUSC_DATA_STORE] Admin session expired or unauthorized.');
                }
            } catch (err) {
                console.warn('[NUSC_DATA_STORE] Server sync failed (offline or network error):', err.message);
            }
            return this.getApplications();
        },

        fetchEvents: async function () {
            try {
                const res = await fetch('/api/events');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.events)) {
                        saveLocal(EVENTS_KEY, data.events);
                        return data.events;
                    }
                }
            } catch (err) {}
            return this.getEvents();
        },

        fetchRegistrations: async function (eventId) {
            try {
                const token = NUSC_AUTH.getToken();
                const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
                const url = eventId ? ('/api/registrations?eventId=' + encodeURIComponent(eventId)) : '/api/registrations';
                const res = await fetch(url, { headers });
                if (res.ok) {
                    const data = await res.json();
                    if (data.registrations) {
                        const regMap = loadLocal(REGISTRATIONS_KEY, {});
                        if (eventId) {
                            regMap[eventId] = data.registrations;
                        } else if (typeof data.registrations === 'object') {
                            Object.assign(regMap, data.registrations);
                        }
                        saveLocal(REGISTRATIONS_KEY, regMap);
                        return eventId ? (regMap[eventId] || []) : regMap;
                    }
                }
            } catch (err) {}
            return this.getRegistrations(eventId);
        },

        syncAll: async function () {
            const [apps, events] = await Promise.all([
                this.fetchApplications(),
                this.fetchEvents()
            ]);
            return { applications: apps, events: events };
        },

        saveApplication: async function (appData) {
            const newApp = Object.assign({
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

            let serverSaved = null;
            let errorMessage = null;

            // Attempt serverless API save
            try {
                const res = await fetch('/api/applications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newApp)
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.application) {
                        serverSaved = data.application;
                    }
                } else {
                    const errData = await res.json().catch(() => ({}));
                    errorMessage = errData.error || ('Server error (' + res.status + ')');
                }
            } catch (e) {
                errorMessage = 'Network connection to application server failed. Please check internet connection.';
            }

            if (errorMessage) {
                return { error: errorMessage };
            }

            const finalApp = serverSaved || newApp;
            const apps = this.getApplications();
            const idx = apps.findIndex(a => a.id === finalApp.id);
            if (idx !== -1) {
                apps[idx] = finalApp;
            } else {
                apps.unshift(finalApp);
            }
            saveLocal(APPS_KEY, apps);
            return finalApp;
        },

        updateApplication: async function (id, updates) {
            const apps = this.getApplications();
            const idx = apps.findIndex(a => a.id === id);
            if (idx === -1) return null;
            apps[idx] = Object.assign({}, apps[idx], updates);
            saveLocal(APPS_KEY, apps);

            // Attempt serverless sync
            try {
                const token = NUSC_AUTH.getToken();
                await fetch('/api/applications', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ id, updates })
                });
            } catch (e) {}

            return apps[idx];
        },

        deleteApplication: async function (id) {
            let apps = this.getApplications();
            apps = apps.filter(a => a.id !== id);
            saveLocal(APPS_KEY, apps);

            try {
                const token = NUSC_AUTH.getToken();
                await fetch('/api/applications', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ id })
                });
            } catch (e) {}

            return true;
        },

        addInternalNote: function (appId, author, text) {
            const app = this.getApplicationById(appId);
            if (!app) return null;
            const notes = app.internalNotes || [];
            const newNote = {
                id: 'note_' + Date.now(),
                author: author || 'Admin',
                text: text,
                timestamp: new Date().toISOString()
            };
            notes.unshift(newNote);
            return this.updateApplication(appId, { internalNotes: notes });
        },

        deleteInternalNote: function (appId, noteId) {
            const app = this.getApplicationById(appId);
            if (!app) return null;
            const notes = (app.internalNotes || []).filter(n => n.id !== noteId);
            return this.updateApplication(appId, { internalNotes: notes });
        },

        getEvents: function () {
            return loadLocal(EVENTS_KEY, REAL_EVENTS);
        },

        getEventById: function (id) {
            const events = this.getEvents();
            return events.find(e => e.id === id) || null;
        },

        saveEvent: async function (eventData) {
            const newEvent = Object.assign({
                id: 'evt_' + Date.now(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'published'
            }, eventData);

            const events = this.getEvents();
            events.unshift(newEvent);
            saveLocal(EVENTS_KEY, events);

            try {
                const token = NUSC_AUTH.getToken();
                await fetch('/api/events', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(newEvent)
                });
            } catch (e) {}

            return newEvent;
        },

        updateEvent: async function (id, updates) {
            const events = this.getEvents();
            const idx = events.findIndex(e => e.id === id);
            if (idx === -1) return null;
            updates.updatedAt = new Date().toISOString();
            events[idx] = Object.assign({}, events[idx], updates);
            saveLocal(EVENTS_KEY, events);

            try {
                const token = NUSC_AUTH.getToken();
                await fetch('/api/events', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ id, updates })
                });
            } catch (e) {}

            return events[idx];
        },

        deleteEvent: async function (id) {
            let events = this.getEvents();
            events = events.filter(e => e.id !== id);
            saveLocal(EVENTS_KEY, events);

            try {
                const token = NUSC_AUTH.getToken();
                await fetch('/api/events', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ id })
                });
            } catch (e) {}

            return true;
        },

        getRegistrations: function (eventId) {
            const regMap = loadLocal(REGISTRATIONS_KEY, {});
            return regMap[eventId] || [];
        },

        saveRegistration: async function (eventId, regData) {
            const regMap = loadLocal(REGISTRATIONS_KEY, {});
            if (!regMap[eventId]) regMap[eventId] = [];
            const newReg = Object.assign({
                id: 'reg_' + Date.now(),
                registeredAt: new Date().toISOString(),
                status: 'CONFIRMED'
            }, regData);
            regMap[eventId].unshift(newReg);
            saveLocal(REGISTRATIONS_KEY, regMap);

            try {
                await fetch('/api/registrations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventId, ...regData })
                });
            } catch (e) {}

            return newReg;
        },

        updateRegistrationStatus: async function (eventId, regId, status) {
            const regMap = loadLocal(REGISTRATIONS_KEY, {});
            if (!regMap[eventId]) return null;
            const reg = regMap[eventId].find(r => r.id === regId);
            if (reg) reg.status = status;
            saveLocal(REGISTRATIONS_KEY, regMap);

            try {
                const token = NUSC_AUTH.getToken();
                await fetch('/api/registrations', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ eventId, regId, status })
                });
            } catch (e) {}

            return reg;
        },

        getQuestions: function (department) {
            const qs = loadLocal(QUESTIONS_KEY, REAL_QUESTIONS);
            if (!department || department === 'all') return qs;
            return qs.filter(q => q.department === department.toLowerCase());
        },

        getQuestionById: function (id) {
            const qs = this.getQuestions();
            return qs.find(q => q.id === id) || null;
        },

        addQuestion: function (qData) {
            const qs = this.getQuestions();
            const newQ = Object.assign({
                id: 'q_' + Date.now(),
                active: true,
                order: qs.length + 1
            }, qData);
            qs.push(newQ);
            saveLocal(QUESTIONS_KEY, qs);
            return newQ;
        },

        updateQuestion: function (id, updates) {
            const qs = this.getQuestions();
            const idx = qs.findIndex(q => q.id === id);
            if (idx === -1) return null;
            qs[idx] = Object.assign({}, qs[idx], updates);
            saveLocal(QUESTIONS_KEY, qs);
            return qs[idx];
        },

        toggleQuestionActive: function (id) {
            const q = this.getQuestionById(id);
            if (!q) return null;
            return this.updateQuestion(id, { active: !q.active });
        },

        getStats: function () {
            const apps = this.getApplications();
            const events = this.getEvents();
            const regMap = loadLocal(REGISTRATIONS_KEY, {});

            let totalRegs = 0;
            Object.values(regMap).forEach(list => { totalRegs += (list || []).length; });

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

        exportApplicationsCSV: function (filteredApps) {
            const apps = filteredApps || this.getApplications();
            const headers = ['ID', 'Full Name', 'Email', 'Phone', 'University', 'Year', 'First Preference', 'Second Preference', 'Final Department', 'Status', 'Submitted At'];
            
            const rows = apps.map(a => [
                a.id,
                '"' + (a.fullName || '').replace(/"/g, '""') + '"',
                '"' + (a.email || '').replace(/"/g, '""') + '"',
                '"' + (a.phone || '').replace(/"/g, '""') + '"',
                '"' + (a.university || '').replace(/"/g, '""') + '"',
                '"' + (a.academicYear || '').replace(/"/g, '""') + '"',
                '"' + (a.firstPreference || '').replace(/"/g, '""') + '"',
                '"' + (a.secondPreference || '').replace(/"/g, '""') + '"',
                '"' + (a.finalDepartment || 'Not Assigned').replace(/"/g, '""') + '"',
                '"' + (a.status || '').toUpperCase() + '"',
                '"' + (a.submittedAt || '') + '"'
            ]);

            const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', 'ICPC_NUSC_Real_Applications_' + new Date().toISOString().slice(0, 10) + '.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },

        backupData: function () {
            const bundle = {
                version: '2.0-REAL',
                exportedAt: new Date().toISOString(),
                applications: this.getApplications(),
                events: this.getEvents(),
                registrations: loadLocal(REGISTRATIONS_KEY, {}),
                questions: this.getQuestions()
            };
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundle, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', dataStr);
            downloadAnchor.setAttribute('download', 'NUSC_REAL_DATA_BACKUP_' + new Date().toISOString().slice(0, 10) + '.json');
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        },

        restoreData: function (jsonStr) {
            try {
                const bundle = JSON.parse(jsonStr);
                if (bundle.applications) saveLocal(APPS_KEY, bundle.applications);
                if (bundle.events) saveLocal(EVENTS_KEY, bundle.events);
                if (bundle.registrations) saveLocal(REGISTRATIONS_KEY, bundle.registrations);
                if (bundle.questions) saveLocal(QUESTIONS_KEY, bundle.questions);
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    // SECURE AUTH CLIENT (ZERO HARDCODED PASSWORDS)
    const NUSC_AUTH = {
        login: async function (username, password) {
            if (!username || !password) {
                return { success: false, message: 'Please enter both username and password.' };
            }

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    saveLocal(TOKEN_KEY, data.token);
                    saveLocal(USER_KEY, data.user);
                    return { success: true, session: data.user };
                } else {
                    return { success: false, message: data.error || 'Invalid administrator credentials.' };
                }
            } catch (err) {
                // If API is unreachable, prompt user to ensure server is running
                return { success: false, message: 'Unable to connect to authentication server. Please check backend connection.' };
            }
        },

        logout: async function () {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } catch (e) {}
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            window.location.href = '/admin/login';
        },

        isAuthenticated: function () {
            const token = this.getToken();
            return !!token && token !== 'null' && token !== 'undefined';
        },

        getToken: function () {
            let t = loadLocal(TOKEN_KEY, '');
            if (!t) {
                t = localStorage.getItem(TOKEN_KEY) || '';
            }
            if (typeof t === 'string' && t.startsWith('"') && t.endsWith('"')) {
                try { t = JSON.parse(t); } catch(e) {}
            }
            if (!t || t === 'null' || t === 'undefined') return '';
            return t;
        },

        getAdminUser: function () {
            return loadLocal(USER_KEY, { username: 'cassidy', role: 'Super Admin' });
        },

        requireAuth: function () {
            if (!this.isAuthenticated()) {
                window.location.href = '/admin/login';
                return false;
            }
            return true;
        }
    };

    window.NUSC_DATA_STORE = NUSC_DATA_STORE;
    window.NUSC_AUTH = NUSC_AUTH;

})(window);
