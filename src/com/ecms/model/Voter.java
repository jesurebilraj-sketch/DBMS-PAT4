package com.ecms.model;

public class Voter {
    private int voterId;
    private int userId;
    private String epicNo;
    private String fullName;
    private String dob;
    private int age;
    private String gender;
    private int constituencyId;
    private String constituencyName;
    private String constituencyState;
    private String address;
    private String phone;
    private boolean isVerified;
    private boolean hasVoted;
    private String votedAt;

    public Voter(int voterId, int userId, String epicNo, String fullName, String dob, int age,
                 String gender, int constituencyId, String constituencyName, String constituencyState,
                 String address, String phone, boolean isVerified, boolean hasVoted, String votedAt) {
        this.voterId = voterId;
        this.userId = userId;
        this.epicNo = epicNo;
        this.fullName = fullName;
        this.dob = dob;
        this.age = age;
        this.gender = gender;
        this.constituencyId = constituencyId;
        this.constituencyName = constituencyName;
        this.constituencyState = constituencyState;
        this.address = address;
        this.phone = phone;
        this.isVerified = isVerified;
        this.hasVoted = hasVoted;
        this.votedAt = votedAt;
    }

    public int getVoterId() { return voterId; }
    public int getUserId() { return userId; }
    public String getEpicNo() { return epicNo; }
    public String getFullName() { return fullName; }
    public String getDob() { return dob; }
    public int getAge() { return age; }
    public String getGender() { return gender; }
    public int getConstituencyId() { return constituencyId; }
    public String getConstituencyName() { return constituencyName; }
    public String getConstituencyState() { return constituencyState; }
    public String getAddress() { return address; }
    public String getPhone() { return phone; }
    public boolean isVerified() { return isVerified; }
    public boolean hasVoted() { return hasVoted; }
    public String getVotedAt() { return votedAt; }

    public String toJson() {
        return String.format(
            "{\"voterId\":%d,\"userId\":%d,\"epicNo\":\"%s\",\"fullName\":\"%s\",\"dob\":\"%s\",\"age\":%d," +
            "\"gender\":\"%s\",\"constituencyId\":%d,\"constituencyName\":\"%s\",\"constituencyState\":\"%s\"," +
            "\"address\":\"%s\",\"phone\":\"%s\",\"isVerified\":%b,\"hasVoted\":%b,\"votedAt\":\"%s\"}",
            voterId, userId, escape(epicNo), escape(fullName), escape(dob), age,
            escape(gender), constituencyId, escape(constituencyName), escape(constituencyState),
            escape(address), escape(phone), isVerified, hasVoted, escape(votedAt != null ? votedAt : "")
        );
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
}

