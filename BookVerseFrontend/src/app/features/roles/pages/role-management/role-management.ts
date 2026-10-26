import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { apiError } from '../../../../core/api/api.config';
import { ManagedRole, ManagedUser } from '../../models/role-management.model';
import { RoleManagementService } from '../../services/role-management.service';

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './role-management.html',
  styleUrl: './role-management.css',
})
export class RoleManagement implements OnInit {
  private readonly service = inject(RoleManagementService);
  roles = signal<ManagedRole[]>([]);
  users = signal<ManagedUser[]>([]);
  drafts = signal<Record<string, string[]>>({});
  query = signal('');
  loading = signal(true);
  savingUserId = signal<string | null>(null);
  error = signal('');
  notice = signal('');
  currentPage = signal(1);
  pageSize = 5;
  roleFilter = signal('ALL');

  filteredUsers = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    const roleFilter = this.roleFilter();

    return this.users().filter((user) => {
      const matchesQuery =
        !query ||
        `${user.username} ${user.email}`.toLocaleLowerCase().includes(query);

      const matchesRole =
        roleFilter === 'ALL' || (user.roles ?? []).includes(roleFilter);

      return matchesQuery && matchesRole;
    });
  });

  pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize)),
  );

  pageNumbers = computed(() =>
    Array.from({ length: this.pageCount() }, (_, index) => index + 1),
  );

  paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredUsers().slice(start, start + this.pageSize);
  });

  firstVisibleUser = computed(() =>
    this.filteredUsers().length === 0
      ? 0
      : (this.currentPage() - 1) * this.pageSize + 1,
  );

  lastVisibleUser = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.filteredUsers().length),
  );

  // Kept until the table template is switched to paginatedUsers.
  visibleUsers = computed(() => this.paginatedUsers());

  changePage(page: number): void {
    if (page >= 1 && page <= this.pageCount()) {
      this.currentPage.set(page);
    }
  }

  onSearchChange(value: string): void {
    this.query.set(value);
    this.currentPage.set(1);
  }

  onRoleFilterChange(roleName: string): void {
    this.roleFilter.set(roleName);
    this.currentPage.set(1);
  }

  roleLabel(roleName: string): string {
    const role = roleName.toUpperCase().replace(/^ROLE_/, '');

    if (role === 'USER' || role === 'USUARIO') return 'USUARIO';
    if (role === 'MODERATOR' || role === 'MODERADOR') return 'MODERADOR';
    if (role === 'ADMIN') return 'ADMIN';

    return role;
  }

  countUsersWithRole(roleName: string): number {
    const role = this.roles().find(
      (item) => this.roleLabel(item.name) === roleName,
    );

    return role?.usersCount ?? 0;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ roles: this.service.getRoles(), users: this.service.getUsers() }).subscribe({
      next: ({ roles, users }) => {
        this.roles.set(roles);
        this.users.set(users);
        this.drafts.set(this.buildDrafts(users, roles));
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(apiError(error));
        this.loading.set(false);
      },
    });
  }

  isSelected(userId: string, roleName: string): boolean {
    return (this.drafts()[userId] ?? []).includes(roleName);
  }

  toggleRole(user: ManagedUser, roleName: string, checked: boolean): void {
    this.drafts.update((drafts) => {
      const current = drafts[user.idExternal] ?? [];
      const next = checked
        ? [...new Set([...current, roleName])]
        : current.filter((name) => name !== roleName);
      return { ...drafts, [user.idExternal]: next };
    });
    this.notice.set('');
  }

  save(user: ManagedUser): void {
    const roleNames = this.drafts()[user.idExternal] ?? [];
    if (roleNames.length === 0 || this.savingUserId()) return;
    const roleIds = this.roles()
      .filter((role) => roleNames.includes(role.name))
      .map((role) => role.idExternal);
    if (roleIds.length === 0) return;

    this.savingUserId.set(user.idExternal);
    this.error.set('');
    this.notice.set('');
    this.service.replaceUserRoles(user.idExternal, roleIds).subscribe({
      next: (updatedUser) => {
        this.users.update((users) =>
          users.map((item) => item.idExternal === updatedUser.idExternal ? updatedUser : item),
        );
        this.drafts.update((drafts) => ({ ...drafts, [updatedUser.idExternal]: updatedUser.roles }));
        this.savingUserId.set(null);
        this.notice.set(`Roles actualizados para ${updatedUser.username}.`);
      },
      error: (error) => {
        this.error.set(apiError(error));
        this.savingUserId.set(null);
      },
    });
  }

  hasChanges(user: ManagedUser): boolean {
    const original = [...(user.roles ?? [])].sort().join('|');
    const draft = [...(this.drafts()[user.idExternal] ?? [])].sort().join('|');
    return original !== draft;
  }

  private buildDrafts(users: ManagedUser[], roles: ManagedRole[]): Record<string, string[]> {
    const validRoleNames = new Set(roles.map((role) => role.name));
    return Object.fromEntries(
      users.map((user) => [user.idExternal, (user.roles ?? []).filter((role) => validRoleNames.has(role))]),
    );
  }
}
