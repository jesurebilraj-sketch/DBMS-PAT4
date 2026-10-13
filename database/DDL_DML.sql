-- ====================================================================
-- ELECTION COMMISSION MANAGEMENT SYSTEM (ECMS)
-- Comprehensive Database Schema & SQL Scripts (DDL & DML)
-- Compatible with SQLite & MySQL / Oracle RDBMS
-- ====================================================================

-- ====================================================================
-- SECTION 1: DATA DEFINITION LANGUAGE (DDL)
-- ====================================================================

-- 1. Drop existing tables if they exist (child tables first for FK integrity)
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS voters;
DROP TABLE IF EXISTS candidates;
DROP TABLE IF EXISTS parties;
DROP TABLE IF EXISTS constituencies;
DROP TABLE IF EXISTS users;

-- 2. Table: users (System authentication and role management)
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK(role IN ('ADMIN', 'VOTER', 'OFFICER')),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table: constituencies (Electoral zones/districts)
CREATE TABLE constituencies (
    constituency_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    state VARCHAR(50) NOT NULL,
    total_voters INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'CLOSED', 'SUSPENDED'))
);

-- 4. Table: parties (Registered political organizations)
CREATE TABLE parties (
    party_id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_name VARCHAR(100) NOT NULL UNIQUE,
    abbreviation VARCHAR(10) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    leader_name VARCHAR(100) NOT NULL,
    manifesto TEXT
);

-- 5. Table: candidates (Contesting nominees per constituency)
CREATE TABLE candidates (
    candidate_id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name VARCHAR(100) NOT NULL,
    party_id INTEGER NOT NULL,
    constituency_id INTEGER NOT NULL,
    age INTEGER NOT NULL CHECK(age >= 25),
    education VARCHAR(50) NOT NULL,
    criminal_cases INTEGER DEFAULT 0 CHECK(criminal_cases >= 0),
    assets_declared DOUBLE DEFAULT 0.0,
    votes_count INTEGER DEFAULT 0,
    FOREIGN KEY (party_id) REFERENCES parties(party_id) ON DELETE CASCADE,
    FOREIGN KEY (constituency_id) REFERENCES constituencies(constituency_id) ON DELETE CASCADE
);

-- 6. Table: voters (Electoral roll with eligibility constraints)
CREATE TABLE voters (
    voter_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    epic_no VARCHAR(20) NOT NULL UNIQUE,
    dob VARCHAR(10) NOT NULL,
    age INTEGER NOT NULL CHECK(age >= 18),
    gender VARCHAR(10) NOT NULL CHECK(gender IN ('Male', 'Female', 'Other')),
    constituency_id INTEGER NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(15) NOT NULL,
    is_verified INTEGER DEFAULT 1 CHECK(is_verified IN (0, 1)),
    has_voted INTEGER DEFAULT 0 CHECK(has_voted IN (0, 1)),
    voted_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (constituency_id) REFERENCES constituencies(constituency_id) ON DELETE CASCADE
);

-- 7. Table: votes (Anonymized ballot ledger with VVPAT receipt hash)
CREATE TABLE votes (
    vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
    constituency_id INTEGER NOT NULL,
    candidate_id INTEGER NOT NULL,
    ballot_hash VARCHAR(64) NOT NULL UNIQUE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (constituency_id) REFERENCES constituencies(constituency_id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
);

-- 8. Table: audit_logs (System audit trail for Election Commission oversight)
CREATE TABLE audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type VARCHAR(50) NOT NULL,
    performed_by VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX idx_voter_epic ON voters(epic_no);
CREATE INDEX idx_candidate_constituency ON candidates(constituency_id);
CREATE INDEX idx_vote_constituency ON votes(constituency_id);
CREATE INDEX idx_user_username ON users(username);


-- ====================================================================
-- SECTION 2: DATA MANIPULATION LANGUAGE (DML)
-- ====================================================================

-- 1. Seed Constituencies
INSERT INTO constituencies (name, state, total_voters, status) VALUES
('New Delhi Central', 'Delhi', 4, 'ACTIVE'),
('Mumbai South', 'Maharashtra', 3, 'ACTIVE'),
('Bengaluru South', 'Karnataka', 3, 'ACTIVE'),
('Chennai Central', 'Tamil Nadu', 2, 'ACTIVE');

-- 2. Seed Political Parties
INSERT INTO parties (party_name, abbreviation, symbol, leader_name, manifesto) VALUES
('National Democratic Alliance', 'NDA', 'Lotus', 'J. P. Nadda', 'Infrastructure, Economic Growth, Digital Governance'),
('United Progressive Alliance', 'UPA', 'Hand', 'Mallikarjun Kharge', 'Social Welfare, Rural Employment, Education Reform'),
('Aam Aadmi Party', 'AAP', 'Broom', 'Arvind Kejriwal', 'Healthcare Clinics, Free Electricity, Public Schools'),
('Independent Candidate Coalition', 'IND', 'Kite', 'Self-Nominated', 'Constituency Development, Civic Amenities, Transparency');

-- 3. Seed Candidates (Age >= 25 requirement enforced)
-- New Delhi Central
INSERT INTO candidates (full_name, party_id, constituency_id, age, education, criminal_cases, assets_declared, votes_count) VALUES
('Rajesh Sharma', 1, 1, 48, 'Post Graduate (Economics)', 0, 45000000.0, 0),
('Priya Venkat', 2, 1, 42, 'LL.B. (Constitutional Law)', 0, 28000000.0, 0),
('Sanjay Gupta', 3, 1, 38, 'B.Tech (Computer Science)', 0, 15000000.0, 0),
('Alok Mathur', 4, 1, 51, 'M.A. (Public Policy)', 0, 8500000.0, 0);

-- Mumbai South
INSERT INTO candidates (full_name, party_id, constituency_id, age, education, criminal_cases, assets_declared, votes_count) VALUES
('Aditya Deshmukh', 1, 2, 45, 'M.B.A. (Finance)', 0, 62000000.0, 0),
('Farhan Merchant', 2, 2, 53, 'Chartered Accountant', 0, 51000000.0, 0),
('Sunita Kadam', 3, 2, 39, 'M.S.W. (Social Work)', 0, 9500000.0, 0);

-- Bengaluru South
INSERT INTO candidates (full_name, party_id, constituency_id, age, education, criminal_cases, assets_declared, votes_count) VALUES
('Dr. Ramesh Rao', 1, 3, 50, 'Ph.D. (Electronics)', 0, 39000000.0, 0),
('Ananya Murthy', 2, 3, 36, 'M.Sc. (Data Science)', 0, 22000000.0, 0),
('Deepak Gowda', 4, 3, 44, 'Graduate (Commerce)', 0, 14000000.0, 0);

-- Chennai Central
INSERT INTO candidates (full_name, party_id, constituency_id, age, education, criminal_cases, assets_declared, votes_count) VALUES
('S. Ramakrishnan', 1, 4, 55, 'B.L. (Law)', 0, 33000000.0, 0),
('Kavitha Selvam', 2, 4, 41, 'M.A. (Literature)', 0, 19000000.0, 0);

-- 4. Seed Administrator & Returning Officer Accounts
INSERT INTO users (username, password, full_name, role, email) VALUES
('admin', 'admin123', 'Chief Election Commissioner', 'ADMIN', 'cec@eci.gov.in'),
('officer_delhi', 'officer123', 'Returning Officer Delhi', 'OFFICER', 'ro.delhi@eci.gov.in');

-- 5. Seed Pre-registered Verified Voters (Age >= 18 requirement enforced)
-- Voter 1 (User + Voter record)
INSERT INTO users (username, password, full_name, role, email) VALUES
('voter1', 'voter123', 'Aarav Patel', 'VOTER', 'aarav@gmail.com');
INSERT INTO voters (user_id, epic_no, dob, age, gender, constituency_id, address, phone, is_verified, has_voted) VALUES
(3, 'ECI781901', '2001-05-14', 25, 'Male', 1, '12, Connaught Place, New Delhi', '9876543210', 1, 0);

-- Voter 2
INSERT INTO users (username, password, full_name, role, email) VALUES
('voter2', 'voter123', 'Sneha Iyer', 'VOTER', 'sneha@gmail.com');
INSERT INTO voters (user_id, epic_no, dob, age, gender, constituency_id, address, phone, is_verified, has_voted) VALUES
(4, 'ECI781902', '1998-11-20', 27, 'Female', 1, '45, Barakhamba Road, New Delhi', '9812345678', 1, 0);

-- Voter 3 (Mumbai South)
INSERT INTO users (username, password, full_name, role, email) VALUES
('voter3', 'voter123', 'Rohan Mehta', 'VOTER', 'rohan@gmail.com');
INSERT INTO voters (user_id, epic_no, dob, age, gender, constituency_id, address, phone, is_verified, has_voted) VALUES
(5, 'ECI892101', '1995-02-10', 31, 'Male', 2, '78, Marine Drive, Mumbai', '9723456789', 1, 0);

-- 6. Initial Audit Log
INSERT INTO audit_logs (action_type, performed_by, description) VALUES
('SYSTEM_INITIALIZATION', 'SYSTEM', 'Election Commission Database initialized with constituencies, candidates, and baseline rolls.');


-- ====================================================================
-- SECTION 3: KEY DML QUERIES USED IN SYSTEM PROCESSING
-- ====================================================================

-- Query 1: Authenticate User Login
-- SELECT user_id, username, full_name, role, email FROM users WHERE username = ? AND password = ?;

-- Query 2: Fetch Voter Profile & Voting Eligibility
-- SELECT v.voter_id, v.epic_no, u.full_name, v.dob, v.age, v.gender, 
--        c.name AS constituency_name, v.constituency_id, v.has_voted, v.is_verified, v.voted_at
-- FROM voters v
-- JOIN users u ON v.user_id = u.user_id
-- JOIN constituencies c ON v.constituency_id = c.constituency_id
-- WHERE u.user_id = ?;

-- Query 3: Retrieve Eligible Candidates for a Given Constituency
-- SELECT c.candidate_id, c.full_name, p.party_name, p.abbreviation, p.symbol,
--        c.age, c.education, c.criminal_cases, c.assets_declared, c.votes_count
-- FROM candidates c
-- JOIN parties p ON c.party_id = p.party_id
-- WHERE c.constituency_id = ?
-- ORDER BY c.candidate_id ASC;

-- Query 4: ACID Transaction - Process Vote Cast
-- Step A: INSERT INTO votes (constituency_id, candidate_id, ballot_hash) VALUES (?, ?, ?);
-- Step B: UPDATE candidates SET votes_count = votes_count + 1 WHERE candidate_id = ?;
-- Step C: UPDATE voters SET has_voted = 1, voted_at = CURRENT_TIMESTAMP WHERE voter_id = ?;
-- Step D: INSERT INTO audit_logs (action_type, performed_by, description) VALUES ('VOTE_CAST', ?, ?);

-- Query 5: Calculate Real-time Election Results & Vote Share %
-- SELECT c.candidate_id, c.full_name, p.party_name, p.abbreviation, p.symbol,
--        con.name AS constituency_name, c.votes_count,
--        ROUND(100.0 * c.votes_count / NULLIF((SELECT COUNT(*) FROM votes v WHERE v.constituency_id = c.constituency_id), 0), 2) AS vote_percentage
-- FROM candidates c
-- JOIN parties p ON c.party_id = p.party_id
-- JOIN constituencies con ON c.constituency_id = con.constituency_id
-- ORDER BY con.name, c.votes_count DESC;

-- Query 6: Determine Constituency Winners (Using Correlated Subquery)
-- SELECT con.name AS constituency, c.full_name AS leading_candidate, p.party_name, c.votes_count
-- FROM candidates c
-- JOIN parties p ON c.party_id = p.party_id
-- JOIN constituencies con ON c.constituency_id = con.constituency_id
-- WHERE c.votes_count = (
--     SELECT MAX(c2.votes_count) 
--     FROM candidates c2 
--     WHERE c2.constituency_id = c.constituency_id
-- ) AND c.votes_count > 0;

-- Query 7: Overall Voter Turnout Analytics
-- SELECT 
--     (SELECT COUNT(*) FROM voters) AS total_registered_voters,
--     (SELECT COUNT(*) FROM votes) AS total_votes_cast,
--     ROUND(100.0 * (SELECT COUNT(*) FROM votes) / NULLIF((SELECT COUNT(*) FROM voters), 0), 2) AS turnout_percentage;

-- Query 8: DML Insertion - Delimitation & Creation of New Electoral Constituency
-- INSERT INTO constituencies (name, state, total_voters, status) VALUES ('Kolkata North', 'West Bengal', 0, 'ACTIVE');

-- ====================================================================
-- SECTION 4: EXPLICIT UPDATION COMMANDS (DATA MODIFICATION)
-- ====================================================================

-- Update 1: Form 8 - Correction to Particulars in Electoral Roll (Address & Phone)
-- UPDATE voters 
-- SET address = 'Flat 402, Lotus Towers, Barakhamba Road, New Delhi',
--     phone = '9876500000'
-- WHERE voter_id = 1;

-- Update 2: User Contact Email Modification
-- UPDATE users 
-- SET email = 'aarav.updated@eci-voter.in'
-- WHERE user_id = 3;

-- Update 3: Cast Vote Status Modification (Invoked atomically on voting)
-- UPDATE voters 
-- SET has_voted = 1, 
--     voted_at = CURRENT_TIMESTAMP 
-- WHERE voter_id = 1;

-- Update 4: Candidate Vote Tally Increment
-- UPDATE candidates 
-- SET votes_count = votes_count + 1 
-- WHERE candidate_id = 1;

-- Update 5: Candidate Affidavit / Nomination Particulars Modification
-- UPDATE candidates 
-- SET education = 'Ph.D. in Constitutional Law',
--     criminal_cases = 0,
--     assets_declared = 52000000.0
-- WHERE candidate_id = 1;

-- Update 6: Constituency Status Modification (Active / Closed / Suspended)
-- UPDATE constituencies 
-- SET status = 'CLOSED' 
-- WHERE constituency_id = 1;

-- Update 7: Elector Verification Status Modification by Returning Officer
-- UPDATE voters 
-- SET is_verified = 1 
-- WHERE voter_id = 1;

-- Update 8: Incremental Elector Count on Constituency
-- UPDATE constituencies 
-- SET total_voters = total_voters + 1 
-- WHERE constituency_id = 1;

