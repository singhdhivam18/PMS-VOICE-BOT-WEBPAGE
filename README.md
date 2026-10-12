# VoiceOps Management Dashboard — Starter

A React + Django REST Framework application scaffold for the existing PostgreSQL schema supplied in `schema_voice_bot.txt`.

## Included

- React + Vite admin dashboard with responsive navigation and reusable resource tables/forms.
- Django REST Framework APIs using the existing eight tables: `language`, `driver`, `vehicle`, `vehicle_service`, `voice_bot_call_job`, `voice_bot_call_job_event`, `appointment_record`, and `voice_call_job_document`.
- JWT login and refresh endpoints; no public sign-up route, one-time initial-admin setup command, and staff-only API permissions.
- Server-side search, pagination, related-record selectors and input validation.
- Existing database mappings use `managed = False`; Django migrations will not create/alter those business tables.
- Call jobs, job events, and document metadata are read-only in this starter to protect the operational voice-calling workflow and audit history. Languages, drivers, vehicles, vehicle services and appointments have create/edit endpoints.

## Important schema notes

1. This starter is mapped to the SQL DDL file provided for the project. Before connecting to production, verify the deployed database's actual table/column definitions and constraints.
2. The DDL has `voice_bot_call_job.service_id INTEGER` pointing to `vehicle_service.id BIGINT`. This starter intentionally models `service_id` as an integer to mirror the supplied DDL. Confirm this is intentional before making schema changes.
3. Document paths are never returned by the public API response. The authenticated document-content endpoint validates the stored `/upload/` path and streams content through the configured filesystem, SFTP, or HTTP storage backend.
4. `do_not_call` is surfaced in the driver UI. Before linking this dashboard to call initiation, the calling service itself must enforce the flag; a dashboard-only check is not a safety control.
5. No business-table migrations are required. If your actual database is missing these tables, stop and review the DDL first rather than running an automatic migration against a production database.

## Prerequisites

- Python 3.11 or newer (Django 5.2 supported Python versions)
- Node.js 20 or newer and npm
- Access to PostgreSQL with the supplied tables already created

## Run locally

### 1. Configure Django

```bash
cd backend
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
python -m pip install -r requirements.txt
```

Linux/macOS:

```bash
source .venv/bin/activate
cp .env.example .env
python -m pip install -r requirements.txt
```

Edit `backend/.env` with the database name, username, password, host, port and a strong `DJANGO_SECRET_KEY`. Keep `.env` private and do not commit it.

The default database values are placeholders, not working credentials.

### 2. Set the single initial administrator account

The React login page has username and password fields, but **the credentials are not hardcoded in React, Django source, or a frontend environment file**. Create one administrator account interactively. Django saves the username in its authentication database and stores the password as a one-way password hash, not plaintext. There is no public sign-up endpoint and no separate Django Admin web login; the React sign-in is the only web login screen.

```bash
python manage.py migrate
python manage.py create_voiceops_admin
```

Enter the username and password when prompted; password input is hidden. The command refuses to create another active superuser if one already exists. If you already created the admin with `createsuperuser`, keep using that account. To change its password later, run `python manage.py changepassword <username>`. Do not share production passwords in source control or chat.

These migrations should create Django's own authentication tables only. The models for VoiceOps business tables are `managed = False`. Verify database permissions and the migration plan before running commands against a shared or production database. The APIs require a staff account, so normal non-staff accounts cannot access the management data.

### 3. Start the API

```bash
python manage.py runserver 127.0.0.1:8000
```

Useful endpoints:

- `GET http://127.0.0.1:8000/api/health/` — basic API/database health check
- `POST http://127.0.0.1:8000/api/auth/token/` — obtain access and refresh tokens using `{ "username": "...", "password": "..." }`
- `GET http://127.0.0.1:8000/api/dashboard/` — dashboard counts (JWT required)
- `GET http://127.0.0.1:8000/api/languages/` — list languages (JWT required)

### 4. Start React

In a separate terminal:

```bash
cd frontend
npm install
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
npm run dev
```

Linux/macOS:

```bash
cp .env.example .env
npm run dev
```

Visit `http://localhost:5173` and sign in with the Django user you created.

If the API host/port is different, change `VITE_API_BASE_URL` in `frontend/.env`. Its value includes `/api`, for example `http://127.0.0.1:8000/api`.

For a production build served from the same domain as Django, copy `frontend/.env.production.example` to `frontend/.env.production` and use `VITE_API_BASE_URL=/api`; configure Nginx to route `/api/` to Django. If the API is on a separate domain, set its full HTTPS URL instead and configure exact CORS origins in the backend environment. **Vite values are embedded at build time**, so set this before running `npm run build`. Avoid leaving the production frontend pointed at `127.0.0.1`, which would refer to each visitor's own computer.

## API routes

| Resource | Route | Starter access |
|---|---|---|
| Languages | `/api/languages/` | List/create/edit |
| Drivers | `/api/drivers/` | List/create/edit |
| Vehicles | `/api/vehicles/` | List/create/edit |
| Vehicle services | `/api/vehicle-services/` | List/create/edit |
| Call jobs | `/api/call-jobs/` | Read-only |
| Call-job events | `/api/call-job-events/` | Read-only |
| Appointments | `/api/appointments/` | List/create/edit |
| Documents | `/api/documents/` | Read-only metadata |

List routes support DRF pagination and `?search=...` where configured. The starter deliberately does not enable deletion from the React UI.

## Before production deployment

- Set `DJANGO_DEBUG=False`, a unique random `DJANGO_SECRET_KEY`, exact `DJANGO_ALLOWED_HOSTS`, and exact `CORS_ALLOWED_ORIGINS`.
- Serve React and Django over HTTPS; use Nginx and a managed process such as `systemd` for Django on a suitable VPS.
- Permit database traffic only from the application server or private network. Never ship PostgreSQL credentials into the React app.
- Configure database backups, log rotation, monitoring, access controls and secret rotation.
- Test with a non-production database copy before any write operation against real records.
- Confirm the actual `service_status` and `job_status` lifecycle with the voice-calling service before adding buttons that change them.
- Review pagination scale before loading all drivers/jobs into a dropdown for large datasets; server-side autocomplete may be preferable.

## Suggested next milestone

1. Connect this scaffold to a safe development copy of PostgreSQL.
2. Verify each list endpoint returns the expected columns and relationships.
3. Test create/edit for language, driver, vehicle, vehicle service and appointment records.
4. Add automated API tests and then deployment configuration for the Bluehost VM.


## Call recording and transcript viewer

The Documents page has **Listen** for recording rows and **View** for transcript rows. Django verifies the administrator's JWT, validates that `document_path` is under `/upload/`, and streams the content back. The upload directory is not exposed publicly.

The artifact files on the VM are regular files (for example `/upload/recording/example.mp3`), while SFTP is only the transfer protocol. Choose the backend based on where Django is running:

### Local development on Windows

Use SFTP so the local Django process can read the VM files without requiring an HTTP file server. In `backend/.env` set:

```env
VOICEOPS_DOCUMENT_STORAGE_BACKEND=sftp
VOICEOPS_SFTP_HOST=129.121.134.68
VOICEOPS_SFTP_PORT=22
VOICEOPS_SFTP_USERNAME=stockuser
VOICEOPS_SFTP_REMOTE_ROOT=/upload
```

Configure either `VOICEOPS_SFTP_PRIVATE_KEY_FILE` (recommended) or `VOICEOPS_SFTP_PASSWORD` locally. Ensure the VM's SSH host key is present in your Windows `~/.ssh/known_hosts` or configured through `VOICEOPS_SFTP_KNOWN_HOSTS`; the backend rejects unknown host keys rather than trusting them automatically. Use the exact SFTP port and visible remote root from your SFTP client. If that account is chrooted and `/upload` appears as the starting directory, set `VOICEOPS_SFTP_REMOTE_ROOT=/` instead.

### Production on the same VM as the files

Run Django on the VM where `/upload/recording` and `/upload/transcript` exist, then use:

```env
VOICEOPS_DOCUMENT_STORAGE_BACKEND=filesystem
VOICEOPS_MEDIA_ROOT=/upload
```

The Linux user running Django needs read permission on both directories and their files. Do not make the folders world-readable or expose them through a public web server just to make playback work. Confirm the Django service user can read the example file before restarting the service.

### HTTP mode

`VOICEOPS_DOCUMENT_STORAGE_BACKEND=http` and `VOICEOPS_MEDIA_BASE_URL` are only for a server that genuinely serves HTTP at those paths. SFTP alone does not create an HTTP URL, so this mode will not work unless a web server is deliberately configured.
