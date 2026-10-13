const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js/dist/sql-asm.js');

let db = null;
const tmpDbPath = '/tmp/election.db';

const EMBEDDED_SEED_SQL = `
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS constituencies (
    constituency_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    state VARCHAR(50) NOT NULL,
    total_voters INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS parties (
    party_id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_name VARCHAR(100) NOT NULL UNIQUE,
    abbreviation VARCHAR(10) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    leader_name VARCHAR(100) NOT NULL,
    manifesto TEXT
);

CREATE TABLE IF NOT EXISTS candidates (
    candidate_id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name VARCHAR(100) NOT NULL,
    party_id INTEGER NOT NULL,
    constituency_id INTEGER NOT NULL,
    age INTEGER NOT NULL,
    education VARCHAR(50) NOT NULL,
    criminal_cases INTEGER DEFAULT 0,
    assets_declared DOUBLE DEFAULT 0.0,
    votes_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS voters (
    voter_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    epic_no VARCHAR(20) NOT NULL UNIQUE,
    dob VARCHAR(10) NOT NULL,
    age INTEGER NOT NULL,
    gender VARCHAR(10) NOT NULL,
    constituency_id INTEGER NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(15) NOT NULL,
    is_verified INTEGER DEFAULT 1,
    has_voted INTEGER DEFAULT 0,
    voted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS votes (
    vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
    constituency_id INTEGER NOT NULL,
    candidate_id INTEGER NOT NULL,
    ballot_hash VARCHAR(64) NOT NULL UNIQUE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type VARCHAR(50) NOT NULL,
    performed_by VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO constituencies (constituency_id, name, state, total_voters, status) VALUES
(1, 'New Delhi Central', 'Delhi', 4, 'ACTIVE'),
(2, 'Mumbai South', 'Maharashtra', 3, 'ACTIVE'),
(3, 'Bengaluru South', 'Karnataka', 3, 'ACTIVE'),
(4, 'Chennai Central', 'Tamil Nadu', 2, 'ACTIVE');

INSERT OR IGNORE INTO parties (party_id, party_name, abbreviation, symbol, leader_name, manifesto) VALUES
(1, 'National Democratic Alliance', 'NDA', 'Lotus', 'J. P. Nadda', 'Infrastructure, Economic Growth, Digital Governance'),
(2, 'United Progressive Alliance', 'UPA', 'Hand', 'Mallikarjun Kharge', 'Social Welfare, Rural Employment, Education Reform'),
(3, 'Aam Aadmi Party', 'AAP', 'Broom', 'Arvind Kejriwal', 'Healthcare Clinics, Free Electricity, Public Schools'),
(4, 'Independent Coalition', 'IND', 'Kite', 'Self-Nominated', 'Constituency Development, Civic Amenities, Transparency');

INSERT OR IGNORE INTO candidates (candidate_id, full_name, party_id, constituency_id, age, education, criminal_cases, assets_declared, votes_count) VALUES
(1, 'Rajesh Sharma', 1, 1, 48, 'Post Graduate (Economics)', 0, 45000000.0, 0),
(2, 'Priya Venkat', 2, 1, 42, 'LL.B. (Constitutional Law)', 0, 28000000.0, 0),
(3, 'Sanjay Gupta', 3, 1, 38, 'B.Tech (Computer Science)', 0, 15000000.0, 0),
(4, 'Alok Mathur', 4, 1, 51, 'M.A. (Public Policy)', 0, 8500000.0, 0),
(5, 'Aditya Deshmukh', 1, 2, 45, 'M.B.A. (Finance)', 0, 62000000.0, 0),
(6, 'Farhan Merchant', 2, 2, 53, 'Chartered Accountant', 0, 51000000.0, 0),
(7, 'Sunita Kadam', 3, 2, 39, 'M.S.W. (Social Work)', 0, 9500000.0, 0),
(8, 'Dr. Ramesh Rao', 1, 3, 50, 'Ph.D. (Electronics)', 0, 39000000.0, 0),
(9, 'Ananya Murthy', 2, 3, 36, 'M.Sc. (Data Science)', 0, 22000000.0, 0),
(10, 'Deepak Gowda', 4, 3, 44, 'Graduate (Commerce)', 0, 14000000.0, 0),
(11, 'S. Ramakrishnan', 1, 4, 55, 'B.L. (Law)', 0, 33000000.0, 0),
(12, 'Kavitha Selvam', 2, 4, 41, 'M.A. (Literature)', 0, 19000000.0, 0);

INSERT OR IGNORE INTO users (user_id, username, password, full_name, role, email) VALUES
(1, 'admin', 'admin123', 'Chief Election Commissioner', 'ADMIN', 'cec@eci.gov.in'),
(2, 'officer_delhi', 'officer123', 'Returning Officer Delhi', 'OFFICER', 'ro.delhi@eci.gov.in'),
(3, 'voter1', 'voter123', 'Aarav Patel', 'VOTER', 'aarav@gmail.com'),
(4, 'voter2', 'voter123', 'Sneha Iyer', 'VOTER', 'sneha@gmail.com'),
(5, 'voter3', 'voter123', 'Rohan Mehta', 'VOTER', 'rohan@gmail.com');

INSERT OR IGNORE INTO voters (voter_id, user_id, epic_no, dob, age, gender, constituency_id, address, phone, is_verified, has_voted) VALUES
(1, 3, 'ECI781901', '2001-05-14', 25, 'Male', 1, '12, Connaught Place, New Delhi', '9876543210', 1, 0),
(2, 4, 'ECI781902', '1998-11-20', 27, 'Female', 1, '45, Barakhamba Road, New Delhi', '9812345678', 1, 0),
(3, 5, 'ECI892101', '1995-02-10', 31, 'Male', 2, '78, Marine Drive, Mumbai', '9723456789', 1, 0);
`;

async function getDatabase() {
    if (db) return db;

    const SQL = await initSqlJs();

    // 1. Try reading existing /tmp/election.db
    if (fs.existsSync(tmpDbPath)) {
        try {
            const data = fs.readFileSync(tmpDbPath);
            db = new SQL.Database(data);
            return db;
        } catch (e) {
            console.error('[ECMS] Could not read /tmp/election.db:', e.message);
        }
    }

    // 2. Try reading bundled election.db in various possible paths
    const possiblePaths = [
        path.join(process.cwd(), 'election.db'),
        path.join(__dirname, '..', 'election.db'),
        path.join(__dirname, 'election.db')
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            try {
                const data = fs.readFileSync(p);
                db = new SQL.Database(data);
                saveDatabase();
                return db;
            } catch (e) {
                console.error('[ECMS] Failed reading db at ' + p + ':', e.message);
            }
        }
    }

    // 3. Fallback: Initialize in-memory database using embedded DDL & seeds
    console.log('[ECMS] Initializing SQLite database from embedded seed schema...');
    db = new SQL.Database();
    db.run(EMBEDDED_SEED_SQL);
    saveDatabase();
    return db;
}

function saveDatabase() {
    if (!db) return;
    try {
        const data = db.export();
        fs.writeFileSync(tmpDbPath, Buffer.from(data));
    } catch (e) {
        // Read-only filesystem warning ignore
    }
}

function queryAll(database, sql, params = []) {
    const stmt = database.prepare(sql);
    if (params && params.length > 0) {
        stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

function queryOne(database, sql, params = []) {
    const rows = queryAll(database, sql, params);
    return rows.length > 0 ? rows[0] : null;
}

function runSql(database, sql, params = []) {
    const stmt = database.prepare(sql);
    if (params && params.length > 0) {
        stmt.bind(params);
    }
    stmt.step();
    stmt.free();
    saveDatabase();
}

function getAction(req) {
    let action = '';

    // Check query params
    if (req.query) {
        if (req.query.action) action = req.query.action;
        else if (req.query.path) action = req.query.path;
        else if (req.query.match) action = req.query.match;
    }

    // Check URL search params
    if (!action && req.url) {
        try {
            const parsed = new URL(req.url, 'http://localhost');
            action = parsed.searchParams.get('action') || parsed.searchParams.get('path') || '';
        } catch (e) {}
    }

    // Check Vercel headers
    if (!action && req.headers) {
        const headerPath = req.headers['x-matched-path'] || req.headers['x-forwarded-url'] || '';
        if (headerPath) {
            action = headerPath.replace(/^\/api\/?/, '');
        }
    }

    // Check req.url path
    if (!action && req.url) {
        try {
            const parsed = new URL(req.url, 'http://localhost');
            action = parsed.pathname.replace(/^\/api\/?/, '');
        } catch (e) {}
    }

    // Clean action
    return (action || '').split('?')[0].replace(/^\/+|\/+$/g, '').toLowerCase();
}

async function getBody(req) {
    if (!req) return {};
    const m = (req.method || 'GET').toUpperCase();
    if (m === 'GET' || m === 'HEAD') return {};

    if (req.body) {
        if (typeof req.body === 'string') {
            try { return JSON.parse(req.body); } catch (e) { return {}; }
        }
        return req.body;
    }

    if (typeof req.on === 'function') {
        return new Promise((resolve) => {
            let buffer = '';
            req.on('data', chunk => { buffer += chunk; });
            req.on('end', () => {
                try { resolve(buffer ? JSON.parse(buffer) : {}); }
                catch (e) { resolve({}); }
            });
            req.on('error', () => resolve({}));
        });
    }

    return {};
}

function getQueryParam(req, param) {
    if (req.query && req.query[param] !== undefined) return req.query[param];
    try {
        const parsed = new URL(req.url, 'http://localhost');
        return parsed.searchParams.get(param);
    } catch (e) {
        return null;
    }
}

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    const action = getAction(req);
    const method = req.method ? req.method.toUpperCase() : 'GET';
    const body = await getBody(req);

    try {
        const database = await getDatabase();

        // 1. POST /api/login
        if (action === 'login' && method === 'POST') {
            const username = (body.username || '').trim();
            const password = (body.password || '').trim();

            if (!username || !password) {
                res.status(200).json({ success: false, message: 'Username and password are required.' });
                return;
            }

            const user = queryOne(database,
                'SELECT user_id, username, full_name, role, email FROM users WHERE username = ? AND password = ?',
                [username, password]
            );

            if (user) {
                let voter = null;
                if (user.role === 'VOTER') {
                    voter = queryOne(database,
                        'SELECT v.voter_id, v.user_id, v.epic_no, u.full_name, v.dob, v.age, v.gender, ' +
                        '       v.constituency_id, c.name AS constituency_name, c.state AS constituency_state, ' +
                        '       v.address, v.phone, v.is_verified, v.has_voted, v.voted_at ' +
                        'FROM voters v ' +
                        'JOIN users u ON v.user_id = u.user_id ' +
                        'JOIN constituencies c ON v.constituency_id = c.constituency_id ' +
                        'WHERE u.user_id = ?',
                        [user.user_id]
                    );
                    if (voter) {
                        voter.isVerified = voter.is_verified === 1;
                        voter.hasVoted = voter.has_voted === 1;
                    }
                }

                runSql(database,
                    'INSERT INTO audit_logs (action_type, performed_by, description) VALUES (?, ?, ?)',
                    ['USER_LOGIN', username, `Successful login by ${user.role}: ${username}`]
                );

                res.status(200).json({
                    success: true,
                    message: `Login successful! Welcome ${user.full_name}.`,
                    user: {
                        userId: user.user_id,
                        username: user.username,
                        fullName: user.full_name,
                        role: user.role,
                        email: user.email || ''
                    },
                    voter: voter ? {
                        voterId: voter.voter_id,
                        userId: voter.user_id,
                        epicNo: voter.epic_no,
                        fullName: voter.full_name,
                        dob: voter.dob,
                        age: voter.age,
                        gender: voter.gender,
                        constituencyId: voter.constituency_id,
                        constituencyName: voter.constituency_name,
                        constituencyState: voter.constituency_state,
                        address: voter.address,
                        phone: voter.phone,
                        isVerified: voter.isVerified,
                        hasVoted: voter.hasVoted,
                        votedAt: voter.voted_at || ''
                    } : null
                });
            } else {
                res.status(200).json({ success: false, message: 'Invalid credentials. Please verify your username and password.' });
            }
            return;
        }

        // 2. POST /api/register
        if (action === 'register' && method === 'POST') {
            const { fullName, dob, gender, constituencyId, address, phone, username, password, email } = body;

            if (!fullName || !dob || !gender || !address || !phone || !username || !password) {
                res.status(200).json({ success: false, message: 'All required fields must be filled.' });
                return;
            }

            // Article 326 Age calculation
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            if (isNaN(age) || birthDate > today) {
                res.status(200).json({ success: false, message: 'Invalid Date of Birth.' });
                return;
            }

            if (age < 18) {
                res.status(200).json({
                    success: false,
                    message: `ELIGIBILITY REJECTED: Voter is ${age} years old. Under Article 326 of the Constitution & Representation of the People Act, citizens must be at least 18 years of age to register as an elector.`
                });
                return;
            }

            // Check if username already exists
            const existing = queryOne(database, 'SELECT user_id FROM users WHERE username = ?', [username.trim()]);
            if (existing) {
                res.status(200).json({ success: false, message: `Username '${username}' is already registered. Please choose another username.` });
                return;
            }

            const epicNo = 'ECI' + Math.floor(100000 + Math.random() * 900000);

            // Insert user
            runSql(database,
                'INSERT INTO users (username, password, full_name, role, email) VALUES (?, ?, ?, "VOTER", ?)',
                [username.trim(), password.trim(), fullName.trim(), email || '']
            );

            const newUser = queryOne(database, 'SELECT user_id FROM users WHERE username = ?', [username.trim()]);
            const newUserId = newUser ? newUser.user_id : null;

            if (!newUserId) {
                res.status(200).json({ success: false, message: 'Failed to create user record.' });
                return;
            }

            const constId = parseInt(constituencyId, 10) || 1;

            // Insert voter
            runSql(database,
                'INSERT INTO voters (user_id, epic_no, dob, age, gender, constituency_id, address, phone, is_verified, has_voted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)',
                [newUserId, epicNo, dob, age, gender, constId, address.trim(), phone.trim()]
            );

            // Increment total_voters
            runSql(database, 'UPDATE constituencies SET total_voters = total_voters + 1 WHERE constituency_id = ?', [constId]);

            // Audit
            runSql(database,
                'INSERT INTO audit_logs (action_type, performed_by, description) VALUES (?, ?, ?)',
                ['VOTER_REGISTRATION', username.trim(), `New voter registered: ${fullName} (EPIC: ${epicNo}, Age: ${age})`]
            );

            res.status(200).json({
                success: true,
                message: 'Voter Registration Approved! Welcome to the Electoral Roll.',
                epicNo: epicNo,
                age: age,
                username: username.trim()
            });
            return;
        }

        // 3. GET /api/constituencies
        if (action === 'constituencies' && method === 'GET') {
            const rows = queryAll(database, 'SELECT constituency_id, name, state, total_voters, status FROM constituencies ORDER BY name ASC');
            const result = rows.map(r => ({
                constituencyId: r.constituency_id,
                name: r.name,
                state: r.state,
                totalVoters: r.total_voters,
                status: r.status
            }));
            res.status(200).json(result);
            return;
        }

        // 4. GET /api/parties
        if (action === 'parties' && method === 'GET') {
            const rows = queryAll(database, 'SELECT party_id, party_name, abbreviation, symbol, leader_name, manifesto FROM parties ORDER BY party_name ASC');
            const result = rows.map(r => ({
                partyId: r.party_id,
                partyName: r.party_name,
                abbreviation: r.abbreviation,
                symbol: r.symbol,
                leaderName: r.leader_name,
                manifesto: r.manifesto || ''
            }));
            res.status(200).json(result);
            return;
        }

        // 5. GET /api/candidates
        if (action === 'candidates' && method === 'GET') {
            const constId = parseInt(getQueryParam(req, 'constituencyId') || '1', 10);
            const rows = queryAll(database,
                'SELECT c.candidate_id, c.full_name, c.party_id, p.party_name, p.abbreviation, p.symbol, ' +
                '       c.constituency_id, con.name AS constituency_name, c.age, c.education, c.criminal_cases, ' +
                '       c.assets_declared, c.votes_count ' +
                'FROM candidates c ' +
                'JOIN parties p ON c.party_id = p.party_id ' +
                'JOIN constituencies con ON c.constituency_id = con.constituency_id ' +
                'WHERE c.constituency_id = ? ' +
                'ORDER BY c.candidate_id ASC',
                [constId]
            );
            const result = rows.map(r => ({
                candidateId: r.candidate_id,
                fullName: r.full_name,
                partyId: r.party_id,
                partyName: r.party_name,
                partyAbbreviation: r.abbreviation,
                symbol: r.symbol,
                constituencyId: r.constituency_id,
                constituencyName: r.constituency_name,
                age: r.age,
                education: r.education,
                criminalCases: r.criminal_cases,
                assetsDeclared: r.assets_declared,
                votesCount: r.votes_count,
                votePercentage: 0.0
            }));
            res.status(200).json(result);
            return;
        }

        // 6. POST /api/vote
        if (action === 'vote' && method === 'POST') {
            const voterId = parseInt(body.voterId, 10);
            const candidateId = parseInt(body.candidateId, 10);

            if (!voterId || !candidateId) {
                res.status(200).json({ success: false, message: 'Invalid voter or candidate identifier.' });
                return;
            }

            const voter = queryOne(database,
                'SELECT v.has_voted, v.constituency_id, v.epic_no, u.full_name ' +
                'FROM voters v JOIN users u ON v.user_id = u.user_id WHERE v.voter_id = ?',
                [voterId]
            );

            if (!voter) {
                res.status(200).json({ success: false, message: 'Voter record not found.' });
                return;
            }

            if (voter.has_voted === 1) {
                res.status(200).json({ success: false, message: 'ACCESS DENIED: You have already cast your vote! Duplicate voting is prohibited.' });
                return;
            }

            const candidate = queryOne(database,
                'SELECT c.full_name, c.constituency_id, p.party_name, p.symbol ' +
                'FROM candidates c JOIN parties p ON c.party_id = p.party_id WHERE c.candidate_id = ?',
                [candidateId]
            );

            if (!candidate) {
                res.status(200).json({ success: false, message: 'Invalid candidate selected.' });
                return;
            }

            if (voter.constituency_id !== candidate.constituency_id) {
                res.status(200).json({ success: false, message: 'Security Exception: Candidate is not contesting in your registered constituency.' });
                return;
            }

            // Generate SHA-256 ballot receipt
            const ballotHash = crypto.createHash('sha256')
                .update(`BALLOT-${voterId}-${candidateId}-${Date.now()}`)
                .digest('hex').toUpperCase();

            const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

            // Execute atomic transaction
            runSql(database, 'INSERT INTO votes (constituency_id, candidate_id, ballot_hash) VALUES (?, ?, ?)',
                [voter.constituency_id, candidateId, ballotHash]);
            runSql(database, 'UPDATE candidates SET votes_count = votes_count + 1 WHERE candidate_id = ?',
                [candidateId]);
            runSql(database, 'UPDATE voters SET has_voted = 1, voted_at = CURRENT_TIMESTAMP WHERE voter_id = ?',
                [voterId]);
            runSql(database, 'INSERT INTO audit_logs (action_type, performed_by, description) VALUES (?, ?, ?)',
                ['VOTE_CAST_COMPLETED', voter.epic_no, `Vote cast by EPIC: ${voter.epic_no} in Constituency ID: ${voter.constituency_id}. VVPAT Hash: ${ballotHash.substring(0, 16)}...`]);

            res.status(200).json({
                success: true,
                message: 'Vote recorded successfully!',
                receipt: {
                    candidateName: candidate.full_name,
                    partyName: candidate.party_name,
                    symbol: candidate.symbol,
                    timestamp: timestampStr,
                    ballotHash: ballotHash,
                    epicNo: voter.epic_no,
                    voterName: voter.full_name
                }
            });
            return;
        }

        // 7. GET /api/results
        if (action === 'results' && method === 'GET') {
            const votesPerConst = {};
            const voteRows = queryAll(database, 'SELECT constituency_id, COUNT(*) AS total FROM votes GROUP BY constituency_id');
            voteRows.forEach(r => { votesPerConst[r.constituency_id] = r.total; });

            const candRows = queryAll(database,
                'SELECT c.candidate_id, c.full_name, c.party_id, p.party_name, p.abbreviation, p.symbol, ' +
                '       c.constituency_id, con.name AS constituency_name, c.age, c.education, c.criminal_cases, ' +
                '       c.assets_declared, c.votes_count ' +
                'FROM candidates c ' +
                'JOIN parties p ON c.party_id = p.party_id ' +
                'JOIN constituencies con ON c.constituency_id = con.constituency_id ' +
                'ORDER BY con.name, c.votes_count DESC'
            );

            const candidates = candRows.map(c => {
                const totalInConst = votesPerConst[c.constituency_id] || 0;
                const votePct = totalInConst > 0 ? (c.votes_count * 100.0 / totalInConst) : 0.0;
                return {
                    candidateId: c.candidate_id,
                    fullName: c.full_name,
                    partyId: c.party_id,
                    partyName: c.party_name,
                    partyAbbreviation: c.abbreviation,
                    symbol: c.symbol,
                    constituencyId: c.constituency_id,
                    constituencyName: c.constituency_name,
                    age: c.age,
                    education: c.education,
                    criminalCases: c.criminal_cases,
                    assetsDeclared: c.assets_declared,
                    votesCount: c.votes_count,
                    votePercentage: votePct
                };
            });

            res.status(200).json({ success: true, candidates });
            return;
        }

        // 8. GET /api/admin/stats
        if (action === 'admin/stats' && method === 'GET') {
            const vRow = queryOne(database, 'SELECT COUNT(*) AS total FROM voters');
            const totalVoters = vRow ? vRow.total : 0;

            const vtRow = queryOne(database, 'SELECT COUNT(*) AS total FROM votes');
            const totalVotes = vtRow ? vtRow.total : 0;

            const turnout = totalVoters > 0 ? (totalVotes * 100.0 / totalVoters) : 0.0;

            const constRows = queryAll(database,
                'SELECT c.constituency_id, c.name, c.state, ' +
                '       (SELECT COUNT(*) FROM voters v WHERE v.constituency_id = c.constituency_id) AS registered_count, ' +
                '       (SELECT COUNT(*) FROM votes vt WHERE vt.constituency_id = c.constituency_id) AS votes_cast ' +
                'FROM constituencies c'
            );

            const constituencies = constRows.map(r => {
                const reg = r.registered_count || 0;
                const cast = r.votes_cast || 0;
                const pct = reg > 0 ? (cast * 100.0 / reg) : 0.0;
                return {
                    id: r.constituency_id,
                    name: r.name,
                    state: r.state,
                    registered: reg,
                    cast: cast,
                    turnout: pct
                };
            });

            res.status(200).json({ totalVoters, totalVotes, turnout, constituencies });
            return;
        }

        // 9. GET /api/admin/voters
        if (action === 'admin/voters' && method === 'GET') {
            const rows = queryAll(database,
                'SELECT v.voter_id, v.epic_no, u.username, u.full_name, v.dob, v.age, v.gender, ' +
                '       c.name AS constituency_name, v.phone, v.is_verified, v.has_voted, v.voted_at ' +
                'FROM voters v ' +
                'JOIN users u ON v.user_id = u.user_id ' +
                'JOIN constituencies c ON v.constituency_id = c.constituency_id ' +
                'ORDER BY v.voter_id DESC'
            );
            const result = rows.map(r => ({
                voterId: r.voter_id,
                epicNo: r.epic_no,
                username: r.username,
                fullName: r.full_name,
                dob: r.dob,
                age: r.age,
                gender: r.gender,
                constituencyName: r.constituency_name,
                phone: r.phone,
                isVerified: r.is_verified === 1,
                hasVoted: r.has_voted === 1,
                votedAt: r.voted_at || 'Not yet cast'
            }));
            res.status(200).json(result);
            return;
        }

        // 10. POST /api/admin/candidates
        if (action === 'admin/candidates' && method === 'POST') {
            const { fullName, partyId, constituencyId, age, education, criminalCases, assetsDeclared } = body;
            const candAge = parseInt(age, 10);
            if (candAge < 25) {
                res.status(200).json({ success: false, message: 'Eligibility Error: Candidate must be at least 25 years old to contest elections under Article 84/173.' });
                return;
            }

            runSql(database,
                'INSERT INTO candidates (full_name, party_id, constituency_id, age, education, criminal_cases, assets_declared, votes_count) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
                [fullName.trim(), parseInt(partyId, 10), parseInt(constituencyId, 10), candAge, education || 'Graduate', parseInt(criminalCases, 10) || 0, parseFloat(assetsDeclared) || 0.0]
            );

            runSql(database,
                'INSERT INTO audit_logs (action_type, performed_by, description) VALUES (?, ?, ?)',
                ['CANDIDATE_NOMINATED', 'ADMIN', `Nominated candidate: ${fullName.trim()} in Constituency ID: ${constituencyId}`]
            );

            res.status(200).json({ success: true, message: 'Candidate nomination accepted and enrolled in ballot!' });
            return;
        }

        // 11. POST /api/admin/constituency (DML Execution)
        if (action === 'admin/constituency' && method === 'POST') {
            const { name, state, status } = body;
            if (!name || !state) {
                res.status(200).json({ success: false, message: 'Constituency name and State are required.' });
                return;
            }

            const existing = queryOne(database, 'SELECT constituency_id FROM constituencies WHERE name = ?', [name.trim()]);
            if (existing) {
                res.status(200).json({ success: false, message: `Constituency with name '${name}' already exists in database.` });
                return;
            }

            const st = (status || 'ACTIVE').toUpperCase();
            runSql(database,
                'INSERT INTO constituencies (name, state, total_voters, status) VALUES (?, ?, 0, ?)',
                [name.trim(), state.trim(), st]
            );

            const inserted = queryOne(database, 'SELECT constituency_id FROM constituencies WHERE name = ?', [name.trim()]);

            runSql(database,
                'INSERT INTO audit_logs (action_type, performed_by, description) VALUES (?, ?, ?)',
                ['CONSTITUENCY_CREATED', 'CHIEF_ELECTION_COMMISSIONER', `Created new electoral constituency: ${name.trim()} (${state.trim()})`]
            );

            const dmlExecuted = `INSERT INTO constituencies (name, state, total_voters, status) VALUES ('${name.trim()}', '${state.trim()}', 0, '${st}');`;

            res.status(200).json({
                success: true,
                message: 'Electoral Constituency created successfully!',
                constituencyId: inserted ? inserted.constituency_id : 99,
                name: name.trim(),
                state: state.trim(),
                status: st,
                dmlExecuted: dmlExecuted
            });
            return;
        }

        // 12. POST /api/voter/update (Form 8 UPDATE)
        if (action === 'voter/update' && method === 'POST') {
            const { voterId, phone, address, email } = body;
            const vid = parseInt(voterId, 10);
            if (!vid || !phone || !address) {
                res.status(200).json({ success: false, message: 'Voter ID, Mobile number, and Address are required for update.' });
                return;
            }

            runSql(database, 'UPDATE voters SET address = ?, phone = ? WHERE voter_id = ?', [address.trim(), phone.trim(), vid]);

            const v = queryOne(database, 'SELECT user_id, epic_no FROM voters WHERE voter_id = ?', [vid]);
            if (v && v.user_id && email) {
                runSql(database, 'UPDATE users SET email = ? WHERE user_id = ?', [email.trim(), v.user_id]);
            }

            runSql(database,
                'INSERT INTO audit_logs (action_type, performed_by, description) VALUES (?, ?, ?)',
                ['VOTER_PARTICULARS_UPDATED', v ? v.epic_no : 'VOTER', `Form 8 update: Modified address/phone for EPIC: ${v ? v.epic_no : vid}`]
            );

            res.status(200).json({ success: true, message: 'Form 8: Elector particulars updated successfully in Electoral Roll!' });
            return;
        }

        // 13. POST /api/admin/candidate-update
        if (action === 'admin/candidate-update' && method === 'POST') {
            const { candidateId, education, criminalCases, assetsDeclared } = body;
            const cid = parseInt(candidateId, 10);
            runSql(database,
                'UPDATE candidates SET education = ?, criminal_cases = ?, assets_declared = ? WHERE candidate_id = ?',
                [education || 'Graduate', parseInt(criminalCases, 10) || 0, parseFloat(assetsDeclared) || 0.0, cid]
            );
            res.status(200).json({ success: true, message: 'Candidate affidavit details updated successfully!' });
            return;
        }

        // 14. POST /api/admin/constituency-update
        if (action === 'admin/constituency-update' && method === 'POST') {
            const { constituencyId, status } = body;
            const cid = parseInt(constituencyId, 10);
            runSql(database, 'UPDATE constituencies SET status = ? WHERE constituency_id = ?', [status, cid]);
            res.status(200).json({ success: true, message: `Constituency status updated to ${status}!` });
            return;
        }

        // 15. GET /api/admin/audit-logs
        if (action === 'admin/audit-logs' && method === 'GET') {
            const rows = queryAll(database, 'SELECT log_id, action_type, performed_by, description, timestamp FROM audit_logs ORDER BY log_id DESC LIMIT 50');
            const result = rows.map(r => ({
                id: r.log_id,
                action: r.action_type,
                user: r.performed_by,
                desc: r.description,
                time: r.timestamp
            }));
            res.status(200).json(result);
            return;
        }

        // 16. GET /api/sql-script
        if (action === 'sql-script' && method === 'GET') {
            const sqlFile = path.join(process.cwd(), 'database', 'DDL_DML.sql');
            let content = '';
            if (fs.existsSync(sqlFile)) {
                content = fs.readFileSync(sqlFile, 'utf8');
            } else {
                content = EMBEDDED_SEED_SQL;
            }
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.status(200).send(content);
            return;
        }

        console.warn(`[ECMS 404] Unmatched action '${action}' for method ${method}`);
        res.status(404).json({ error: `Endpoint not found: action='${action}'` });

    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: err.message });
    }
};
