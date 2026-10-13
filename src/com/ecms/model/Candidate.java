package com.ecms.model;

public class Candidate {
    private int candidateId;
    private String fullName;
    private int partyId;
    private String partyName;
    private String partyAbbreviation;
    private String symbol;
    private int constituencyId;
    private String constituencyName;
    private int age;
    private String education;
    private int criminalCases;
    private double assetsDeclared;
    private int votesCount;
    private double votePercentage;

    public Candidate(int candidateId, String fullName, int partyId, String partyName,
                     String partyAbbreviation, String symbol, int constituencyId,
                     String constituencyName, int age, String education, int criminalCases,
                     double assetsDeclared, int votesCount) {
        this.candidateId = candidateId;
        this.fullName = fullName;
        this.partyId = partyId;
        this.partyName = partyName;
        this.partyAbbreviation = partyAbbreviation;
        this.symbol = symbol;
        this.constituencyId = constituencyId;
        this.constituencyName = constituencyName;
        this.age = age;
        this.education = education;
        this.criminalCases = criminalCases;
        this.assetsDeclared = assetsDeclared;
        this.votesCount = votesCount;
        this.votePercentage = 0.0;
    }

    public int getCandidateId() { return candidateId; }
    public String getFullName() { return fullName; }
    public int getPartyId() { return partyId; }
    public String getPartyName() { return partyName; }
    public String getPartyAbbreviation() { return partyAbbreviation; }
    public String getSymbol() { return symbol; }
    public int getConstituencyId() { return constituencyId; }
    public String getConstituencyName() { return constituencyName; }
    public int getAge() { return age; }
    public String getEducation() { return education; }
    public int getCriminalCases() { return criminalCases; }
    public double getAssetsDeclared() { return assetsDeclared; }
    public int getVotesCount() { return votesCount; }
    public double getVotePercentage() { return votePercentage; }
    public void setVotePercentage(double votePercentage) { this.votePercentage = votePercentage; }

    public String toJson() {
        return String.format(
            "{\"candidateId\":%d,\"fullName\":\"%s\",\"partyId\":%d,\"partyName\":\"%s\"," +
            "\"partyAbbreviation\":\"%s\",\"symbol\":\"%s\",\"constituencyId\":%d,\"constituencyName\":\"%s\"," +
            "\"age\":%d,\"education\":\"%s\",\"criminalCases\":%d,\"assetsDeclared\":%.2f," +
            "\"votesCount\":%d,\"votePercentage\":%.2f}",
            candidateId, escape(fullName), partyId, escape(partyName),
            escape(partyAbbreviation), escape(symbol), constituencyId, escape(constituencyName),
            age, escape(education), criminalCases, assetsDeclared, votesCount, votePercentage
        );
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
}

