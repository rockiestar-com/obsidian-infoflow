import { requestUrl } from 'obsidian';

export const fetchInfoFlowData = async (apiKey: string, query: string) => {
  const response = await requestUrl({
    url: 'https://api.infoflow.com/graphql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query }),
  });

  if (response.status !== 200) {
    throw new Error(`Error fetching data: ${response.statusText}`);
  }

  return response.json;
};

export const deleteInfoFlowItem = async (apiKey: string, itemId: string) => {
  const response = await requestUrl({
    url: `https://api.infoflow.com/items/${itemId}`,
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (response.status !== 204) {
    throw new Error(`Error deleting item: ${response.statusText}`);
  }

  return true;
};
