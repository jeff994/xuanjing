# BookShelf — Load-Balanced React + Fastify Book Portal

A stateless, horizontally scalable book portal built with **React + Vite + TypeScript + Tailwind CSS** on the frontend and **Fastify + TypeScript** on the backend.

## Features
- **User Authentication:** Register, sign in, stateless JWT authentication (`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`), and stateless OAuth 2.0 social login (**Google/Gmail**, **WeChat**, **Facebook**)
- **Book Uploads & Downloads:** Upload books (`.pdf`, `.epub`, `.txt`, `.md`, `.mobi`) with optional cover images, search/browse catalog, download files, and delete own uploads
- **Comments:** View, post, and delete comments on any book
- **Multi-Language (i18n):** Instant language switcher in the navbar supporting **English**, **简体中文**, **Español**, **日本語**, and **Français** with automatic browser detection and `localStorage` persistence
- **Load-Balancer Ready:**
  - Stateless JWT auth & signed JWT OAuth `state` tokens (no sticky sessions required)
  - Pluggable storage (`local` for single-node dev, `s3` for AWS S3 / Cloudflare R2 / MinIO in multi-replica prod)
  - Dual DB support via Knex (SQLite for zero-config local dev, PostgreSQL for production)
  - Health check endpoint (`GET /api/health`) and `X-API-Instance` response header
  - Graceful `SIGTERM`/`SIGINT` shutdown

## Social Login Setup (Google / WeChat / Facebook)
Copy `backend/.env.example` to `backend/.env` and fill in the provider credentials you want to enable:
- **Google (Gmail):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Callback: `http://localhost:4000/api/auth/oauth/google/callback`
- **WeChat (Open Platform Web QR):** `WECHAT_APP_ID`, `WECHAT_APP_SECRET` — Callback: `http://localhost:4000/api/auth/oauth/wechat/callback`
- **Facebook:** `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` — Callback: `http://localhost:4000/api/auth/oauth/facebook/callback`

*(In load-balanced Docker Compose mode, set `API_PUBLIC_URL=http://localhost:8080` and `FRONTEND_URL=http://localhost:8080`.)*

## Quick Start (Local Development — No Docker Needed)
```bash
npm run install:all
npm run dev
```
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000 (health check: http://localhost:4000/api/health)

## Running Tests
```bash
npm test                # Run both backend and frontend test suites
npm run test:backend    # Fastify REST API + OAuth security tests (node:test)
npm run test:frontend   # React i18n, Navbar, and OAuth callback tests (Vitest)
```

## Load-Balanced Production Stack (Docker Compose)
Runs **Nginx** (`least_conn` load balancer) → **2× Fastify API replicas (`api-1`, `api-2`)** + **React SPA** + **PostgreSQL** + **MinIO (S3)**:
```bash
docker compose up --build
```
- Portal: http://localhost:8080
- Verify load balancing by curling `http://localhost:8080/api/health` repeatedly and checking the `instanceId` field / `X-API-Instance` header.
