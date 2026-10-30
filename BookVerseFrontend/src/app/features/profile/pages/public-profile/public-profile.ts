import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EMPTY,
  Subject,
  Subscription,
  catchError,
  combineLatest,
  startWith,
  switchMap,
} from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { GroupMembersService } from '../../../groups/services/group-members.service';
import { ReadingGroupsService } from '../../../groups/services/reading-groups.service';
import { ReadingGroup } from '../../../groups/models/reading-group.model';
import { UserProfile, UserProfileStory } from '../../models/user-profile.model';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-public-profile',
  imports: [RouterLink, FormsModule],
  templateUrl: './public-profile.html',
  styleUrl: '../../community.css',
})
export class PublicProfile implements OnInit {
  private readonly users = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly groupsService = inject(ReadingGroupsService);
  private readonly membersService = inject(GroupMembersService);
  private readonly destroyRef = inject(DestroyRef);
  private storyRequest?: Subscription;
  private groupRequest?: Subscription;
  private readonly reload = new Subject<void>();

  readonly profile = signal<UserProfile | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly stories = signal<UserProfileStory[]>([]);
  readonly storiesLoading = signal(false);
  readonly storiesError = signal('');
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly groups = signal<ReadingGroup[]>([]);
  readonly showGroupPicker = signal(false);
  readonly groupsLoading = signal(false);
  readonly groupsError = signal('');
  readonly adding = signal(false);
  readonly groupMessage = signal('');
  readonly isOwnProfile = computed(
    () => this.profile()?.idExternal === localStorage.getItem('userId'),
  );
  selectedGroupId = '';

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.reload.pipe(startWith(undefined))])
      .pipe(
        switchMap(([params]) => {
          this.storyRequest?.unsubscribe();
          this.groupRequest?.unsubscribe();
          this.profile.set(null);
          this.loading.set(true);
          this.error.set('');
          this.stories.set([]);
          this.groups.set([]);
          this.groupsLoading.set(false);
          this.groupsError.set('');
          this.showGroupPicker.set(false);
          this.groupMessage.set('');
          this.selectedGroupId = '';
          return this.users.getProfile(params.get('id') ?? '').pipe(
            catchError((error: HttpErrorResponse) => {
              this.error.set(
                error.status === 404
                  ? 'Este perfil no está disponible.'
                  : 'No pudimos cargar el perfil. Intentá de nuevo.',
              );
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((user) => {
        this.profile.set(user);
        this.loading.set(false);
        this.loadStories(0);
      });
  }

  retry(): void {
    this.reload.next();
  }

  loadStories(page: number): void {
    const user = this.profile();
    if (!user) return;
    this.storyRequest?.unsubscribe();
    this.page.set(page);
    this.storiesLoading.set(true);
    this.storiesError.set('');
    this.storyRequest = this.users
      .getProfileStories(user.idExternal, page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.stories.set(result.content);
          this.page.set(result.number);
          this.totalPages.set(result.totalPages);
          this.storiesLoading.set(false);
        },
        error: () => {
          this.storiesError.set('No pudimos cargar las historias.');
          this.storiesLoading.set(false);
        },
      });
  }

  openGroupPicker(): void {
    const userId = localStorage.getItem('userId');
    if (!userId || this.isOwnProfile() || this.groupsLoading() || this.adding()) return;
    this.showGroupPicker.set(true);
    this.groupsLoading.set(true);
    this.groupsError.set('');
    this.groupMessage.set('');
    this.groupRequest?.unsubscribe();
    this.groupRequest = this.groupsService
      .getCreatedByUser(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups) => {
          this.groups.set(
            groups.filter((group) => group.isActive && group.createdByUserId === userId),
          );
          this.groupsLoading.set(false);
        },
        error: () => {
          this.groupsError.set('No pudimos cargar tus grupos.');
          this.groupsLoading.set(false);
        },
      });
  }

  addToGroup(): void {
    const user = this.profile();
    const group = this.groups().find((item) => item.idExternal === this.selectedGroupId);
    if (!user || !group || this.adding() || this.isOwnProfile()) return;
    this.adding.set(true);
    this.groupsError.set('');
    this.membersService
      .addMember(group.idExternal, { userId: user.idExternal })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.adding.set(false);
          if (this.profile()?.idExternal !== user.idExternal) return;
          this.showGroupPicker.set(false);
          this.groupMessage.set(`Agregaste a @${user.username} a ${group.name}.`);
          this.selectedGroupId = '';
        },
        error: (error: HttpErrorResponse) => {
          this.adding.set(false);
          if (this.profile()?.idExternal !== user.idExternal) return;
          this.groupsError.set(
            error.status === 409
              ? 'Este usuario ya pertenece al grupo.'
              : error.status === 403
                ? 'No se puede agregar a este usuario al grupo.'
                : 'No pudimos agregar al usuario. Intentá de nuevo.',
          );
        },
      });
  }
}
