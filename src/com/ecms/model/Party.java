package com.ecms.model;

public class Party {
    private int partyId;
    private String partyName;
    private String abbreviation;
    private String symbol;
    private String leaderName;
    private String manifesto;

    public Party(int partyId, String partyName, String abbreviation, String symbol, String leaderName, String manifesto) {
        this.partyId = partyId;
        this.partyName = partyName;
        this.abbreviation = abbreviation;
        this.symbol = symbol;
        this.leaderName = leaderName;
        this.manifesto = manifesto;
    }

    public int getPartyId() { return partyId; }
    public String getPartyName() { return partyName; }
    public String getAbbreviation() { return abbreviation; }
    public String getSymbol() { return symbol; }
    public String getLeaderName() { return leaderName; }
    public String getManifesto() { return manifesto; }

    public String toJson() {
        return String.format(
            "{\"partyId\":%d,\"partyName\":\"%s\",\"abbreviation\":\"%s\",\"symbol\":\"%s\",\"leaderName\":\"%s\",\"manifesto\":\"%s\"}",
            partyId, escape(partyName), escape(abbreviation), escape(symbol), escape(leaderName), escape(manifesto != null ? manifesto : "")
        );
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
}

