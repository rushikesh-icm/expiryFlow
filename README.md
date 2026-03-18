# ExpiryFlow

A fullstack data management platform for downloading and managing historical Futures & Options data from Dhan. Built for systematic backtesting with proper metadata storage.

## Stack

- **Backend**: FastAPI, SQLite, httpx
- **Frontend**: React, Vite, TypeScript, ShadCN UI, Zustand
- **Data** (Phase 2): DuckDB for historical F&O data

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
fastapi dev main.py
```

Runs on http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173

## Usage

1. Open http://localhost:5173
2. Enter your Dhan Client ID, API Key, and API Secret
3. Login with your PIN and TOTP code
4. Access the dashboard with live token expiry countdown

## Project Structure

```
backend/
  main.py              # FastAPI app entrypoint
  database.py          # SQLite setup
  models.py            # ORM models
  schemas.py           # Pydantic models
  dependencies.py      # Rate limiter, auth deps
  routers/             # API route handlers
  services/            # Dhan API & session logic

frontend/
  src/
    api/               # Backend API client
    store/             # Zustand state management
    hooks/             # Custom React hooks
    pages/             # Setup, Login, Dashboard
    components/        # Shared components
    layouts/           # Auth & Dashboard layouts
```

## License

MIT
