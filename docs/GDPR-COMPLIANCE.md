# GDPR Compliance & Data Protection

## Overview

This document outlines how the MindMap Collaboration Tool complies with GDPR and relevant data protection regulations for use at German universities.

## Relevant Regulations

- **GDPR** (General Data Protection Regulation) - EU-wide
- **BDSG** (Bundesdatenschutzgesetz) - Germany-specific additions
- **LRDiG** (Landesdatenschutzgesetz Baden-Württemberg) - If applicable

## Data Classification

### What Data We Collect

1. **From Moodle (via LTI)**
   - User ID (internal Moodle ID)
   - Name (first & last name)
   - Email address
   - Course/Class ID
   - Role (Student, Instructor, Admin)

2. **Application Usage**
   - MindMap/Whiteboard content
   - Timestamps of edits
   - User action history (who edited what, when)
   - IP address (server logs)

### What We DON'T Collect

- ❌ Passwords (LTI handles auth, we never see them)
- ❌ Profile images or additional personal data
- ❌ Tracking cookies or analytics
- ❌ Third-party service calls

## Data Processing Activities

| Activity | Purpose | Legal Basis | Retention |
|----------|---------|-------------|-----------|
| **LTI Authentication** | User identification, course context | Contract (Moodle) | Session duration |
| **Project Storage** | Enable user to access their work | Legitimate Interest | For duration of course + 1 year |
| **Audit Log** | Security, debug issues | Legitimate Interest | 90 days |
| **Session Cookies** | Keep user logged in | Consent (via Moodle) | Until logout |

## Data Storage & Security

### Where is Data Stored?

**MVP & Beta Phase:**
- **Frontend**: Vercel (EU CDN)
- **Backend**: Render (EU servers available)
- **Database**: All-Inkl.com (German hosting, Bavaria)

✅ **All data stays in EU** - GDPR-compliant

**Production Phase (RUB):**
- **All services**: RUB servers in Germany
- **Database**: RUB PostgreSQL server

✅ **Maximum data protection** - Under RUB institutional control

### Encryption

- **In Transit**: HTTPS/TLS (all connections)
- **At Rest**: Database has encrypted password fields
- **Session Storage**: Secure, HttpOnly cookies (no JS access)

### Access Control

- Only authenticated Moodle users can access
- Users can only access their own projects + shared projects
- Admins have audit access to logs (for security only)

## User Rights (GDPR Articles 12-22)

### Right to Access (Article 15)

Users can request all personal data we hold:
- contact: [your-support-email@rub.de](mailto:your-support-email@rub.de)
- Response time: 30 days (GDPR standard)

### Right to Rectification (Article 16)

Users can request corrections to their data:
- Name, email corrections go through Moodle
- Project metadata can be edited in-app

### Right to Erasure (Article 17)

Users can request deletion:
- Projects: Deleted from our database
- User data: Removed from audit logs after 90 days
- Backups: Retained per backup policy (max 30 days)

### Right to Data Portability (Article 20)

Users can export their data:
- Projects can be exported as JSON
- User data available via API endpoint (documented in LTI-SETUP.md)

### Right to Object (Article 21)

Users can object to processing:
- Academic use: Moodle integration requires this
- Marketing: We don't do any marketing
- Profiling: We don't profile users

## Breach Notification

In case of data breach:
1. **RUB is notified** immediately
2. **Users are notified** within 72 hours (if high risk)
3. **Authorities notified** (if required by law)
4. **Mitigation steps taken** (password resets, etc.)

## Cookies & Tracking

### What Cookies We Use

| Cookie | Purpose | Duration |
|--------|---------|----------|
| `session_id` | Keep user logged in | Session + 24h |
| `socket.io` | WebSocket connection | Session |
| `XSRF-TOKEN` | CSRF protection | Session |

✅ No tracking cookies (Google Analytics, Facebook Pixel, etc.)

### Do We Need Consent?

- **Session cookies**: Exempt (necessary for functionality)
- **CSRF token**: Exempt (security)
- **Analytics**: Not used, so no consent needed

## Third-Party Services

### What We Use

| Service | Purpose | Data Shared | Alternative |
|---------|---------|-------------|-------------|
| **All-Inkl** | Database hosting | DB content | RUB servers |
| **Render** | Backend hosting (MVP) | Code, env vars | RUB servers |
| **Vercel** | Frontend hosting | Frontend only | RUB servers |

✅ All vendors are GDPR-compliant
✅ Migration to RUB removes external dependencies

### What We DON'T Use (Ever)

- ❌ Google Analytics
- ❌ Mixpanel, Segment, or other analytics
- ❌ Slack/Discord webhooks with user data
- ❌ Any US-based cloud services (except during MVP, disclosed)

## Data Retention Policy

### Active Project Data

- **Storage**: Until user deletes or course ends + 1 year
- **Backups**: 30 days after deletion (for recovery)

### Logs

- **Server Logs**: 7 days (automatic rotation)
- **Audit Logs**: 90 days (for security tracking)
- **Session Logs**: Deleted after logout

### User Data

- **Can be deleted**: Immediately on request
- **Automatically deleted**: 2 years after last access

## Processing Agreement (Auftragsverarbeitungsvertrag)

RUB data protection officer should verify:

1. ✅ We sign Data Processing Agreement (if using external hosts)
2. ✅ All sub-processors disclosed (All-Inkl, Render, Vercel)
3. ✅ Data importe/export capabilities documented
4. ✅ Audit rights for RUB compliance teams

## Compliance Checklist

- [ ] Privacy Policy posted on tool
- [ ] Data Processing Agreement signed (if external services used)
- [ ] Users informed about data usage (via Moodle)
- [ ] Audit trail logs stored (90 days minimum)
- [ ] Encryption enabled (HTTPS, at-rest encryption)
- [ ] Access controls in place (authentication, authorization)
- [ ] Backup & disaster recovery plan documented
- [ ] Data breach response plan documented
- [ ] Staff trained on data protection (if applicable)

## Privacy Policy Template

```
Privacy Notice: MindMap Collaboration Tool for Moodle

This tool processes the following personal data from Moodle:
- Your name and email (from Moodle authentication)
- Your course/class information
- Your MindMap and Whiteboard projects

Your data is stored on [All-Inkl.com / RUB servers] with encryption.
You have rights to access, correct, delete, or export your data.

For questions: [your-support-email@rub.de]
```

## Updates

This document is updated as:
- Regulations change (GDPR updates, court rulings)
- New services are added (need compliance review)
- Annual RUB audit (review with RUB data protection officer)

Last Updated: 2025-02-12
Next Review: 2025-12-12

---

**For detailed data protection questions, contact RUB Datenschutzbeauftragte (Data Protection Officer).**
