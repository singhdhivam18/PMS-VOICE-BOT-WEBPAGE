# Project status — initial scaffold

## Implemented in source

- [x] React/Vite dashboard, responsive navigation, login form and resource pages
- [x] JWT token obtain/refresh flow in React API client
- [x] Interactive `create_voiceops_admin` command; no hardcoded default credentials and refuses a second active superuser
- [x] Removed the separate Django Admin web route so the React login is the only web login screen
- [x] Management API restricted to staff accounts
- [x] Production React API base URL defaults to same-origin `/api` in production builds
- [x] Django REST Framework settings, router, health endpoint and dashboard summary endpoint
- [x] Unmanaged Django model mappings for eight supplied PostgreSQL tables
- [x] Search and paginated list endpoints
- [x] Create/update APIs for language, driver, vehicle, vehicle service and appointment
- [x] Read-only APIs for call jobs, job events and document metadata
- [x] API-level deletion disabled for editable resources
- [x] `.env.example`, `.gitignore` and setup/deployment README

## Not yet verified in this environment

- [ ] Python dependency installation and `manage.py check` (Django package is not installed in the execution environment)
- [ ] npm dependency installation and `vite build` (npm install timed out in the execution environment)
- [ ] Connection to the user's PostgreSQL server (credentials/server access have not been provided)
- [ ] Browser-based CRUD tests and deployment on Bluehost

## Next action on the user's computer

Follow `README.md`, configure the backend `.env`, run Django's built-in migrations, create the initial administrator with `create_voiceops_admin`, set the frontend API URL, and start Vite. Start against a non-production copy of the database if possible, verify list APIs first, then test writes table by table.


## Call artifacts (latest change)
- Documents list presents a filename rather than the raw server path.
- Recording rows include a Listen action; transcript rows include a View action.
- Django exposes an authenticated `/api/documents/{id}/content/` action and validates `/upload/` paths. It supports SFTP for Windows development, direct filesystem reads for production on the VM, and optional HTTP mode when a real HTTP file server exists.
- Configure `VOICEOPS_DOCUMENT_STORAGE_BACKEND=sftp` for local Windows development or `filesystem` for production on the VM. The SFTP host key, user permissions, port and remote root must be verified in the deployment environment.
