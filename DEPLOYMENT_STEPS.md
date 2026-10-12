# VoiceOps Docker deployment starter

This is a starter scaffold based on the supplied project details: Django URLs live under `/api/`, React uses Vite, the existing PostgreSQL and RabbitMQ run on the VM, and recordings/transcripts are under `/upload`.

## Before committing anything

1. Inspect the project's existing root `.gitignore`. Ensure `.env`, `backend/.env`, `frontend/.env`, virtual environments, `frontend/node_modules/`, and `frontend/dist/` are ignored.
2. Confirm `frontend/package-lock.json` exists; the frontend Dockerfile uses `npm ci`.
3. Add `gunicorn>=23,<24` to `backend/requirements.txt`.
4. In `backend/config/settings.py`, keep the existing `BASE_DIR` and change static settings to:

   ```python
   STATIC_URL = "/static/"
   STATIC_ROOT = BASE_DIR / "staticfiles"
   ```

   Do not duplicate `STATIC_ROOT` if you already have it. Confirm `BASE_DIR` is defined and `Path` is imported.
5. Confirm the setting used for Django's secret key matches `DJANGO_SECRET_KEY` in `.env.production.example`. If the code expects a different environment variable name, use that name in the production environment file instead.
6. Confirm `DB_USER` is the environment variable name used in `DATABASES` in `backend/config/settings.py`.
7. Confirm `VOICEOPS_MEDIA_ROOT`/filesystem mode behaves as expected (the supplied view maps `/upload/...` paths to the media root). The Compose file mounts `/upload` read-only and adds supplementary GID `1001`, matching the current `stockuser` group.
8. Review all extra environment variables your settings/app require. Keep real secrets out of Git.

## Local image build checks (from project root, PowerShell)

```powershell
docker build -t voiceops-backend:test -f backend/Dockerfile backend
docker build -t voiceops-frontend:test --build-arg VITE_API_BASE_URL=/api -f frontend/Dockerfile frontend
```

These checks build images but do not start Django or connect to your database.

## Publish images

1. Create a **private** GitHub repository and push the project to branch `main` after reviewing `.gitignore` and the staged file list.
2. Add `.github/workflows/publish-images.yml` from this scaffold.
3. GitHub Actions publishes `latest` and commit-SHA tags to GHCR. Verify both packages are private and the workflow completed successfully.

## Initial VM deployment (after images have been published)

Use a separate directory such as `/opt/voiceops-deploy`; do not overwrite `/opt/pms`, its existing service configuration, the database, RabbitMQ, or `/upload`.

Copy `compose.production.yaml` to `/opt/voiceops-deploy/compose.production.yaml`; create `/opt/voiceops-deploy/.env` from `.env.images.example` and `/opt/voiceops-deploy/.env.production` from `.env.production.example`. Fill the image owner, existing DB credentials, actual domain, and secret-key variable name. Keep `.env.production` mode `600`.

Log in to private GHCR images on the VM with a GitHub classic PAT that has `read:packages` (and any repository scope required by your GitHub account/package permissions). Supply the token through `docker login ghcr.io --password-stdin`; do not place it in the shell command or a file committed to Git.

First validate the compose file:

```bash
cd /opt/voiceops-deploy
chmod 600 .env.production
 docker compose -f compose.production.yaml config -q
```

Then pull the images and bring up only the backend for diagnostics:

```bash
docker compose -f compose.production.yaml pull
docker compose -f compose.production.yaml up -d backend
docker compose -f compose.production.yaml ps
docker compose -f compose.production.yaml logs --tail=100 backend
```

Before running migrations, verify that `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_HOST` reach the *existing* database. The Compose configuration points the app to `host.docker.internal:5432`; confirm PostgreSQL `pg_hba.conf` permits the Docker bridge address. Do not change or recreate the PostgreSQL data directory.

Once backend health and database access are confirmed, run the planned migration and start the frontend:

```bash
docker compose -f compose.production.yaml exec backend python manage.py migrate
docker compose -f compose.production.yaml up -d frontend
curl -I http://127.0.0.1:8080/
curl -i http://127.0.0.1:8080/api/health/
```

If the backend container is not healthy, inspect logs first. Do not run migrations against an unverified database.

The frontend is bound to `127.0.0.1:8080` deliberately. It is not yet publicly exposed. Configure host Nginx and HTTPS only after you provide the domain and confirm public DNS points to this VM. Before production launch, review the VM firewall: PostgreSQL (5432) and RabbitMQ (5672, 15672) are currently allowed from anywhere according to the supplied `ufw status`; identify current clients before restricting any rules.
