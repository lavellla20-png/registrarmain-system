# Local Registrar System MVP

Monorepo foundation for City College of Bayawan Local Registrar System.

## Services
- `backend`: Django + DRF API
- `frontend`: React + TypeScript app
- `db`: MySQL 8
- `redis`: Celery broker/cache
- `nginx`: Reverse proxy

## Quick Start
1. Copy `.env.example` to `.env` and fill values.
2. Start infra: `docker compose up -d db redis`
3. Backend setup:
   - `cd backend`
   - `python -m venv .venv`
   - `.venv\\Scripts\\activate`
   - `pip install -r requirements.txt`
   - `python manage.py makemigrations`
   - `python manage.py migrate`
   - `python manage.py createsuperuser`
   - `python manage.py runserver 8001`
4. Frontend setup:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

## Connected Local Flow
1. Create root `.env` from `.env.example` and keep MySQL/XAMPP values correct.
2. Ensure `frontend/.env` contains:
   - `VITE_API_BASE_URL=http://localhost:8001/api`
3. Start backend on `8001`.
4. Start frontend on `5173`.
5. Log in with your Django superuser account in the sidebar login form.

## Validation Commands
- Backend syntax check:
  - `cd backend`
  - `python -m py_compile $(Get-ChildItem -Recurse -Filter *.py | Select-Object -ExpandProperty FullName)`
- Frontend TypeScript check:
  - `cd frontend`
  - `npm run typecheck`

## XAMPP MySQL (No Password)
- Use these `.env` values for default XAMPP:
  - `MYSQL_USER=root`
  - `MYSQL_PASSWORD=`
- Ensure MySQL is running in XAMPP Control Panel before running migrations.

## MVP Status
This initial scaffold includes:
- Core data models
- Auth-ready DRF setup
- CRUD viewsets for master data and prospectus
- Student search by student ID
- Student load create/update endpoint
- Continuing promotion endpoint (auto-load task stub)
