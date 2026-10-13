package com.ecms.db;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Properties;

/**
 * Database connection manager and schema initializer for ECMS.
 * Connects via standard JDBC driver (SQLite by default, MySQL switchable).
 */
public class Database {

    private static String dbUrl = "jdbc:sqlite:election.db";
    private static String dbUser = "";
    private static String dbPassword = "";
    private static String dbDriver = "org.sqlite.JDBC";
    private static boolean isInitialized = false;

    static {
        try {
            // Load configuration if present
            Class.forName(dbDriver);
        } catch (ClassNotFoundException e) {
            System.err.println("[JDBC ERROR] Could not load driver " + dbDriver + ": " + e.getMessage());
        }
    }

    public static synchronized void configure(String url, String user, String password, String driver) {
        dbUrl = url;
        dbUser = user;
        dbPassword = password;
        dbDriver = driver;
        try {
            Class.forName(dbDriver);
        } catch (ClassNotFoundException e) {
            System.err.println("[JDBC ERROR] Driver load failed: " + e.getMessage());
        }
    }

    public static Connection getConnection() throws SQLException {
        if (dbUser == null || dbUser.isEmpty()) {
            return DriverManager.getConnection(dbUrl);
        } else {
            return DriverManager.getConnection(dbUrl, dbUser, dbPassword);
        }
    }

    /**
     * Executes DDL to create tables and inserts initial seeds if the database is fresh.
     */
    public static synchronized void initializeDatabase() {
        if (isInitialized) return;

        try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
            System.out.println("[JDBC] Connecting to database: " + dbUrl);

            // Check if users table already exists
            boolean tablesExist = false;
            try (ResultSet rs = stmt.executeQuery("SELECT count(*) FROM users")) {
                if (rs.next()) {
                    tablesExist = true;
                }
            } catch (SQLException ignored) {
                // Table doesn't exist yet, proceed with DDL execution
            }

            if (!tablesExist) {
                System.out.println("[JDBC] Executing DDL Schema and Initial Seed Data...");
                executeDdlAndSeed(stmt);
                System.out.println("[JDBC] Schema and Seed Data populated successfully.");
            } else {
                System.out.println("[JDBC] Existing tables detected. Skipping seed initialization.");
            }

            isInitialized = true;
        } catch (SQLException e) {
            System.err.println("[JDBC ERROR] Error during database initialization: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void executeDdlAndSeed(Statement stmt) throws SQLException {
        // Table: users
        stmt.execute("CREATE TABLE IF NOT EXISTS users (" +
                "user_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "username VARCHAR(50) NOT NULL UNIQUE," +
                "password VARCHAR(100) NOT NULL," +
                "full_name VARCHAR(100) NOT NULL," +
                "role VARCHAR(20) NOT NULL CHECK(role IN ('ADMIN', 'VOTER', 'OFFICER'))," +
                "email VARCHAR(100)," +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");

        // Table: constituencies
        stmt.execute("CREATE TABLE IF NOT EXISTS constituencies (" +
                "constituency_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "name VARCHAR(100) NOT NULL UNIQUE," +
                "state VARCHAR(50) NOT NULL," +
                "total_voters INTEGER DEFAULT 0," +
                "status VARCHAR(20) DEFAULT 'ACTIVE')");

        // Table: parties
        stmt.execute("CREATE TABLE IF NOT EXISTS parties (" +
                "party_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "party_name VARCHAR(100) NOT NULL UNIQUE," +
                "abbreviation VARCHAR(10) NOT NULL," +
                "symbol VARCHAR(50) NOT NULL," +
                "leader_name VARCHAR(100) NOT NULL," +
                "manifesto TEXT)");

        // Table: candidates
        stmt.execute("CREATE TABLE IF NOT EXISTS candidates (" +
                "candidate_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "full_name VARCHAR(100) NOT NULL," +
                "party_id INTEGER NOT NULL REFERENCES parties(party_id) ON DELETE CASCADE," +
                "constituency_id INTEGER NOT NULL REFERENCES constituencies(constituency_id) ON DELETE CASCADE," +
                "age INTEGER NOT NULL CHECK(age >= 25)," +
                "education VARCHAR(50) NOT NULL," +
                "criminal_cases INTEGER DEFAULT 0," +
                "assets_declared DOUBLE DEFAULT 0.0," +
                "votes_count INTEGER DEFAULT 0)");

        // Table: voters
        stmt.execute("CREATE TABLE IF NOT EXISTS voters (" +
                "voter_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "user_id INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE," +
                "epic_no VARCHAR(20) NOT NULL UNIQUE," +
                "dob VARCHAR(10) NOT NULL," +
                "age INTEGER NOT NULL CHECK(age >= 18)," +
                "gender VARCHAR(10) NOT NULL," +
                "constituency_id INTEGER NOT NULL REFERENCES constituencies(constituency_id) ON DELETE CASCADE," +
                "address TEXT NOT NULL," +
                "phone VARCHAR(15) NOT NULL," +
                "is_verified INTEGER DEFAULT 1," +
                "has_voted INTEGER DEFAULT 0," +
                "voted_at TIMESTAMP)");

        // Table: votes
        stmt.execute("CREATE TABLE IF NOT EXISTS votes (" +
                "vote_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "constituency_id INTEGER NOT NULL REFERENCES constituencies(constituency_id)," +
                "candidate_id INTEGER NOT NULL REFERENCES candidates(candidate_id)," +
                "ballot_hash VARCHAR(64) NOT NULL UNIQUE," +
                "timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");

        // Table: audit_logs
        stmt.execute("CREATE TABLE IF NOT EXISTS audit_logs (" +
                "log_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "action_type VARCHAR(50) NOT NULL," +
                "performed_by VARCHAR(50) NOT NULL," +
                "description TEXT NOT NULL," +
                "timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");

        // Indexes
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_voter_epic ON voters(epic_no)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_cand_const ON candidates(constituency_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_vote_const ON votes(constituency_id)");

        // Seed Constituencies
        stmt.execute("INSERT INTO constituencies (name, state, total_voters, status) VALUES " +
                "('New Delhi Central', 'Delhi', 4, 'ACTIVE')," +
                "('Mumbai South', 'Maharashtra', 3, 'ACTIVE')," +
                "('Bengaluru South', 'Karnataka', 3, 'ACTIVE')," +
                "('Chennai Central', 'Tamil Nadu', 2, 'ACTIVE')");

        // Seed Parties
        stmt.execute("INSERT INTO parties (party_name, abbreviation, symbol, leader_name, manifesto) VALUES " +
                "('National Democratic Alliance', 'NDA', 'Lotus', 'J. P. Nadda', 'Infrastructure, Economic Growth, Digital Governance')," +
                "('United Progressive Alliance', 'UPA', 'Hand', 'Mallikarjun Kharge', 'Social Welfare, Rural Employment, Education Reform')," +
                "('Aam Aadmi Party', 'AAP', 'Broom', 'Arvind Kejriwal', 'Healthcare Clinics, Free Electricity, Public Schools')," +
                "('Independent Coalition', 'IND', 'Kite', 'Self-Nominated', 'Constituency Development, Civic Amenities, Transparency')");

        // Seed Candidates
        stmt.execute("INSERT INTO candidates (full_name, party_id, constituency_id, age, education, criminal_cases, assets_declared, votes_count) VALUES " +
                // New Delhi Central
                "('Rajesh Sharma', 1, 1, 48, 'Post Graduate (Economics)', 0, 45000000.0, 0)," +
                "('Priya Venkat', 2, 1, 42, 'LL.B. (Constitutional Law)', 0, 28000000.0, 0)," +
                "('Sanjay Gupta', 3, 1, 38, 'B.Tech (Computer Science)', 0, 15000000.0, 0)," +
                "('Alok Mathur', 4, 1, 51, 'M.A. (Public Policy)', 0, 8500000.0, 0)," +
                // Mumbai South
                "('Aditya Deshmukh', 1, 2, 45, 'M.B.A. (Finance)', 0, 62000000.0, 0)," +
                "('Farhan Merchant', 2, 2, 53, 'Chartered Accountant', 0, 51000000.0, 0)," +
                "('Sunita Kadam', 3, 2, 39, 'M.S.W. (Social Work)', 0, 9500000.0, 0)," +
                // Bengaluru South
                "('Dr. Ramesh Rao', 1, 3, 50, 'Ph.D. (Electronics)', 0, 39000000.0, 0)," +
                "('Ananya Murthy', 2, 3, 36, 'M.Sc. (Data Science)', 0, 22000000.0, 0)," +
                "('Deepak Gowda', 4, 3, 44, 'Graduate (Commerce)', 0, 14000000.0, 0)," +
                // Chennai Central
                "('S. Ramakrishnan', 1, 4, 55, 'B.L. (Law)', 0, 33000000.0, 0)," +
                "('Kavitha Selvam', 2, 4, 41, 'M.A. (Literature)', 0, 19000000.0, 0)");

        // Seed System Accounts (Admin & Returning Officer)
        stmt.execute("INSERT INTO users (username, password, full_name, role, email) VALUES " +
                "('admin', 'admin123', 'Chief Election Commissioner', 'ADMIN', 'cec@eci.gov.in')," +
                "('officer_delhi', 'officer123', 'Returning Officer Delhi', 'OFFICER', 'ro.delhi@eci.gov.in')," +
                "('voter1', 'voter123', 'Aarav Patel', 'VOTER', 'aarav@gmail.com')," +
                "('voter2', 'voter123', 'Sneha Iyer', 'VOTER', 'sneha@gmail.com')," +
                "('voter3', 'voter123', 'Rohan Mehta', 'VOTER', 'rohan@gmail.com')");

        // Seed Sample Voters
        stmt.execute("INSERT INTO voters (user_id, epic_no, dob, age, gender, constituency_id, address, phone, is_verified, has_voted) VALUES " +
                "(3, 'ECI781901', '2001-05-14', 25, 'Male', 1, '12, Connaught Place, New Delhi', '9876543210', 1, 0)," +
                "(4, 'ECI781902', '1998-11-20', 27, 'Female', 1, '45, Barakhamba Road, New Delhi', '9812345678', 1, 0)," +
                "(5, 'ECI892101', '1995-02-10', 31, 'Male', 2, '78, Marine Drive, Mumbai', '9723456789', 1, 0)");

        // Initial Audit Log
        stmt.execute("INSERT INTO audit_logs (action_type, performed_by, description) VALUES " +
                "('SYSTEM_INIT', 'SYSTEM', 'Election Commission Database initialized with default constituencies, candidates, and rolls.')");
    }
}

