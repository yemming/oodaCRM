# N8N Webhook Payload Structures

Here are the JSON data structures sent to the N8N webhook for each of the four AI functions.

## 1. Discovery Call 建議
**Request Type**: `discovery_call`
**Purpose**: Analyzes the customer and contacts to provide research and competitive analysis before a call.

```json
{
  "requestType": "discovery_call",
  "opportunityContext": {
    "id": "12345",
    "title": "New ERP for NeuroBrain",
    "customer": "NeuroBrain",
    "customerId": "888",
    "status": "In Discussion",
    "amount": 49950,
    "probability": 25,
    "closeDate": "2025/12/31",
    "salesRep": "Larry Wilson"
  },
  "timestamp": "2025-12-22T04:57:45.670Z",
  "contacts": [
    { "id": "c1", "name": "林 泳成", "title": "CO-FOUNDER & CCO" },
    { "id": "c2", "name": "李 名鴻", "title": "CTO" }
  ]
}
```

## 2. 生成 AI 洞察
**Request Type**: `ai_insight`
**Purpose**: Performs a full business logic analysis based on the Buying Center, Weekly Review, and Activities (Tasks/Events).

```json
{
  "requestType": "ai_insight",
  "opportunityContext": { /* ... same as above ... */ },
  "timestamp": "2025-12-22T04:57:44.636Z",
  "buyingCenter": [
    { "id": "c1", "category": "champion" },
    { "id": "c2", "category": "blocker" }
  ],
  "weeklyNotes": [
    { "date": "2025-12-20", "title": "Meeting Note", "note": "Customer is interested..." }
  ],
  "activities": {
    "emails": [],
    "tasks": [ { "title": "Send proposal", "status": "Completed" } ],
    "events": []
  },
  "scorecardData": {
    "scorecardChecks": { "check1": true, "check2": false },
    "probability": 25
  }
}
```

## 3. AI 建議郵件
**Request Type**: `email_template`
**Purpose**: Generates a personalized email draft based on the full Deal context and the specific recipient.

```json
{
  "requestType": "email_template",
  "opportunityContext": { /* ... same as above ... */ },
  "timestamp": "2025-12-22T04:58:00.000Z",
  "recipientName": "林 泳成",
  "recipientEmail": "jeff@neurobrain.com",
  "recipientTitle": "CO-FOUNDER & CCO",
  "emailPurpose": "follow_up",
  "buyingCenter": [ /* ... buying center matrix ... */ ],
  "weeklyNotes": [ /* ... review notes ... */ ],
  "activities": { /* ... activity timeline ... */ },
  "scorecardData": { /* ... }
}
```

## 4. 生成 JEP 建議 (Joint Engage Plan)
**Request Type**: `generate_jep`
**Purpose**: Creates a collaborative action plan (JEP) based on the current deal status and historical activities.

```json
{
  "requestType": "generate_jep",
  "opportunityContext": { /* ... same as above ... */ },
  "timestamp": "2025-12-22T04:57:49.371Z",
  "buyingCenter": [ /* ... */ ],
  "weeklyNotes": [ /* ... */ ],
  "activities": {
    "emails": [ /* ... emails ... */ ],
    "tasks": [ /* ... tasks ... */ ],
    "events": [ /* ... events ... */ ]
  },
  "scorecardData": { /* ... */ },
  "formData": { /* ... other NetSuite fields ... */ }
}
```
