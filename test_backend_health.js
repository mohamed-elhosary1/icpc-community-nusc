/**
 * Comprehensive Backend Health & Integration Test Suite
 * Tests all API endpoints, auth flow, database queries, and security guards.
 */

const DB = require('./api/_db');
const CloudDB = require('./api/_cloud');

// Mock request / response helpers for serverless functions
function createMockReqRes(method, url, body = null, headers = {}) {
    let statusCode = 200;
    let responseHeaders = {};
    let responseData = '';
    let ended = false;

    const req = {
        method,
        url,
        headers: { ...headers },
        body: body,
        on: function(event, callback) {
            if (event === 'data' && body) {
                callback(typeof body === 'string' ? body : JSON.stringify(body));
            }
            if (event === 'end') {
                callback();
            }
        }
    };

    const res = {
        setHeader: function(k, v) {
            responseHeaders[k.toLowerCase()] = v;
        },
        writeHead: function(status, headers = {}) {
            statusCode = status;
            Object.assign(responseHeaders, headers);
        },
        status: function(code) {
            statusCode = code;
            return this;
        },
        end: function(data) {
            if (data) responseData = data;
            ended = true;
        },
        send: function(data) {
            if (typeof data === 'object') {
                responseData = JSON.stringify(data);
            } else {
                responseData = data || '';
            }
            ended = true;
        }
    };

    return {
        req,
        res,
        getResult: () => {
            let parsed = null;
            try {
                parsed = JSON.parse(responseData);
            } catch (e) {
                parsed = responseData;
            }
            return {
                status: statusCode,
                headers: responseHeaders,
                data: parsed
            };
        }
    };
}

async function runTests() {
    console.log('====================================================');
    console.log('   ICPC NUSC BACKEND HEALTH & ENDPOINT TEST SUITE   ');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, testName, details = '') {
        if (condition) {
            console.log(`[PASS] ${testName}`);
            passed++;
        } else {
            console.error(`[FAIL] ${testName}: ${details}`);
            failed++;
        }
    }

    // 1. Test CloudDB Direct Queries
    console.log('--- 1. Testing Supabase CloudDB Layer ---');
    try {
        const participants = await CloudDB.getParticipants();
        assert(Array.isArray(participants), 'CloudDB.getParticipants() returns array', `Count: ${participants.length}`);
        assert(participants.length > 0, 'CloudDB.getParticipants() has live records', `Records found: ${participants.length}`);

        const apps = await CloudDB.getApplications();
        assert(Array.isArray(apps), 'CloudDB.getApplications() returns array', `Count: ${apps.length}`);

        const regs = await CloudDB.getEventRegistrations();
        assert(Array.isArray(regs), 'CloudDB.getEventRegistrations() returns array', `Count: ${regs.length}`);

        const stats = await CloudDB.getCalculatedStats();
        assert(stats && stats.totalParticipants === participants.length, 'CloudDB.getCalculatedStats() aggregates match participants count', `Stats: ${stats.totalParticipants}, List: ${participants.length}`);
        assert(stats && stats.totalRegistrations === regs.length, 'CloudDB.getCalculatedStats() aggregates match registrations count', `Stats: ${stats.totalRegistrations}, List: ${regs.length}`);
    } catch (e) {
        assert(false, 'CloudDB query execution failed', e.message);
    }

    // 2. Test Auth Flow: Invalid credentials
    console.log('\n--- 2. Testing Auth API (/api/auth/login) ---');
    try {
        const loginHandler = require('./api/auth/login');

        // Bad login
        const badLogin = createMockReqRes('POST', '/api/auth/login', { username: 'cassidy', password: 'wrongpassword' });
        await loginHandler(badLogin.req, badLogin.res);
        const badRes = badLogin.getResult();
        assert(badRes.status === 401, 'POST /api/auth/login rejects invalid password with 401', `Status: ${badRes.status}`);

        // Good login
        const goodLogin = createMockReqRes('POST', '/api/auth/login', { username: 'cassidy', password: '1046579435' });
        await loginHandler(goodLogin.req, goodLogin.res);
        const goodRes = goodLogin.getResult();
        assert(goodRes.status === 200 && goodRes.data.success && goodRes.data.token, 'POST /api/auth/login authenticates admin and generates token');
        
        var adminToken = goodRes.data.token;

        // Verify token endpoint
        const verifyHandler = require('./api/auth/verify');
        const verifyGood = createMockReqRes('GET', '/api/auth/verify', null, { 'authorization': `Bearer ${adminToken}` });
        await verifyHandler(verifyGood.req, verifyGood.res);
        assert(verifyGood.getResult().status === 200, 'GET /api/auth/verify accepts valid admin token with 200');

        const verifyBad = createMockReqRes('GET', '/api/auth/verify', null, { 'authorization': 'Bearer fake_invalid_token' });
        await verifyHandler(verifyBad.req, verifyBad.res);
        assert(verifyBad.getResult().status === 401, 'GET /api/auth/verify rejects fake token with 401');
    } catch (e) {
        assert(false, 'Auth test failed', e.message);
    }

    // 3. Test Participants Endpoint
    console.log('\n--- 3. Testing Participants API (/api/participants) ---');
    try {
        const participantsHandler = require('./api/participants');

        // Unauthorized admin GET
        const unauthGet = createMockReqRes('GET', '/api/participants');
        await participantsHandler(unauthGet.req, unauthGet.res);
        assert(unauthGet.getResult().status === 401, 'GET /api/participants rejects unauthorized admin request with 401');

        // Authorized admin GET
        const authGet = createMockReqRes('GET', '/api/participants', null, { 'authorization': `Bearer ${adminToken}` });
        await participantsHandler(authGet.req, authGet.res);
        const authRes = authGet.getResult();
        assert(authRes.status === 200 && Array.isArray(authRes.data.participants), 'GET /api/participants returns live participants list with 200 for authorized admin', `Found: ${authRes.data.participants ? authRes.data.participants.length : 0}`);

        // Public lookup by ID
        const samplePart = authRes.data.participants[0];
        if (samplePart) {
            const lookupGet = createMockReqRes('GET', `/api/participants?lookup=${encodeURIComponent(samplePart.registration_id)}`);
            await participantsHandler(lookupGet.req, lookupGet.res);
            const lookupRes = lookupGet.getResult();
            assert(lookupRes.status === 200 && lookupRes.data.participant && lookupRes.data.participant.registration_id === samplePart.registration_id, 'GET /api/participants?lookup=... resolves existing participant registration');

            const missingGet = createMockReqRes('GET', '/api/participants?lookup=NUSC-NON-EXISTENT-XYZ');
            await participantsHandler(missingGet.req, missingGet.res);
            assert(missingGet.getResult().status === 404, 'GET /api/participants?lookup=... returns 404 for non-existent lookup');

            // POST closed test (Recruitment closed 403)
            const postPart = createMockReqRes('POST', '/api/participants', {
                universityConfirmed: true,
                fullName: 'Test Participant',
                email: 'test@student.nusc.edu.eg',
                phone: '01099998888',
                faculty: 'Science',
                academicYear: 'First Year',
                level: 'Level 1: Beginner'
            });
            await participantsHandler(postPart.req, postPart.res);
            const postRes = postPart.getResult();
            assert(postRes.status === 403 && postRes.data.code === 'RECRUITMENT_CLOSED', 'POST /api/participants is strictly closed with 403 RECRUITMENT_CLOSED');
        }
    } catch (e) {
        assert(false, 'Participants endpoint test failed', e.message);
    }

    // 4. Test Event Registrations Lockout (Must be 403)
    console.log('\n--- 4. Testing Event Registrations API (/api/registrations) ---');
    try {
        const registrationsHandler = require('./api/registrations');

        // Test POST (Must be blocked 403)
        const postReg = createMockReqRes('POST', '/api/registrations', {
            fullName: 'Test Student',
            email: 'test@student.nusc.edu.eg',
            phone: '01012345678',
            faculty: 'Science',
            academicYear: 'First Year',
            isNuscStudent: true
        });
        await registrationsHandler(postReg.req, postReg.res);
        const postRes = postReg.getResult();
        assert(postRes.status === 403 && postRes.data.code === 'REGISTRATIONS_CLOSED', 'POST /api/registrations is strictly closed with 403 REGISTRATIONS_CLOSED');

        // Test Authorized GET for Admin
        const getRegs = createMockReqRes('GET', '/api/registrations', null, { 'authorization': `Bearer ${adminToken}` });
        await registrationsHandler(getRegs.req, getRegs.res);
        const getRes = getRegs.getResult();
        assert(getRes.status === 200 && Array.isArray(getRes.data.registrations), 'GET /api/registrations returns registrations list for admin with 200', `Count: ${getRes.data.registrations ? getRes.data.registrations.length : 0}`);
    } catch (e) {
        assert(false, 'Registrations endpoint test failed', e.message);
    }

    // 5. Test Applications Endpoint
    console.log('\n--- 5. Testing Applications API (/api/applications) ---');
    try {
        const appsHandler = require('./api/applications');

        // POST (Organizing team recruitment closed 403)
        const postApp = createMockReqRes('POST', '/api/applications', { fullName: 'Applicant', email: 'app@nusc.eg' });
        await appsHandler(postApp.req, postApp.res);
        assert(postApp.getResult().status === 403, 'POST /api/applications is closed with 403 RECRUITMENT_CLOSED');

        // Authorized GET for Admin
        const getApps = createMockReqRes('GET', '/api/applications', null, { 'authorization': `Bearer ${adminToken}` });
        await appsHandler(getApps.req, getApps.res);
        assert(getApps.getResult().status === 200 && Array.isArray(getApps.getResult().data.applications), 'GET /api/applications returns applications list for admin with 200');
    } catch (e) {
        assert(false, 'Applications endpoint test failed', e.message);
    }

    // 6. Test Stats API
    console.log('\n--- 6. Testing Stats API (/api/stats) ---');
    try {
        const statsHandler = require('./api/stats');
        const getStats = createMockReqRes('GET', '/api/stats');
        await statsHandler(getStats.req, getStats.res);
        const statsRes = getStats.getResult();
        assert(statsRes.status === 200 && typeof statsRes.data.totalParticipants === 'number', 'GET /api/stats returns live aggregated stats with 200', `Participants: ${statsRes.data.totalParticipants}`);
        console.log('   Live Stats Summary:', JSON.stringify(statsRes.data));
    } catch (e) {
        assert(false, 'Stats endpoint test failed', e.message);
    }

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
});
