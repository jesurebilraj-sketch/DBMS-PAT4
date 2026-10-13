const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

let db = null;
const tmpDbPath = '/tmp/election.db';

async function getDatabase() {
    if (db) return db;

    const SQL = await initSqlJs();

    // Check if tmp db exists
    if (fs.existsSync(tmpDbPath)) {
        try {
            const fileData = fs.readFileSync(tmpDbPath);
            db = new SQL.Database(fileData);
            return db;
        } catch (e) {
            console.error('Failed reading tmpDbPath, fallback to bundled db', e);
        }
    }

    // Check bundled db
    const bundledPath = path.join(process.cwd(), 'election.db');
    if (fs.existsSync(bundledPath)) {
        const fileData = fs.readFileSync(bundledPath);
        db = new SQL.Database(fileData);
    } else {
        db = new SQL.Database();
        const sqlFile = path.join(process.cwd(), 'database', 'DDL_DML.sql');
        if (fs.existsSync(sqlFile)) {
            const sqlContent = fs.readFileSync(sqlFile, 'utf8');
            db.run(sqlContent);
        }
    }

    saveDatabase();
    return db;
}

function saveDatabase() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(tmpDbPath, buffer);
    } catch (e) {
        // In read-only environments where /tmp isn't writable, ignore
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

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // Parse body if JSON string
    let body = req.body;
    if (typeof body === 'string' && body.trim().length > 0) {
        try {
            body = JSON.parse(body);
        } catch (e) {
            body = {};
        }
    } else if (!body) {
        body = {};
    }

    try {
        const database = await getDatabase();

        // 1. POST /api/login
        if (pathname === '/api/login' && method === 'POST') {
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
        if (pathname === '/api/register' && method === 'POST') {
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
        if (pathname === '/api/constituencies' && method === 'GET') {
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
        if (pathname === '/api/parties' && method === 'GET') {
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
        if (pathname === '/api/candidates' && method === 'GET') {
            const constId = parseInt(parsedUrl.searchParams.get('constituencyId') || '1', 10);
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
        if (pathname === '/api/vote' && method === 'POST') {
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
        if (pathname === '/api/results' && method === 'GET') {
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
        if (pathname === '/api/admin/stats' && method === 'GET') {
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
        if (pathname === '/api/admin/voters' && method === 'GET') {
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
        if (pathname === '/api/admin/candidates' && method === 'POST') {
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
        if (pathname === '/api/admin/constituency' && method === 'POST') {
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
        if (pathname === '/api/voter/update' && method === 'POST') {
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
        if (pathname === '/api/admin/candidate-update' && method === 'POST') {
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
        if (pathname === '/api/admin/constituency-update' && method === 'POST') {
            const { constituencyId, status } = body;
            const cid = parseInt(constituencyId, 10);
            runSql(database, 'UPDATE constituencies SET status = ? WHERE constituency_id = ?', [status, cid]);
            res.status(200).json({ success: true, message: `Constituency status updated to ${status}!` });
            return;
        }

        // 15. GET /api/admin/audit-logs
        if (pathname === '/api/admin/audit-logs' && method === 'GET') {
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
        if (pathname === '/api/sql-script' && method === 'GET') {
            const sqlFile = path.join(process.cwd(), 'database', 'DDL_DML.sql');
            const content = fs.existsSync(sqlFile) ? fs.readFileSync(sqlFile, 'utf8') : '-- SQL File not found';
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.status(200).send(content);
            return;
        }

        res.status(404).json({ error: 'Endpoint not found' });

    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: err.message });
    }
};
