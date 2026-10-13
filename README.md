# 🏛️ Election Commission Management System (ECMS)
### Database Management Systems (DBMS) Lab Assessment / PAT Test Solution
**Technology Stack:** Java (JDK 26 / 17+), Java Database Connectivity (JDBC), Embedded Java HTTP Server, HTML5, CSS3, Modern JavaScript, SQLite & MySQL compatible schema.

---

## 📌 1. Project Overview & Problem Statement

The **Election Commission Management System (ECMS)** is an end-to-end, full-stack relational database web application designed to automate and regulate democratic elections as per the constitutional guidelines of the Election Commission (Representation of the People Act and Article 326 of the Constitution of India).

### Core Functional Capabilities:
1. **User Authentication & Role-Based Access Control (RBAC):**
   - **Chief Election Commissioner (Admin):** Manages constituencies, political parties, candidate nominations, voter registry verification, and live election audit logs.
   - **Elector (Voter):** Citizen portal to check eligibility, register as a voter, verify their assigned constituency, review candidate qualifications, and cast a secret ballot.
2. **User Input Acceptance & Constitutional Eligibility Processing:**
   - **Voter Registration (Form 6):** Accepts Full Name, Date of Birth (DOB), Gender, Constituency, Phone, Address, and credentials.
   - **Eligibility Processing:** Dynamically computes applicant's age from DOB.
     - **If Age < 18:** Registration is rejected with a constitutional violation notice (*"Under Article 326, minimum age for voter registration is 18 years"*).
     - **If Age >= 18:** Registration is approved, a unique 9-digit **Election Photo Identity Card (EPIC)** number is generated (e.g., `ECI509667`), and the elector is enrolled into their registered constituency's roll.
3. **Electronic Voting Machine (EVM) & ACID Transactional Vote Processing:**
   - Enforces the strict **One Person, One Vote** principle: prevents duplicate voting by checking the voter's `has_voted` status.
   - Atomic database transaction using JDBC:
     - Generates a cryptographic **SHA-256 digital ballot receipt** (VVPAT).
     - Inserts the ballot record into `votes`.
     - Atomically increments candidate's `votes_count`.
     - Updates voter record `has_voted = 1` and logs timestamp `voted_at`.
     - Writes immutable transaction audit record into `audit_logs`.
     - Commits transaction (`conn.commit()`) or rolls back (`conn.rollback()`) on any fault.
4. **Live Election Results & Turnout Analytics:**
   - Real-time aggregation of votes, candidate vote share percentages, and leading candidate/winner identification per assembly constituency.
   - Real-time voter turnout percentage calculation: `(Total Ballots Cast / Total Registered Electors) * 100`.

---

## 🗄️ 2. Database Design: DDL (Data Definition Language)

The relational schema is normalized (3NF) and enforces entity, referential, and domain constraints.

### Schema Table Definitions

```sql
-- 1. Table: users (System Authentication & Roles)
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK(role IN ('ADMIN', 'VOTER', 'OFFICER')),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table: constituencies (Electoral Divisions)
CREATE TABLE constituencies (
    constituency_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    state VARCHAR(50) NOT NULL,
    total_voters INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'CLOSED', 'SUSPENDED'))
);

-- 3. Table: parties (Recognized Political Parties)
CREATE TABLE parties (
    party_id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_name VARCHAR(100) NOT NULL UNIQUE,
    abbreviation VARCHAR(10) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    leader_name VARCHAR(100) NOT NULL,
    manifesto TEXT
);

-- 4. Table: candidates (Contesting Nominees)
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

-- 5. Table: voters (Electoral Roll with Age & Duplicate Constraints)
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

-- 6. Table: votes (Anonymized Ballot Ledger)
CREATE TABLE votes (
    vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
    constituency_id INTEGER NOT NULL,
    candidate_id INTEGER NOT NULL,
    ballot_hash VARCHAR(64) NOT NULL UNIQUE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (constituency_id) REFERENCES constituencies(constituency_id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
);

-- 7. Table: audit_logs (Commission System Audit Trail)
CREATE TABLE audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type VARCHAR(50) NOT NULL,
    performed_by VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX idx_voter_epic ON voters(epic_no);
CREATE INDEX idx_candidate_constituency ON candidates(constituency_id);
CREATE INDEX idx_vote_constituency ON votes(constituency_id);
```

---

## 📥 3. Database Operations: DML (Data Manipulation Language)

### Sample Seed Insertions:
```sql
-- Seed Constituencies
INSERT INTO constituencies (name, state, total_voters, status) VALUES
('New Delhi Central', 'Delhi', 4, 'ACTIVE'),
('Mumbai South', 'Maharashtra', 3, 'ACTIVE'),
('Bengaluru South', 'Karnataka', 3, 'ACTIVE'),
('Chennai Central', 'Tamil Nadu', 2, 'ACTIVE');

-- Seed Political Parties
INSERT INTO parties (party_name, abbreviation, symbol, leader_name, manifesto) VALUES
('National Democratic Alliance', 'NDA', 'Lotus', 'J. P. Nadda', 'Infrastructure & Digital Governance'),
('United Progressive Alliance', 'UPA', 'Hand', 'Mallikarjun Kharge', 'Social Welfare & Education'),
('Aam Aadmi Party', 'AAP', 'Broom', 'Arvind Kejriwal', 'Healthcare & Civic Amenities'),
('Independent Coalition', 'IND', 'Kite', 'Self-Nominated', 'Constituency Development & Transparency');

-- Seed Candidates
INSERT INTO candidates (full_name, party_id, constituency_id, age, education, criminal_cases, assets_declared, votes_count) VALUES
('Rajesh Sharma', 1, 1, 48, 'Post Graduate (Economics)', 0, 45000000.0, 0),
('Priya Venkat', 2, 1, 42, 'LL.B. (Constitutional Law)', 0, 28000000.0, 0),
('Sanjay Gupta', 3, 1, 38, 'B.Tech (Computer Science)', 0, 15000000.0, 0),
('Alok Mathur', 4, 1, 51, 'M.A. (Public Policy)', 0, 8500000.0, 0);

-- Seed System Accounts
INSERT INTO users (username, password, full_name, role, email) VALUES
('admin', 'admin123', 'Chief Election Commissioner', 'ADMIN', 'cec@eci.gov.in'),
('voter1', 'voter123', 'Aarav Patel', 'VOTER', 'aarav@gmail.com'),
('voter2', 'voter123', 'Sneha Iyer', 'VOTER', 'sneha@gmail.com'),
('voter3', 'voter123', 'Rohan Mehta', 'VOTER', 'rohan@gmail.com');

-- Seed Elector Identity Card Details
INSERT INTO voters (user_id, epic_no, dob, age, gender, constituency_id, address, phone, is_verified, has_voted) VALUES
(2, 'ECI781901', '2001-05-14', 25, 'Male', 1, '12, Connaught Place, New Delhi', '9876543210', 1, 0),
(3, 'ECI781902', '1998-11-20', 27, 'Female', 1, '45, Barakhamba Road, New Delhi', '9812345678', 1, 0),
(4, 'ECI892101', '1995-02-10', 31, 'Male', 2, '78, Marine Drive, Mumbai', '9723456789', 1, 0);
```

### Key DML Queries Executed by JDBC:
```sql
-- Query 1: Authenticate User
SELECT user_id, username, full_name, role, email FROM users WHERE username = ? AND password = ?;

-- Query 2: Retrieve Eligible Candidates for a Voter's Constituency
SELECT c.candidate_id, c.full_name, p.party_name, p.abbreviation, p.symbol,
       c.age, c.education, c.criminal_cases, c.assets_declared, c.votes_count
FROM candidates c
JOIN parties p ON c.party_id = p.party_id
WHERE c.constituency_id = ?
ORDER BY c.candidate_id ASC;

-- Query 3: Atomic Vote Cast Transaction (ACID)
INSERT INTO votes (constituency_id, candidate_id, ballot_hash) VALUES (?, ?, ?);
UPDATE candidates SET votes_count = votes_count + 1 WHERE candidate_id = ?;
UPDATE voters SET has_voted = 1, voted_at = CURRENT_TIMESTAMP WHERE voter_id = ?;
INSERT INTO audit_logs (action_type, performed_by, description) VALUES ('VOTE_CAST', ?, ?);

-- Query 4: Aggregate Candidate Vote Count & Vote Share %
SELECT c.candidate_id, c.full_name, p.party_name, p.abbreviation, p.symbol,
       con.name AS constituency_name, c.votes_count,
       ROUND(100.0 * c.votes_count / NULLIF((SELECT COUNT(*) FROM votes v WHERE v.constituency_id = c.constituency_id), 0), 2) AS vote_percentage
FROM candidates c
JOIN parties p ON c.party_id = p.party_id
JOIN constituencies con ON c.constituency_id = con.constituency_id
ORDER BY con.name, c.votes_count DESC;

-- Query 5: Overall Turnout Percentage Calculation
SELECT 
    (SELECT COUNT(*) FROM voters) AS total_registered_voters,
    (SELECT COUNT(*) FROM votes) AS total_votes_cast,
    ROUND(100.0 * (SELECT COUNT(*) FROM votes) / NULLIF((SELECT COUNT(*) FROM voters), 0), 2) AS turnout_percentage;

-- Query 6: Form 8 - Updation of Elector Particulars (Correction of Entries)
UPDATE voters 
SET address = ?, phone = ? 
WHERE voter_id = ?;

-- Query 7: User Profile Contact Email Modification
UPDATE users 
SET email = ? 
WHERE user_id = ?;

-- Query 8: Candidate Affidavit & Criminal Record Updation
UPDATE candidates 
SET education = ?, criminal_cases = ?, assets_declared = ? 
WHERE candidate_id = ?;

-- Query 9: Electoral Constituency Status Updation (Active / Closed / Suspended)
UPDATE constituencies 
SET status = ? 
WHERE constituency_id = ?;

-- Query 10: DML Insertion - Delimitation & Creation of New Electoral Constituency
INSERT INTO constituencies (name, state, total_voters, status) 
VALUES (?, ?, 0, ?);
```

---

## ⚙️ 4. Prerequisites & Installation Steps

### 1. Requirements:
- **Java SE Development Kit (JDK):** Version 17, 21, or 26.
  - Verify via command line:
    ```powershell
    javac -version
    java -version
    ```
- **JDBC Driver:** Bundled in `lib/`:
  - `sqlite-jdbc.jar` (Zero-configuration embedded driver, auto-creates `election.db`).
  - `mysql-connector-j.jar` (Also provided for MySQL integration if required).
  - `slf4j-api.jar` & `slf4j-simple.jar` (Logging framework dependencies).

---

## 🚀 5. How to Compile and Run

### Option A: Using Windows Batch Script (Recommended)
Simply double-click or run:
```cmd
run.bat
```
This script will automatically check if binaries exist, compile if necessary, and launch the server.

### Option B: Using PowerShell Script
```powershell
.\run.ps1
```

### Option C: Manual Terminal Commands
1. **Compile:**
   ```powershell
   javac -encoding UTF-8 -d bin -cp "lib/*;src" (Get-ChildItem -Path src -Filter "*.java" -Recurse | ForEach-Object { $_.FullName })
   ```
2. **Execute:**
   ```powershell
   java --enable-native-access=ALL-UNNAMED -cp "bin;lib/*" com.ecms.ElectionCommissionApp
   ```

### 3. Access in Web Browser:
Open your browser and navigate to:
```
http://localhost:8080/
```

---

## 🔑 6. Test User Credentials

| Role | Username | Password | Notes |
|---|---|---|---|
| **Chief Election Commissioner (Admin)** | `admin` | `admin123` | Full access to Electoral Roll, candidate nominations, audit logs |
| **Returning Officer (Delhi)** | `officer_delhi` | `officer123` | Constituency officer access |
| **Registered Voter 1 (Delhi)** | `voter1` | `voter123` | New Delhi Central (Can cast vote in EVM) |
| **Registered Voter 2 (Delhi)** | `voter2` | `voter123` | New Delhi Central (Can cast vote in EVM) |
| **Registered Voter 3 (Mumbai)** | `voter3` | `voter123` | Mumbai South (Can cast vote in EVM) |

*Tip: The web login page features **Quick Login Buttons** to authenticate test roles with a single click.*

---

## 🧪 7. Verification of Inputs, Processing & Outputs

| Feature | User Input | Processing Logic | Expected Output |
|---|---|---|---|
| **Voter Registration (Under-age)** | DOB: `2012-05-10` (Age 14) | Calculates age from DOB; triggers Constitutional Rule check `age < 18`. | ❌ **Rejected:** `"ELIGIBILITY REJECTED: Voter is 14 years old. Under Article 326... minimum age is 18 years."` |
| **Voter Registration (Eligible)** | DOB: `2004-03-20` (Age 22) | Calculates age (22); checks uniqueness; executes `INSERT INTO users` & `INSERT INTO voters`. | ✅ **Approved:** Generates EPIC number (e.g. `ECI509667`), adds elector to roll. |
| **Ballot Access** | Elector logs in (`voter1`) | Queries voter's constituency; pulls candidate nominations via JDBC. | Displays interactive EVM unit with candidate names, symbols, qualifications, and criminal records. |
| **Vote Casting** | Clicks `VOTE` for chosen candidate | Checks `has_voted == 0`; initiates ACID transaction with `conn.setAutoCommit(false)`; writes vote; updates voter to `has_voted = 1`; commits transaction. | ✅ Displays official **VVPAT Confirmation Slip** with candidate name, party symbol, timestamp, and SHA-256 verification hash. |
| **Duplicate Voting Prevention** | `voter1` attempts to vote again | Checks `has_voted == 1`. | ❌ **Blocked:** `"ACCESS DENIED: You have already cast your vote! Duplicate voting is prohibited."` |
| **Live Election Analytics** | Navigates to *Live Results* | Aggregates votes cast, computes candidate vote share percentages and constituency winners. | Real-time turnout %, ranking table, progress bars, and leading candidate badges. |

