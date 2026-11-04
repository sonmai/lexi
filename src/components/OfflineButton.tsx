import { ArrowDownToLine, Check, RefreshCw } from 'lucide-react'
import type { OfflineStatus, Section } from '../dictionary-service'
import type { OfflineDownload } from '../hooks/useOfflineDictionary'

const sectionLabels: Record<Section, string> = { en: 'Anh–Việt', ja: 'Nhật–Việt' }

function size(bytes?: number): string {
  return bytes ? ' · ' + Math.max(1, Math.round(bytes / 1e6)) + ' MB' : ''
}

export function OfflineButton({
  section, status, download, onDownload,
}: {
  section: Section
  status?: OfflineStatus
  download: OfflineDownload | null
  onDownload: (section: Section) => void
}) {
  const label = sectionLabels[section]
  const state = status?.state ?? 'unavailable'
  let text = 'Tải từ điển offline' + size(status?.bytes)
  let description = 'Tải từ điển ' + label + ' để sử dụng offline'
  if (download?.section === section) {
    text = download.saved + '/' + download.total + ' phần'
  } else if (download) {
    text = 'Đang tải ' + sectionLabels[download.section] + '...'
  } else if (state === 'ready') {
    text = 'Đã tải offline'
    description = 'Từ điển ' + label + ' đã có sẵn offline'
  } else if (state === 'update') {
    text = 'Cập nhật bản offline' + size(status?.bytes)
    description = 'Tải phiên bản mới của từ điển ' + label + ' để sử dụng offline'
  }
  const Icon = state === 'ready' ? Check : state === 'update' ? RefreshCw : ArrowDownToLine

  return (
    <button
      className="offline-action"
      type="button"
      onClick={() => onDownload(section)}
      disabled={Boolean(download) || state === 'ready' || state === 'unavailable'}
      aria-label={description}
    >
      <Icon size={17} />
      <span>{text}</span>
    </button>
  )
}
