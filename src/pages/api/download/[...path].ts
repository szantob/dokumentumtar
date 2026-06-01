export const prerender = false;

import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const key = params.path;
  if (!key) {
    return new Response('Not Found', { status: 404 });
  }

  const bucket: R2Bucket = (locals as App.Locals).runtime.env.DOKUMENTUMTAR;
  const object = await bucket.get(key);

  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  const parts = key.split('/');
  const filename = parts[parts.length - 1];
  // Return 404 for directory-like keys (key ending with '/')
  if (!filename) {
    return new Response('Not Found', { status: 404 });
  }
  // Use RFC 5987 encoding for the filename parameter to handle all special characters
  const encodedFilename = encodeURIComponent(filename);
  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';

  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
    'Content-Length': String(object.size),
  });

  return new Response(object.body, { headers });
};
