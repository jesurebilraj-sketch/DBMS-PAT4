package com.ecms.service;

import com.ecms.db.Database;
import com.ecms.db.Queries;
import com.ecms.model.Candidate;
import com.ecms.model.Constituency;
import com.ecms.model.Party;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ElectionService {

    public static String getConstituencies() {
        List<String> list = new ArrayList<>();
        try (Connection conn = Database.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(Queries.GET_ALL_CONSTITUENCIES)) {

            while (rs.next()) {
                Constituency c = new Constituency(
                    rs.getInt("constituency_id"),
                    rs.getString("name"),
                    rs.getString("state"),
                    rs.getInt("total_voters"),
                    rs.getString("status")
                );
                list.add(c.toJson());
            }
            return "[" + String.join(",", list) + "]";
        } catch (SQLException e) {
            e.printStackTrace();
            return "[]";
        }
    }

    public static String getParties() {
        List<String> list = new ArrayList<>();
        try (Connection conn = Database.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(Queries.GET_ALL_PARTIES)) {

            while (rs.next()) {
                Party p = new Party(
                    rs.getInt("party_id"),
                    rs.getString("party_name"),
                    rs.getString("abbreviation"),
                    rs.getString("symbol"),
                    rs.getString("leader_name"),
                    rs.getString("manifesto")
                );
                list.add(p.toJson());
            }
            return "[" + String.join(",", list) + "]";
        } catch (SQLException e) {
            e.printStackTrace();
            return "[]";
        }
    }

    public static String getCandidatesByConstituency(int constituencyId) {
        List<String> list = new ArrayList<>();
        try (Connection conn = Database.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(Queries.GET_CANDIDATES_FOR_CONSTITUENCY)) {

            pstmt.setInt(1, constituencyId);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    Candidate c = new Candidate(
                        rs.getInt("candidate_id"),
                        rs.getString("full_name"),
                        rs.getInt("party_id"),
                        rs.getString("party_name"),
                        rs.getString("abbreviation"),
                        rs.getString("symbol"),
                        rs.getInt("constituency_id"),
                        rs.getString("constituency_name"),
                        rs.getInt("age"),
                        rs.getString("education"),
                        rs.getInt("criminal_cases"),
                        rs.getDouble("assets_declared"),
                        rs.getInt("votes_count")
                    );
                    list.add(c.toJson());
                }
            }
            return "[" + String.join(",", list) + "]";
        } catch (SQLException e) {
            e.printStackTrace();
            return "[]";
        }
    }

    public static String getLiveElectionResults() {
        List<Candidate> candidateList = new ArrayList<>();
        Map<Integer, Integer> constituencyVotesMap = new HashMap<>();

        try (Connection conn = Database.getConnection()) {

            // Calculate total votes per constituency
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT constituency_id, COUNT(*) AS total FROM votes GROUP BY constituency_id")) {
                while (rs.next()) {
                    constituencyVotesMap.put(rs.getInt("constituency_id"), rs.getInt("total"));
                }
            }

            // Fetch all candidates
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(Queries.GET_ALL_CANDIDATES)) {
                while (rs.next()) {
                    Candidate c = new Candidate(
                        rs.getInt("candidate_id"),
                        rs.getString("full_name"),
                        rs.getInt("party_id"),
                        rs.getString("party_name"),
                        rs.getString("abbreviation"),
                        rs.getString("symbol"),
                        rs.getInt("constituency_id"),
                        rs.getString("constituency_name"),
                        rs.getInt("age"),
                        rs.getString("education"),
                        rs.getInt("criminal_cases"),
                        rs.getDouble("assets_declared"),
                        rs.getInt("votes_count")
                    );
                    int totalInConst = constituencyVotesMap.getOrDefault(c.getConstituencyId(), 0);
                    if (totalInConst > 0) {
                        c.setVotePercentage((double) c.getVotesCount() * 100.0 / totalInConst);
                    } else {
                        c.setVotePercentage(0.0);
                    }
                    candidateList.add(c);
                }
            }

            // Format JSON
            List<String> candJson = new ArrayList<>();
            for (Candidate c : candidateList) {
                candJson.add(c.toJson());
            }

            return "{\"success\":true,\"candidates\":[" + String.join(",", candJson) + "]}";

        } catch (SQLException e) {
            e.printStackTrace();
            return "{\"success\":false,\"message\":\"" + e.getMessage() + "\"}";
        }
    }

    public static String getAdminStats() {
        try (Connection conn = Database.getConnection()) {
            int totalVoters = 0;
            int totalVotes = 0;

            try (Statement s = conn.createStatement(); ResultSet rs = s.executeQuery(Queries.GET_TOTAL_REGISTERED_VOTERS)) {
                if (rs.next()) totalVoters = rs.getInt("total");
            }

            try (Statement s = conn.createStatement(); ResultSet rs = s.executeQuery(Queries.GET_TOTAL_VOTES_CAST)) {
                if (rs.next()) totalVotes = rs.getInt("total");
            }

            double turnout = totalVoters > 0 ? ((double) totalVotes * 100.0 / totalVoters) : 0.0;

            // Turnout by constituency
            List<String> constTurnouts = new ArrayList<>();
            try (Statement s = conn.createStatement(); ResultSet rs = s.executeQuery(Queries.GET_CONSTITUENCY_TURNOUT)) {
                while (rs.next()) {
                    int reg = rs.getInt("registered_count");
                    int cast = rs.getInt("votes_cast");
                    double pct = reg > 0 ? ((double) cast * 100.0 / reg) : 0.0;
                    constTurnouts.add(String.format(
                        "{\"id\":%d,\"name\":\"%s\",\"state\":\"%s\",\"registered\":%d,\"cast\":%d,\"turnout\":%.2f}",
                        rs.getInt("constituency_id"), escape(rs.getString("name")), escape(rs.getString("state")),
                        reg, cast, pct
                    ));
                }
            }

            return String.format(
                "{\"totalVoters\":%d,\"totalVotes\":%d,\"turnout\":%.2f,\"constituencies\":[%s]}",
                totalVoters, totalVotes, turnout, String.join(",", constTurnouts)
            );

        } catch (SQLException e) {
            e.printStackTrace();
            return "{\"totalVoters\":0,\"totalVotes\":0,\"turnout\":0.0,\"constituencies\":[]}";
        }
    }

    public static String getAllVotersForAdmin() {
        List<String> list = new ArrayList<>();
        try (Connection conn = Database.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(Queries.GET_ALL_REGISTERED_VOTERS_DETAIL)) {

            while (rs.next()) {
                list.add(String.format(
                    "{\"voterId\":%d,\"epicNo\":\"%s\",\"username\":\"%s\",\"fullName\":\"%s\",\"dob\":\"%s\"," +
                    "\"age\":%d,\"gender\":\"%s\",\"constituencyName\":\"%s\",\"phone\":\"%s\",\"isVerified\":%b," +
                    "\"hasVoted\":%b,\"votedAt\":\"%s\"}",
                    rs.getInt("voter_id"), escape(rs.getString("epic_no")), escape(rs.getString("username")),
                    escape(rs.getString("full_name")), escape(rs.getString("dob")), rs.getInt("age"),
                    escape(rs.getString("gender")), escape(rs.getString("constituency_name")),
                    escape(rs.getString("phone")), rs.getInt("is_verified") == 1, rs.getInt("has_voted") == 1,
                    escape(rs.getString("voted_at") != null ? rs.getString("voted_at") : "Not yet cast")
                ));
            }
            return "[" + String.join(",", list) + "]";
        } catch (SQLException e) {
            e.printStackTrace();
            return "[]";
        }
    }

    public static String getAuditLogs() {
        List<String> list = new ArrayList<>();
        try (Connection conn = Database.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(Queries.GET_RECENT_AUDIT_LOGS)) {

            while (rs.next()) {
                list.add(String.format(
                    "{\"id\":%d,\"action\":\"%s\",\"user\":\"%s\",\"desc\":\"%s\",\"time\":\"%s\"}",
                    rs.getInt("log_id"), escape(rs.getString("action_type")),
                    escape(rs.getString("performed_by")), escape(rs.getString("description")),
                    escape(rs.getString("timestamp"))
                ));
            }
            return "[" + String.join(",", list) + "]";
        } catch (SQLException e) {
            e.printStackTrace();
            return "[]";
        }
    }

    public static String addCandidate(String fullName, int partyId, int constituencyId, int age,
                                      String education, int criminalCases, double assetsDeclared) {
        if (fullName == null || fullName.trim().isEmpty() || partyId <= 0 || constituencyId <= 0) {
            return "{\"success\":false,\"message\":\"Candidate name, party, and constituency are required.\"}";
        }
        if (age < 25) {
            return "{\"success\":false,\"message\":\"Eligibility Error: Candidate must be at least 25 years old to contest elections under Article 84/173.\"}";
        }

        try (Connection conn = Database.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(Queries.INSERT_CANDIDATE)) {

            pstmt.setString(1, fullName.trim());
            pstmt.setInt(2, partyId);
            pstmt.setInt(3, constituencyId);
            pstmt.setInt(4, age);
            pstmt.setString(5, education != null ? education.trim() : "Graduate");
            pstmt.setInt(6, Math.max(0, criminalCases));
            pstmt.setDouble(7, Math.max(0.0, assetsDeclared));
            pstmt.executeUpdate();

            // Audit
            try (PreparedStatement log = conn.prepareStatement(Queries.INSERT_AUDIT_LOG)) {
                log.setString(1, "CANDIDATE_NOMINATED");
                log.setString(2, "ADMIN");
                log.setString(3, "Nominated candidate: " + fullName + " in Constituency ID: " + constituencyId);
                log.executeUpdate();
            }

            return "{\"success\":true,\"message\":\"Candidate nomination accepted and enrolled in ballot!\"}";

        } catch (SQLException e) {
            e.printStackTrace();
            return "{\"success\":false,\"message\":\"Failed to add candidate: " + e.getMessage() + "\"}";
        }
    }

    public static String createConstituency(String name, String state, String status) {
        if (name == null || name.trim().isEmpty() || state == null || state.trim().isEmpty()) {
            return "{\"success\":false,\"message\":\"Constituency name and State are required.\"}";
        }
        if (status == null || status.trim().isEmpty()) {
            status = "ACTIVE";
        }

        try (Connection conn = Database.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(Queries.INSERT_CONSTITUENCY, Statement.RETURN_GENERATED_KEYS)) {

            pstmt.setString(1, name.trim());
            pstmt.setString(2, state.trim());
            pstmt.setString(3, status.trim().toUpperCase());
            pstmt.executeUpdate();

            int generatedId = -1;
            try (ResultSet rs = pstmt.getGeneratedKeys()) {
                if (rs.next()) {
                    generatedId = rs.getInt(1);
                }
            }

            // Audit Log
            try (PreparedStatement log = conn.prepareStatement(Queries.INSERT_AUDIT_LOG)) {
                log.setString(1, "CONSTITUENCY_CREATED");
                log.setString(2, "CHIEF_ELECTION_COMMISSIONER");
                log.setString(3, "Created new electoral constituency: " + name.trim() + " (" + state.trim() + ")");
                log.executeUpdate();
            }

            String dmlExecuted = String.format("INSERT INTO constituencies (name, state, total_voters, status) VALUES ('%s', '%s', 0, '%s');",
                    escape(name.trim()), escape(state.trim()), escape(status.trim().toUpperCase()));

            return String.format(
                "{\"success\":true,\"message\":\"Electoral Constituency created successfully!\"," +
                "\"constituencyId\":%d,\"name\":\"%s\",\"state\":\"%s\",\"status\":\"%s\",\"dmlExecuted\":\"%s\"}",
                generatedId, escape(name.trim()), escape(state.trim()), escape(status.trim().toUpperCase()), escape(dmlExecuted)
            );

        } catch (SQLException e) {
            e.printStackTrace();
            if (e.getMessage() != null && e.getMessage().toLowerCase().contains("unique")) {
                return "{\"success\":false,\"message\":\"Constituency with name '" + name + "' already exists in database.\"}";
            }
            return "{\"success\":false,\"message\":\"Failed to create constituency: " + e.getMessage() + "\"}";
        }
    }

    public static String updateCandidateAffidavit(int candidateId, String education, int criminalCases, double assetsDeclared) {
        try (Connection conn = Database.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(Queries.UPDATE_CANDIDATE_AFFIDAVIT)) {
            pstmt.setString(1, education != null ? education.trim() : "Graduate");
            pstmt.setInt(2, Math.max(0, criminalCases));
            pstmt.setDouble(3, Math.max(0.0, assetsDeclared));
            pstmt.setInt(4, candidateId);
            int rows = pstmt.executeUpdate();

            if (rows > 0) {
                try (PreparedStatement log = conn.prepareStatement(Queries.INSERT_AUDIT_LOG)) {
                    log.setString(1, "CANDIDATE_AFFIDAVIT_UPDATED");
                    log.setString(2, "ADMIN");
                    log.setString(3, "Updated affidavit particulars for Candidate ID: " + candidateId);
                    log.executeUpdate();
                }
                return "{\"success\":true,\"message\":\"Candidate affidavit details updated successfully!\"}";
            } else {
                return "{\"success\":false,\"message\":\"Candidate not found.\"}";
            }
        } catch (SQLException e) {
            e.printStackTrace();
            return "{\"success\":false,\"message\":\"Update error: " + e.getMessage() + "\"}";
        }
    }

    public static String updateConstituencyStatus(int constituencyId, String status) {
        try (Connection conn = Database.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(Queries.UPDATE_CONSTITUENCY_STATUS)) {
            pstmt.setString(1, status);
            pstmt.setInt(2, constituencyId);
            int rows = pstmt.executeUpdate();

            if (rows > 0) {
                try (PreparedStatement log = conn.prepareStatement(Queries.INSERT_AUDIT_LOG)) {
                    log.setString(1, "CONSTITUENCY_STATUS_UPDATED");
                    log.setString(2, "ADMIN");
                    log.setString(3, "Constituency ID " + constituencyId + " status updated to " + status);
                    log.executeUpdate();
                }
                return "{\"success\":true,\"message\":\"Constituency status updated to " + status + "!\"}";
            } else {
                return "{\"success\":false,\"message\":\"Constituency not found.\"}";
            }
        } catch (SQLException e) {
            e.printStackTrace();
            return "{\"success\":false,\"message\":\"Update error: " + e.getMessage() + "\"}";
        }
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
}

