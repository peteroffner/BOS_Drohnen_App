import { describe, expect, it } from 'vitest'
import { AKTIVE_ORG_KEY, BosDb } from '../../db/db'
import { STANDARD_FREIGABE_REGELN } from '../../lib/useOrg'
import { BACKUP_FORMAT, type BackupDatei, backupErzeugen, backupValidieren, backupWiederherstellen, LETZTES_BACKUP_KEY, tageSeit } from './backup'
import { demodatenLaden } from './demo'

const org = { id: 'org1', name: 'FF Test', typ: 'FF' as const, freigabeRegeln: STANDARD_FREIGABE_REGELN, erstelltAm: '2026-01-01' }

describe('Backup-Validierung', () => {
  it('lehnt Fremddateien ab', () => {
    expect(backupValidieren('kein json')).toMatchObject({ ok: false })
    expect(backupValidieren({ format: 'anderes' })).toMatchObject({ ok: false })
    expect(backupValidieren({ format: BACKUP_FORMAT, version: 99, tabellen: {} })).toMatchObject({ ok: false, fehler: expect.stringMatching(/Version 99/) })
    expect(backupValidieren({ format: BACKUP_FORMAT, version: 1, tabellen: { foo: [] } })).toMatchObject({ ok: false, fehler: expect.stringMatching(/foo/) })
    expect(backupValidieren({ format: BACKUP_FORMAT, version: 1, tabellen: { organisationen: [] } })).toMatchObject({ ok: false })
  })
  it('prüft Schlüssel, Duplikate und orgId', () => {
    const basis = { format: BACKUP_FORMAT, version: 1, tabellen: { organisationen: [org] } }
    expect(backupValidieren({ ...basis, tabellen: { ...basis.tabellen, piloten: [{ vorname: 'x' }] } })).toMatchObject({ ok: false })
    expect(backupValidieren({ ...basis, tabellen: { ...basis.tabellen, piloten: [{ id: 'a', orgId: 'org1' }, { id: 'a', orgId: 'org1' }] } })).toMatchObject({
      ok: false,
      fehler: expect.stringMatching(/doppelt/),
    })
    expect(backupValidieren({ ...basis, tabellen: { ...basis.tabellen, geraete: [{ id: 'g' }] } })).toMatchObject({ ok: false })
    const v = backupValidieren(JSON.stringify(basis))
    expect(v.ok && v.anzahl).toMatchObject({ organisationen: 1, piloten: 0, einstellungen: 0 })
  })
})

describe('Backup Rundreise', () => {
  it('erzeugt, validiert und stellt vollständig wieder her (ersetzt alles)', async () => {
    const quelle = new BosDb('backup-quelle')
    await quelle.organisationen.add(org)
    await quelle.einstellungen.put({ key: AKTIVE_ORG_KEY, value: 'org1' })
    await demodatenLaden(quelle, 'org1')
    const b = await backupErzeugen(quelle, new Date('2026-11-12T10:00:00Z'))
    expect(b.format).toBe(BACKUP_FORMAT)
    const v = backupValidieren(JSON.stringify(b))
    expect(v.ok).toBe(true)
    if (!v.ok) return

    const ziel = new BosDb('backup-ziel')
    await ziel.organisationen.add({ ...org, id: 'alt', name: 'Alt' })
    await ziel.piloten.add({ id: 'altpilot', orgId: 'alt', vorname: 'A', nachname: 'B', qualifikationen: [], freigabe: { erteilt: false }, aktiv: true, erstelltAm: '' })
    await backupWiederherstellen(ziel, v.daten)
    expect(await ziel.organisationen.toArray()).toEqual([org])
    expect(await ziel.piloten.get('altpilot')).toBeUndefined()
    expect(await ziel.einsaetze.count()).toBe(await quelle.einsaetze.count())
    expect((await ziel.einstellungen.get(AKTIVE_ORG_KEY))?.value).toBe('org1')
    expect((await ziel.einstellungen.get(LETZTES_BACKUP_KEY))?.value).toBe('2026-11-12T10:00:00.000Z')
    quelle.close()
    ziel.close()
  })

  it('bricht bei Fehler ab, ohne Daten zu verändern', async () => {
    const ziel = new BosDb('backup-fehler')
    await ziel.organisationen.add(org)
    const kaputt: BackupDatei = { format: BACKUP_FORMAT, version: 1, erstelltAm: '', dbVersion: 1, app: '', tabellen: { organisationen: [{ id: 'x' }, { id: 'x' }], piloten: [], geraete: [], einsaetze: [], wartungen: [], maengel: [], einstellungen: [] } }
    await expect(backupWiederherstellen(ziel, kaputt)).rejects.toThrow()
    expect(await ziel.organisationen.toArray()).toEqual([org])
    ziel.close()
  })

  it('tageSeit', () => {
    expect(tageSeit(undefined)).toBeUndefined()
    expect(tageSeit('2026-10-01T00:00:00Z', new Date('2026-11-12T00:00:00Z'))).toBe(42)
  })
})
