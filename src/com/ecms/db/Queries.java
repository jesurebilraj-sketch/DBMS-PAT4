package com.ecms.db;

/**
 * Centralized repository of all DML SQL queries utilized by the JDBC Data Access Layer.
 */
public class Queries {

    // 1. Authentication
    public static final String AUTHENTICATE_USER =
            "SELECT user_id, username, full_name, role, email FROM users WHERE username = ? AND password = ?";

    // 2. Voter Lookup
    public static final String GET_VOTER_BY_USER_ID =
            "SELECT v.voter_id, v.user_id, v.epic_no, u.full_name, v.dob, v.age, v.gender, " +
            "       v.constituency_id, c.name AS constituency_name, c.state AS constituency_state, " +
            "       v.address, v.phone, v.is_verified, v.has_voted, v.voted_at " +
            "FROM voters v " +
            "JOIN users u ON v.user_id = u.user_id " +
            "JOIN constituencies c ON v.constituency_id = c.constituency_id " +
            "WHERE u.user_id = ?";

    public static final String GET_VOTER_BY_EPIC =
            "SELECT v.voter_id, v.user_id, v.epic_no, u.full_name, v.dob, v.age, v.gender, " +
            "       v.constituency_id, c.name AS constituency_name, v.has_voted " +
            "FROM voters v " +
            "JOIN users u ON v.user_id = u.user_id " +
            "JOIN constituencies c ON v.constituency_id = c.constituency_id " +
            "WHERE v.epic_no = ?";

    // 3. Voter Registration
    public static final String CHECK_USERNAME_OR_EPIC_EXISTS =
            "SELECT u.user_id FROM users u " +
            "LEFT JOIN voters v ON u.user_id = v.user_id " +
            "WHERE u.username = ? OR v.epic_no = ?";

    public static final String INSERT_USER =
            "INSERT INTO users (username, password, full_name, role, email) VALUES (?, ?, ?, 'VOTER', ?)";

    public static final String INSERT_VOTER =
            "INSERT INTO voters (user_id, epic_no, dob, age, gender, constituency_id, address, phone, is_verified, has_voted) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)";

    // 4. Ballot & Candidates
    public static final String GET_CANDIDATES_FOR_CONSTITUENCY =
            "SELECT c.candidate_id, c.full_name, c.party_id, p.party_name, p.abbreviation, p.symbol, " +
            "       c.constituency_id, con.name AS constituency_name, c.age, c.education, c.criminal_cases, " +
            "       c.assets_declared, c.votes_count " +
            "FROM candidates c " +
            "JOIN parties p ON c.party_id = p.party_id " +
            "JOIN constituencies con ON c.constituency_id = con.constituency_id " +
            "WHERE c.constituency_id = ? " +
            "ORDER BY c.candidate_id ASC";

    public static final String GET_ALL_CANDIDATES =
            "SELECT c.candidate_id, c.full_name, c.party_id, p.party_name, p.abbreviation, p.symbol, " +
            "       c.constituency_id, con.name AS constituency_name, c.age, c.education, c.criminal_cases, " +
            "       c.assets_declared, c.votes_count " +
            "FROM candidates c " +
            "JOIN parties p ON c.party_id = p.party_id " +
            "JOIN constituencies con ON c.constituency_id = con.constituency_id " +
            "ORDER BY con.name, c.votes_count DESC";

    // 5. Voting Transaction
    public static final String CHECK_IF_VOTER_HAS_VOTED =
            "SELECT has_voted, constituency_id FROM voters WHERE voter_id = ?";

    public static final String RECORD_VOTE_ENTRY =
            "INSERT INTO votes (constituency_id, candidate_id, ballot_hash) VALUES (?, ?, ?)";

    public static final String INCREMENT_CANDIDATE_VOTES =
            "UPDATE candidates SET votes_count = votes_count + 1 WHERE candidate_id = ?";

    public static final String MARK_VOTER_AS_VOTED =
            "UPDATE voters SET has_voted = 1, voted_at = CURRENT_TIMESTAMP WHERE voter_id = ?";

    // 6. Constituencies & Parties
    public static final String GET_ALL_CONSTITUENCIES =
            "SELECT constituency_id, name, state, total_voters, status FROM constituencies ORDER BY name ASC";

    public static final String GET_ALL_PARTIES =
            "SELECT party_id, party_name, abbreviation, symbol, leader_name, manifesto FROM parties ORDER BY party_name ASC";

    // 7. Live Results & Analytics
    public static final String GET_TOTAL_REGISTERED_VOTERS =
            "SELECT COUNT(*) AS total FROM voters";

    public static final String GET_TOTAL_VOTES_CAST =
            "SELECT COUNT(*) AS total FROM votes";

    public static final String GET_CONSTITUENCY_TURNOUT =
            "SELECT c.constituency_id, c.name, c.state, " +
            "       (SELECT COUNT(*) FROM voters v WHERE v.constituency_id = c.constituency_id) AS registered_count, " +
            "       (SELECT COUNT(*) FROM votes vt WHERE vt.constituency_id = c.constituency_id) AS votes_cast " +
            "FROM constituencies c";

    // 8. Admin Oversight
    public static final String GET_ALL_REGISTERED_VOTERS_DETAIL =
            "SELECT v.voter_id, v.epic_no, u.username, u.full_name, v.dob, v.age, v.gender, " +
            "       c.name AS constituency_name, v.phone, v.is_verified, v.has_voted, v.voted_at " +
            "FROM voters v " +
            "JOIN users u ON v.user_id = u.user_id " +
            "JOIN constituencies c ON v.constituency_id = c.constituency_id " +
            "ORDER BY v.voter_id DESC";

    public static final String INSERT_CANDIDATE =
            "INSERT INTO candidates (full_name, party_id, constituency_id, age, education, criminal_cases, assets_declared, votes_count) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, 0)";

    public static final String INSERT_CONSTITUENCY =
            "INSERT INTO constituencies (name, state, total_voters, status) VALUES (?, ?, 0, ?)";

    public static final String INSERT_AUDIT_LOG =
            "INSERT INTO audit_logs (action_type, performed_by, description) VALUES (?, ?, ?)";

    public static final String GET_RECENT_AUDIT_LOGS =
            "SELECT log_id, action_type, performed_by, description, timestamp " +
            "FROM audit_logs ORDER BY log_id DESC LIMIT 50";

    // 9. Updation Commands (Correction of Entries & Administrative Modifiers)
    public static final String UPDATE_VOTER_PARTICULARS =
            "UPDATE voters SET address = ?, phone = ? WHERE voter_id = ?";

    public static final String UPDATE_USER_PROFILE =
            "UPDATE users SET full_name = ?, email = ? WHERE user_id = ?";

    public static final String UPDATE_CANDIDATE_AFFIDAVIT =
            "UPDATE candidates SET education = ?, criminal_cases = ?, assets_declared = ? WHERE candidate_id = ?";

    public static final String UPDATE_CONSTITUENCY_STATUS =
            "UPDATE constituencies SET status = ? WHERE constituency_id = ?";

    public static final String UPDATE_VOTER_VERIFICATION =
            "UPDATE voters SET is_verified = ? WHERE voter_id = ?";
}

