import type { Ereignis, NotfallSzenario } from '../../db/types'

/** Ereignis-Log-Eintrag für einen protokollierten Notfall */
export function notfallEreignis(s: NotfallSzenario, id: string, zeit: string): Ereignis {
  return { id, zeit, typ: 'notfall', bezug: `Notfall ${s.nr}`, text: s.vorfall }
}

export const notfallAnker = (nr: number) => `notfall-${nr}`
