export interface Item {
  id: string;
  title: string;
  infoFlowUrl: string;
  siteName: string;
  originalUrl?: string;
  author: string;
  labels?: LabelView[];
  dateSaved: string;
  highlights: HighlightView[];
  content?: string;
  datePublished?: string;
  fileAttachment?: string;
  description?: string;
  note?: string;
  type: string;
  dateRead?: string;
  wordsCount?: number;
  readLength?: number;
  state: string;
  dateArchived?: string;
  image?: string;
  updatedAt?: string;
}

export interface LabelView {
  name: string;
}

export interface HighlightView {
  text: string;
  highlightUrl: string;
  highlightID: string;
  dateHighlighted?: string;
  note?: string;
  labels?: LabelView[];
  color: string;
  positionPercent: number;
  positionAnchorIndex: number;
}
