/**
 * NeverLifts — Cloudflare Worker proxy
 * Receives weight log JSON from the app and writes it to GitHub.
 * The GitHub token lives in Cloudflare secrets, never in the app code.
 *
 * Environment variables (set in Cloudflare dashboard):
 *   GITHUB_TOKEN  — classic PAT with repo scope
 *   GITHUB_REPO   — e.g. "seanstep88/daily-sheve-lifts"
 */

export default {
  async fetch(request, env) {
    // Allow CORS from any origin (the app is on GitHub Pages)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    const { date, content } = body;
    if (!date || !content) {
      return new Response('Missing date or content', { status: 400, headers: corsHeaders });
    }

    const path = `logs/${date}.json`;
    const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`;
    const headers = {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'NeverLifts-Worker',
    };

    // Check if file already exists (need SHA to update)
    let sha = null;
    const checkRes = await fetch(apiUrl, { headers });
    if (checkRes.ok) {
      const existing = await checkRes.json();
      sha = existing.sha;
    }

    // Base64-encode the content
    const encoded = btoa(unescape(encodeURIComponent(content)));

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `weight log: ${date}`,
        content: encoded,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err.message || 'GitHub error', status: putRes.status }), {
        status: putRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
