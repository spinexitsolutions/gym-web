// Absolute URL for API downloads (CSV, PDF). Cookies authenticate GET requests, so a plain link works.
export const apiUrl = (path) => `${import.meta.env.VITE_API_URL || ''}/api${path}`;
