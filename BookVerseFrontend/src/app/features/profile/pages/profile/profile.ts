import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  EMPTY,
  Subject,
  Subscription,
  catchError,
  combineLatest,
  expand,
  forkJoin,
  map,
  of,
  startWith,
  switchMap,
  toArray,
} from 'rxjs';
import { GroupMember } from '../../../groups/models/group-member.model';
import { GroupMembersService } from '../../../groups/services/group-members.service';
import { ReadingGroupsService } from '../../../groups/services/reading-groups.service';
import { ReadingGroup } from '../../../groups/models/reading-group.model';
import { FavoriteStories } from '../../components/favorite-stories/favorite-stories';
import {
  AccountDeactivationRequest,
  AccountStoryAction,
} from '../../models/user.model';
import { UserProfile } from '../../models/user-profile.model';
import { PROFILE_COVERS } from '../../models/profile-covers';
import { PROFILE_AVATARS, profileAvatar } from '../../models/profile-avatars';
import { StoryResponse } from '../../../stories/models/story-response';
import { StoryService } from '../../../stories/services/story.services';
import { UserService } from '../../services/user.service';
import { SendTip } from '../../../tips/components/send-tip/send-tip';
import { ProfileBadge } from '../../components/profile-badge/profile-badge';

interface CreatorTransferOption {
  groupId: string;
  groupName: string;
  candidates: GroupMember[];
  selectedUsername: string;
  searchText: string;
  lookupFailed: boolean;
}

@Component({
  imports: [UserAvatar, RouterLink, FormsModule, FavoriteStories, SendTip, ProfileBadge],
  selector: 'app-profile',
  styleUrls: [
    './profile.css',
    './profile-settings.css',
    './profile-social.css',
  ],
  templateUrl: './profile.html',
})
export class Profile implements OnInit {
  readonly userService = inject(UserService);
  private readonly users = this.userService;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly groupsService = inject(ReadingGroupsService);
  private readonly membersService = inject(GroupMembersService);
  private readonly storyService = inject(StoryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  private activityRequest?: Subscription;
  private appearanceRequest?: Subscription;
  private groupRequest?: Subscription;
  private savedCoverIndex = 0;
  private savedAvatarIndex: number | null = null;
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
  readonly editingUsername = signal(false);
  readonly savingUsername = signal(false);
  readonly usernameError = signal('');
  readonly settingsMenuOpen = signal(false);
  readonly settingsMode = signal<'username' | 'username-updated'>('username');
  readonly usernameMessage = signal('');
  usernameDraft = '';
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
  readonly showDeactivationDialog = signal(false);
  readonly preparingDeactivation = signal(false);
  readonly deactivatingAccount = signal(false);
  readonly deactivationError = signal('');
  readonly storyAction = signal<AccountStoryAction>('KEEP');
  readonly activeGroupMemberships = signal<GroupMember[]>([]);
  readonly creatorTransferOptions = signal<CreatorTransferOption[]>([]);
  readonly ownStories = signal<StoryResponse[]>([]);
  readonly loadingOwnStories = signal(false);
  readonly ownStoriesError = signal('');
  readonly openCreatorListGroupId = signal<string | null>(null);
  private pendingDeactivationRequest: AccountDeactivationRequest | null = null;
  selectedGroupId = '';
  readonly covers = PROFILE_COVERS;
  readonly avatars = PROFILE_AVATARS;
  selectedCoverIndex = 0;
  selectedAvatarIndex: number | null = null;
  @ViewChild('coverPicker') coverPicker?: ElementRef<HTMLDialogElement>;
  @ViewChild('avatarPicker') avatarPicker?: ElementRef<HTMLDialogElement>;
  @ViewChild('settingsDialog')
  settingsDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('deactivationDialog')
  deactivationDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('finalConfirmationDialog')
  finalConfirmationDialog?: ElementRef<HTMLDialogElement>;

  get profile() {
    const ownUser = this.canEditProfile() ? this.users.currentUser() : null;
    const username = this.viewedUser()?.username?.trim() || 'Usuario';
    return {
      name: username,
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
    return profileAvatar(this.selectedAvatarIndex);
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
          this.selectedCoverIndex = this.savedCoverIndex = 0;
          this.selectedAvatarIndex = this.savedAvatarIndex = null;
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

  openSettings(): void {
    if (!this.canEditProfile()) return;

    this.settingsMenuOpen.update((isOpen) => !isOpen);
  }

  filteredCreatorCandidates(transfer: CreatorTransferOption): GroupMember[] {
    const query = transfer.searchText.trim().toLocaleLowerCase();

    return transfer.candidates.filter((candidate) =>
      candidate.userName.toLocaleLowerCase().includes(query),
    );
  }

  selectedCreator(transfer: CreatorTransferOption): GroupMember | undefined {
    return (
      transfer.candidates.find(
        (candidate) => candidate.userName === transfer.selectedUsername,
      ) ?? transfer.candidates[0]
    );
  }

  openCreatorCandidates(groupId: string): void {
    this.openCreatorListGroupId.set(groupId);
  }

  closeCreatorCandidates(): void {
    this.openCreatorListGroupId.set(null);
  }

  selectCreator(transfer: CreatorTransferOption, username: string): void {
    transfer.selectedUsername = username;
    transfer.searchText = '';
    this.closeCreatorCandidates();
  }

  openDeactivationDialog(): void {
    const userId = localStorage.getItem('userId');

    if (!userId || !this.canEditProfile() || this.preparingDeactivation()) return;

    this.showDeactivationDialog.set(true);
    this.deactivationDialog?.nativeElement.showModal();
    this.preparingDeactivation.set(true);
    this.deactivationError.set('');
    this.storyAction.set('KEEP');
    this.activeGroupMemberships.set([]);
    this.creatorTransferOptions.set([]);
    this.ownStories.set([]);
    this.loadingOwnStories.set(true);
    this.ownStoriesError.set('');

    this.storyService
      .getByAuthor(userId)
      .pipe(
        expand((page) =>
          page.last
            ? EMPTY
            : this.storyService.getByAuthor(userId, page.number + 1),
        ),
        toArray(),
        map((pages) => pages.flatMap((page) => page.content)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (stories) => {
          this.ownStories.set(stories);
          this.loadingOwnStories.set(false);
        },
        error: () => {
          this.loadingOwnStories.set(false);
          this.ownStoriesError.set('No pudimos cargar tus historias.');
        },
      });

    this.membersService
      .getActiveByUser(userId)
      .pipe(
        switchMap((memberships) => {
          this.activeGroupMemberships.set(memberships);

          const createdGroups = memberships.filter(
            (membership) =>
              membership.memberType === 'CREATOR' &&
              membership.status === 'ACTIVE',
          );

          if (createdGroups.length === 0) {
            return of([] as CreatorTransferOption[]);
          }

          return forkJoin(
            createdGroups.map((membership) =>
              this.membersService.getActiveByGroup(membership.groupId).pipe(
                map((members) => {
                  const candidates = members
                    .filter(
                      (member) =>
                        member.userId !== userId &&
                        member.status === 'ACTIVE',
                    )
                    .sort(
                      (a, b) =>
                        Date.parse(a.joinedAt) - Date.parse(b.joinedAt),
                    );

                  return {
                    groupId: membership.groupId,
                    groupName: membership.groupName,
                    candidates,
                    selectedUsername: candidates[0]?.userName ?? '',
                    searchText: '',
                    lookupFailed: false,
                  };
                }),
                catchError(() =>
                  of({
                    groupId: membership.groupId,
                    groupName: membership.groupName,
                    candidates: [],
                    selectedUsername: '',
                    searchText: '',
                    lookupFailed: true,
                  }),
                ),
              ),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (options) => {
          this.creatorTransferOptions.set(options);
          this.preparingDeactivation.set(false);
        },
        error: () => {
          this.preparingDeactivation.set(false);
          this.deactivationError.set(
            'No pudimos cargar tus grupos. Intentá de nuevo.',
          );
        },
      });
  }

  closeDeactivationDialog(): void {
    if (this.deactivatingAccount()) return;

    this.deactivationDialog?.nativeElement.close();
    this.showDeactivationDialog.set(false);
  }

  returnToDeactivationReview(): void {
    if (this.deactivatingAccount()) return;

    this.deactivationError.set('');
    this.finalConfirmationDialog?.nativeElement.close();
    this.showDeactivationDialog.set(true);
    this.deactivationDialog?.nativeElement.showModal();
  }

  cancelFinalDeactivation(): void {
    if (this.deactivatingAccount()) return;

    this.pendingDeactivationRequest = null;
    this.deactivationError.set('');
    this.finalConfirmationDialog?.nativeElement.close();
  }

  continueToDeactivationConfirmation(): void {
    if (
      this.preparingDeactivation() ||
      this.loadingOwnStories() ||
      this.ownStoriesError() ||
      this.deactivationError()
    ) {
      return;
    }

    const creatorReplacements: Record<string, string> = {};

    for (const transfer of this.creatorTransferOptions()) {
      if (transfer.lookupFailed || transfer.candidates.length === 0) {
        continue;
      }

      const selected =
        transfer.candidates.find(
          (candidate) => candidate.userName === transfer.selectedUsername,
        ) ?? transfer.candidates[0];

      creatorReplacements[transfer.groupId] = selected.userName;
    }

    this.pendingDeactivationRequest = {
      storyAction: this.storyAction(),
      creatorReplacements,
    };

    this.deactivationDialog?.nativeElement.close();
    this.showDeactivationDialog.set(false);
    this.finalConfirmationDialog?.nativeElement.showModal();
  }

  deactivateAccount(): void {
    const request = this.pendingDeactivationRequest;

    if (!request || this.deactivatingAccount()) return;

    this.deactivatingAccount.set(true);
    this.deactivationError.set('');

    this.users
      .deactivateOwnAccount(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deactivatingAccount.set(false);
          this.pendingDeactivationRequest = null;
          this.finalConfirmationDialog?.nativeElement.close();
          this.users.logout();
          void this.router.navigateByUrl('/login');
        },
        error: (error: HttpErrorResponse) => {
          this.deactivatingAccount.set(false);

          this.deactivationError.set(
            error.status === 403
              ? 'Esta cuenta no puede desactivarse.'
              : error.status === 400
                ? 'No se pudo completar la baja. Revisá las decisiones de historias y grupos.'
                : 'No pudimos desactivar tu cuenta. Intentá de nuevo.',
          );
        },
      });
  }

  closeSettings(): void {
    if (this.savingUsername()) return;

    this.settingsDialog?.nativeElement.close();
  }

  startUsernameEdit(): void {
    if (!this.canEditProfile()) return;

    this.settingsMenuOpen.set(false);
    this.usernameDraft = this.viewedUser()?.username ?? '';
    this.usernameError.set('');
    this.usernameMessage.set('');
    this.settingsMode.set('username');
    this.editingUsername.set(true);
    this.settingsDialog?.nativeElement.showModal();
  }

  cancelUsernameChange(): void {
    if (this.savingUsername()) return;

    this.usernameError.set('');
    this.settingsDialog?.nativeElement.close();
  }

  returnToSettingsMenu(): void {
    this.cancelUsernameChange();
  }

  saveUsername(): void {
    const profile = this.viewedUser();
    const username = this.usernameDraft.trim();

    if (!profile || !this.canEditProfile() || this.savingUsername()) return;

    if (!username) {
      this.usernameError.set('Ingresá un nombre de usuario.');
      return;
    }

    if (username === profile.username) {
      this.usernameError.set('El nombre de usuario no cambió.');
      return;
    }

    if (username.length < 3 || username.length > 15) {
      this.usernameError.set(
        'El nombre de usuario debe tener entre 3 y 15 caracteres.',
      );
      return;
    }

    this.savingUsername.set(true);
    this.usernameError.set('');

    this.users
      .loadCurrentUser()
      .pipe(
        switchMap((currentUser) => {
          if (!currentUser || currentUser.idExternal !== profile.idExternal) {
            this.usernameError.set('No pudimos cargar tus datos. Intentá de nuevo.');
            this.savingUsername.set(false);
            return EMPTY;
          }

          return this.users.updateUser(currentUser.idExternal, {
            username,
            email: currentUser.email,
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updatedUser) => {
          this.users.setCurrentUser(updatedUser);
          this.viewedUser.update((current) =>
            current ? { ...current, username: updatedUser.username } : current,
          );
          this.savingUsername.set(false);
          this.usernameError.set('');
          this.usernameMessage.set('Tu nombre de usuario se actualizó correctamente.');
          this.settingsMode.set('username-updated');
          this.editingUsername.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.savingUsername.set(false);

          this.usernameError.set(
            error.status === 409
              ? 'Ese nombre de usuario ya existe. Elegí otro.'
              : 'No pudimos cambiar el nombre de usuario. Intentá de nuevo.',
          );
          this.settingsMode.set('username');
          this.editingUsername.set(true);
        },
      });
  }

  requestUsernameChange(): void {
    this.saveUsername();
  }

  confirmUsernameChange(): void {
    this.saveUsername();
  }

  // Compatibilidad temporal con la plantilla inline anterior.
  cancelUsernameEdit(): void {
    this.returnToSettingsMenu();
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
  loadAppearance(refresh = false): void {
    const user = this.viewedUser();
    if (!user) return;
    this.appearanceRequest?.unsubscribe();
    this.coverError.set('');
    this.appearanceLoading.set(true);
    this.selectedAvatarIndex = this.savedAvatarIndex = null;
    this.appearanceRequest = this.users
      .getProfileAppearance(user.idExternal, refresh)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (appearance) => {
          this.appearanceLoading.set(false);
          this.selectedAvatarIndex = this.savedAvatarIndex =
            appearance.configured && profileAvatar(appearance.avatarIndex)
              ? appearance.avatarIndex
              : null;
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
          this.selectedAvatarIndex = this.savedAvatarIndex =
            appearance.configured && profileAvatar(appearance.avatarIndex)
              ? appearance.avatarIndex
              : null;
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
    this.avatarPicker?.nativeElement.close();
  }

  selectAvatar(index: number): void {
    if (!this.canEditProfile() || this.savingAvatar() || index < 0 || index >= this.avatars.length)
      return;
    this.selectedAvatarIndex = index;
  }

  saveAvatar(): void {
    const user = this.viewedUser();
    const avatarIndex = this.selectedAvatarIndex;
    if (
      !user ||
      avatarIndex === null ||
      !profileAvatar(avatarIndex) ||
      !this.canEditProfile() ||
      this.savingAvatar() ||
      this.savingCover()
    )
      return;
    this.savingAvatar.set(true);
    this.avatarError.set('');
    this.users
      .updateProfileAvatar(avatarIndex)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (appearance) => {
          this.savingAvatar.set(false);
          if (this.viewedUser()?.idExternal !== user.idExternal) return;
          this.selectedAvatarIndex = this.savedAvatarIndex =
            appearance.configured && profileAvatar(appearance.avatarIndex)
              ? appearance.avatarIndex
              : null;
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
      .invite(group.idExternal, user.idExternal)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.adding.set(false);
          if (this.viewedUser()?.idExternal !== user.idExternal) return;
          this.showGroupPicker.set(false);
          this.groupMessage.set(`Invitaste a @${user.username} a ${group.name}.`);
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
