# Future Ideas & Implementation Plans

This document tracks proposed features, security enhancements, and roadmap items currently awaiting approval or scheduled for future phases.

---

## 📅 Log Entry: 21 February 2026

### 🛡️ Security Hardening (Proposed)
| Feature | Description | Rationale |
|---|---|---|
| **HMAC URL Signing** | Add a cryptographic signature to each QR code URL. | Prevents "Enumeration Attacks" where users manually change the `exam_id` in the address bar. |
| **Global Access PIN** | A mandatory passcode required to view Admin/Attendance pages. | Ensures that even with a physical QR code, data remains protected from unauthorized eyes. |
| **QR Code TTL (Expiration)** | Implement a Time-To-Live for admission cards (e.g., valid for 24h). | Reduces the risk of post-examination data tampering or reuse of old cards. |

### 📊 Management & Reporting (Proposed)
| Feature | Description | Rationale |
|---|---|---|
| **Consolidated Master Report** | A one-click export joining Student Info with final Attendance stats. | Simplifies final record-keeping and grade processing for administration. |
| **Admin Dashboard** | A high-level visual interface on the main page. | Provides instant pulse-check on total attendance percentages and recent system activity. |
| **Search & Filter** | Advanced search for student records by name, subject, or date. | Increases usability as the exam database grows over time. |

---

## 📈 Status Legend
- ⏳ **Awaiting Approval**: Idea proposed, pending user confirmation.
- 🏗️ **Planned**: Approved, scheduled for next implementation phase.
- ✅ **Implemented**: Feature is live in the codebase.

---
*Note: This file is updated whenever new architectural or functional directions are discussed.*
