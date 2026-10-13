package com.ecms.service;

import com.ecms.db.Database;
import com.ecms.db.Queries;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class VotingService {

    /**
     * Executes an ACID-compliant vote casting transaction:
     * 1. Validates voter has not already cast ballot
     * 2. Confirms candidate belongs to voter's constituency
     * 3. Generates cryptographic SHA-256 VVPAT ballot token
     * 4. Updates votes, candidates, voters, and audit_logs atomically
     */
    public static String castVote(int voterId, int candidateId) {
        if (voterId <= 0 || candidateId <= 0) {
            return "{\"success\":false,\"message\":\"Invalid voter or candidate identifier.\"}";
        }

        try (Connection conn = Database.getConnection()) {

            // Step 1: Check voter eligibility & existing ballot status
            int voterConstituencyId = -1;
            boolean alreadyVoted = true;
            String epicNo = "";
            String voterName = "";

            try (PreparedStatement vStmt = conn.prepareStatement(
                    "SELECT v.has_voted, v.constituency_id, v.epic_no, u.full_name " +
                    "FROM voters v JOIN users u ON v.user_id = u.user_id WHERE v.voter_id = ?")) {
                vStmt.setInt(1, voterId);
                try (ResultSet rs = vStmt.executeQuery()) {
                    if (rs.next()) {
                        alreadyVoted = rs.getInt("has_voted") == 1;
                        voterConstituencyId = rs.getInt("constituency_id");
                        epicNo = rs.getString("epic_no");
                        voterName = rs.getString("full_name");
                    } else {
                        return "{\"success\":false,\"message\":\"Voter record not found.\"}";
                    }
                }
            }

            if (alreadyVoted) {
                return "{\"success\":false,\"message\":\"ACCESS DENIED: You have already cast your vote! Duplicate voting is prohibited.\"}";
            }

            // Step 2: Validate candidate and retrieve candidate details
            String candidateName = "";
            String partyName = "";
            String symbol = "";
            int candidateConstituencyId = -1;

            try (PreparedStatement cStmt = conn.prepareStatement(
                    "SELECT c.full_name, c.constituency_id, p.party_name, p.symbol " +
                    "FROM candidates c JOIN parties p ON c.party_id = p.party_id WHERE c.candidate_id = ?")) {
                cStmt.setInt(1, candidateId);
                try (ResultSet rs = cStmt.executeQuery()) {
                    if (rs.next()) {
                        candidateName = rs.getString("full_name");
                        candidateConstituencyId = rs.getInt("constituency_id");
                        partyName = rs.getString("party_name");
                        symbol = rs.getString("symbol");
                    } else {
                        return "{\"success\":false,\"message\":\"Invalid candidate selected.\"}";
                    }
                }
            }

            if (voterConstituencyId != candidateConstituencyId) {
                return "{\"success\":false,\"message\":\"Security Exception: Candidate is not contesting in your registered constituency.\"}";
            }

            // Step 3: Perform ACID Transaction with rollback safety
            conn.setAutoCommit(false);
            String ballotHash;
            String timestampStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

            try {
                // Generate Cryptographic VVPAT Token
                ballotHash = generateHash("BALLOT-" + voterId + "-" + candidateId + "-" + System.currentTimeMillis());

                // A. Insert into votes table
                try (PreparedStatement voteStmt = conn.prepareStatement(Queries.RECORD_VOTE_ENTRY)) {
                    voteStmt.setInt(1, voterConstituencyId);
                    voteStmt.setInt(2, candidateId);
                    voteStmt.setString(3, ballotHash);
                    voteStmt.executeUpdate();
                }

                // B. Increment candidate votes count
                try (PreparedStatement candStmt = conn.prepareStatement(Queries.INCREMENT_CANDIDATE_VOTES)) {
                    candStmt.setInt(1, candidateId);
                    candStmt.executeUpdate();
                }

                // C. Mark voter as voted
                try (PreparedStatement voterUpdStmt = conn.prepareStatement(Queries.MARK_VOTER_AS_VOTED)) {
                    voterUpdStmt.setInt(1, voterId);
                    voterUpdStmt.executeUpdate();
                }

                // D. Insert Audit Log
                try (PreparedStatement logStmt = conn.prepareStatement(Queries.INSERT_AUDIT_LOG)) {
                    logStmt.setString(1, "VOTE_CAST_COMPLETED");
                    logStmt.setString(2, epicNo);
                    logStmt.setString(3, "Vote cast by EPIC: " + epicNo + " in Constituency ID: " + voterConstituencyId +
                                         ". VVPAT Hash: " + ballotHash.substring(0, 16) + "...");
                    logStmt.executeUpdate();
                }

                // Commit Transaction
                conn.commit();

                return String.format(
                    "{\"success\":true,\"message\":\"Vote recorded successfully!\"," +
                    "\"receipt\":{" +
                    "\"candidateName\":\"%s\"," +
                    "\"partyName\":\"%s\"," +
                    "\"symbol\":\"%s\"," +
                    "\"timestamp\":\"%s\"," +
                    "\"ballotHash\":\"%s\"," +
                    "\"epicNo\":\"%s\"," +
                    "\"voterName\":\"%s\"" +
                    "}}",
                    escape(candidateName), escape(partyName), escape(symbol),
                    timestampStr, ballotHash, escape(epicNo), escape(voterName)
                );

            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(true);
            }

        } catch (Exception e) {
            e.printStackTrace();
            return "{\"success\":false,\"message\":\"Voting transaction error: " + e.getMessage() + "\"}";
        }
    }

    private static String generateHash(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString().toUpperCase();
        } catch (Exception e) {
            return "VVPAT-" + Long.toHexString(System.currentTimeMillis()).toUpperCase();
        }
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
}

