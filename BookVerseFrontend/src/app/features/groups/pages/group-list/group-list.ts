import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar';
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

import {
  GroupReadingCycle,
  ReadingGroup,
} from '../../models/reading-group.model';
import { GroupMembersService } from '../../services/group-members.service';
import { DiscoveredGroup, ReadingGroupsService } from '../../services/reading-groups.service';
import { UserService } from '../../../profile/services/user.service';

interface ReadingGroupListItem extends ReadingGroup {
  currentCycle: GroupReadingCycle | null;
}

@Component({
  selector: 'app-group-list',
  imports: [UserAvatar, DatePipe, FormsModule, RouterLink],
  styleUrl: './group-list.css',
  templateUrl: './group-list.html',
})
export class GroupList implements OnInit {
  private readonly readingGroupsService = inject(ReadingGroupsService);
  private readonly groupMembersService = inject(GroupMembersService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly userService = inject(UserService);

  groups: ReadingGroupListItem[] = [];
  searchTerm = '';
  readonly pageSize = 6;
  currentPage = 0;
  isLoading = true;
  errorMessage = '';
  view: 'mine' | 'discover' = 'mine';
  discoverSearch = '';
  discovered: DiscoveredGroup[] = [];
  discoverLoading = false;
  discoverError = '';
  requestingId = '';
  private discoverLoaded = false;

  showDiscover(): void {
    this.view = 'discover';
    this.loadDiscover();
  }

  private loadDiscover(): void {
    if (this.discoverLoaded || this.discoverLoading) {
      return;
    }

    this.discoverLoading = true;
    this.discoverError = '';
    this.readingGroupsService.discover().subscribe({
      next: groups => {
        this.discovered = groups;
        this.discoverLoading = false;
        this.discoverLoaded = true;
        this.changeDetector.markForCheck();
      },
      error: () => { this.discoverError = 'No pudimos cargar los grupos. Intentá de nuevo.'; this.discoverLoading = false; this.changeDetector.markForCheck(); },
    });
  }

  get filteredDiscover(): DiscoveredGroup[] {
    const query = this.normalizeSearchText(this.discoverSearch);
    const terms = query.split(/\s+/).filter(Boolean);

    if (terms.length === 0) {
      return this.discovered;
    }

    return this.discovered.filter((group) => {
      const readingType = group.activeReadingCycle?.storyId
        ? 'historia'
        : group.activeReadingCycle?.bookId
          ? 'libro'
          : 'lectura por definir';

      const searchableText = this.normalizeSearchText(
        [
          group.name,
          group.activeContentTitle ?? '',
          readingType,
          group.activeReadingCycle?.editionReference ?? '',
        ].join(' '),
      );

      return terms.every((term) => searchableText.includes(term));
    });
  }

  private normalizeSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  requestGroup(group: DiscoveredGroup): void {
    if (this.requestingId || group.membershipState !== 'NOT_MEMBER') return;
    this.requestingId = group.idExternal;
    this.discoverError = '';
    this.readingGroupsService.requestMembership(group.idExternal).subscribe({
      next: () => { group.membershipState = 'JOIN_REQUEST_PENDING'; this.requestingId = ''; this.changeDetector.markForCheck(); },
      error: () => { this.discoverError = 'No pudimos enviar la solicitud. Intentá de nuevo.'; this.requestingId = ''; this.changeDetector.markForCheck(); },
    });
  }

  get currentUsername(): string {
    return this.userService.currentUser()?.username ?? 'Usuario';
  }

  logout(): void {
    this.userService.logout();
  }

  ngOnInit(): void {
    this.loadGroups();
    this.loadDiscover();
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
            (group): group is ReadingGroup => group !== null && group.isActive,
          ),
        ),
      )
      .subscribe({
        next: (groups) => {
          this.groups = groups.map((group) => ({
            ...group,
            currentCycle: null,
          }));
          this.isLoading = false;
          this.changeDetector.markForCheck();
          this.loadCurrentCycles(groups);
        },
        error: (error: unknown) => {
          console.error('Error al cargar los grupos del usuario:', error);
          this.errorMessage = 'No se pudieron cargar tus grupos de lectura.';
          this.isLoading = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private loadCurrentCycles(groups: ReadingGroup[]): void {
    if (groups.length === 0) {
      return;
    }

    forkJoin(
      groups.map((group) =>
        this.readingGroupsService.getCycles(group.idExternal).pipe(
          map((cycles) => {
            const latestCycle = [...cycles].sort(
              (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
            )[0];

            const currentCycle =
              cycles.find((cycle) => cycle.status === 'ACTIVE') ??
              cycles.find((cycle) => cycle.status === 'PLANNED') ??
              latestCycle ??
              null;

            return { groupId: group.idExternal, currentCycle };
          }),
          catchError(() =>
            of({ groupId: group.idExternal, currentCycle: null }),
          ),
        ),
      ),
    ).subscribe({
      next: (cycleResults) => {
        const cyclesByGroup = new Map(
          cycleResults.map((result) => [result.groupId, result.currentCycle]),
        );

        this.groups = this.groups.map((group) => ({
          ...group,
          currentCycle: cyclesByGroup.get(group.idExternal) ?? null,
        }));
        this.changeDetector.markForCheck();
      },
    });
  }

  get filteredGroups(): ReadingGroupListItem[] {
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

  get paginatedGroups(): ReadingGroupListItem[] {
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
