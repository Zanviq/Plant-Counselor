# Plant Counselor — frontend

Next.js 16 (App Router) client for Plant Counselor.

Run the whole stack with Docker from the repository root (see [../README.md](../README.md)):

```bash
cp .env.example .env
docker compose up --build
```

Frontend only (expects the API at `NEXT_PUBLIC_API_BASE`, default `http://localhost:8000/api/v1`):

```bash
npm install
npm run dev
```
