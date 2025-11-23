# Salesforce Field Discovery Summary

**Generated:** 2025-11-22
**Sandbox:** https://axonify--fullcpy.sandbox.my.salesforce.com

## Overview

This document summarizes all custom fields discovered in the Salesforce Account and Opportunity objects that are relevant for the CRM Overlay application.

---

## Account Object

**Total Fields:** 691
**Custom Fields:** 633
**Standard Fields:** 58

### 🎯 6sense Fields (9 fields)

These fields provide intent data and account intelligence:

| Field API Name | Label | Type | Notes |
|----------------|-------|------|-------|
| `accountIntentScore6sense__c` | 6sense Account Intent Score | Number | Key metric for prioritization |
| `accountBuyingStage6sense__c` | 6sense Account Buying Stage | Text (30) | Shows where account is in buying journey |
| `accountProfileScore6sense__c` | 6sense Account Profile Score | Number | Profile fit score |
| `accountProfileFit6sense__c` | 6sense Account Profile Fit | Text (18) | Fit rating |
| `accountReachScore6sense__c` | 6sense Account Reach Score | Text (18) | Reach potential |
| `accountUpdateDate6sense__c` | 6sense Account Update Date | DateTime | Last update from 6sense |
| `X6senseID__c` | 6senseID | Text (25) | Unique 6sense identifier |
| `X6Sense_Segments__c` | 6Sense - Technologies in Use | Text (255) | Tech stack detected by 6sense |
| `Previous_6sense_Account_Buying_Stage__c` | Previous 6sense Account Buying Stage | Text (25) | Historical buying stage |

**Key Insight:** Use `accountIntentScore6sense__c >= 70` to identify high-priority accounts.

### 🧱 Clay Enrichment Fields (22 fields)

Clay provides comprehensive account enrichment data:

| Field API Name | Label | Type | Use Case |
|----------------|-------|------|----------|
| `Clay_Employee_Count__c` | Clay - Employee Count | Number | Company size |
| `Gemini_Employee_Count__c` | Gemini Employee Count | Number | Alternative employee count |
| `Clay_Revenue__c` | Clay - Revenue | Currency | Company revenue |
| `Clay_Industry__c` | Clay - Industry | Text (255) | Industry classification |
| `Clay_Parent_Account__c` | Clay - Parent Account | Text (255) | Parent company name |
| `Clay_Total_Locations__c` | Clay - Total Locations | Number | Number of locations |
| `Clay_NAICS_code__c` | Clay - NAICS code | Number | Industry code |
| `Clay_City__c` / `Clay_State__c` / `Clay_Country__c` | Location fields | Text | Geographic data |
| `Enriched_by_Clay__c` | Enriched by Clay | Boolean | Flag if enriched |
| `Last_Enriched_by_Clay__c` | Last Enriched by Clay | DateTime | Last enrichment date |
| `Clay_Franchise__c` | Clay - Franchise | Boolean | Is franchise |
| `Clay_Purchasing_Power__c` | Clay - Purchasing Power | Boolean | Has purchasing power |
| `Clay_Is_the_Parent_Company__c` | Clay - Is the Parent Company | Boolean | Parent company flag |

**Key Insight:** Check `Enriched_by_Clay__c` to see if account has enrichment data.

### ⭐ Priority/Scoring Fields (7 fields)

| Field API Name | Label | Type | Notes |
|----------------|-------|------|-------|
| `Current_Gainsight_Score__c` | Current Gainsight Score | Number | Customer health score |
| `bizible2__Engagement_Score__c` | Predictive Engagement Score | Text (255) | Bizible engagement metric |
| `MQL_Company_Score__c` | MQL Company Score | Number | Marketing qualified score |
| `G2Crowd__CustomerPriority__c` | Customer Priority | Picklist | High/Medium/Low |
| `IV_Match_Score__c` | IV Match Score | Number | Ideal customer profile match |
| `Customer_Success_Score__c` | Customer Success Score | Number (Formula) | CS health metric |

### 💬 Notes & Commentary Fields (13 fields)

**AE-Editable Fields for Recording Insights:**

| Field API Name | Label | Type | Max Length |
|----------------|-------|------|------------|
| `Strategy_Notes__c` | Strategy Notes | Long Text | 32,768 chars |
| `Sponsorship_Notes__c` | Sponsorship Notes | Long Text | 32,768 chars |
| `Support_Notes__c` | Support Notes | Long Text | 32,768 chars |
| `Contract_Notes__c` | Contract Notes | Long Text | 32,768 chars |
| `Risk_Notes__c` | Risk Notes | Text | 255 chars |
| `Risk_Notes_History__c` | Risk Notes History | Long Text | 32,768 chars |
| `Detailed_Notes_for_Tools_in_Use__c` | Detailed Notes for Tools in Use | Long Text | 32,768 chars |
| `Overall_Customer_Health_Notes__c` | Overall Customer Health Notes | Text | 255 chars |
| `Learning_Strategy_Notes__c` | Learning Strategy Notes | Text | 255 chars |
| `Account_Notes__c` | Account Notes | URL | 255 chars |

**Key Insight:** These are likely the "scratchpad" fields AEs use to record important observations.

### 📝 No Dedicated Scratchpad Fields Found

The search for fields with "scratchpad" in the name returned 0 results. However, the **Notes & Commentary fields** above serve this purpose.

### 📊 Other Important Account Fields

| Field API Name | Label | Type | Use Case |
|----------------|-------|------|----------|
| `Risk__c` | Risk | Picklist | Red/Yellow/Green |
| `Customer_Stage__c` | Customer Stage | Picklist | New/Lifecycle/Renewal/Churned |
| `Total_ARR__c` | Current Total ARR | Currency | Revenue metric |
| `of_Axonify_Users__c` | Active Users | Number | Usage metric |
| `Launch_Date__c` | Launch Date | Date | Customer start date |
| `Agreement_Expiry_Date__c` | Agreement Expiry Date | Date | Contract end |
| `Target_Account__c` | Named Account | Boolean | Strategic account flag |
| `Last_QBR__c` | Last QBR | Date | Last quarterly review |
| `Last_Exec_Check_In__c` | Last Exec Check-In | Date | Last executive meeting |

---

## Opportunity Object

**Total Fields:** 731
**Custom Fields:** 686
**Standard Fields:** 45

### 🎯 MEDDPICC Fields (24 fields)

**Complete MEDDPICC methodology tracking:**

| Field API Name | Label | Type | Purpose |
|----------------|-------|------|---------|
| `COM_Metrics__c` | Metrics | Long Text | Success metrics & KPIs |
| `MEDDPICCR_Economic_Buyer__c` | Economic Buyer | Long Text | Who has budget authority |
| `Economic_Buyer_Name__c` | Economic Buyer Name | Text (80) | Name |
| `Economic_Buyer_Title__c` | Economic Buyer Title | Text (80) | Title |
| `MEDDPICCR_Decision_Criteria__c` | Decision Criteria | Long Text | What they're evaluating on |
| `MEDDPICCR_Decision_Process__c` | Decision Process | Long Text | How they make decisions |
| `MEDDPICCR_Paper_Process__c` | Paper Process | Long Text | Procurement/legal process |
| `MEDDPICCR_Implicate_Pain__c` | Implicate Pain | Long Text | Business pain points |
| `MEDDPICCR_Champion__c` | Champion | Long Text | Internal advocate |
| `MEDDPICCR_Competition__c` | Competition | Long Text | Competitive landscape |
| `MEDDPICCR_Risks__c` | Risks | Long Text | Deal risks |

**History Fields** (for change tracking):
- `MEDDPICCR_Metric_History__c`
- `MEDDPICCR_Economic_Buyer_History__c`
- `MEDDPICCR_Decision_Criteria_History__c`
- `MEDDPICCR_Decision_Process_History__c`
- `MEDDPICCR_Paper_Process_History__c`
- `MEDDPICCR_Implicate_Pain_History__c`
- `MEDDPICCR_Champion_History__c`
- `MEDDPICCR_Competition_History__c`
- `MEDDPICCR_Risks_History__c`

### ⚠️ Risk Tracking Fields (2 fields)

| Field API Name | Label | Type | Values |
|----------------|-------|------|--------|
| `Risk__c` | Risk | Picklist | Red, Yellow, Green |
| `Unresolved_Risks__c` | Unresolved Risks | Number (Formula) | Count of risks |

### ✅ Deal Qualification Fields (2 fields)

| Field API Name | Label | Type |
|----------------|-------|------|
| `DiscoveryZone_ARR__c` | DiscoveryZone ARR | Currency |
| `Nudge_Qualified_Date__c` | Nudge Qualified Date | Date |

### 📝 No Opportunity Scratchpad Fields

Similar to Accounts, no dedicated "scratchpad" fields were found. However, the extensive MEDDPICC fields serve as structured note-taking areas.

### 📊 Other Important Opportunity Fields

| Field API Name | Label | Type | Use Case |
|----------------|-------|------|----------|
| `ARR__c` | ARR | Currency | Annual recurring revenue |
| `Duration__c` | Duration (Months) | Number | Contract length |
| `Total_Contract_Value__c` | Total Contract Value | Currency (Formula) | TCV calculation |
| `License_Seats__c` | License Seats | Number | User count |
| `Milestone__c` | Milestone | Picklist | 28 sales process stages |
| `Use_Cases__c` | Application | Multi-Picklist | Sales, Product, Compliance, etc. |
| `Commit__c` | Commit | Boolean | Committed to forecast |
| `Date_Passed__c` | Date Passed | Date | When passed to sales |
| `Business_Objectives__c` | Business Objectives | Long Text | Customer goals |
| `Lost_Abandoned_Notes__c` | Lost Notes | Long Text | Why deal was lost |

---

## Recommended Fields for CRM Overlay

### Account 360 View - High Priority Fields

**6sense Intelligence:**
```typescript
accountIntentScore6sense__c
accountBuyingStage6sense__c
accountProfileScore6sense__c
X6Sense_Segments__c
```

**Clay Enrichment:**
```typescript
Clay_Employee_Count__c
Clay_Revenue__c
Clay_Industry__c
Clay_Total_Locations__c
Enriched_by_Clay__c
```

**Health & Risk:**
```typescript
Risk__c
Current_Gainsight_Score__c
Customer_Stage__c
Total_ARR__c
```

**AE Notes:**
```typescript
Strategy_Notes__c
Risk_Notes__c
Contract_Notes__c
Overall_Customer_Health_Notes__c
```

### Opportunity Detail - High Priority Fields

**MEDDPICC Core:**
```typescript
COM_Metrics__c
MEDDPICCR_Economic_Buyer__c
MEDDPICCR_Champion__c
MEDDPICCR_Decision_Process__c
MEDDPICCR_Implicate_Pain__c
MEDDPICCR_Competition__c
```

**Deal Metrics:**
```typescript
ARR__c
Total_Contract_Value__c
Duration__c
License_Seats__c
```

**Deal Health:**
```typescript
Risk__c
Milestone__c
Business_Objectives__c
```

---

## Next Steps

1. ✅ **Update TypeScript Interfaces** - Use the actual field names in `backend/src/services/salesforceData.ts`
2. ✅ **Update SOQL Queries** - Replace mock field names with real ones
3. ✅ **Update Frontend Components** - Display real data instead of placeholders
4. **Test Queries** - Verify all fields are accessible and returning data
5. **Design UI** - Create sections for 6sense, Clay, MEDDPICC, and Notes

---

## Important Notes

- **No Security Token Needed Going Forward:** Once OAuth is working, scripts can use refresh tokens
- **Field Limits:** Many text fields have character limits (check before displaying)
- **Picklist Values:** Some fields have predefined values - validate on save
- **Formula Fields:** Cannot be updated via API (they're calculated)
- **History Fields:** MEDDPICC has separate history fields for audit trail
