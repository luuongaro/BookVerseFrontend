import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnInit,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { Book } from '../../../books/models/book.model';
import { BooksService } from '../../../books/services/books.service';
import { ReadingStatus } from '../../../library/models/library-book.model';
import { LibraryService } from '../../../library/services/library.service';
import { GroupComment } from '../../models/group-comment.model';
import { GroupGoal } from '../../models/group-goal.model';
import { GroupMember } from '../../models/group-member.model';
import { GroupProgress } from '../../models/group-progress.model';
import { ReadingGroup } from '../../models/reading-group.model';

import { GroupCommentsService } from '../../services/group-comments.service';
import { GroupGoalsService } from '../../services/group-goals.service';
import { GroupMembersService } from '../../services/group-members.service';
import { GroupProgressService } from '../../services/group-progress.service';
import { ReadingGroupsService } from '../../services/reading-groups.service';
import { UserService } from '../../../profile/services/user.service';
import { UserSearch } from '../../../profile/components/user-search/user-search';
import { UserProfile } from '../../../profile/models/user-profile.model';
import { TokenService } from '../../../../core/services/token.service';

import { StoryDetailResponse } from '../../../stories/models/story-detail-response';
import { StoryService } from '../../../stories/services/story.services';

@Component({
  selector: 'app-group-detail',
  imports: [UserAvatar, DatePipe, DecimalPipe, FormsModule, RouterLink, UserSearch],
  styleUrls: ['./group-detail.css', './group-leave-dialog.css'],
  templateUrl: './group-detail.html',
})
export class GroupDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly readingGroupsService = inject(ReadingGroupsService);
  private readonly groupMembersService = inject(GroupMembersService);
  private readonly groupGoalsService = inject(GroupGoalsService);
  private readonly groupCommentsService = inject(GroupCommentsService);
  private readonly groupProgressService = inject(GroupProgressService);
  private readonly booksService = inject(BooksService);
  private readonly libraryService = inject(LibraryService);
  private readonly storyService = inject(StoryService);
  private readonly userService = inject(UserService);
  private readonly tokens = inject(TokenService);

  readonly leaveGroupDialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('leaveGroupDialog');
  readonly memberTrack =
    viewChild<ElementRef<HTMLDivElement>>('memberTrack');

  group: ReadingGroup | null = null;
  members: GroupMember[] = [];
  goals: GroupGoal[] = [];
  activeGoal: GroupGoal | null = null;
  progress: GroupProgress | null = null;
  comments: GroupComment[] = [];
  linkedBook: Book | null = null;
  linkedStory: StoryDetailResponse | null = null;
  isLoadingLinkedContent = false;
  isWorkInLibrary: boolean | null = null;
  isCheckingLibraryStatus = false;
  libraryStatusError = '';
  libraryReadingStatus: ReadingStatus | null = null;

  goalType: 'CHAPTER' | 'PERCENTAGE' = 'PERCENTAGE';
  targetProgress = 1;
  bookTotalChapters: number | null = null;
  targetDate = '';
  readonly minTargetDate = this.getTomorrowDate();
  targetDatePastError = false;
  commentContent = '';
  commentProgress = 0;
  selectedInviteUser: UserProfile | null = null;
  selectedLeaveCreator: GroupMember | null = null;
  leaveCreatorSearch = '';
  leaveCreatorListOpen = false;
  showInviteForm = false;

  isLoading = true;
  isLoadingMembers = true;
  isLoadingGoals = true;
  isLoadingComments = true;
  isSavingGoal = false;
  isSavingComment = false;
  isChangingGoal = false;
  isUpdatingMembers = false;

  errorMessage = '';
  membersErrorMessage = '';
  goalsErrorMessage = '';
  progressErrorMessage = '';
  commentsErrorMessage = '';
  linkedContentError = '';
  goalActionMessage = '';
  commentActionMessage = '';
  memberActionMessage = '';
  memberSuccessMessage = '';

  get currentUsername(): string {
    return this.userService.currentUser()?.username ?? 'Usuario';
  }

  get completedGoals(): GroupGoal[] {
    return this.goals.filter((goal) => goal.status === 'COMPLETED');
  }

  get canEditGroup(): boolean {
    const currentUserId =
      this.userService.currentUser()?.idExternal ??
      localStorage.getItem('userId');

    return (
      !!this.group &&
      (
        this.group.createdByUserId === currentUserId ||
        this.tokens.hasAnyRole('ROLE_ADMIN', 'ROLE_MODERATOR')
      )
    );
  }

  requestLeaveGroup(): void {
    if (!this.group || !this.canLeaveGroup || this.isUpdatingMembers) return;

    this.memberActionMessage = '';
    this.leaveCreatorSearch = '';
    this.leaveCreatorListOpen = false;

    if (this.isCurrentUserCreator) {
      this.selectedLeaveCreator = this.leaveCreatorCandidates[0] ?? null;
    } else {
      this.selectedLeaveCreator = null;
    }

    this.leaveGroupDialog().nativeElement.showModal();
  }

  cancelLeaveGroup(): void {
    if (this.isUpdatingMembers) return;

    this.memberActionMessage = '';
    this.selectedLeaveCreator = null;
    this.leaveCreatorSearch = '';
    this.leaveCreatorListOpen = false;
    this.leaveGroupDialog().nativeElement.close();
  }

  openLeaveCreatorCandidates(): void {
    this.leaveCreatorListOpen = true;
  }

  closeLeaveCreatorCandidates(): void {
    this.leaveCreatorListOpen = false;
  }

  get isCurrentUserCreator(): boolean {
    const currentUserId =
      this.userService.currentUser()?.idExternal ?? localStorage.getItem('userId');

    return this.members.some(
      (member) =>
        member.userId === currentUserId && member.memberType === 'CREATOR',
    );
  }

  get leaveCreatorCandidates(): GroupMember[] {
    const currentUserId =
      this.userService.currentUser()?.idExternal ?? localStorage.getItem('userId');

    return this.members
      .filter(
        (member) => member.userId !== currentUserId && member.status === 'ACTIVE',
      )
      .sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt));
  }

  get filteredLeaveCreatorCandidates(): GroupMember[] {
    const search = this.leaveCreatorSearch.trim().toLocaleLowerCase();

    return this.leaveCreatorCandidates.filter((member) =>
      member.userName.toLocaleLowerCase().includes(search),
    );
  }

  selectLeaveCreator(member: GroupMember): void {
    this.selectedLeaveCreator = member;
    this.leaveCreatorSearch = '';
    this.closeLeaveCreatorCandidates();
  }

  scrollMembers(direction: -1 | 1): void {
    const track = this.memberTrack()?.nativeElement;
    if (!track) return;

    track.scrollBy({
      left: direction * track.clientWidth * 0.8,
      behavior: 'smooth',
    });
  }

  memberProfileLink(userId: string): string[] {
    const currentUserId =
      this.userService.currentUser()?.idExternal ??
      localStorage.getItem('userId');

    return userId === currentUserId
      ? ['/profile']
      : ['/users', userId];
  }

  private getTomorrowDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  logout(): void {
    this.userService.logout();
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const groupId = params.get('id');

      if (!groupId) {
        this.errorMessage = 'No se encontró el identificador del grupo.';
        this.isLoading = false;
        return;
      }

      this.loadGroup(groupId);
      this.loadMembers(groupId);
      this.loadGoals(groupId);
    });
  }

  get isStoryGroup(): boolean {
    return !!this.group?.storyId;
  }

  get libraryProgressPercent(): number {
    const reading = this.libraryReadingStatus;

    if (!reading) {
      return 0;
    }

    if (reading.status === 'FINISHED') {
      return 100;
    }

    if (
      reading.progressType === 'PERCENTAGE' &&
      reading.progressValue !== null
    ) {
      return Math.min(100, Math.max(0, Math.floor(reading.progressValue)));
    }

    const currentChapter = reading.progressValue;
    const totalChapters = reading.progressTotal;

    if (
      reading.progressType === 'CHAPTER' &&
      currentChapter !== null &&
      totalChapters !== null &&
      totalChapters !== undefined &&
      totalChapters > 0
    ) {
      return Math.min(
        100,
        Math.max(
          0,
          Math.floor((currentChapter / totalChapters) * 100),
        ),
      );
    }

    return 0;
  }

  get isCommentProgressInvalid(): boolean {
    return (
      !Number.isInteger(this.commentProgress) ||
      this.commentProgress < 1 ||
      this.commentProgress > this.libraryProgressPercent
    );
  }

  get hasPercentageCommentProgress(): boolean {
    const reading = this.libraryReadingStatus;

    return (
      !this.isStoryGroup &&
      reading !== null &&
      reading.progressType === 'PERCENTAGE' &&
      reading.progressValue !== null &&
      reading.progressValue > 0
    );
  }

  get commentsEmptyStateMessage(): string {
    if (this.isCheckingLibraryStatus) {
      return 'Estamos comprobando el estado de lectura de este libro…';
    }

    if (this.libraryStatusError) {
      return 'No pudimos consultar tu estado de lectura. Revisá tu conexión e intentá recargar la página.';
    }

    if (!this.libraryReadingStatus) {
      return 'Este libro todavía no está guardado en tu biblioteca. Agregalo primero para registrar tu avance y participar de la conversación.';
    }

    if (this.libraryReadingStatus.progressType === 'CHAPTER') {
      return 'El libro está en tu biblioteca, pero tu avance está registrado por capítulos. Para participar de la conversación sin spoilers, cambiá el seguimiento a porcentaje y guardá cuánto leíste.';
    }

    if (
      this.libraryReadingStatus.progressType !== 'PERCENTAGE' ||
      this.libraryReadingStatus.progressValue === null ||
      this.libraryReadingStatus.progressValue <= 0
    ) {
      return 'El libro ya está en tu biblioteca, pero todavía no registraste cuánto leíste en porcentaje. Abrí Mi biblioteca, buscá este libro, elegí el seguimiento por porcentaje y guardá tu avance. Después, volvé al grupo para ver y publicar comentarios.';
    }

    if (this.libraryProgressPercent >= 100) {
      return 'Todavía no hay comentarios publicados para este grupo.';
    }

    return (
      `Todavía no hay comentarios visibles para tu avance actual (${this.libraryProgressPercent}%). ` +
      'Los comentarios ubicados más adelante se ocultan para evitar spoilers. ' +
      'También puede que todavía no se hayan publicado comentarios. Si ya avanzaste más, actualizá tu progreso en Mi biblioteca.'
    );
  }

  get canManageGoals(): boolean {
    return !!this.group?.isActive && (
      this.group.createdByUserId === localStorage.getItem('userId') ||
      this.tokens.hasAnyRole('ROLE_ADMIN', 'ROLE_MODERATOR')
    );
  }

  get canCreateGoal(): boolean {
    return (
      this.canManageGoals &&
      (!this.isStoryGroup || this.isCurrentUserCreator)
    );
  }

  get goalUnit(): string {
    return this.goalType === 'PERCENTAGE' ? '%' : 'capítulos';
  }

  get isTargetProgressInteger(): boolean {
    return Number.isInteger(this.targetProgress);
  }

  get maxChapterTarget(): number {
    if (this.isStoryGroup) {
      return this.linkedStory?.publishedChaptersCount ?? 0;
    }

    return this.bookTotalChapters ?? this.group?.totalChapters ?? 0;
  }

  get isChapterTargetInvalid(): boolean {
    if (this.goalType !== 'CHAPTER') {
      return false;
    }

    return (
      this.maxChapterTarget < 1 ||
      this.targetProgress > this.maxChapterTarget ||
      (this.isStoryGroup && this.isLoadingLinkedContent)
    );
  }

  get isPercentageTargetInvalid(): boolean {
    if (this.goalType !== 'PERCENTAGE') {
      return false;
    }

    const invalidRange =
      !Number.isInteger(this.targetProgress) ||
      this.targetProgress < 1 ||
      this.targetProgress > 100;

    const storyHasNoPublishedChapters =
      this.isStoryGroup &&
      (this.isLoadingLinkedContent ||
        !this.linkedStory ||
        this.linkedStory.publishedChaptersCount === 0);

    return invalidRange || storyHasNoPublishedChapters;
  }

  get activeGoalLabel(): string {
    if (!this.activeGoal) {
      return '';
    }

    if (this.activeGoal.goalType === 'PERCENTAGE') {
      return `Alcanzar ${this.activeGoal.targetProgress}% de progreso`;
    }

    const unit =
      this.activeGoal.targetProgress === 1 ? 'capítulo' : 'capítulos';

    return `Leer ${this.activeGoal.targetProgress} ${unit}`;
  }

  get goalCompletionPercent(): number {
    if (!this.activeGoal || !this.progress || this.activeGoal.targetProgress <= 0) {
      return 0;
    }

    return Math.min(
      100,
      (this.progress.currentProgress / this.activeGoal.targetProgress) * 100,
    );
  }

  get isCurrentUserActiveMember(): boolean {
    const currentUserId =
      this.userService.currentUser()?.idExternal ??
      localStorage.getItem('userId');

    return (
      !!currentUserId &&
      this.members.some((member) => member.userId === currentUserId)
    );
  }

  get canManageMembers(): boolean {
    return (
      !!this.group?.isActive &&
      (
        this.isCurrentUserActiveMember ||
        this.tokens.hasAnyRole('ROLE_ADMIN', 'ROLE_MODERATOR')
      )
    );
  }

  get canLeaveGroup(): boolean {
    return !!this.group?.isActive && this.isCurrentUserActiveMember;
  }

  get memberUserIds(): string[] {
    return this.members.map((member) => member.userId);
  }

  toggleInviteForm(): void {
    if (this.isUpdatingMembers) return;
    this.showInviteForm = !this.showInviteForm;
    this.selectedInviteUser = null;
    this.memberActionMessage = '';
    this.memberSuccessMessage = '';
  }

  onPercentageSliderChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.targetProgress = Number(input.value);
  }

  inviteMember(): void {
    const user = this.selectedInviteUser;
    if (!this.group || !this.canManageMembers || this.isUpdatingMembers || !user || this.memberUserIds.includes(user.idExternal)) {
      return;
    }

    this.memberActionMessage = '';
    this.memberSuccessMessage = '';
    this.isUpdatingMembers = true;

    this.groupMembersService
      .addMember(this.group.idExternal, {
        userId: user.idExternal,
      })
      .subscribe({
        next: () => {
          this.selectedInviteUser = null;
          this.showInviteForm = false;
          this.isUpdatingMembers = false;
          this.memberSuccessMessage = `Agregaste a @${user.username} al grupo.`;
          this.loadMembers(this.group!.idExternal);
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error inviting group member:', error);
          const status = (error as { status?: number })?.status;
          this.memberActionMessage = status === 409
            ? 'Este usuario ya pertenece al grupo.'
            : status === 403
              ? 'No se puede agregar a este usuario al grupo.'
              : 'No pudimos agregar al usuario. Intentá de nuevo.';
          this.isUpdatingMembers = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  leaveGroup(): void {
    if (!this.group || !this.canLeaveGroup || this.isUpdatingMembers) {
      return;
    }

    this.memberActionMessage = '';
    this.isUpdatingMembers = true;

    this.groupMembersService
      .leaveGroup(
        this.group.idExternal,
        this.isCurrentUserCreator
          ? { newCreatorUserId: this.selectedLeaveCreator?.userId ?? null }
          : undefined,
      )
      .subscribe({
        next: () => {
          this.isUpdatingMembers = false;
          this.leaveGroupDialog().nativeElement.close();
          void this.router.navigate(['/groups']);
        },
        error: (error: unknown) => {
          console.error('Error leaving reading group:', error);
          this.memberActionMessage =
            'No se pudo salir del grupo. Puede que tu membresía ya no esté activa.';
          this.isUpdatingMembers = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  createGoal(): void {
    this.targetDatePastError =
      !!this.targetDate && this.targetDate < this.minTargetDate;

    if (
      !this.group ||
      !this.canManageGoals ||
      this.isSavingGoal ||
      !this.targetDate ||
      this.targetDatePastError ||
      !Number.isInteger(this.targetProgress) ||
      this.targetProgress < 1 ||
      this.isChapterTargetInvalid ||
      this.isPercentageTargetInvalid
    ) {
      return;
    }

    this.isSavingGoal = true;
    this.goalActionMessage = '';

    this.groupGoalsService
      .create(this.group.idExternal, {
        groupId: this.group.idExternal,
        goalType: this.goalType,
        targetProgress: Number(this.targetProgress),
        targetDate: this.targetDate,
        totalChapters:
          !this.isStoryGroup && this.goalType === 'CHAPTER'
            ? this.bookTotalChapters
            : null,
      })
      .subscribe({
        next: (goal) => {
          this.activeGoal = goal;
          this.goals = [goal, ...this.goals];
          this.isSavingGoal = false;
          this.loadProgress(this.group!.idExternal);
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error creating group goal:', error);
          const status =
            error instanceof HttpErrorResponse ? error.status : undefined;

          const apiMessage =
            error instanceof HttpErrorResponse &&
            typeof error.error?.message === 'string'
              ? error.error.message
              : null;

          this.goalActionMessage =
            apiMessage ??
            (status === 409
              ? 'Este grupo ya tiene una meta activa.'
              : status === 403
                ? 'No tenés permisos para crear una meta en este grupo.'
                : 'No se pudo crear la meta. Revisá la consola para ver el error.');
          this.isSavingGoal = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  finishGoal(): void {
    if (!this.canManageGoals || !this.activeGoal || this.isChangingGoal) {
      return;
    }

    this.isChangingGoal = true;

    this.groupGoalsService
      .changeStatus(this.activeGoal.idExternal, { status: 'COMPLETED' })
      .subscribe({
        next: (goal) => this.onGoalStatusChanged(goal),
        error: (error: unknown) => this.onGoalActionError(error),
      });
  }

  cancelGoal(): void {
    if (!this.canManageGoals || !this.activeGoal || this.isChangingGoal) {
      return;
    }

    this.isChangingGoal = true;

    this.groupGoalsService.cancel(this.activeGoal.idExternal).subscribe({
      next: () => {
        this.activeGoal = null;
        this.progress = null;
        this.isChangingGoal = false;
        this.loadGoals(this.group!.idExternal);
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => this.onGoalActionError(error),
    });
  }

  onCommentProgressSliderInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.commentProgress = Number(input.value);
  }

  publishComment(): void {
    if (!this.group || !this.commentContent.trim() || this.isSavingComment) {
      return;
    }

    if (!this.hasPercentageCommentProgress) {
      this.commentActionMessage = this.commentsEmptyStateMessage;
      return;
    }

    if (this.isCheckingLibraryStatus || this.libraryStatusError) {
      this.commentActionMessage =
        'No pudimos comprobar tu avance en Mi biblioteca. Intentá nuevamente.';
      return;
    }

    if (this.isCommentProgressInvalid) {
      this.commentActionMessage =
        this.commentProgress < 1 || !Number.isInteger(this.commentProgress)
          ? `Elegí un porcentaje entero entre 1% y ${this.libraryProgressPercent}%, que es tu avance guardado en Mi biblioteca.`
          : `El porcentaje del comentario no puede superar el ${this.libraryProgressPercent}% que ya leíste.`;
      return;
    }

    this.isSavingComment = true;
    this.commentActionMessage = '';

    this.groupCommentsService
      .create(this.group.idExternal, {
        content: this.commentContent.trim(),
        progressPercent: Number(this.commentProgress),
      })
      .subscribe({
        next: (comment) => {
          this.comments = [
            { ...comment, userName: this.currentUsername },
            ...this.comments,
          ];
          this.commentContent = '';
          this.isSavingComment = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error creating group comment:', error);
          this.commentActionMessage =
            'No se pudo publicar. Verificá que el porcentaje no supere tu avance guardado y que sigas siendo miembro activo del grupo.';
          this.isSavingComment = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private loadGroup(groupId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.readingGroupsService.getById(groupId).subscribe({
      next: (group) => {
        this.group = group;
        this.goalType = group.storyId ? 'CHAPTER' : 'PERCENTAGE';
        this.checkLinkedWorkInLibrary(group);
        this.loadLinkedContent(group);

        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Error loading reading group:', error);
        this.errorMessage = 'No se pudo cargar el grupo de lectura.';
        this.isLoading = false;
        this.isLoadingComments = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadLinkedContent(group: ReadingGroup): void {
    this.linkedBook = null;
    this.linkedStory = null;
    this.linkedContentError = '';

    if (group.bookId) {
      this.isLoadingLinkedContent = true;

      this.booksService.getById(group.bookId).subscribe({
        next: (book) => {
          this.linkedBook = book;
          this.isLoadingLinkedContent = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error al cargar el libro del grupo:', error);
          this.linkedContentError = 'No se pudo cargar el libro del grupo.';
          this.isLoadingLinkedContent = false;
          this.changeDetector.markForCheck();
        },
      });

      return;
    }

    if (group.storyId) {
      this.isLoadingLinkedContent = true;

      this.storyService.getById(group.storyId).subscribe({
        next: (story) => {
          this.linkedStory = story;
          this.isLoadingLinkedContent = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error al cargar la historia del grupo:', error);
          this.linkedContentError = 'No se pudo cargar la historia del grupo.';
          this.isLoadingLinkedContent = false;
          this.changeDetector.markForCheck();
        },
      });

      return;
    }

    this.linkedContentError =
      'Este grupo no tiene un libro o una historia asociados.';
  }

  private checkLinkedWorkInLibrary(group: ReadingGroup): void {
    this.isWorkInLibrary = null;
    this.libraryReadingStatus = null;
    this.commentProgress = 0;
    this.libraryStatusError = '';
    this.commentsErrorMessage = '';
    this.comments = [];
    this.isCheckingLibraryStatus = true;
    this.isLoadingComments = !!group.bookId;

    const statusRequest = group.bookId
      ? this.libraryService.getBookStatus(group.bookId)
      : group.storyId
        ? this.libraryService.getStoryStatus(group.storyId)
        : null;

    if (!statusRequest) {
      this.isCheckingLibraryStatus = false;
      this.isLoadingComments = false;
      return;
    }

    statusRequest.subscribe({
      next: (readingStatus) => {
        this.libraryReadingStatus = readingStatus;
        this.isWorkInLibrary = readingStatus !== null;
        this.commentProgress = this.libraryProgressPercent;
        this.isCheckingLibraryStatus = false;

        if (group.bookId && this.hasPercentageCommentProgress) {
          this.loadComments(group.idExternal);
        } else {
          this.comments = [];
          this.commentsErrorMessage = '';
          this.isLoadingComments = false;
        }

        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        console.error('No se pudo verificar la biblioteca del usuario:', error);
        this.libraryReadingStatus = null;
        this.commentProgress = 0;
        this.libraryStatusError =
          'No se pudo comprobar el estado de lectura en Mi biblioteca.';
        this.isCheckingLibraryStatus = false;
        this.comments = [];
        this.commentsErrorMessage = '';
        this.isLoadingComments = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadMembers(groupId: string): void {
    this.isLoadingMembers = true;
    this.membersErrorMessage = '';

    this.groupMembersService.getActiveByGroup(groupId).subscribe({
      next: (members) => {
        this.members = [...members].sort((a, b) => {
          const creatorDifference =
            Number(b.memberType === 'CREATOR') - Number(a.memberType === 'CREATOR');

          if (creatorDifference !== 0) {
            return creatorDifference;
          }

          return a.userName.localeCompare(b.userName, 'es', {
            sensitivity: 'base',
          });
        });
        this.isLoadingMembers = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Error loading group members:', error);
        this.membersErrorMessage = 'No se pudieron cargar los miembros.';
        this.isLoadingMembers = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadGoals(groupId: string): void {
    this.isLoadingGoals = true;
    this.goalsErrorMessage = '';

    this.groupGoalsService.getByGroup(groupId).subscribe({
      next: (goals) => {
        this.goals = goals;
        this.activeGoal =
          goals.find((goal) => goal.status === 'ACTIVE') ?? null;
        this.isLoadingGoals = false;

        if (this.activeGoal) {
          this.loadProgress(groupId);
        }

        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Error loading group goals:', error);
        this.goalsErrorMessage = 'No se pudieron cargar las metas del grupo.';
        this.isLoadingGoals = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadProgress(groupId: string): void {
    this.progressErrorMessage = '';

    this.groupProgressService.getByGroup(groupId).subscribe({
      next: (progress) => {
        this.progress = progress;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Error loading group progress:', error);
        this.progressErrorMessage = 'No se pudo calcular el progreso grupal.';
        this.changeDetector.markForCheck();
      },
    });
  }

  private commentLoadErrorMessage(error: unknown): string {
    if (this.isStoryGroup) {
      return 'Los comentarios todavía están disponibles solo para grupos de libros.';
    }

    if (!(error instanceof HttpErrorResponse)) {
      return 'Ocurrió un problema al cargar los comentarios. Intentá nuevamente.';
    }

    const apiMessage =
      typeof error.error?.message === 'string'
        ? error.error.message.toLowerCase()
        : '';

    if (error.status === 404 && apiMessage.includes('reading status')) {
      return 'Este libro no está guardado en tu biblioteca. Agregalo y registrá tu progreso para acceder a los comentarios.';
    }

    if (
      error.status === 400 &&
      apiMessage.includes('percentage-based reading status')
    ) {
      return 'Tu estado de lectura no tiene un porcentaje. Elegí el seguimiento por porcentaje en Mi biblioteca para ver y publicar comentarios sin spoilers.';
    }

    if (error.status === 403) {
      return 'Necesitás ser miembro activo de este grupo para ver sus comentarios.';
    }

    if (error.status === 401) {
      return 'Tu sesión venció. Iniciá sesión nuevamente para ver los comentarios.';
    }

    if (error.status === 0) {
      return 'No pudimos conectar con el servidor para cargar los comentarios. Revisá tu conexión e intentá nuevamente.';
    }

    return 'No se pudieron cargar los comentarios. Intentá nuevamente en unos momentos.';
  }

  private loadComments(groupId: string): void {
    this.isLoadingComments = true;
    this.commentsErrorMessage = '';

    this.groupCommentsService
      .getVisibleByGroup(groupId)
      .pipe(
        switchMap((comments) => {
          const userIds = [...new Set(comments.map((comment) => comment.userId))];

          if (userIds.length === 0) return of(comments);

          return forkJoin(
            userIds.map((userId) =>
              this.userService.getProfile(userId).pipe(catchError(() => of(null))),
            ),
          ).pipe(
            map((profiles) => {
              const usernames = new Map(
                profiles
                  .filter((profile): profile is UserProfile => profile !== null)
                  .map((profile) => [profile.idExternal, profile.username]),
              );

              return comments.map((comment) => ({
                ...comment,
                userName: usernames.get(comment.userId) ?? comment.userName,
              }));
            }),
          );
        }),
      )
      .subscribe({
        next: (comments) => {
          this.comments = comments;
          this.isLoadingComments = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error loading group comments:', error);
          this.commentsErrorMessage = this.commentLoadErrorMessage(error);
          this.isLoadingComments = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private onGoalStatusChanged(goal: GroupGoal): void {
    this.activeGoal = null;
    this.goals = this.goals.map((current) =>
      current.idExternal === goal.idExternal ? goal : current,
    );
    this.isChangingGoal = false;
    this.progress = null;
    this.loadGoals(this.group!.idExternal);
    this.changeDetector.markForCheck();
  }

  private onGoalActionError(error: unknown): void {
    console.error('Error changing group goal:', error);
    this.goalActionMessage =
      'No se pudo actualizar la meta. Revisá los permisos e intentá nuevamente.';
    this.isChangingGoal = false;
    this.changeDetector.markForCheck();
  }
}
