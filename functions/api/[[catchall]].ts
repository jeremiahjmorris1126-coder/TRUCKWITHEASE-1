interface Env {
  BACKEND_URL?: string;
  DB?: any;
  CACHE?: any;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const backendBase = context.env.BACKEND_URL || 'https://truckwithease-1-62nxuqhmtq-uc.a.run.app';
  const backendUrl = `${backendBase}${url.pathname}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', 'https');
  const clientIp = context.request.headers.get('cf-connecting-ip');
  if (clientIp) {
    headers.set('X-Forwarded-For', clientIp);
  }

  // Handle CORS preflight at edge if needed
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': context.request.headers.get('Origin') || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-carrier-token, x-tenant-id',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const isBodyAllowed = !['GET', 'HEAD'].includes(context.request.method);
  const body = isBodyAllowed ? context.request.body : undefined;

  return fetch(backendUrl, {
    method: context.request.method,
    headers,
    body,
    redirect: 'follow',
  });
};
