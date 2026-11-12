import type { OrgTyp } from '../../db/types'

export const ORG_TYPEN: { value: OrgTyp; label: string }[] = [
  { value: 'FF', label: 'Freiwillige Feuerwehr' },
  { value: 'BF', label: 'Berufsfeuerwehr' },
  { value: 'BtF', label: 'Betriebsfeuerwehr' },
  { value: 'Rettung', label: 'Rettungsdienst' },
  { value: 'Polizei', label: 'Polizei' },
  { value: 'Bergrettung', label: 'Bergrettung' },
  { value: 'Wasserrettung', label: 'Wasserrettung' },
  { value: 'Sonstige', label: 'Sonstige BOS' },
]
