package com.ecms.model;

public class User {
    private int userId;
    private String username;
    private String fullName;
    private String role;
    private String email;

    public User(int userId, String username, String fullName, String role, String email) {
        this.userId = userId;
        this.username = username;
        this.fullName = fullName;
        this.role = role;
        this.email = email;
    }

    public int getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getFullName() { return fullName; }
    public String getRole() { return role; }
    public String getEmail() { return email; }

    public String toJson() {
        return String.format(
            "{\"userId\":%d,\"username\":\"%s\",\"fullName\":\"%s\",\"role\":\"%s\",\"email\":\"%s\"}",
            userId, escape(username), escape(fullName), escape(role), escape(email != null ? email : "")
        );
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
}

