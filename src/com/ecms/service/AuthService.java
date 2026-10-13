package com.ecms.service;

import com.ecms.db.Database;
import com.ecms.db.Queries;
import com.ecms.model.User;
import com.ecms.model.Voter;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class AuthService {

    public static String authenticate(String username, String password) {
        if (username == null || username.trim().isEmpty() || password == null || password.trim().isEmpty()) {
            return "{\"success\":false,\"message\":\"Username and password are required.\"}";
        }

        try (Connection conn = Database.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(Queries.AUTHENTICATE_USER)) {

            pstmt.setString(1, username.trim());
            pstmt.setString(2, password.trim());

            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    int userId = rs.getInt("user_id");
                    String user = rs.getString("username");
                    String fullName = rs.getString("full_name");
                    String role = rs.getString("role");
                    String email = rs.getString("email");

                    User u = new User(userId, user, fullName, role, email);

                    // If user is a voter, attach voter profile
                    String voterJson = "null";
                    if ("VOTER".equalsIgnoreCase(role)) {
                        Voter voter = VoterService.getVoterByUserId(conn, userId);
                        if (voter != null) {
                            voterJson = voter.toJson();
                        }
                    }

                    // Log audit entry
                    try (PreparedStatement logStmt = conn.prepareStatement(Queries.INSERT_AUDIT_LOG)) {
                        logStmt.setString(1, "USER_LOGIN");
                        logStmt.setString(2, user);
                        logStmt.setString(3, "Successful login by " + role + ": " + user);
                        logStmt.executeUpdate();
                    }

                    return String.format(
                        "{\"success\":true,\"message\":\"Login successful! Welcome %s.\",\"user\":%s,\"voter\":%s}",
                        fullName, u.toJson(), voterJson
                    );
                } else {
                    return "{\"success\":false,\"message\":\"Invalid credentials. Please verify your username and password.\"}";
                }
            }

        } catch (SQLException e) {
            e.printStackTrace();
            return "{\"success\":false,\"message\":\"Database error during authentication: " + e.getMessage() + "\"}";
        }
    }
}

