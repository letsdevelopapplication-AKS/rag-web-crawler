import { Navigate, Route, Routes } from 'react-router-dom'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Embed from './Embed'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/embed" element={<Embed />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
