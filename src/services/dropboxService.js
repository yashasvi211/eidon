export const DROPBOX_APP_KEY = '0jdpm1eiynbfgf8';
export const DROPBOX_APP_SECRET = 've335407gtwlx2e';
const DROPBOX_API = 'https://api.dropboxapi.com';
const DROPBOX_CONTENT = 'https://content.dropboxapi.com';

/**
 * Returns the Dropbox OAuth authorize URL
 */
export function getDropboxAuthUrl() {
  const scopes =
    'account_info.read files.content.write files.content.read files.metadata.read files.metadata.write';
  return `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&response_type=code&token_access_type=offline&scope=${encodeURIComponent(
    scopes
  )}`;
}

/**
 * Exchanges the user-entered authorization code for access & refresh tokens
 */
export async function exchangeDropboxCode(authCode) {
  if (!authCode || !authCode.trim()) {
    throw new Error('Please enter a valid authorization code.');
  }

  const response = await fetch(`${DROPBOX_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=authorization_code&code=${encodeURIComponent(
      authCode.trim()
    )}&client_id=${encodeURIComponent(
      DROPBOX_APP_KEY
    )}&client_secret=${encodeURIComponent(DROPBOX_APP_SECRET)}`,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Failed to exchange auth code');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenExpiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Refreshes the access token using the stored refresh token
 */
export async function refreshDropboxToken(refreshToken) {
  if (!refreshToken) throw new Error('No refresh token available');

  const response = await fetch(`${DROPBOX_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(
      refreshToken
    )}&client_id=${encodeURIComponent(
      DROPBOX_APP_KEY
    )}&client_secret=${encodeURIComponent(DROPBOX_APP_SECRET)}`,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Failed to refresh token');
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    tokenExpiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Tests the Dropbox connection and retrieves account details
 */
export async function testDropboxConnection(token) {
  if (!token) return { success: false, message: 'No Dropbox token configured.' };

  try {
    const response = await fetch(`${DROPBOX_API}/2/users/get_current_account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: 'null',
    });

    if (!response.ok) {
      const text = await response.text();
      let msg = `Dropbox error (${response.status})`;
      try {
        const j = JSON.parse(text);
        const s = j.error_summary || j.error?.['.tag'] || '';
        if (s) msg += `: ${s}`;
      } catch {
        if (text) msg += `: ${text.slice(0, 150)}`;
      }
      return { success: false, message: msg };
    }

    const account = await response.json();
    const name = account.name?.display_name || account.email || 'Dropbox Account';
    return { success: true, message: `Connected as ${name}`, account };
  } catch (err) {
    return { success: false, message: err.message || 'Connection test failed' };
  }
}

/**
 * Uploads full Eidon data to Dropbox
 */
export async function uploadToDropbox(token, data, remoteRoot = '/eidon') {
  if (!token) return { success: false, message: 'No Dropbox token configured.' };

  let root = remoteRoot.trim() || '/eidon';
  if (root.endsWith('/')) root = root.slice(0, -1);

  const exportPayload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: data.settings || {},
    projects: data.projects || [],
    tasks: data.tasks || [],
  };

  const content = JSON.stringify(exportPayload, null, 2);
  const targetPath = `${root}/eidon_export.json`;

  try {
    const response = await fetch(`${DROPBOX_CONTENT}/2/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: targetPath,
          mode: 'overwrite',
          mute: true,
        }),
        'Content-Type': 'application/octet-stream',
      },
      body: content,
    });

    if (response.ok) {
      return {
        success: true,
        message: `Synced backup to Dropbox (${targetPath}) successfully!`,
      };
    }

    const errText = await response.text();
    return {
      success: false,
      message: `Dropbox upload failed (${response.status}): ${errText.slice(0, 150)}`,
    };
  } catch (err) {
    return { success: false, message: err.message || 'Upload failed' };
  }
}

/**
 * Downloads and restores Eidon data from Dropbox
 */
export async function syncFromDropbox(token, remoteRoot = '/eidon') {
  if (!token) return { success: false, message: 'No Dropbox token configured.' };

  let root = remoteRoot.trim() || '/eidon';
  if (root.endsWith('/')) root = root.slice(0, -1);
  const targetPath = `${root}/eidon_export.json`;

  try {
    const response = await fetch(`${DROPBOX_CONTENT}/2/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: targetPath }),
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        message: `Could not find or download ${targetPath} (${response.status}): ${errText.slice(0, 150)}`,
      };
    }

    const text = await response.text();
    const parsed = JSON.parse(text);

    return {
      success: true,
      data: parsed,
      message: `Successfully downloaded backup from Dropbox (${targetPath})!`,
    };
  } catch (err) {
    return { success: false, message: err.message || 'Sync from Dropbox failed' };
  }
}

/**
 * Client-side file export (download eidon_export.json)
 */
export function exportDataAsJsonFile(data) {
  const exportPayload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: data.settings || {},
    projects: data.projects || [],
    tasks: data.tasks || [],
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eidon_export_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Client-side file import from a File object
 */
export function importDataFromJsonFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file selected'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          reject(new Error('Failed to read file content'));
          return;
        }
        const parsed = JSON.parse(text);
        if (!parsed.tasks && !parsed.projects) {
          reject(new Error('Invalid Eidon JSON: Missing tasks or projects array.'));
          return;
        }
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse JSON file: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
}
