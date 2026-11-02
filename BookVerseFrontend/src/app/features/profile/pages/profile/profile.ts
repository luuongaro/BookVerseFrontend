import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  EMPTY,
  Subject,
  Subscription,
  catchError,
  combineLatest,
  startWith,
  switchMap,
} from 'rxjs';
import { GroupMembersService } from '../../../groups/services/group-members.service';
import { ReadingGroupsService } from '../../../groups/services/reading-groups.service';
import { ReadingGroup } from '../../../groups/models/reading-group.model';
import { FavoriteStories } from '../../components/favorite-stories/favorite-stories';
import { UserProfile } from '../../models/user-profile.model';
import { PROFILE_COVERS } from '../../models/profile-covers';
import { PROFILE_AVATARS } from '../../models/profile-avatars';
import { UserService } from '../../services/user.service';
import { SendTip } from '../../../tips/components/send-tip/send-tip';

@Component({
  imports: [RouterLink, FormsModule, FavoriteStories, SendTip],
  selector: 'app-profile',
  styleUrls: ['./profile.css', './profile-social.css'],
  templateUrl: './profile.html',
})
export class Profile implements OnInit {
  readonly userService = inject(UserService);
  private readonly users = this.userService;
  private readonly route = inject(ActivatedRoute);
  private readonly groupsService = inject(ReadingGroupsService);
  private readonly membersService = inject(GroupMembersService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  private activityRequest?: Subscription;
  private appearanceRequest?: Subscription;
  private groupRequest?: Subscription;
  private savedCoverIndex = 0;
  private savedAvatarIndex = 0;
  readonly viewedUser = signal<UserProfile | null>(null);
  readonly isPublicView = signal(false);
  readonly isOwnProfile = computed(
    () => this.viewedUser()?.idExternal === localStorage.getItem('userId'),
  );
  readonly canEditProfile = computed(() => this.isOwnProfile() && !this.isPublicView());
  readonly loading = signal(true);
  readonly error = signal('');
  readonly activityError = signal('');
  readonly coverError = signal('');
  readonly savingCover = signal(false);
  readonly appearanceLoading = signal(true);
  readonly savingAvatar = signal(false);
  readonly avatarError = signal('');
  readonly avatarImageFailed = signal(false);
  readonly readingCounts = signal({ wantToRead: '…', inProgress: '…', finished: '…' });
  readonly createdStoriesCount = signal('…');
  readonly activeGroupsCount = signal('…');
  readonly tipStoryId = signal<string | null>(null);
  readonly canSendTip = computed(() => !this.isOwnProfile() && !!this.tipStoryId());
  readonly groups = signal<ReadingGroup[]>([]);
  readonly showGroupPicker = signal(false);
  readonly groupsLoading = signal(false);
  readonly groupsError = signal('');
  readonly adding = signal(false);
  readonly groupMessage = signal('');
  selectedGroupId = '';
  readonly covers = PROFILE_COVERS;
  readonly avatars = PROFILE_AVATARS;
  selectedCoverIndex = 0;
  selectedAvatarIndex = 0;
  @ViewChild('coverPicker') coverPicker?: ElementRef<HTMLDialogElement>;
  @ViewChild('avatarPicker') avatarPicker?: ElementRef<HTMLDialogElement>;

  get profile() {
    const ownUser = this.canEditProfile() ? this.users.currentUser() : null;
    const username = this.viewedUser()?.username?.trim() || 'Usuario';
    return {
      name: username,
      initials: username
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      username: `@${username}`,
      email: ownUser?.email ?? '',
      accountStatus: ownUser?.status === 'ACTIVE' ? 'ACTIVA' : 'INACTIVA',
    };
  }
  get roleLabel(): string {
    try {
      const token = localStorage.getItem('token');
      if (!token) return 'USUARIO';
      const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims: { roles?: string[] } = JSON.parse(
        atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')),
      );
      if (claims.roles?.includes('ROLE_ADMIN')) return 'ADMIN';
      if (claims.roles?.includes('ROLE_MODERATOR')) return 'MODERADOR';
    } catch {
      return 'USUARIO';
    }
    return 'USUARIO';
  }
  get currentCover() {
    return this.covers[this.selectedCoverIndex] ?? this.covers[0];
  }
  get currentAvatar() {
    return this.avatars[this.selectedAvatarIndex] ?? this.avatars[0];
  }
  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.reload.pipe(startWith(undefined))])
      .pipe(
        switchMap(([params]) => {
          this.activityRequest?.unsubscribe();
          this.appearanceRequest?.unsubscribe();
          this.groupRequest?.unsubscribe();
          this.viewedUser.set(null);
          this.isPublicView.set(params.has('id'));
          this.loading.set(true);
          this.error.set('');
          this.activityError.set('');
          this.coverError.set('');
          this.avatarError.set('');
          this.avatarImageFailed.set(false);
          this.selectedCoverIndex = this.savedCoverIndex = 0;
          this.selectedAvatarIndex = this.savedAvatarIndex = 0;
          this.readingCounts.set({ wantToRead: '…', inProgress: '…', finished: '…' });
          this.createdStoriesCount.set('…');
          this.activeGroupsCount.set('…');
          this.tipStoryId.set(null);
          this.groups.set([]);
          this.groupsLoading.set(false);
          this.groupsError.set('');
          this.showGroupPicker.set(false);
          this.groupMessage.set('');
          this.selectedGroupId = '';
          const id = params.get('id') ?? localStorage.getItem('userId');
          if (!id) {
            this.loading.set(false);
            this.error.set('Volvé a iniciar sesión para ver tu perfil.');
            return EMPTY;
          }
          if (!this.isPublicView())
            this.users
              .loadCurrentUser()
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({ error: () => undefined });
          return this.users.getProfile(id).pipe(
            catchError((error: HttpErrorResponse) => {
              this.loading.set(false);
              this.error.set(
                error.status === 404 || error.status === 400
                  ? 'Este perfil no está disponible.'
                  : 'No pudimos cargar el perfil. Intentá de nuevo.',
              );
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((user) => {
        this.viewedUser.set(user);
        this.loading.set(false);
        this.loadActivity();
        this.loadAppearance();
      });
  }
  retry(): void {
    this.reload.next();
  }
  loadActivity(): void {
    const user = this.viewedUser();
    if (!user) return;
    this.activityRequest?.unsubscribe();
    this.activityError.set('');
    this.activityRequest = this.users
      .getProfileActivity(user.idExternal)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (activity) => {
          this.readingCounts.set({
            wantToRead: String(activity.wantToRead),
            inProgress: String(activity.inProgress),
            finished: String(activity.finished),
          });
          this.createdStoriesCount.set(String(activity.createdStories));
          this.activeGroupsCount.set(String(activity.activeGroups));
          this.tipStoryId.set(activity.tipStoryId ?? null);
        },
        error: () => {
          this.readingCounts.set({ wantToRead: '—', inProgress: '—', finished: '—' });
          this.createdStoriesCount.set('—');
          this.activeGroupsCount.set('—');
          this.tipStoryId.set(null);
          this.activityError.set('No pudimos cargar la actividad.');
        },
      });
  }
  loadAppearance(): void {
    const user = this.viewedUser();
    if (!user) return;
    this.appearanceRequest?.unsubscribe();
    this.coverError.set('');
    this.appearanceLoading.set(true);
    this.appearanceRequest = this.users
      .getProfileAppearance(user.idExternal)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (appearance) => {
          this.appearanceLoading.set(false);
          this.selectedAvatarIndex = this.savedAvatarIndex = appearance.avatarIndex ?? 0;
          this.avatarImageFailed.set(false);
          const legacy = this.canEditProfile()
            ? localStorage.getItem(`profile-cover:${user.idExternal}`)
            : null;
          const index =
            !appearance.configured && legacy !== null ? Number(legacy) : appearance.coverIndex;
          this.selectedCoverIndex = this.savedCoverIndex =
            Number.isInteger(index) && index >= 0 && index < this.covers.length ? index : 0;
          if (!appearance.configured && legacy !== null) this.saveCover();
        },
        error: () => {
          this.appearanceLoading.set(false);
          this.coverError.set('No pudimos cargar la portada y el avatar.');
        },
      });
  }
  openCoverPicker(): void {
    if (
      !this.canEditProfile() ||
      this.appearanceLoading() ||
      this.savingCover() ||
      this.savingAvatar()
    )
      return;
    this.coverError.set('');
    this.coverPicker?.nativeElement.showModal();
  }
  closeCoverPicker(): void {
    if (this.savingCover()) return;
    this.selectedCoverIndex = this.savedCoverIndex;
    this.coverPicker?.nativeElement.close();
  }
  closeCoverPickerOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeCoverPicker();
  }
  cancelCoverPicker(event: Event): void {
    if (this.savingCover()) {
      event.preventDefault();
      return;
    }
    this.selectedCoverIndex = this.savedCoverIndex;
  }
  selectCover(index: number): void {
    if (this.canEditProfile() && !this.savingCover() && index >= 0 && index < this.covers.length)
      this.selectedCoverIndex = index;
  }
  saveCover(): void {
    const user = this.viewedUser();
    if (!user || !this.canEditProfile() || this.savingCover() || this.savingAvatar()) return;
    this.savingCover.set(true);
    this.coverError.set('');
    this.users
      .updateProfileAppearance(this.selectedCoverIndex)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (appearance) => {
          this.savingCover.set(false);
          if (this.viewedUser()?.idExternal !== user.idExternal) return;
          this.selectedCoverIndex = this.savedCoverIndex = appearance.coverIndex;
          localStorage.setItem(`profile-cover:${user.idExternal}`, String(appearance.coverIndex));
          this.coverPicker?.nativeElement.close();
        },
        error: () => {
          this.savingCover.set(false);
          if (this.viewedUser()?.idExternal === user.idExternal)
            this.coverError.set('No pudimos guardar la portada. Intentá de nuevo.');
        },
      });
  }
  logout(): void {
    this.users.logout();
  }

  openAvatarPicker(): void {
    if (
      !this.canEditProfile() ||
      this.appearanceLoading() ||
      this.savingAvatar() ||
      this.savingCover()
    )
      return;
    this.avatarError.set('');
    this.avatarPicker?.nativeElement.showModal();
  }

  closeAvatarPicker(event?: Event): void {
    if (this.savingAvatar()) {
      event?.preventDefault();
      return;
    }
    this.selectedAvatarIndex = this.savedAvatarIndex;
    this.avatarImageFailed.set(false);
    this.avatarPicker?.nativeElement.close();
  }

  selectAvatar(index: number): void {
    if (!this.canEditProfile() || this.savingAvatar() || index < 0 || index >= this.avatars.length)
      return;
    this.selectedAvatarIndex = index;
    this.avatarImageFailed.set(false);
  }

  saveAvatar(): void {
    const user = this.viewedUser();
    if (!user || !this.canEditProfile() || this.savingAvatar() || this.savingCover()) return;
    this.savingAvatar.set(true);
    this.avatarError.set('');
    this.users
      .updateProfileAvatar(this.selectedAvatarIndex)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (appearance) => {
          this.savingAvatar.set(false);
          if (this.viewedUser()?.idExternal !== user.idExternal) return;
          this.selectedAvatarIndex = this.savedAvatarIndex = appearance.avatarIndex;
          this.avatarImageFailed.set(false);
          this.avatarPicker?.nativeElement.close();
        },
        error: () => {
          this.savingAvatar.set(false);
          if (this.viewedUser()?.idExternal === user.idExternal)
            this.avatarError.set('No pudimos guardar el avatar. Intentá de nuevo.');
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
    const user = this.viewedUser();
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
          if (this.viewedUser()?.idExternal !== user.idExternal) return;
          this.showGroupPicker.set(false);
          this.groupMessage.set(`Agregaste a @${user.username} a ${group.name}.`);
          this.selectedGroupId = '';
        },
        error: (error: HttpErrorResponse) => {
          this.adding.set(false);
          if (this.viewedUser()?.idExternal !== user.idExternal) return;
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
