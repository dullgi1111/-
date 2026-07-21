const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = body?.error?.message || `요청이 실패했습니다 (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.details = body?.error?.details;
    throw err;
  }

  return body ? body.data : null;
}

export function get(path) {
  return request(path, { method: 'GET' });
}

export function post(path, data, { signal } = {}) {
  return request(path, { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data), signal });
}

export function put(path, data) {
  return request(path, { method: 'PUT', body: JSON.stringify(data) });
}

export function del(path) {
  return request(path, { method: 'DELETE' });
}
