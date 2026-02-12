# LTI 1.3 Setup Guide for Moodle

## Overview

This guide explains how to register and configure the MindMap Collaboration Tool as a Learning Tools Interoperability (LTI) 1.3 tool in your Moodle instance.

## What is LTI 1.3?

**LTI = Learning Tools Interoperability**

It's a standard protocol that allows:
- ✅ External tools to link directly into Moodle
- ✅ Automatic user authentication (no separate login)
- ✅ Passing course/class context automatically
- ✅ Secure communication via OAuth2 & JWT

**LTI 1.3 is the current secure standard** (deprecated: LTI 1.0, 1.1)

## Prerequisites

- Moodle 4.0 or later
- Admin access to Moodle
- XiaoWei LTI Plugin installed (or similar)
- MindMap tool URL: `https://your-app.render.com` (or RUB domain)

## Step-by-Step Setup

### 1. Generate LTI Credentials

**On MindMap Backend:**

```bash
# The tool provides auto-generated endpoint
GET https://your-app.render.com/.well-known/openid-configuration
```

This returns:
```json
{
  "client_id": "auto_generated_id",
  "issuer": "https://your-app.render.com",
  "authorization_endpoint": "https://your-app.render.com/lti/auth",
  "token_endpoint": "https://your-app.render.com/lti/token",
  "jwks_uri": "https://your-app.render.com/.well-known/jwks.json"
}
```

### 2. Register Tool in Moodle

1. **Log in as Admin**
2. Go to: **Administration → Plugins → LTI Tools → Manage tools**
3. Click: **"Configure a tool manually"** or **"Register LTI Tool"**

4. **Fill in Details:**

| Field | Value |
|-------|-------|
| **Tool Name** | MindMap Collaboration |
| **Tool URL** | `https://your-app.render.com` |
| **Tool Description** | Real-time collaborati

ve MindMap and Whiteboard editor |
| **Client ID** | Leave blank (auto-generated) |
| **Client Secret** | Leave blank (auto-generated) |
| **OIDC Discovery URL** | `https://your-app.render.com/.well-known/openid-configuration` |
| **Access mode** | "Account owner and institution admins can configure tool" |
| **Require token signature** | Yes (checked) |

5. **Save**

   Moodle generates:
   - Client ID (looks like: `12345678901234567890`)
   - Client Secret (long random string)

### 3. Configure Backend with Moodle Credentials

Update your backend `.env`:

```env
MOODLE_CLIENT_ID=12345678901234567890
MOODLE_CLIENT_SECRET=your_generated_secret
MOODLE_OIDC_DISCOVERY_URL=https://moodle.rub.de/auth/oidc/.well-known/openid-configuration
MOODLE_LAUNCH_URL=https://moodle.rub.de
```

Redeploy backend:
```bash
git add .env
git commit -m "Add Moodle LTI credentials"
git push
# Render auto-deploys
```

### 4. Add Tool to a Course

1. **Go to your test course**
2. Click: **"Add an activity or resource"**
3. Select: **"External tool"** (or **"LTI Consumer"**)
4. **Configure:**
   - **Activity name**: "MindMap Project"
   - **Preconfigured tool**: Select "MindMap Collaboration"
   - **Activity description**: "Collaborate on a MindMap in real-time"
   - **Launch container**: "New window"
   - **Display tool as a block**: No

5. **Save and display**

### 5. Test the Launch

1. Click the **"MindMap Project"** link as a student
2. Expected behavior:
   - Tool opens in new window
   - **No login screen** (automatic authentication via LTI)
   - Your name appears at top
   - Blank dashboard (first time)

3. Create a new project → edit → verify real-time sync

✅ **Success!** You just launched an LTI tool!

## LTI Launch Flow Explained

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User in Moodle clicks "MindMap Project" link                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Moodle signs LTI Launch Request (JWT)                       │
│    - User ID: 12345                                             │
│    - Name: Max Mustermann                                       │
│    - Course: Physics 101                                        │
│    - Role: Student                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Browser POSTs to: /lti/launch                               │
│    Payload: JWT token (signed by Moodle)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Tool validates JWT signature                                │
│    - Fetches Moodle's public key from OIDC endpoint            │
│    - Verifies signature using public key                       │
│    - Extracts user data                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Tool creates session for user                               │
│    - Stores: user_id, name, course_id, role                   │
│    - Sets secure session cookie                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Tool redirects to frontend (logged in)                      │
│    User sees: Dashboard with their projects                    │
└─────────────────────────────────────────────────────────────────┘
```

## Troubleshooting LTI Launch

### 1. "Invalid launch request"

**Cause**: JWT signature validation failed

**Solution**:
- Verify `MOODLE_CLIENT_ID` and `MOODLE_CLIENT_SECRET` are correct
- Check backend logs: `docker-compose logs -f backend`
- Ensure OIDC Discovery URL is correct

### 2. "Tool not available"

**Cause**: Tool URL not responding

**Solution**:
- Check backend is running: `curl https://your-app.render.com/health`
- Check Render logs for errors
- Verify firewall allows HTTPS

### 3. "Incorrect user data"

**Cause**: JWT decoded but data missing

**Solution**:
- Check Moodle Admin → LTI Tool configuration
- Verify NRPS is enabled (for participant names)
- Check backend code: `src/lti/handler.js`

### 4. "Real-time sync not working after login"

**Cause**: User authenticated but WebSocket failing

**Solution**:
- Check browser console for WebSocket errors
- Verify WebSocket isn't blocked by proxy/firewall
- Check CORS settings in `backend/server.js`

## Advanced: NRPS (Names and Roles Provisioning Service)

To display student names in the tool:

### Enable in Moodle

1. Go to: **Admin → LTI Tools Configuration**
2. Under tool, enable: **"Allow access to Names and Roles Provisioning Service"**
3. Save

### Use in Backend

```javascript
// backend/src/lti/handler.js

async function getNamesAndRoles(token, courseId) {
  const response = await fetch(token.nrps_service_url, {
    headers: {
      'Authorization': `Bearer ${token.access_token}`
    }
  });
  
  const data = await response.json();
  return data.members;  // Array of {userId, name, email, role}
}
```

## Optional: Deep Linking

Deep Linking allows users to select tool content and insert it into their course.

**Not enabled by default** - requires additional implementation.

## Security Best Practices

1. ✅ **Always use HTTPS** (Vercel/Render enforce this)
2. ✅ **Validate JWTs strictly** before trusting user data
3. ✅ **Whitelist Moodle URLs** in CORS
4. ✅ **Keep Client Secret private** (never in frontend, use .env)
5. ✅ **Rotate credentials** periodically
6. ✅ **Monitor failed LTI launches** (security log)
7. ✅ **Use OIDC** (not legacy LTI 1.0)

## Testing

### Manual Test Checklist

- [ ] Tool launches without login screen
- [ ] User name displayed correctly
- [ ] Course context correct
- [ ] Can create new project
- [ ] WebSocket connects
- [ ] Real-time edits sync
- [ ] Logout destroys session
- [ ] Re-opening tool shows correct projects (not other students')

### Automated Testing

```bash
# backend/tests/lti.test.js

test('LTI launch validates JWT correctly', async () => {
  // Mock Moodle JWT
  const jwt = generateMockJWT({
    user_id: '12345',
    name: 'Test User',
    course_id: 'course_001'
  });
  
  const response = await request(app)
    .post('/lti/launch')
    .send({ id_token: jwt });
  
  expect(response.status).toBe(200);
  expect(response.body.session_id).toBeDefined();
});
```

## LTI Resource Links

- [LTI 1.3 Specification](https://www.imsglobal.org/spec/lti/v1p3/)
- [Moodle LTI Documentation](https://docs.moodle.org/en/Learning_Tools_Interoperability)
- [OIDC Configuration](https://openid.net/specs/openid-connect-core-1_0.html)

## Support

For LTI-specific questions:
1. Check Moodle LTI docs
2. Review backend logs
3. Open GitHub issue with JWT payload example (sanitized)
