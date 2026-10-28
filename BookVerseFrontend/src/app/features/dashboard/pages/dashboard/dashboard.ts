import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { Book } from '../../../books/models/book.model';
import { BooksService } from '../../../books/services/books.service';
import { GroupGoal } from '../../../groups/models/group-goal.model';
import { GroupGoalsService } from '../../../groups/services/group-goals.service';
import { GroupProgress } from '../../../groups/models/group-progress.model';
import { GroupProgressService } from '../../../groups/services/group-progress.service';
import { ReadingGroup } from '../../../groups/models/reading-group.model';
import { GroupMembersService } from '../../../groups/services/group-members.service';
import { ReadingGroupsService } from '../../../groups/services/reading-groups.service';
import { UserService } from '../../../profile/services/user.service';
import { StoryDetailResponse } from '../../../stories/models/story-detail-response';
import { StoryService } from '../../../stories/services/story.services';

@Component({
  imports: [DatePipe, DecimalPipe, RouterLink],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private readonly userService = inject(UserService);
  private readonly groupMembersService = inject(GroupMembersService);
  private readonly readingGroupsService = inject(ReadingGroupsService);
  private readonly booksService = inject(BooksService);
  private readonly groupGoalsService = inject(GroupGoalsService);
  private readonly groupProgressService = inject(GroupProgressService);
  private readonly storyService = inject(StoryService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  groups: ReadingGroup[] = [];
  isLoadingGroups = true;
  groupsError = '';
  groupBook: Book | null = null;
  groupStory: StoryDetailResponse | null = null;
  activeGoal: GroupGoal | null = null;
  groupProgress: GroupProgress | null = null;
  isLoadingGroupData = false;

  get featuredGroup(): ReadingGroup | null {
    return this.groups[0] ?? null;
  }

  get groupCount(): number {
    return this.groups.length;
  }

  get goalCompletionPercent(): number {
    const progress = this.groupProgress;

    if (!progress) {
      return 0;
    }

    if (progress.achieved) {
      return 100;
    }

    if (progress.targetProgress <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(
        0,
        (progress.currentProgress / progress.targetProgress) * 100,
      ),
    );
  }

  ngOnInit(): void {
    this.loadUserGroups();
  }

  get userName(): string {
    return this.userService.currentUser()?.username ?? 'lector';
  }

  get fullName(): string {
    return this.userService.currentUser()?.username ?? 'Usuario';
  }

  get initials(): string {
    return this.getInitials(this.userService.currentUser()?.username);
  }

  private getInitials(name?: string): string {
    const value = name?.trim();
    return value ? value.slice(0, 2).toUpperCase() : 'BV';
  }

  logout(): void {
    this.userService.logout();
  }

  private loadUserGroups(): void {
    const userId =
      this.userService.currentUser()?.idExternal ??
      localStorage.getItem('userId');

    if (!userId) {
      this.isLoadingGroups = false;
      this.groupsError = 'No se encontró el usuario de la sesión.';
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
            (group): group is ReadingGroup =>
              group !== null && group.isActive,
          ),
        ),
      )
      .subscribe({
        next: (groups) => {
          this.groups = groups;
          this.isLoadingGroups = false;

          if (this.featuredGroup) {
            this.loadFeaturedGroupData(this.featuredGroup);
          }

          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error al cargar los grupos del usuario:', error);
          this.groupsError = 'No se pudieron cargar tus grupos de lectura.';
          this.isLoadingGroups = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private loadFeaturedGroupData(group: ReadingGroup): void {
    this.isLoadingGroupData = true;

    const bookRequest = group.bookId
      ? this.booksService.getById(group.bookId).pipe(catchError(() => of(null)))
      : of(null);

    const storyRequest = group.storyId
      ? this.storyService
          .getById(group.storyId)
          .pipe(catchError(() => of(null)))
      : of(null);

    const goalRequest = this.groupGoalsService
      .getActiveByGroup(group.idExternal)
      .pipe(catchError(() => of(null)));

    forkJoin({
      book: bookRequest,
      story: storyRequest,
      goal: goalRequest,
    })
      .pipe(
        switchMap(({ book, story, goal }) => {
          if (!goal) {
            return of({ book, story, goal: null, progress: null });
          }

          return this.groupProgressService
            .getByGroup(group.idExternal)
            .pipe(
              map((progress) => ({ book, story, goal, progress })),
              catchError(() => of({ book, story, goal, progress: null })),
            );
        }),
      )
      .subscribe(({ book, story, goal, progress }) => {
        this.groupBook = book;
        this.groupStory = story;
        this.activeGoal = goal;
        this.groupProgress = progress;
        this.isLoadingGroupData = false;
        this.changeDetector.markForCheck();
      });
  }
}
