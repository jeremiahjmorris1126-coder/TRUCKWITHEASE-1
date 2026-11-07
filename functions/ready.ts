interface Env {
  BACKEND_URL?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const backendBase = context.env.BACKEND_URL || 'https://truckwithease-1-62nxuqhmtq-uc.a.run.app';
  const backendUrl = `${backendBase}/ready`;

  const headers = new Headers(context.request.headers);
  headers.set('X-Forwarded-Host', new URL(context.request.url).host);
  headers.set('X-Forwarded-Proto', 'https');
  const clientIp = context.request.headers.get('cf-connecting-ip');
  if (clientIp) {
    headers.set('X-Forwarded-For', clientIp);
  }

  return fetch(backendUrl, {
    method: 'GET',
    headers,
  });
};
