exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const CLIENT_SECRET = process.env.GCAL_CLIENT_SECRET;
  if (!CLIENT_SECRET) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GCAL_CLIENT_SECRET not configured in Netlify environment variables' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
  // Client ID comes from the frontend request (it's public, not secret)
  const CLIENT_ID = body.client_id || '';

  try {
    if (body.action === 'exchange') {
      // Exchange authorization code for tokens
      const params = new URLSearchParams({
        code: body.code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: body.redirect_uri,
        grant_type: 'authorization_code',
      });

      const resp = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const data = await resp.json();

      if (!resp.ok) {
        return {
          statusCode: resp.status,
          headers,
          body: JSON.stringify({ error: data.error_description || data.error || 'Token exchange failed' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
          token_type: data.token_type,
        }),
      };

    } else if (body.action === 'refresh') {
      // Refresh an access token using the refresh token
      const params = new URLSearchParams({
        refresh_token: body.refresh_token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
      });

      const resp = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const data = await resp.json();

      if (!resp.ok) {
        return {
          statusCode: resp.status,
          headers,
          body: JSON.stringify({ error: data.error_description || data.error || 'Token refresh failed' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          access_token: data.access_token,
          expires_in: data.expires_in,
          token_type: data.token_type,
          // Google may issue a new refresh token
          refresh_token: data.refresh_token || null,
        }),
      };

    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action. Use "exchange" or "refresh".' }) };
    }
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + e.message }) };
  }
};
