// Shared API configuration
// Shared API configuration
export const API_BASE = () => {
  const { hostname, protocol, port } = window.location;
  // If we are on Render (no port or standard 80/443), use the same origin
  if (!port || port === '80' || port === '443') {
    return `${protocol}//${hostname}/api`;
  }
  // Otherwise assume local dev on port 5000
  return `${protocol}//${hostname}:5000/api`;
};


// Shared date helper
export function toISODate(str) {
  if (!str) return '';
  if (str.includes('-')) return str;
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts[0].length === 4) return str.replace(/\//g, '-');
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return str;
}
