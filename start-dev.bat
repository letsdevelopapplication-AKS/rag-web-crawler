@echo off
echo Starting RAG Web Crawler (Dev Mode)
echo =====================================

:: Backend
echo [1/2] Starting FastAPI backend on http://localhost:8000 ...
start "Backend" cmd /k "cd backend && uvicorn main:app --reload --port 8000"

:: Wait a moment then start frontend
timeout /t 2 /nobreak >nul

:: Frontend
echo [2/2] Starting React frontend on http://localhost:5173 ...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting. Open http://localhost:5173 in your browser.
