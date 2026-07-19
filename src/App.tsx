import type { ReactElement } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AppDashboard from './pages/AppDashboard'
import ContentListPage from './pages/ContentListPage'
import ContentDetailPage from './pages/ContentDetailPage'
import ContentEditPage from './pages/ContentEditPage'
import TrajectoryPage from './pages/TrajectoryPage'
import FootprintMapPage from './pages/FootprintMapPage'
import FlightsPage from './pages/FlightsPage'
import SpaceGatePage from './pages/SpaceGatePage'
import SpaceTimelinePage from './pages/SpaceTimelinePage'
import SpacePostPage from './pages/SpacePostPage'
import ContentCreatePage from './pages/ContentCreatePage'
import SearchPage from './pages/SearchPage'
import AccountPage from './pages/AccountPage'
import AdminPage from './pages/AdminPage'
import AboutPage from './pages/AboutPage'
import { useIsLoggedIn, useIsAdmin } from './auth'

function RequireAuth({ children }: { children: ReactElement }) {
  return useIsLoggedIn() ? children : <Navigate to="/login" replace />
}

function RequireAdmin({ children }: { children: ReactElement }) {
  const loggedIn = useIsLoggedIn()
  const admin = useIsAdmin()
  if (!loggedIn) return <Navigate to="/login" replace />
  return admin ? children : <Navigate to="/app" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public home — both / and /euan show euan's public page */}
        <Route path="/" element={<HomePage />} />
        <Route path="/euan" element={<HomePage />} />

        {/* Auth pages */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Private workspace */}
        <Route path="/app" element={<RequireAuth><AppDashboard /></RequireAuth>} />

        {/* Create mode (Ch 7.2) */}
        <Route path="/new/:type" element={<RequireAuth><ContentCreatePage /></RequireAuth>} />

        {/* Search, about, account, admin */}
        <Route path="/search" element={<SearchPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />

        {/* Content list pages */}
        <Route path="/:username/diary" element={<ContentListPage section="diary" />} />
        <Route path="/:username/pkm" element={<ContentListPage section="pkm" />} />
        <Route path="/:username/thoughts" element={<ContentListPage section="thoughts" />} />

        {/* Content detail (read-only) */}
        <Route path="/:username/diary/:slug" element={<ContentDetailPage section="diary" />} />
        <Route path="/:username/pkm/:slug" element={<ContentDetailPage section="pkm" />} />
        <Route path="/:username/thoughts/:slug" element={<ContentDetailPage section="thoughts" />} />

        {/* Content edit (owner only) */}
        <Route path="/:username/diary/:slug/edit" element={<ContentEditPage section="diary" />} />
        <Route path="/:username/pkm/:slug/edit" element={<ContentEditPage section="pkm" />} />
        <Route path="/:username/thoughts/:slug/edit" element={<ContentEditPage section="thoughts" />} />

        {/* Life trajectory, footprint map, flight log */}
        <Route path="/:username/trajectory" element={<TrajectoryPage />} />
        <Route path="/:username/map" element={<FootprintMapPage />} />
        <Route path="/:username/flights" element={<FlightsPage />} />

        {/* Encrypted interactive spaces */}
        <Route path="/:username/space" element={<SpaceGatePage />} />
        <Route path="/:username/space/:spaceKey" element={<SpaceTimelinePage />} />
        <Route path="/:username/space/:spaceKey/:postId" element={<SpacePostPage />} />

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
