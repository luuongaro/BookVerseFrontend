import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { UserService } from '../../../features/profile/services/user.service';

interface SidebarLink {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit {
  readonly userService = inject(UserService);
  private readonly router = inject(Router);

  readonly roles = signal<string[]>([]);

  readonly isAdmin = computed(() => this.roles().includes('ROLE_ADMIN'));

  readonly canModerate = computed(() =>
    this.roles().some(
      (role) => role === 'ROLE_MODERATOR' || role === 'ROLE_ADMIN',
    ),
  );

  readonly userName = computed(
    () => this.userService.currentUser()?.username ?? 'Usuario',
  );

  readonly userInitials = computed(() =>
    this.userName().slice(0, 2).toUpperCase(),
  );

  readonly commonLinks: SidebarLink[] = [
    { label: 'Mi espacio', route: '/dashboard', icon: 'home' },
    { label: 'Mi biblioteca', route: '/library', icon: 'library' },
    { label: 'Escritorio', route: '/writer', icon: 'pencil' },
    { label: 'Historias', route: '/stories', icon: 'story' },
    { label: 'Libros', route: '/books', icon: 'book' },
    { label: 'Reseñas', route: '/reviews', icon: 'review' },
    { label: 'Grupos de lectura', route: '/groups', icon: 'people' },
  ];

  readonly iconPaths: Record<string, string> = {
    home: 'm3 10 9-7 9 7v10H3Zm6 10v-7h6v7',
    library: 'M3 4h4v16H3Zm7 0h4v16h-4Zm7 0 4-1 4 16-4 1Z',
    story: 'M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2h4M6 3h12a2 2 0 0 1 2 2v12M10 7h6m-6 4h6',
    pencil: 'm16 3 5 5L8 21H3v-5L16 3Zm-3 3 5 5',
    book: 'M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-2-1-6-1-10 1Zm0 0v16',
    review: 'm12 2 3 6.2 6.8 1-4.9 4.8 1.2 6.8L12 17.5l-6.1 3.3 1.2-6.8-4.9-4.8 6.8-1Z',
    people: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 13v-3a7 7 0 0 0-14 0v3Zm1-16a3 3 0 0 1 0 6m2 10v-3a7 7 0 0 0-2-5',
    report: 'M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3v.1',
    roles: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-12v2m0 14v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 22v-2a8 8 0 0 1 16 0v2',
    logout: 'M10 3H3v18h7m-2-9h14m-5-5 5 5-5 5',
  };

  ngOnInit(): void {
    this.readRolesFromToken();
    this.userService.loadCurrentUser().subscribe({
      error: () => undefined,
    });
  }

  logout(): void {
    this.userService.logout();
    void this.router.navigateByUrl('/login');
  }

  private readRolesFromToken(): void {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        this.roles.set([]);
        return;
      }

      const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
      const claims: { roles?: string[] } = JSON.parse(atob(padded));

      this.roles.set(Array.isArray(claims.roles) ? claims.roles : []);
    } catch {
      this.roles.set([]);
    }
  }
}
