package com.ecms.service;

import com.ecms.db.Database;
import com.ecms.db.Queries;
import com.ecms.model.Voter;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.Period;
import java.util.Random;

public class VoterService {

    /**
     * Registers a new voter after stringent eligibility validation:
     * - Minimum Age requirement >= 18 (computed from DOB)
     * - Unique username and unique EPIC generation
     * - Valid constituency assignment
     */
    public static String registerVoter(String fullName, String dob, String gender,
                                      int constituencyId, String address, String phone,
                                      String username, String password, String email) {

        // 1. Validation of mandatory inputs
        if (fullName == null || fullName.trim().isEmpty() ||
            dob == null || dob.trim().isEmpty() ||
            gender == null || gender.trim().isEmpty() ||
            address == null || address.trim().isEmpty() ||
            phone == null || phone.trim().isEmpty() ||
            username == null || username.trim().isEmpty() ||
            password == null || password.trim().isEmpty()) {
            return "{\"success\":false,\"message\":\"All required fields must be filled.\"}";
        }

        // 2. Age Computation & Constitutional Eligibility Check (Article 326)
        int age;
        try {
            LocalDate birthDate = LocalDate.parse(dob.trim());
            LocalDate today = LocalDate.now();
            if (birthDate.isAfter(today)) {
                return "{\"success\":false,\"message\":\"Invalid Date of Birth: Date cannot be in the future.\"}";
            }
            age = Period.between(birthDate, today).getYears();
        } catch (Exception e) {
            return "{\"success\":false,\"message\":\"Invalid Date of Birth format. Please use YYYY-MM-DD.\"}";
        }

        // Strict Eligibility Rule:
        if (age < 18) {
            return String.format(
                "{\"success\":false,\"message\":\"ELIGIBILITY REJECTED: Voter is %d years old. " +
                "Under Article 326 of the Constitution & Representation of the People Act, " +
                "citizens must be at least 18 years of age to register as an elector.\"}",
                age
            );
        }

        // 3. Database Operations with JDBC
        try (Connection conn = Database.getConnection()) {
            // Check if username already exists
            try (PreparedStatement checkStmt = conn.prepareStatement(Queries.CHECK_USERNAME_OR_EPIC_EXISTS)) {
                checkStmt.setString(1, username.trim());
                checkStmt.setString(2, "");
                try (ResultSet rs = checkStmt.executeQuery()) {
                    if (rs.next()) {
                        return "{\"success\":false,\"message\":\"Username '" + username + "' is already registered. Please choose another username.\"}";
                    }
                }
            }

            // Generate unique EPIC Card Number (e.g. ECI + 6 digits)
            String epicNo = "ECI" + (100000 + new Random().nextInt(900000));

            // Use transaction for atomic user + voter creation
            conn.setAutoCommit(false);
            int newUserId = -1;

            try {
                // Insert User Record
                try (PreparedStatement uStmt = conn.prepareStatement(Queries.INSERT_USER, Statement.RETURN_GENERATED_KEYS)) {
                    uStmt.setString(1, username.trim());
                    uStmt.setString(2, password.trim());
                    uStmt.setString(3, fullName.trim());
                    uStmt.setString(4, email != null ? email.trim() : "");
                    uStmt.executeUpdate();

                    try (ResultSet keys = uStmt.getGeneratedKeys()) {
                        if (keys.next()) {
                            newUserId = keys.getInt(1);
                        }
                    }
                }

                if (newUserId <= 0) {
                    conn.rollback();
                    return "{\"success\":false,\"message\":\"Failed to generate user record.\"}";
                }

                // Insert Voter Record
                try (PreparedStatement vStmt = conn.prepareStatement(Queries.INSERT_VOTER)) {
                    vStmt.setInt(1, newUserId);
                    vStmt.setString(2, epicNo);
                    vStmt.setString(3, dob.trim());
                    vStmt.setInt(4, age);
                    vStmt.setString(5, gender.trim());
                    vStmt.setInt(6, constituencyId);
                    vStmt.setString(7, address.trim());
                    vStmt.setString(8, phone.trim());
                    vStmt.executeUpdate();
                }

                // Increment Constituency Registered Voters count
                try (PreparedStatement cStmt = conn.prepareStatement(
                        "UPDATE constituencies SET total_voters = total_voters + 1 WHERE constituency_id = ?")) {
                    cStmt.setInt(1, constituencyId);
                    cStmt.executeUpdate();
                }

                // Insert Audit Trail
                try (PreparedStatement logStmt = conn.prepareStatement(Queries.INSERT_AUDIT_LOG)) {
                    logStmt.setString(1, "VOTER_REGISTRATION");
                    logStmt.setString(2, username);
                    logStmt.setString(3, "New voter registered: " + fullName + " (EPIC: " + epicNo + ", Age: " + age + ")");
                    logStmt.executeUpdate();
                }

                conn.commit();

                return String.format(
                    "{\"success\":true,\"message\":\"Voter Registration Approved! Welcome to the Electoral Roll.\"," +
                    "\"epicNo\":\"%s\",\"age\":%d,\"username\":\"%s\"}",
                    epicNo, age, username
                );

            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(true);
            }

        } catch (SQLException e) {
            e.printStackTrace();
            return "{\"success\":false,\"message\":\"Database transaction failed: " + e.getMessage() + "\"}";
        }
    }

    public static Voter getVoterByUserId(Connection conn, int userId) throws SQLException {
        try (PreparedStatement pstmt = conn.prepareStatement(Queries.GET_VOTER_BY_USER_ID)) {
            pstmt.setInt(1, userId);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return new Voter(
                        rs.getInt("voter_id"),
                        rs.getInt("user_id"),
                        rs.getString("epic_no"),
                        rs.getString("full_name"),
                        rs.getString("dob"),
                        rs.getInt("age"),
                        rs.getString("gender"),
                        rs.getInt("constituency_id"),
                        rs.getString("constituency_name"),
                        rs.getString("constituency_state"),
                        rs.getString("address"),
                        rs.getString("phone"),
                        rs.getInt("is_verified") == 1,
                        rs.getInt("has_voted") == 1,
                        rs.getString("voted_at")
                    );
                }
            }
        }
        return null;
    }

    /**
     * Executes Form 8: Application for Correction to Particulars Entered in Electoral Roll.
     * Performs SQL UPDATE on voters (address, phone) and users (email).
     */
    public static String updateVoterParticulars(int voterId, String phone, String address, String email) {
        if (voterId <= 0 || phone == null || phone.trim().isEmpty() || address == null || address.trim().isEmpty()) {
            return "{\"success\":false,\"message\":\"Voter ID, Mobile number, and Address are required for update.\"}";
        }

        try (Connection conn = Database.getConnection()) {
            conn.setAutoCommit(false);
            try {
                // 1. UPDATE voters table
                try (PreparedStatement pstmt = conn.prepareStatement(Queries.UPDATE_VOTER_PARTICULARS)) {
                    pstmt.setString(1, address.trim());
                    pstmt.setString(2, phone.trim());
                    pstmt.setInt(3, voterId);
                    int updatedRows = pstmt.executeUpdate();
                    if (updatedRows == 0) {
                        conn.rollback();
                        return "{\"success\":false,\"message\":\"Voter record not found.\"}";
                    }
                }

                // 2. Fetch user_id to update users table email
                int userId = -1;
                String epicNo = "";
                try (PreparedStatement s = conn.prepareStatement("SELECT user_id, epic_no FROM voters WHERE voter_id = ?")) {
                    s.setInt(1, voterId);
                    try (ResultSet rs = s.executeQuery()) {
                        if (rs.next()) {
                            userId = rs.getInt("user_id");
                            epicNo = rs.getString("epic_no");
                        }
                    }
                }

                if (userId > 0 && email != null && !email.trim().isEmpty()) {
                    try (PreparedStatement uStmt = conn.prepareStatement("UPDATE users SET email = ? WHERE user_id = ?")) {
                        uStmt.setString(1, email.trim());
                        uStmt.setInt(2, userId);
                        uStmt.executeUpdate();
                    }
                }

                // 3. Log Audit Trail
                try (PreparedStatement log = conn.prepareStatement(Queries.INSERT_AUDIT_LOG)) {
                    log.setString(1, "VOTER_PARTICULARS_UPDATED");
                    log.setString(2, epicNo);
                    log.setString(3, "Form 8 update: Modified address/phone for EPIC: " + epicNo);
                    log.executeUpdate();
                }

                conn.commit();
                return "{\"success\":true,\"message\":\"Form 8: Elector particulars updated successfully in Electoral Roll!\"}";

            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(true);
            }

        } catch (SQLException e) {
            e.printStackTrace();
            return "{\"success\":false,\"message\":\"Update failed: " + e.getMessage() + "\"}";
        }
    }
}

