# Deployment Guide

## Overview

This guide covers deploying the MindMap Collaboration Tool across different environments.

## Phase 1: MVP Deployment (Weeks 1-8)

### Architecture

```
GitHub Repository (Code)
    ↓
Vercel (Frontend - Auto-deploy)
Render (Backend - Auto-deploy + Keep-Alive)
All-Inkl MySQL (Database)
```

### Step 1: Set Up All-Inkl MySQL

1. Log in to All-Inkl.com Control Panel
2. Create a new MySQL Database
3. Save credentials:
   - **Host**: mysql.your-domain.com
   - **User**: your_mysql_user
   - **Password**: your_mysql_password
   - **Database**: your_database_name

### Step 2: Deploy Backend to Render

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit: MindMap LTI Tool"
   git push origin main
   ```

2. **Create Render Service**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect GitHub repository
   - Select repository: `moodboard`
   - Build command: `cd backend && npm install`
   - Start command: `cd backend && npm start`

3. **Set Environment Variables in Render**
   - Go to Render Dashboard → Service → Environment
   - Add all variables from `backend/.env.example`:
     ```
     MOODLE_CLIENT_ID=get_from_moodle
     MOODLE_CLIENT_SECRET=get_from_moodle
     DB_HOST=mysql.your-domain.com
     DB_USER=your_mysql_user
     DB_PASSWORD=your_mysql_password
     DB_NAME=your_database_name
     FRONTEND_URL=https://moodboard.vercel.app
     ...
     ```

4. **Deploy**
   - Render auto-deploys after config
   - Note your Render URL: `https://your-app.render.com`

### Step 3: Deploy Frontend to Vercel

1. **Create Vercel Project**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New..." → "Project"
   - Import GitHub repository: `moodboard`
   - Root Directory: `frontend`

2. **Set Environment Variables in Vercel**
   - Go to Project Settings → Environment Variables
   - Add:
     ```
     VITE_API_URL=https://your-app.render.com
     VITE_WS_URL=wss://your-app.render.com
     ```

3. **Deploy**
   - Vercel auto-deploys after config
   - Note your Vercel URL: `https://mindmap-frontend.vercel.app`

### Step 4: GitHub Actions Keep-Alive Cronjob

1. **Create Secret in GitHub**
   - Go to Repository Settings → Secrets and Variables → Actions
   - Create New Secret: `RENDER_APP_URL`
   - Value: `your-app.render.com` (without https://)

2. **Workflow runs automatically**
   - `.github/workflows/keep-render-alive.yml` pings `/health` every 10 minutes
   - Render never sleeps ✅

## Phase 2: Beta Testing (Weeks 9-12)

No changes needed! Your deployment from Phase 1 is already live and ready for testing.

### Monitor & Adjust

1. **Check Render Logs**
   ```
   Render Dashboard → Service → Logs
   ```

2. **Check Database**
   - All-Inkl Control Panel → MySQL → View Database
   - Verify tables are created

3. **Test LTI Launch**
   - Add tool to Moodle course (see LTI-SETUP.md)
   - Click link → app should open without extra login

## Phase 3: Production & Migration to RUB

### Option A: Continue with Render + All-Inkl (Simplest)

No additional setup needed. This is fine for production if RUB approves.

### Option B: Migrate to RUB Servers (Recommended for Long-term)

This allows RUB to fully control the infrastructure.

#### Step 1: Prepare RUB Server

Contact RUB IT (ZIM) and request:
- Linux Server (CentOS/Ubuntu) or VServer
- Docker & Docker Compose installed
- PostgreSQL database (or continue with MySQL)
- Reverse Proxy / SSL Certificate
- Dedicated domain: `mindmap.rub.de` (or similar)

#### Step 2: Migrate All-Inkl MySQL to RUB

```bash
# On local machine: Export from All-Inkl
mysqldump -h mysql.your-domain.com -u your_mysql_user -p your_database_name > backup.sql

# On RUB server: Import to PostgreSQL
# (Convert SQL syntax if needed, or use MySQL on RUB too)
psql -U postgres -d mindmap_db < backup.sql
```

#### Step 3: Deploy on RUB Server

```bash
# SSH into RUB server
ssh user@rub-server.de

# Clone repository
git clone https://github.com/yourusername/moodboard.git
cd moodboard

# Create .env file
cp backend/.env.example backend/.env
# Edit with RUB credentials:
# - DB_HOST=localhost (PostgreSQL on same server)
# - DB_USER & PASSWORD (RUB DB credentials)
# - FRONTEND_URL=https://mindmap.rub.de
# - MOODLE_LAUNCH_URL=https://moodle.rub.de/

# Start services
docker-compose up -d

# Verify
docker-compose ps
curl https://mindmap.rub.de/health
```

#### Step 4: Configure Nginx Reverse Proxy (on RUB)

```nginx
# /etc/nginx/sites-available/mindmap

upstream backend {
    server localhost:3001;
}

upstream frontend {
    server localhost:5173;
}

server {
    listen 443 ssl http2;
    server_name mindmap.rub.de;

    ssl_certificate /etc/ssl/certs/mindmap.crt;
    ssl_certificate_key /etc/ssl/private/mindmap.key;

    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    location /.well-known {
        proxy_pass http://backend;
    }

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
    }
}
```

#### Step 5: Enable HTTPS & Finalize

```bash
# Install Certbot if not present
sudo apt install certbot python3-certbot-nginx

# Get SSL Certificate
sudo certbot certonly --nginx -d mindmap.rub.de

# Update nginx config with cert paths
sudo systemctl reload nginx

# Test
curl -I https://mindmap.rub.de/health
```

#### Step 6: Update Moodle LTI Configuration

Update the LTI tool in Moodle to point to new RUB domain:
- **Tool URL**: `https://mindmap.rub.de/lti/launch`
- **Client ID & Secret**: Can stay the same if not changed

### Disable Render & GitHub Actions (After RUB Migration)

Once fully migrated, you can:
1. Pause GitHub Actions Keep-Alive (no longer needed on RUB)
2. Delete Render service (stops incurring costs, though free tier had $0 cost anyway)
3. GitHub repo remains for updates & community

## Monitoring & Maintenance

### Health Checks

```bash
# Test backend is alive
curl https://your-app.render.com/health

# After RUB migration
curl https://mindmap.rub.de/health
```

### Logs

**Render:**
```
Dashboard → Service → Logs tab
```

**RUB (Docker):**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql
```

### Database Backups

**All-Inkl:**
- Automatic daily backups included

**RUB:**
```bash
# Manual backup
mysqldump -u root -p mindmap_db > backup_$(date +%Y%m%d).sql

# Scheduled (cron)
0 2 * * * mysqldump -u root -pPASSWORD mindmap_db > /backups/mindmap_$(date +\%Y\%m\%d).sql
```

### Updates & Security

```bash
# Pull latest code
git pull origin main

# Rebuild containers
docker-compose down
docker-compose up -d --build

# Or on Render/Vercel (automatic on git push)
git push origin main
```

## Troubleshooting Deployment

| Issue | Solution |
|-------|----------|
| **Render keeps sleeping** | Check GitHub Actions secrets, verify cronjob is enabled |
| **Vercel build fails** | Check build logs in Vercel dashboard, ensure `frontend/` has valid build |
| **MySQL connection timeout** | Verify All-Inkl IP whitelist, check firewall rules |
| **WebSocket connection fails** | Verify CORS headers, check Render environment variables |
| **HTTPS certificate error** | Run `certbot renewal`, check Nginx config |

## Support

For deployment issues:
1. Check [Troubleshooting](../README.md#-troubleshooting)
2. Review Render/Vercel logs
3. Open GitHub issue with error details
