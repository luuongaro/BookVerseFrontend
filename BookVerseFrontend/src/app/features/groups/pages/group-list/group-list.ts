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

  groups: ReadingGroup[] = [];
  searchTerm = '';
  isLoading = true;
  errorMessage = '';

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
}