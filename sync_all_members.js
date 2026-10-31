/**
 * sync_all_members.js
 * Imports all 139 community participants into nusc_users and fetches live Codeforces data.
 */

const CloudDB = require('./api/_cloud');
const CodeforcesService = require('./api/_codeforces');
const StudentService = require('./api/_student');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gpzwlxbmgpmydgywxtdo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zbshKRcot5UDfjvtMJx4gQ_c9a9-of9';

function getHeaders() {
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
}

function cleanHandle(raw) {
    if (!raw) return null;
    let h = String(raw).trim();
    if (h.includes('codeforces.com/profile/')) {
        h = h.split('codeforces.com/profile/')[1].split('/')[0].split('?')[0];
    }
    h = h.replace(/^[./\\]+/, '').replace(/[./\\]+$/, '').trim();
    if (!h || h === '.' || h.includes(' ') || /[\u0600-\u06FF]/.test(h)) {
        return null;
    }
    return h;
}

function mapLevelToWave(levelStr) {
    const l = (levelStr || '').toLowerCase();
    if (l.includes('3') || l.includes('advanced')) return 'Wave 3';
    if (l.includes('2') || l.includes('intermediate')) return 'Wave 2';
    return 'Wave 1';
}

async function run() {
    console.log('--- 1. Fetching Participants & Users from Supabase ---');
    const participants = await CloudDB.getParticipants();
    console.log(`Found ${participants.length} participants in nusc_participants.`);

    const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_users?select=*`, { headers: getHeaders() });
    if (!usersRes.ok) throw new Error(`Failed to fetch nusc_users: ${usersRes.status}`);
    const existingUsers = await usersRes.json();
    console.log(`Found ${existingUsers.length} existing users in nusc_users.`);

    const userEmailMap = new Map();
    existingUsers.forEach(u => {
        if (u.email) userEmailMap.set(u.email.toLowerCase().trim(), u);
    });

    const toInsert = [];
    const toUpdate = [];

    for (const p of participants) {
        if (!p.email) continue;
        const emailLower = p.email.toLowerCase().trim();
        const handle = cleanHandle(p.codeforces_handle);
        const wave = mapLevelToWave(p.level);

        if (userEmailMap.has(emailLower)) {
            // Already in nusc_users, check if handle or registration_code needs updating
            const existing = userEmailMap.get(emailLower);
            let needsUpdate = false;
            const patch = {};

            if (!existing.registration_code && p.registration_id) {
                patch.registration_code = p.registration_id;
                needsUpdate = true;
            }
            if (!existing.codeforces_handle && handle) {
                patch.codeforces_handle = handle;
                needsUpdate = true;
            }
            if (!existing.wave && wave) {
                patch.wave = wave;
                needsUpdate = true;
            }
            if (needsUpdate) {
                toUpdate.push({ id: existing.id, patch });
            }
        } else {
            // New user to insert
            const regCode = p.registration_id || `NUSC-PAR26-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
            const { hash, salt } = StudentService.hashPassword(regCode);

            toInsert.push({
                id: crypto.randomUUID(),
                email: emailLower,
                password_hash: hash,
                password_salt: salt,
                full_name: (p.full_name || '').trim(),
                phone: (p.phone || '').trim(),
                faculty: (p.faculty || 'Computers and AI').trim(),
                academic_year: (p.academic_year || 'Level 1').trim(),
                wave: wave,
                registration_code: regCode,
                codeforces_handle: handle,
                cf_verified: false,
                role: 'student',
                status: 'active',
                created_at: p.created_at || new Date().toISOString()
            });
        }
    }

    console.log(`To insert into nusc_users: ${toInsert.length}`);
    console.log(`To update in nusc_users: ${toUpdate.length}`);

    // Insert new users in chunks
    if (toInsert.length > 0) {
        const chunkSize = 25;
        for (let i = 0; i < toInsert.length; i += chunkSize) {
            const chunk = toInsert.slice(i, i + chunkSize);
            const insRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_users`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(chunk)
            });
            if (!insRes.ok) {
                const err = await insRes.text();
                console.error(`Error inserting chunk ${i / chunkSize}: ${err}`);
            } else {
                console.log(`Inserted chunk of ${chunk.length} members...`);
            }
        }
    }

    // Apply updates
    for (const u of toUpdate) {
        await fetch(`${SUPABASE_URL}/rest/v1/nusc_users?id=eq.${u.id}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(u.patch)
        });
    }

    console.log('--- 2. Syncing Codeforces Stats for all Members ---');
    const allUsersRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_users?status=eq.active&select=id,full_name,codeforces_handle`, { headers: getHeaders() });
    const allUsers = await allUsersRes.json();
    const withCF = allUsers.filter(u => u.codeforces_handle);
    console.log(`Total students in nusc_users: ${allUsers.length}, with CF handle: ${withCF.length}`);

    let synced = 0;
    for (const u of withCF) {
        try {
            console.log(`Syncing Codeforces for: ${u.codeforces_handle} (${u.full_name})...`);
            const stats = await CodeforcesService.getUserInfo(u.codeforces_handle);
            if (stats) {
                console.log(`  -> Rating: ${stats.rating || 0}, Solved: ${stats.solved_count || 0}, Rank: ${stats.rank || 'unrated'}`);
                synced++;
            }
        } catch (e) {
            console.log(`  -> Codeforces note: ${e.message}`);
        }
        // Small delay to be polite to Codeforces rate limits
        await new Promise(r => setTimeout(r, 400));
    }

    console.log(`\n=================================================`);
    console.log(`SUCCESS: Enrolled ${allUsers.length} total members into student portal.`);
    console.log(`Synchronized Codeforces data for ${synced} handles.`);
    console.log(`=================================================`);
}

run().catch(console.error);
