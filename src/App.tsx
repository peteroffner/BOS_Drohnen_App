import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireOrg } from './features/einstellungen/RequireOrg'
import { EinstellungenPage } from './features/einstellungen/EinstellungenPage'
// Modul A – Einsatz, Flugbuch, Notfall
import { StartPage } from './features/einsatz/StartPage'
import { EinsatzListePage } from './features/einsatz/EinsatzListePage'
import { EinsatzNeuPage } from './features/einsatz/EinsatzNeuPage'
import { EinsatzDetailPage } from './features/einsatz/EinsatzDetailPage'
import { FlugbuchPage } from './features/flugbuch/FlugbuchPage'
import { NotfallPage } from './features/notfall/NotfallPage'
// Modul B – Piloten, Geräte, Wartung
import { PilotenListePage } from './features/piloten/PilotenListePage'
import { PilotDetailPage } from './features/piloten/PilotDetailPage'
import { GeraeteListePage } from './features/geraete/GeraeteListePage'
import { GeraetDetailPage } from './features/geraete/GeraetDetailPage'
// Modul C – Karte, Auswertung, Export
import { KartePage } from './features/karte/KartePage'
import { AuswertungPage } from './features/auswertung/AuswertungPage'

export default function App() {
  return (
    <BrowserRouter>
      <RequireOrg>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </RequireOrg>
    </BrowserRouter>
  )
}
