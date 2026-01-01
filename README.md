# BusinessIntelligenceApp (QlikSense-like BI Prototype)

This repo is a starter prototype for a QlikSense-like Business Intelligence app:

- **Dashboard Designer**: drag/resize widgets on a grid canvas, edit properties from a right panel.
- **SQL Connections + Query Runner**: save/test DB connections, run SELECT queries, view tabular results.
- **Dynamic Chart Query**: backend builds a `GROUP BY + aggregation` SQL from a chart config.

## Project structure

- `backend/BusinessIntelligence.Api`: .NET 8 Minimal API
- `frontend`: Vite + React + TypeScript

## Run (local dev)

### Backend

```bash
cd backend/BusinessIntelligence.Api
dotnet run --launch-profile http
```

Backend dev URL (default): `http://localhost:5208`

### AI (Groq)

The app proxies AI requests through the backend endpoint:

- `POST /api/ai/chat`

Set your Groq API key as an environment variable **(do not hardcode / do not commit)**:

```powershell
$env:GROQ_API_KEY="YOUR_KEY_HERE"
```

Optional:

- `Groq:Model` (default is `openai/gpt-oss-120b`)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend proxies API calls via Vite:

- `frontend/vite.config.ts` proxies `/api/*` → `http://localhost:5208`

## Features (current)

### Dashboard Designer

- Route: `/designer`
- Add a **Bar Chart** widget (button or drag from palette)
- Select a widget → configure:
  - Connection
  - Table
  - Dimension (X)
  - Measure (Y)
  - Aggregation (SUM/COUNT/AVG/MIN/MAX)
- Click **Preview data** to fetch chart data from backend.

### SQL Connections + Query Runner

- Route: `/sql`
- Create & test a connection (PostgreSQL / SQL Server)
- Run a query via backend endpoint:
  - **SELECT-only** is allowed (guarded on server)

### AI Insights

- Route: `/ai`
- Type `@` to mention tables (suggested from selected connection) — mentions render **green** in chat.
- Ctrl+Enter to send.

## Notes / Security

This is a prototype:

- Connections/dashboards are stored in a SQL Server config database (`BusinessIntelligenceAppConfig`).
- Connection strings may contain secrets; do not use this approach for production.
- Query endpoints currently restrict to **SELECT / WITH** and block common write keywords, but this is not a full SQL sandbox.

## Config DB (migrations)

Backend now uses a **SQL Server "config DB"** to store connections/dashboards:

- Default config DB: `BusinessIntelligenceAppConfig` (set via `ConnectionStrings:ConfigDb` in `backend/BusinessIntelligence.Api/appsettings.json`)
- Migrations live in: `backend/BusinessIntelligence.Api/Data/Migrations`

Example "source DB" connection you can add from the UI (SQL page):

```text
Data Source=ARB;Initial Catalog=AdventureWorks2019;Integrated Security=True;Connect Timeout=30;Encrypt=True;Trust Server Certificate=True;Application Intent=ReadWrite;Multi Subnet Failover=False
```


