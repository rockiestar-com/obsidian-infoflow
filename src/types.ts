export interface LabelView {
  name: string
}

export interface HighlightView {
  text: string
  highlightUrl: string
  highlightID: string
  dateHighlighted?: string
  note?: string
  labels?: LabelView[]
  color: string
  positionPercent: number
  positionAnchorIndex: number
}

export interface Highlight {
  id: string
  quote: string | null
  annotation: string | null
  updatedAt: string | null
  tags: string[] | null
  color: string | null
}

export interface Item {
  id: string
  title: string
  itemNote: string | null
  readingProgress: number
  siteName: string | null
  originalArticleUrl: string | null
  author: string | null
  description: string | null
  slug: string
  tags: string[] | null
  highlights: Highlight[] | null
  updatedAt: string | null
  savedAt: string
  content: string | null
  publishedAt: string | null
  url: string
  image: string | null
  readAt: string | null
  wordsCount: number | null
  isArchived: boolean
  archivedAt: string | null
  contentReader: string | null
}
