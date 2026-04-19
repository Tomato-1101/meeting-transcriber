#!/bin/bash
# Start both backend and frontend dev servers
# Usage: ./scripts/dev.sh

DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting backend..."
cd "$DIR/backend"
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Starting frontend..."
cd "$DIR/frontend"
npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop"
echo ""

wait
