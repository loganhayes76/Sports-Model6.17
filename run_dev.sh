#!/usr/bin/env bash
# VLS 3000 — dev launcher
# Kills stale API and frontend processes, then starts both fresh.

echo "[VLS] Cleaning up stale processes on ports 8000 and 5000..."
pkill -f "uvicorn api:app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

echo "[VLS] Starting FastAPI backend (port 8000)..."
python start.py &
BACKEND_PID=$!

echo "[VLS] Starting React/Vite frontend (port 5000)..."
npm --prefix frontend run dev

# If Vite exits, also kill the backend
kill $BACKEND_PID 2>/dev/null || true
