import { requestUrl } from 'obsidian'
import { Item } from './types'

export interface IFetchDataResponse {
  items: Item[]
  hasNextPage: boolean
}

export const fetchInfoFlowData = async (
  endpoint: string,
  apiKey: string,
  {
    offset,
    lastSync,
    size,
  }: { offset: number; lastSync?: string; size: number },
) => {
  const response = await requestUrl({
    url: `${endpoint}/api/v1/open/fetch_data`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ offset, lastSync, size }),
  })

  if (response.status !== 200) {
    throw new Error(`Error fetching data: ${response.status}`)
  }

  return response.json
}

export const deleteInfoFlowItem = async (
  endpoint: string,
  apiKey: string,
  itemId: string,
) => {
  const response = await requestUrl({
    url: `${endpoint}/api/v1/open/items/${itemId}`,
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (response.status !== 204) {
    throw new Error(`Error deleting item: ${response.status}`)
  }

  return true
}

export enum HighlightColors {
  Yellow = '#fff3a3',
  Red = '#ff5582',
  Blue = '#adccff',
  Green = '#bbfabb',
}
