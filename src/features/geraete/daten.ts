import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Einsatz, Geraet, Mangel, Pilot, WartungsPruefung } from '../../db/types'

/**
 * Live-Abfragen für Modul B (Piloten, Geräte, Wartung), immer nach Organisation gefiltert.
 * `undefined` = lädt noch.
 */

export function useEinsaetze(orgId?: string): Einsatz[] | undefined {
  return useLiveQuery(() => (orgId ? db.einsaetze.where('orgId').equals(orgId).toArray() : []), [orgId])
}

export function useGeraete(orgId?: string): Geraet[] | undefined {
  return useLiveQuery(
    async () => (orgId ? (await db.geraete.where('orgId').equals(orgId).toArray()).sort((a, b) => a.name.localeCompare(b.name, 'de-AT', { numeric: true })) : []),
    [orgId],
  )
}

export function usePiloten(orgId?: string): Pilot[] | undefined {
  return useLiveQuery(() => (orgId ? db.piloten.where('orgId').equals(orgId).toArray() : []), [orgId])
}

export function useMaengel(orgId?: string): Mangel[] | undefined {
  return useLiveQuery(() => (orgId ? db.maengel.where('orgId').equals(orgId).toArray() : []), [orgId])
}

export function useWartungen(orgId?: string, geraetId?: string): WartungsPruefung[] | undefined {
  return useLiveQuery(async () => {
    if (!orgId) return []
    const alle = geraetId ? await db.wartungen.where('geraetId').equals(geraetId).toArray() : await db.wartungen.where('orgId').equals(orgId).toArray()
    return alle.filter((w) => w.orgId === orgId)
  }, [orgId, geraetId])
}
