import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireOrg } from './features/einstellungen/RequireOrg'
import { AuthProvider } from './features/auth/AuthProvider'
import { RequireAuth } from './features/auth/RequireAuth'
import { CLOUD } from './lib/supabase'
const EinstellungenPage = lazy(() => import('./features/einstellungen/EinstellungenPage').then((m) => ({ default: m.EinstellungenPage })))
// Modul A – Einsatz, Flugbuch, Notfall
const StartPage = lazy(() => import('./features/einsatz/StartPage').then((m) => ({ default: m.StartPage })))
const EinsatzListePage = lazy(() => import('./features/einsatz/EinsatzListePage').then((m) => ({ default: m.EinsatzListePage })))
const EinsatzNeuPage = lazy(() => import('./features/einsatz/EinsatzNeuPage').then((m) => ({ default: m.EinsatzNeuPage })))
const EinsatzDetailPage = lazy(() => import('./features/einsatz/EinsatzDetailPage').then((m) => ({ default: m.EinsatzDetailPage })))
const FlugbuchPage = lazy(() => import('./features/flugbuch/FlugbuchPage').then((m) => ({ default: m.FlugbuchPage })))
const NotfallPage = lazy(() => import('./features/notfall/NotfallPage').then((m) => ({ default: m.NotfallPage })))
// Modul B – Piloten, Geräte, Wartung
const PilotenListePage = lazy(() => import('./features/piloten/PilotenListePage').then((m) => ({ default: m.PilotenListePage })))
const PilotDetailPage = lazy(() => import('./features/piloten/PilotDetailPage').then((m) => ({ default: m.PilotDetailPage })))
const GeraeteListePage = lazy(() => import('./features/geraete/GeraeteListePage').then((m) => ({ default: m.GeraeteListePage })))
const GeraetDetailPage = lazy(() => import('./features/geraete/GeraetDetailPage').then((m) => ({ default: m.GeraetDetailPage })))
// Modul C – Karte, Auswertung, Export
const KartePage = lazy(() => import('./features/karte/KartePage').then((m) => ({ default: m.KartePage })))
// Modul F – Benutzerverwaltung (nur Cloud-Modus)
const BenutzerPage = lazy(() => import('./features/benutzer/BenutzerPage').then((m) => ({ default: m.BenutzerPage })))
const AuswertungPage = lazy(() => import('./features/auswertung/AuswertungPage').then((m) => ({ default: m.AuswertungPage })))

/** Lokal: Organisation einrichten wie in Phase 1. Cloud: Login + Mitgliedschaft. */
const Zugang = CLOUD ? RequireAuth : RequireOrg

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <Zugang>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<StartPage />} />
              <Route path="einsaetze" element={<EinsatzListePage />} />
              <Route path="einsaetze/neu" element={<EinsatzNeuPage />} />
              <Route path="einsaetze/:id" element={<EinsatzDetailPage />} />
              <Route path="flugbuch" element={<FlugbuchPage />} />
              <Route path="notfall" element={<NotfallPage />} />
              <Route path="piloten" element={<PilotenListePage />} />
              <Route path="piloten/:id" element={<PilotDetailPage />} />
              <Route path="geraete" element={<GeraeteListePage />} />
              <Route path="geraete/:id" element={<GeraetDetailPage />} />
              <Route path="karte" element={<KartePage />} />
              <Route path="auswertung" element={<AuswertungPage />} />
              <Route path="einstellungen" element={<EinstellungenPage />} />
              {CLOUD && <Route path="benutzer" element={<BenutzerPage />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Zugang>
      </AuthProvider>
    </BrowserRouter>
  )
}
