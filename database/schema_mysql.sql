-- ====================================================================
-- ELECTION COMMISSION MANAGEMENT SYSTEM (ECMS)
-- MySQL Specific DDL and DML Script
-- ====================================================================

CREATE DATABASE IF NOT EXISTS election_db;
USE election_db;

-- Drop Tables in reverse dependency order
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS voters;
DROP TABLE IF EXISTS candidates;
DROP TABLE IF EXISTS parties;
DROP TABLE IF EXISTS constituencies;
DROP TABLE IF EXISTS users;

-- 1. Table: users
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('ADMIN', 'VOTER', 'OFFICER') NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Table: constituencies
CREATE TABLE constituencies (
    constituency_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    state VARCHAR(50) NOT NULL,
    total_voters INT DEFAULT 0,
    status ENUM('ACTIVE', 'CLOSED', 'SUSPENDED') DEFAULT 'ACTIVE'
) ENGINE=InnoDB;

-- 3. Table: parties
CREATE TABLE parties (
    party_id INT AUTO_INCREMENT PRIMARY KEY,
    party_name VARCHAR(100) NOT NULL UNIQUE,
    abbreviation VARCHAR(10) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    leader_name VARCHAR(100) NOT NULL,
    manifesto TEXT
) ENGINE=InnoDB;

-- 4. Table: candidates
CREATE TABLE candidates (
    candidate_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    party_id INT NOT NULL,
    constituency_id INT NOT NULL,
    age INT NOT NULL,
    education VARCHAR(50) NOT NULL,
    criminal_cases INT DEFAULT 0,
    assets_declared DOUBLE DEFAULT 0.0,
    votes_count INT DEFAULT 0,
    CONSTRAINT chk_candidate_age CHECK (age >= 25),
    CONSTRAINT chk_criminal_cases CHECK (criminal_cases >= 0),
    FOREIGN KEY (party_id) REFERENCES parties(party_id) ON DELETE CASCADE,
    FOREIGN KEY (constituency_id) REFERENCES constituencies(constituency_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Table: voters
CREATE TABLE voters (
    voter_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE,
    epic_no VARCHAR(20) NOT NULL UNIQUE,
    dob DATE NOT NULL,
    age INT NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    constituency_id INT NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(15) NOT NULL,
    is_verified TINYINT(1) DEFAULT 1,
    has_voted TINYINT(1) DEFAULT 0,
    voted_at DATETIME,
    CONSTRAINT chk_voter_age CHECK (age >= 18),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (constituency_id) REFERENCES constituencies(constituency_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Table: votes
CREATE TABLE votes (
    vote_id INT AUTO_INCREMENT PRIMARY KEY,
    constituency_id INT NOT NULL,
    candidate_id INT NOT NULL,
    ballot_hash VARCHAR(64) NOT NULL UNIQUE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (constituency_id) REFERENCES constituencies(constituency_id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
) ENGINE=InnoDB;

-- 7. Table: audit_logs
CREATE TABLE audit_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    performed_by VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Indexes
CREATE INDEX idx_voter_epic ON voters(epic_no);
CREATE INDEX idx_candidate_constituency ON candidates(constituency_id);
CREATE INDEX idx_vote_constituency ON votes(constituency_id);

-- DML Inserts
INSERT INTO constituencies (name, state, total_voters, status) VALUES
('New Delhi Central', 'Delhi', 4, 'ACTIVE'),
('Mumbai South', 'Maharashtra', 3, 'ACTIVE'),
('Bengaluru South', 'Karnataka', 3, 'ACTIVE'),
('Chennai Central', 'Tamil Nadu', 2, 'ACTIVE');

INSERT INTO parties (party_name, abbreviation, symbol, leader_name, manifesto) VALUES
('National Democratic Alliance', 'NDA', 'Lotus', 'J. P. Nadda', 'Infrastructure, Economic Growth, Digital Governance'),
('United Progressive Alliance', 'UPA', 'Hand', 'Mallikarjun Kharge', 'Social Welfare, Rural Employment, Education Reform'),
('Aam Aadmi Party', 'AAP', 'Broom', 'Arvind Kejriwal', 'Healthcare Clinics, Free Electricity, Public Schools'),
('Independent Candidate Coalition', 'IND', 'Kite', 'Self-Nominated', 'Constituency Development, Civic Amenities, Transparency');

INSERT INTO candidates (full_name, party_id, constituency_id, age, education, criminal_cases, assets_declared, votes_count) VALUES
('Rajesh Sharma', 1, 1, 48, 'Post Graduate (Economics)', 0, 45000000.0, 0),
('Priya Venkat', 2, 1, 42, 'LL.B. (Constitutional Law)', 0, 28000000.0, 0),
('Sanjay Gupta', 3, 1, 38, 'B.Tech (Computer Science)', 0, 15000000.0, 0),
('Alok Mathur', 4, 1, 51, 'M.A. (Public Policy)', 0, 8500000.0, 0),
('Aditya Deshmukh', 1, 2, 45, 'M.B.A. (Finance)', 0, 62000000.0, 0),
('Farhan Merchant', 2, 2, 53, 'Chartered Accountant', 0, 51000000.0, 0),
('Sunita Kadam', 3, 2, 39, 'M.S.W. (Social Work)', 0, 9500000.0, 0),
('Dr. Ramesh Rao', 1, 3, 50, 'Ph.D. (Electronics)', 0, 39000000.0, 0),
('Ananya Murthy', 2, 3, 36, 'M.Sc. (Data Science)', 0, 22000000.0, 0),
('Deepak Gowda', 4, 3, 44, 'Graduate (Commerce)', 0, 14000000.0, 0),
('S. Ramakrishnan', 1, 4, 55, 'B.L. (Law)', 0, 33000000.0, 0),
('Kavitha Selvam', 2, 4, 41, 'M.A. (Literature)', 0, 19000000.0, 0);

INSERT INTO users (username, password, full_name, role, email) VALUES
('admin', 'admin123', 'Chief Election Commissioner', 'ADMIN', 'cec@eci.gov.in'),
('officer_delhi', 'officer123', 'Returning Officer Delhi', 'OFFICER', 'ro.delhi@eci.gov.in'),
('voter1', 'voter123', 'Aarav Patel', 'VOTER', 'aarav@gmail.com'),
('voter2', 'voter123', 'Sneha Iyer', 'VOTER', 'sneha@gmail.com'),
('voter3', 'voter123', 'Rohan Mehta', 'VOTER', 'rohan@gmail.com');

INSERT INTO voters (user_id, epic_no, dob, age, gender, constituency_id, address, phone, is_verified, has_voted) VALUES
(3, 'ECI781901', '2001-05-14', 25, 'Male', 1, '12, Connaught Place, New Delhi', '9876543210', 1, 0),
(4, 'ECI781902', '1998-11-20', 27, 'Female', 1, '45, Barakhamba Road, New Delhi', '9812345678', 1, 0),
(5, 'ECI892101', '1995-02-10', 31, 'Male', 2, '78, Marine Drive, Mumbai', '9723456789', 1, 0);

INSERT INTO audit_logs (action_type, performed_by, description) VALUES
('SYSTEM_INITIALIZATION', 'SYSTEM', 'Election Commission Database initialized successfully.');

