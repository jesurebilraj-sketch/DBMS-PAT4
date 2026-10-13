package com.ecms.handler;

import com.ecms.service.AuthService;
import com.ecms.service.ElectionService;
import com.ecms.service.VoterService;
import com.ecms.service.VotingService;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ApiHandler implements HttpHandler {

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        URI uri = exchange.getRequestURI();
        String path = uri.getPath();

        // Handle CORS preflight
        if ("OPTIONS".equalsIgnoreCase(method)) {
            sendResponse(exchange, 204, "", "application/json");
            return;
        }

        try {
            if (path.equals("/api/login") && "POST".equalsIgnoreCase(method)) {
                String body = readRequestBody(exchange);
                Map<String, String> json = parseSimpleJson(body);
                String resp = AuthService.authenticate(json.get("username"), json.get("password"));
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/register") && "POST".equalsIgnoreCase(method)) {
                String body = readRequestBody(exchange);
                Map<String, String> json = parseSimpleJson(body);
                int constituencyId = Integer.parseInt(json.getOrDefault("constituencyId", "1"));
                String resp = VoterService.registerVoter(
                    json.get("fullName"),
                    json.get("dob"),
                    json.get("gender"),
                    constituencyId,
                    json.get("address"),
                    json.get("phone"),
                    json.get("username"),
                    json.get("password"),
                    json.get("email")
                );
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/constituencies") && "GET".equalsIgnoreCase(method)) {
                String resp = ElectionService.getConstituencies();
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/parties") && "GET".equalsIgnoreCase(method)) {
                String resp = ElectionService.getParties();
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/candidates") && "GET".equalsIgnoreCase(method)) {
                Map<String, String> query = parseQueryParams(uri.getQuery());
                int constId = Integer.parseInt(query.getOrDefault("constituencyId", "1"));
                String resp = ElectionService.getCandidatesByConstituency(constId);
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/vote") && "POST".equalsIgnoreCase(method)) {
                String body = readRequestBody(exchange);
                Map<String, String> json = parseSimpleJson(body);
                int voterId = Integer.parseInt(json.getOrDefault("voterId", "0"));
                int candidateId = Integer.parseInt(json.getOrDefault("candidateId", "0"));
                String resp = VotingService.castVote(voterId, candidateId);
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/results") && "GET".equalsIgnoreCase(method)) {
                String resp = ElectionService.getLiveElectionResults();
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/admin/stats") && "GET".equalsIgnoreCase(method)) {
                String resp = ElectionService.getAdminStats();
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/admin/voters") && "GET".equalsIgnoreCase(method)) {
                String resp = ElectionService.getAllVotersForAdmin();
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/admin/candidates") && "POST".equalsIgnoreCase(method)) {
                String body = readRequestBody(exchange);
                Map<String, String> json = parseSimpleJson(body);
                int partyId = Integer.parseInt(json.getOrDefault("partyId", "1"));
                int constituencyId = Integer.parseInt(json.getOrDefault("constituencyId", "1"));
                int age = Integer.parseInt(json.getOrDefault("age", "30"));
                int crim = Integer.parseInt(json.getOrDefault("criminalCases", "0"));
                double assets = Double.parseDouble(json.getOrDefault("assetsDeclared", "0.0"));
                String resp = ElectionService.addCandidate(
                    json.get("fullName"), partyId, constituencyId, age,
                    json.get("education"), crim, assets
                );
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/admin/audit-logs") && "GET".equalsIgnoreCase(method)) {
                String resp = ElectionService.getAuditLogs();
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/voter/update") && "POST".equalsIgnoreCase(method)) {
                String body = readRequestBody(exchange);
                Map<String, String> json = parseSimpleJson(body);
                int voterId = Integer.parseInt(json.getOrDefault("voterId", "0"));
                String resp = VoterService.updateVoterParticulars(
                    voterId, json.get("phone"), json.get("address"), json.get("email")
                );
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/admin/candidate-update") && "POST".equalsIgnoreCase(method)) {
                String body = readRequestBody(exchange);
                Map<String, String> json = parseSimpleJson(body);
                int candidateId = Integer.parseInt(json.getOrDefault("candidateId", "0"));
                int crim = Integer.parseInt(json.getOrDefault("criminalCases", "0"));
                double assets = Double.parseDouble(json.getOrDefault("assetsDeclared", "0.0"));
                String resp = ElectionService.updateCandidateAffidavit(
                    candidateId, json.get("education"), crim, assets
                );
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/admin/constituency-update") && "POST".equalsIgnoreCase(method)) {
                String body = readRequestBody(exchange);
                Map<String, String> json = parseSimpleJson(body);
                int constId = Integer.parseInt(json.getOrDefault("constituencyId", "0"));
                String resp = ElectionService.updateConstituencyStatus(constId, json.get("status"));
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/admin/constituency") && "POST".equalsIgnoreCase(method)) {
                String body = readRequestBody(exchange);
                Map<String, String> json = parseSimpleJson(body);
                String resp = ElectionService.createConstituency(
                    json.get("name"), json.get("state"), json.get("status")
                );
                sendResponse(exchange, 200, resp, "application/json");

            } else if (path.equals("/api/sql-script") && "GET".equalsIgnoreCase(method)) {
                File sqlFile = new File("database/DDL_DML.sql");
                String content = sqlFile.exists() ? Files.readString(sqlFile.toPath()) : "-- File not found";
                sendResponse(exchange, 200, content, "text/plain; charset=utf-8");

            } else {
                sendResponse(exchange, 404, "{\"error\":\"Endpoint not found\"}", "application/json");
            }
        } catch (Exception e) {
            e.printStackTrace();
            sendResponse(exchange, 500, "{\"error\":\"" + e.getMessage() + "\"}", "application/json");
        }
    }

    private String readRequestBody(HttpExchange exchange) throws IOException {
        InputStream is = exchange.getRequestBody();
        return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    }

    private void sendResponse(HttpExchange exchange, int statusCode, String responseText, String contentType) throws IOException {
        byte[] bytes = responseText.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private Map<String, String> parseQueryParams(String query) {
        Map<String, String> map = new HashMap<>();
        if (query == null || query.isEmpty()) return map;
        for (String param : query.split("&")) {
            String[] entry = param.split("=");
            if (entry.length > 1) {
                map.put(entry[0], entry[1]);
            } else if (entry.length == 1) {
                map.put(entry[0], "");
            }
        }
        return map;
    }

    private Map<String, String> parseSimpleJson(String json) {
        Map<String, String> map = new HashMap<>();
        if (json == null) return map;
        String trimmed = json.trim();
        if (trimmed.startsWith("{")) trimmed = trimmed.substring(1);
        if (trimmed.endsWith("}")) trimmed = trimmed.substring(0, trimmed.length() - 1);

        // Simple parser for standard key-value pairs
        boolean inQuote = false;
        StringBuilder current = new StringBuilder();
        List<String> tokens = new ArrayList<>();
        for (int i = 0; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            if (c == '\"' && (i == 0 || trimmed.charAt(i - 1) != '\\')) {
                inQuote = !inQuote;
                current.append(c);
            } else if (c == ',' && !inQuote) {
                tokens.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        if (current.length() > 0) {
            tokens.add(current.toString().trim());
        }

        for (String token : tokens) {
            int colonIndex = token.indexOf(':');
            if (colonIndex > 0) {
                String key = cleanVal(token.substring(0, colonIndex));
                String val = cleanVal(token.substring(colonIndex + 1));
                map.put(key, val);
            }
        }
        return map;
    }

    private String cleanVal(String s) {
        if (s == null) return "";
        s = s.trim();
        if (s.startsWith("\"") && s.endsWith("\"") && s.length() >= 2) {
            s = s.substring(1, s.length() - 1);
        }
        return s.replace("\\\"", "\"").replace("\\\\", "\\");
    }
}
