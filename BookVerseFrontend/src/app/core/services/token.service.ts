import { Injectable } from '@angular/core';

interface TokenClaims {
  exp?: number;
  roles?: unknown;
}

@Injectable({ providedIn: 'root' })
export class TokenService {
  getToken(): string | null {
    try {
      const token = localStorage.getItem('token');
      return token && this.getValidClaims(token) ? token : null;
    } catch {
      return null;
    }
  }

  getRoles(): string[] | null {
    const claims = this.getValidClaims();
    if (!claims) return null;

    return Array.isArray(claims.roles)
      ? claims.roles.filter((role): role is string => typeof role === 'string')
      : [];
  }

  isAuthenticated(): boolean {
    return this.getValidClaims() !== null;
  }

  hasAnyRole(...expectedRoles: string[]): boolean {
    const roles = this.getRoles();
    return roles !== null && expectedRoles.some((role) => roles.includes(role));
  }

  private getValidClaims(token?: string): TokenClaims | null {
    try {
      const storedToken = token ?? localStorage.getItem('token');
      if (!storedToken) return null;

      const segments = storedToken.split('.');
      if (segments.length !== 3 || !segments[1]) return null;

      const base64 = segments[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(segments[1].length / 4) * 4, '=');

      const bytes = Uint8Array.from(
        atob(base64),
        (character) => character.charCodeAt(0),
      );
      const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));

      if (!claims || typeof claims !== 'object') return null;

      const tokenClaims = claims as TokenClaims;
      if (
        typeof tokenClaims.exp !== 'number' ||
        tokenClaims.exp <= Date.now() / 1000
      ) {
        return null;
      }

      return tokenClaims;
    } catch {
      return null;
    }
  }
}
