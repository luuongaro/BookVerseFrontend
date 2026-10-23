import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
@Component({
  selector: 'app-catalog-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './catalog-nav.html',
  styleUrl: './catalog-nav.css',
})
export class CatalogNav {
  private roles(): string[] {
    try {
      const token = localStorage.getItem('token');
      if (!token) return [];
      const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims: { roles?: string[] } = JSON.parse(atob(encoded));
      return Array.isArray(claims.roles) ? claims.roles : [];
    } catch {
      return [];
    }
  }

  canModerate(): boolean {
    return this.roles().some((role) => role === 'ROLE_ADMIN' || role === 'ROLE_MODERATOR');
  }

  isAdmin(): boolean {
    return this.roles().includes('ROLE_ADMIN');
  }
}
