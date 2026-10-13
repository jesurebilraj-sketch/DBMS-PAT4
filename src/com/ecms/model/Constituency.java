package com.ecms.model;

public class Constituency {
    private int constituencyId;
    private String name;
    private String state;
    private int totalVoters;
    private String status;

    public Constituency(int constituencyId, String name, String state, int totalVoters, String status) {
        this.constituencyId = constituencyId;
        this.name = name;
        this.state = state;
        this.totalVoters = totalVoters;
        this.status = status;
    }

    public int getConstituencyId() { return constituencyId; }
    public String getName() { return name; }
    public String getState() { return state; }
    public int getTotalVoters() { return totalVoters; }
    public String getStatus() { return status; }

    public String toJson() {
        return String.format(
            "{\"constituencyId\":%d,\"name\":\"%s\",\"state\":\"%s\",\"totalVoters\":%d,\"status\":\"%s\"}",
            constituencyId, escape(name), escape(state), totalVoters, escape(status)
        );
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
}

