const ACCESS_TOKEN_KEY = 'torneos_access_token';
const REFRESH_TOKEN_KEY = 'torneos_refresh_token';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function saveSession(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
