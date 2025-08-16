
import { getAuthHeaders } from './apiUtils';

export const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // Retrieve token from localStorage for each API call to ensure it's the latest.
  const token = localStorage.getItem('authToken'); 

  const isFormData = options.body instanceof FormData;
  const authHeadersFromUtil = getAuthHeaders(token, isFormData);
  
  // Merge headers: default from getAuthHeaders, then options.headers (custom ones can override)
  const mergedHeaders = {
    ...authHeadersFromUtil, 
    ...(options.headers || {}), 
  };

  return fetch(url, {
    ...options,
    headers: mergedHeaders,
  });
};

export async function parseJsonSafe(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { return await res.json(); } catch { return null; }
  }
  try { const txt = await res.text(); return txt ? { message: txt } : null; } catch { return null; }
}

export async function apiJson(input: RequestInfo, init?: RequestInit) {
  const res = await apiFetch(input as any, init as any);
  const data = await parseJsonSafe(res as any);
  if (!(res as any).ok) {
    const msg = (data && (data.message || data.error)) || (res as any).statusText || 'Request failed';
    const err: any = new Error(msg);
    err.status = (res as any).status;
    err.data = data;
    throw err;
  }
  return data;
}
