# BookShelf — Load-Balanced React + Fastify Book Portal

A stateless, horizontally scalable book portal built with **React + Vite + TypeScript + Tailwind CSS** on the frontend and **Fastify + TypeScript** on the backend.

## Features
- **User Authentication:** Register, sign in, and stateless JWT authentication (`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`)
- **Book Uploads & Downloads:** Upload books (`.pdf`, `.epub`, `.txt`, `.md`, `.mobi`) with optional cover images, search/browse catalog, download files, and delete own uploads
- **Comments:** View, post, and delete comments on any book
- **Load-Balancer Ready:**
  - Stateless JWT auth (no sticky sessions required)
  - Pluggable storage (`local` for single-node dev, `s3` for AWS S3 / Cloudflare R2 / MinIO in multi-replica prod)
  - Dual DB support via Knex (SQLite for zero-config local dev, PostgreSQL for production)
  - Health check endpoint (`GET /api/health`) and `X-API-Instance` response header
  - Graceful `SIGTERM`/`SIGINT` shutdown

## Quick Start (Local Development — No Docker Needed)
```bash
npm run install:all
npm run dev
```
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000 (health check: http://localhost:4000/api/health)

## Load-Balanced Production Stack (Docker Compose)
Runs **Nginx** (`least_conn` load balancer) → **2× Fastify API replicas (`api-1`, `api-2`)** + **React SPA** + **PostgreSQL** + **MinIO (S3)**:
```bash
docker compose up --build
```
- Portal: http://localhost:8080
- Verify load balancing by curling `http://localhost:8080/api/health` repeatedly and checking the `instanceId` field / `X-API-Instance` header.
