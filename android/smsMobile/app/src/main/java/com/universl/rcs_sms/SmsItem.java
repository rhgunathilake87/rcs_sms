package com.universl.rcs_sms;

public class SmsItem {
    private final String sender;
    private final String body;
    private final long timestamp;

    private String verificationStatus = "NOT_VERIFIED";
    private String institutionId = "";
    private String institutionName = "";
    private String institutionLogoUrl = "";
    private boolean institutionVerified = false;

    public SmsItem(String sender, String body, long timestamp) {
        this.sender = sender;
        this.body = body;
        this.timestamp = timestamp;
    }

    public String getSender() {
        return sender;
    }

    public String getBody() {
        return body;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public String getVerificationStatus() {
        return verificationStatus;
    }

    public void setVerificationStatus(String status) {
        this.verificationStatus = status;
    }

    public String getInstitutionId() {
        return institutionId;
    }

    public String getInstitutionName() {
        return institutionName;
    }

    public String getInstitutionLogoUrl() {
        return institutionLogoUrl;
    }

    public boolean isInstitutionVerified() {
        return institutionVerified;
    }

    public void setInstitutionDetails(
            String id,
            String name,
            String logoUrl,
            boolean verified
    ) {
        institutionId = id == null ? "" : id;
        institutionName = name == null ? "" : name;
        institutionLogoUrl = logoUrl == null ? "" : logoUrl;
        institutionVerified = verified;
    }
}


