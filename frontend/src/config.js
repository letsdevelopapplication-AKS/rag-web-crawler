// In dev, VITE_API_URL is not set → falls back to '' and Vite proxy handles /api/*
// In production, set VITE_API_URL to your Render backend URL (no trailing slash)
export const API_BASE = import.meta.env.VITE_API_URL || ''
