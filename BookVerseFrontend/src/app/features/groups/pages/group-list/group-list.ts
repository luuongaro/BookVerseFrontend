import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { ReadingGroup } from '../../models/reading-group.model';
import { GroupMembersService } from '../../services/group-members.service';
import { ReadingGroupsService } from '../../services/reading-groups.service';
import { UserService } from '../../../profile/services/user.service';

@Component({
  selector: 'app-group-list',
  imports: [DatePipe, FormsModule, RouterLink],
  styleUrl: './group-list.css',
  templateUrl: './group-list.html',
})
export class GroupList implements OnInit {
  private readonly readingGroupsService = inject(ReadingGroupsService);
  private readonly groupMembersService = inject(GroupMembersService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly userService = inject(UserService);

  groups: ReadingGroup[] = [];
  searchTerm = '';
  readonly pageSize = 6;
  currentPage = 0;
  isLoading = true;
  errorMessage = '';

  get currentUsername(): string {
    return this.userService.currentUser()?.username ?? 'Usuario';
  }

  get currentUserInitials(): string {
    const username = this.userService.currentUser()?.username?.trim();
    return username ? username.slice(0, 2).toUpperCase() : 'BV';
  }

  logout(): void {
    this.userService.logout();
  }

  ngOnInit(): void {
    this.loadGroups();
  }

  private loadGroups(): void {
    const userId = localStorage.getItem('userId');

    if (!userId) {
      this.errorMessage = 'No se encontró el usuario de la sesión.';
      this.isLoading = false;
      this.changeDetector.markForCheck();
      return;
    }

    this.groupMembersService
      .getActiveByUser(userId)
      .pipe(
        switchMap((memberships) => {
          const groupIds = [
            ...new Set(memberships.map((membership) => membership.groupId)),
          ];

          if (groupIds.length === 0) {
            return of([]);
          }

          return forkJoin(
            groupIds.map((groupId) =>
              this.readingGroupsService
                .getById(groupId)
                .pipe(catchError(() => of(null))),
            ),
          );
        }),
        map((groups) =>
          groups.filter(
            (group): group is ReadingGroup => group !== null,
          ),
        ),
      )
      .subscribe({
        next: (groups) => {
          this.groups = groups.filter((group) => group.isActive);
          this.isLoading = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error al cargar los grupos del usuario:', error);
          this.errorMessage = 'No se pudieron cargar tus grupos de lectura.';
          this.isLoading = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  get filteredGroups(): ReadingGroup[] {
    const query = this.searchTerm.trim().toLowerCase();

    if (!query) {
      return this.groups;
    }

    return this.groups.filter((group) =>
      group.name.toLowerCase().includes(query),
    );
  }

  get totalPages(): number {
    return Math.ceil(this.filteredGroups.length / this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index);
  }

  get paginatedGroups(): ReadingGroup[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredGroups.slice(start, start + this.pageSize);
  }

  onSearchChange(searchTerm: string): void {
    this.searchTerm = searchTerm;
    this.currentPage = 0;
  }

  goToPage(page: number): void {
    const lastPage = Math.max(this.totalPages - 1, 0);
    this.currentPage = Math.min(Math.max(page, 0), lastPage);
  }
}
