# Campus Food Management System

A DBMS course project: a relational database for the campus food points
(Scoops, Nescafé, Milma, Mess Canteen, Millets) with a role-based web application on top.

- **Database:** 12-table normalised schema with CHECK / UNIQUE / FK constraints, report
  indexes and 4 SQL views. The original MySQL design is in
  [`campus_food_management.sql`](campus_food_management.sql) and
  [`campus_food_management_erd.md`](campus_food_management_erd.md).
- **Backend:** Django 5 + Django REST Framework, JWT auth, SQLite for development.
- **Frontend:** React 19 + Vite + Tailwind CSS v4.

## Quick start

```bash
# 1. Backend  (http://127.0.0.1:8000)
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_data      # demo data, ~6 s, reproducible
.venv/bin/python manage.py runserver

# 2. Frontend (http://127.0.0.1:5173)  — in a second terminal
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173 and use the **Quick role switcher** on the login page.

| Role | Username | Password | What to show |
|---|---|---|---|
| Student | `arun_v` (CS22B001) | `student123` | Menus, purchase history, mess attendance |
| Staff · Scoops | `anitha_s` | `staff123` | Counter POS, stock deduction, inventory |
| Staff · Mess | `suresh_m` | `staff123` | Meal sessions and attendance ledger |
| Admin | `admin` | `admin123` | Revenue reports, low stock, menu CRUD, users |

To reset the demo data: `rm backend/db.sqlite3 && .venv/bin/python manage.py migrate && .venv/bin/python manage.py seed_data`.

## Tests

```bash
cd backend && .venv/bin/python manage.py test
```

15 API tests cover the sale transaction (price snapshot, stock deduction, rollback on
shortage, cross-outlet items, role checks), stock movements, registration, database
CHECK constraints and the report views.

## Where the DBMS concepts live

| Concept | Location |
|---|---|
| Tables, keys, CHECK constraints, indexes | `backend/*/models.py`, `backend/*/migrations/` |
| SQL views (reports) | `backend/core/migrations/0003_report_views.py` |
| Transaction + row locking (`SELECT … FOR UPDATE`) | `SaleCreateView` in `backend/api/views.py` |
| Parameterised raw SQL against views | `_query_view` and the `Report*View` classes in `backend/api/views.py` |
| `ON DELETE RESTRICT` (PROTECT) for history tables | `backend/sales/models.py`, `inventory/models.py`, `mess/models.py` |
| Seed data | `backend/core/management/commands/seed_data.py` |

## API overview

All endpoints are under `/api/` and require a JWT (`Authorization: Bearer <token>`)
except login and register.

| Method | Path | Who |
|---|---|---|
| POST | `auth/login/`, `auth/refresh/`, `auth/register/` | public (register → student only) |
| GET/PATCH | `auth/profile/` | any user |
| GET | `food-points/`, `ingredients/`, `menu/`, `menu/<id>/` | any user |
| GET/POST/PATCH/DELETE | `menu/manage/…` | staff, admin |
| GET | `inventory/` · POST `inventory/movement/` | staff, admin |
| GET | `sales/` (students see only their own) | any user |
| POST | `sales/create/` | staff (assigned outlet), admin |
| GET/POST | `mess/sessions/…`, `mess/records/create/`, `mess/my-history/` | staff / student |
| GET | `reports/sales-by-food-point/`, `reports/daily-revenue/` | admin |
| GET | `reports/low-stock/` | staff, admin |
| GET | `reports/student/<roll_no>/` | admin, staff, that student |
