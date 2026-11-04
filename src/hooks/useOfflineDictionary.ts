import { useCallback, useEffect, useState } from 'react'
import {
  downloadSection, offlineStatus, pruneOfflineCache, type OfflineStatus, type Section,
} from '../dictionary-service'

export interface OfflineDownload {
  section: Section
  saved: number
  total: number
}

/** Offline state of both dictionaries; one section downloads at a time. */
export function useOfflineDictionary() {
  const [status, setStatus] = useState<Partial<Record<Section, OfflineStatus>>>({})
  const [download, setDownload] = useState<OfflineDownload | null>(null)
  const [error, setError] = useState('')
  const [mayBeEvicted, setMayBeEvicted] = useState(false)

  const refresh = useCallback(async () => {
    const [en, ja] = await Promise.all([offlineStatus('en'), offlineStatus('ja')])
    setStatus({ en, ja })
  }, [])

  useEffect(() => {
    // Status first: it pins complete downloads, which pruning must keep.
    refresh().then(() => pruneOfflineCache()).catch((failure) => console.warn('Offline status unavailable:', failure))
  }, [refresh])

  const start = useCallback(async (section: Section) => {
    setDownload({ section, saved: 0, total: status[section]?.total ?? 0 })
    setError('')
    try {
      const { persisted } = await downloadSection(section, (saved, total) => setDownload({ section, saved, total }))
      setMayBeEvicted(!persisted)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể tải dữ liệu offline.')
    } finally {
      setDownload(null)
      await refresh().catch(() => undefined)
    }
  }, [refresh, status])

  return { status, download, error, mayBeEvicted, start }
}
