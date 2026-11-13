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
import {
  catchError,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
  timeout,
} from 'rxjs';

import { Book } from '../../../books/models/book.model';
import { BooksService } from '../../../books/services/books.service';
import { ReadingStatus } from '../../../library/models/library-book.model';
import { LibraryService } from '../../../library/services/library.service';
import {
  GroupComment,
  GroupCommentsVisibility,
} from '../../models/group-comment.model';
import { GroupGoal } from '../../models/group-goal.model';
import { GroupMember } from '../../models/group-member.model';
import { GroupProgress } from '../../models/group-progress.model';
import {
  GroupReadingCycle,
  GroupReadingParticipant,
  ReadingGroup,
} from '../../models/reading-group.model';

import { GroupCommentsService } from '../../services/group-comments.service';
import { GroupCommentReportsService } from '../../services/group-comment-reports.service';
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

type CycleWorkType = 'book' | 'story';

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
  private readonly commentReports = inject(GroupCommentReportsService);
  private readonly groupProgressService = inject(GroupProgressService);
  private readonly booksService = inject(BooksService);
  private readonly libraryService = inject(LibraryService);
  private readonly storyService = inject(StoryService);
  private readonly userService = inject(UserService);
  private readonly tokens = inject(TokenService);

  readonly leaveGroupDialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('leaveGroupDialog');
  readonly newCycleDialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('newCycleDialog');
  readonly referenceUpdateDialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('referenceUpdateDialog');

  group: ReadingGroup | null = null;
  currentCycle: GroupReadingCycle | null = null;
  showNewCycleForm = false;
  showCancelCycleConfirmation = false;
  cycleWorkType: CycleWorkType = 'book';
  cycleWorks: { idExternal: string; title: string }[] = [];
  cycleReferenceId = '';
  cycleEditionReference = '';
  cycleTotalChapters = '';
  isLoadingCycleWorks = false;
  cycleParticipants: GroupReadingParticipant[] = [];
  isLoadingCycleParticipants = false;
  isChangingParticipation = false;
  participantActionMessage = '';
  cycleSuccessMessage = '';
  referenceUpdatedForJoin = false;
  referenceUpdateErrorMessage = '';
  members: GroupMember[] = [];
  membersPage = 0;
  readonly membersPerPage = 4;
  goals: GroupGoal[] = [];
  activeGoal: GroupGoal | null = null;
  goalHistory: GroupGoal[] = [];
  readingCycles: GroupReadingCycle[] = [];
  readingTitles: Record<string, string> = {};
  isLoadingGoalHistory = false;
  goalHistoryErrorMessage = '';
  readingHistory: Array<{
    cycle: GroupReadingCycle;
    goals: GroupGoal[];
  }> = [];

  isLoadingReadingHistory = false;
  progress: GroupProgress | null = null;
  comments: GroupComment[] = [];
  commentVisibility: GroupCommentsVisibility | null = null;
  linkedBook: Book | null = null;
  linkedStory: StoryDetailResponse | null = null;
  isLoadingLinkedContent = false;
  isWorkInLibrary: boolean | null = null;
  isCheckingLibraryStatus = false;
  libraryStatusError = '';
  libraryReadingStatus: ReadingStatus | null = null;
  groupChapterAtJoin: number | null = null;

  goalType: 'CHAPTER' | 'PERCENTAGE' = 'PERCENTAGE';
  targetProgress = 1;
  bookTotalChapters: number | null = null;
  targetDate = '';
  readonly minTargetDate = this.getTomorrowDate();
  targetDatePastError = false;
  commentContent = '';
  commentProgress = 0;
  commentChapter = 0;
  editingCommentId: string | null = null;
  editedCommentContent = '';
  reportingCommentId: string | null = null;
  reportReason = '';
  reportDetails = '';
  commentFormBusy = false;
  commentFormMessage = '';
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
  isChangingCycle = false;
  cycleActionInProgress: 'start' | 'complete' | 'cancel' | null = null;
  isUpdatingMembers = false;

  errorMessage = '';
  membersErrorMessage = '';
  goalsErrorMessage = '';
  progressErrorMessage = '';
  commentsErrorMessage = '';
  linkedContentError = '';
  goalActionMessage = '';
  cycleActionMessage = '';
  commentActionMessage = '';
  deleteConfirmationCommentId: string | null = null;
  deletingCommentId: string | null = null;
  memberActionMessage = '';
  memberSuccessMessage = '';

  get currentUsername(): string {
    return this.userService.currentUser()?.username ?? 'Usuario';
  }

  get completedGoals(): GroupGoal[] {
    return this.goals.filter((goal) => goal.status === 'COMPLETED');
  }

  get historicalGoals(): GroupGoal[] {
    return this.goalHistory.filter(
      (goal) =>
        goal.readingCycleId !== null &&
        goal.idExternal !== this.activeGoal?.idExternal,
    );
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

  get canManageCycles(): boolean {
    const currentUserId =
      this.userService.currentUser()?.idExternal ?? localStorage.getItem('userId');

    return (
      !!this.group &&
      (
        this.group.createdByUserId === currentUserId ||
        this.tokens.hasAnyRole('ROLE_ADMIN', 'ROLE_MODERATOR')
      )
    );
  }

  get currentUserCycleParticipation(): GroupReadingParticipant | null {
    const userId =
      this.userService.currentUser()?.idExternal ?? localStorage.getItem('userId');

    return (
      this.cycleParticipants.find(
        (participant) => participant.userId === userId,
      ) ?? null
    );
  }

  get activeCycleParticipants(): GroupReadingParticipant[] {
    return this.cycleParticipants.filter(
      (participant) => participant.status === 'ACTIVE',
    );
  }

  isParticipatingInCurrentCycle(userId: string): boolean {
    return this.activeCycleParticipants.some(
      (participant) => participant.userId === userId,
    );
  }

  get canJoinCurrentCycle(): boolean {
    const allowedReadingStatuses = ['IN_PROGRESS', 'RE_READING', 'FINISHED'];

    return (
      this.currentCycle?.status === 'ACTIVE' &&
      this.isCurrentUserActiveMember &&
      !!this.libraryReadingStatus &&
      allowedReadingStatuses.includes(this.libraryReadingStatus.status) &&
      (
        !this.currentUserCycleParticipation ||
        this.currentUserCycleParticipation.status === 'WITHDRAWN'
      )
    );
  }

  get hasDifferentBookChapterReference(): boolean {
    const reading = this.libraryReadingStatus;
    const groupTotal = this.currentCycle?.totalChapters;
    const userTotal = reading?.progressTotal;

    return (
      !!this.currentCycle?.bookId &&
      reading?.progressType === 'CHAPTER' &&
      userTotal != null &&
      groupTotal != null &&
      userTotal !== groupTotal
    );
  }

  get isGroupChapterAtJoinValid(): boolean {
    const total = this.currentCycle?.totalChapters;
    const chapter = this.groupChapterAtJoin;

    return (
      Number.isInteger(chapter) &&
      chapter !== null &&
      total != null &&
      chapter >= 1 &&
      chapter <= total
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

  get membersPageCount(): number {
    return Math.ceil(this.members.length / this.membersPerPage);
  }

  get paginatedMembers(): GroupMember[] {
    const start = this.membersPage * this.membersPerPage;
    return this.members.slice(start, start + this.membersPerPage);
  }

  scrollMembers(direction: -1 | 1): void {
    const nextPage = this.membersPage + direction;

    if (nextPage < 0 || nextPage >= this.membersPageCount) {
      return;
    }

    this.membersPage = nextPage;
  }

  changeCommentChapter(direction: -1 | 1): void {
    const max = this.libraryChapterProgress;

    if (max < 1) {
      return;
    }

    const current = Math.min(
      max,
      Math.max(1, this.commentChapter || 1),
    );

    this.commentChapter = Math.min(
      max,
      Math.max(1, current + direction),
    );
  }

  memberProfileLink(userId: string): string[] {
    const currentUserId =
      this.userService.currentUser()?.idExternal ??
      localStorage.getItem('userId');

    return userId === currentUserId
      ? ['/profile']
      : ['/users', userId];
  }

  getReadingCycleForGoal(goal: GroupGoal): GroupReadingCycle | null {
    if (!goal.readingCycleId) {
      return null;
    }

    return (
      this.readingCycles.find(
        (cycle) => cycle.idExternal === goal.readingCycleId,
      ) ?? null
    );
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

  startCurrentCycle(): void {
    this.changeCurrentCycleStatus('start');
  }

  completeCurrentCycle(): void {
    this.changeCurrentCycleStatus('complete');
  }

  toggleNewCycleForm(): void {
    const dialog = this.newCycleDialog().nativeElement;

    if (dialog.open) {
      dialog.close();
      this.showNewCycleForm = false;
      return;
    }

    this.showNewCycleForm = true;
    this.cycleActionMessage = '';
    this.loadCycleWorks();
    dialog.showModal();
  }

  closeNewCycleForm(): void {
    this.newCycleDialog().nativeElement.close();
    this.showNewCycleForm = false;
  }

  loadCycleWorks(): void {
    this.isLoadingCycleWorks = true;
    this.cycleWorks = [];
    this.cycleReferenceId = '';

    this.libraryService
      .getMyLibrary()
      .pipe(
        map((library) =>
          this.cycleWorkType === 'book'
            ? library.entries.map(({ book }) => ({
                idExternal: book.idExternal,
                title: book.title,
              }))
            : (library.stories ?? []).map(({ story }) => ({
                idExternal: story.idExternal,
                title: story.title,
              })),
        ),
      )
      .subscribe({
        next: (works) => {
          this.cycleWorks = works;
          this.isLoadingCycleWorks = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error loading library works for a new cycle:', error);
          this.cycleActionMessage = 'No se pudieron cargar las obras de tu biblioteca.';
          this.isLoadingCycleWorks = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  createNextCycle(): void {
    if (!this.group || !this.canManageCycles || this.isChangingCycle) {
      return;
    }

    const editionReference = this.cycleEditionReference.trim();
    const totalChapters = Number(this.cycleTotalChapters);

    if (!this.cycleReferenceId) {
      this.cycleActionMessage = 'Elegí una obra de tu biblioteca.';
      return;
    }

    if (
      this.cycleWorkType === 'book' &&
      (!editionReference || !Number.isInteger(totalChapters) || totalChapters < 1)
    ) {
      this.cycleActionMessage =
        'Para un libro, indicá la edición y una cantidad total de capítulos mayor que cero.';
      return;
    }

    const request =
      this.cycleWorkType === 'book'
        ? {
            bookId: this.cycleReferenceId,
            editionReference,
            totalChapters,
          }
        : { storyId: this.cycleReferenceId };

    this.isChangingCycle = true;
    this.cycleActionMessage = '';

    this.readingGroupsService
      .createCycle(this.group.idExternal, request)
      .subscribe({
        next: () => {
          this.isChangingCycle = false;
          this.closeNewCycleForm();
          this.cycleEditionReference = '';
          this.cycleTotalChapters = '';
          this.cycleActionMessage =
            'La próxima lectura quedó planificada. El creador puede iniciarla cuando estén listos.';
          this.loadCurrentCycle(this.group!.idExternal);
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error creating a new reading cycle:', error);
          this.cycleActionMessage = 'No se pudo planificar la próxima lectura.';
          this.isChangingCycle = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  requestCancelCurrentCycle(): void {
    if (
      !this.group ||
      !this.currentCycle ||
      !this.canManageCycles ||
      this.isChangingCycle ||
      !['PLANNED', 'ACTIVE'].includes(this.currentCycle.status)
    ) {
      return;
    }

    this.cycleActionMessage = '';
    this.showCancelCycleConfirmation = true;
  }

  confirmCancelCurrentCycle(): void {
    if (
      !this.group ||
      !this.currentCycle ||
      !this.canManageCycles ||
      this.isChangingCycle
    ) {
      return;
    }

    const groupId = this.group.idExternal;
    const cycleId = this.currentCycle.idExternal;

    this.isChangingCycle = true;
    this.cycleActionInProgress = 'cancel';
    this.cycleActionMessage = '';

    this.readingGroupsService
      .cancelCycle(groupId, cycleId)
      .pipe(
        timeout({ first: 15000 }),
        finalize(() => {
          this.isChangingCycle = false;
          this.cycleActionInProgress = null;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.cycleActionMessage = 'La lectura del grupo se canceló.';
          this.showCancelCycleConfirmation = false;
          this.loadCurrentCycle(groupId);
        },
        error: (error: unknown) => {
          console.error('Error cancelling reading cycle:', error);
          this.cycleActionMessage =
            'No se pudo actualizar la lectura del grupo. Intentá nuevamente.';
        },
      });
  }

  dismissCancelCycleConfirmation(): void {
    this.showCancelCycleConfirmation = false;
  }

  private changeCurrentCycleStatus(action: 'start' | 'complete'): void {
    if (!this.group || !this.currentCycle || !this.canManageCycles || this.isChangingCycle) {
      return;
    }

    const { idExternal: groupId } = this.group;
    const cycleId = this.currentCycle.idExternal;

    if (
      (action === 'start' && this.currentCycle.status !== 'PLANNED') ||
      (action === 'complete' && this.currentCycle.status !== 'ACTIVE')
    ) {
      return;
    }

    this.isChangingCycle = true;
    this.cycleActionInProgress = action;
    this.cycleActionMessage = '';

    const request =
      action === 'start'
        ? this.readingGroupsService.startCycle(groupId, cycleId)
        : this.readingGroupsService.completeCycle(groupId, cycleId);

    request
      .pipe(
        timeout({ first: 15000 }),
        finalize(() => {
          this.isChangingCycle = false;
          this.cycleActionInProgress = null;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.cycleActionMessage =
            action === 'start'
              ? 'La lectura del grupo está en curso.'
              : 'La lectura del grupo se completó.';
          this.loadCurrentCycle(groupId);
        },
        error: (error: unknown) => {
          console.error('Error changing reading cycle status:', error);
          this.cycleActionMessage =
            'No se pudo actualizar la lectura del grupo. Intentá nuevamente.';
        },
      });
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
    });
  }

  get isStoryGroup(): boolean {
    return !!this.currentCycle?.storyId;
  }

  get currentCycleStatusLabel(): string {
    if (!this.currentCycle) {
      return 'Sin lectura planificada';
    }

    const labels = {
      PLANNED: 'Planificada',
      ACTIVE: 'En curso',
      COMPLETED: 'Completada',
      CANCELLED: 'Cancelada',
    };

    return labels[this.currentCycle.status];
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
    const allowedStatuses = ['IN_PROGRESS', 'RE_READING', 'FINISHED'];

    return (
      this.commentProgressType === 'PERCENTAGE' &&
      this.currentCycle?.status === 'ACTIVE' &&
      !!reading &&
      allowedStatuses.includes(reading.status) &&
      this.libraryProgressPercent > 0
    );
  }

  get commentProgressType(): 'CHAPTER' | 'PERCENTAGE' {
    if (this.isStoryGroup) {
      return 'CHAPTER';
    }

    if (this.activeGoal?.goalType === 'CHAPTER') {
      return 'CHAPTER';
    }

    if (this.activeGoal?.goalType === 'PERCENTAGE') {
      return 'PERCENTAGE';
    }

    return this.libraryReadingStatus?.progressType === 'CHAPTER'
      ? 'CHAPTER'
      : 'PERCENTAGE';
  }

  get storyChapterTotal(): number {
    return this.linkedStory?.publishedChaptersCount ?? 0;
  }

  get commentChapterTotal(): number {
    if (this.currentCycle?.storyId) {
      return this.storyChapterTotal;
    }

    return this.currentCycle?.totalChapters ?? 0;
  }

  get libraryChapterProgress(): number {
    const reading = this.libraryReadingStatus;
    const total = this.commentChapterTotal;

    if (!reading || total <= 0) {
      return 0;
    }

    if (reading.status === 'FINISHED') {
      return total;
    }

    if (
      reading.progressType === 'CHAPTER' &&
      reading.progressValue !== null
    ) {
      return Math.min(total, Math.max(0, reading.progressValue));
    }

    if (
      reading.progressType === 'PERCENTAGE' &&
      reading.progressValue !== null
    ) {
      return Math.floor((reading.progressValue * total) / 100);
    }

    return 0;
  }

  get hasChapterCommentProgress(): boolean {
    const reading = this.libraryReadingStatus;
    const allowedStatuses = ['IN_PROGRESS', 'RE_READING', 'FINISHED'];

    return (
      this.commentProgressType === 'CHAPTER' &&
      this.currentCycle?.status === 'ACTIVE' &&
      !!reading &&
      allowedStatuses.includes(reading.status) &&
      this.commentChapterTotal > 0 &&
      this.libraryChapterProgress > 0
    );
  }

  get isCommentChapterInvalid(): boolean {
    return (
      !Number.isInteger(this.commentChapter) ||
      this.commentChapter < 1 ||
      this.commentChapter > this.libraryChapterProgress
    );
  }

  get commentsEmptyStateMessage(): string {
    if (!this.currentCycle) {
      return 'Todavía no hay una lectura planificada. La conversación aparecerá cuando el creador inicie una lectura del grupo.';
    }

    if (this.currentCycle.status === 'PLANNED') {
      return 'La lectura está planificada. La conversación se habilitará cuando el creador la inicie.';
    }

    if (this.currentCycle.status === 'COMPLETED') {
      return 'Esta lectura del grupo se completó. Planificá otra lectura para abrir una nueva conversación.';
    }

    if (this.currentCycle.status === 'CANCELLED') {
      return 'Esta lectura del grupo se canceló. La conversación estará disponible cuando se inicie otra lectura.';
    }

    if (this.isCheckingLibraryStatus) {
      return 'Estamos comprobando tu estado de lectura…';
    }

    if (this.libraryStatusError) {
      return 'No pudimos consultar tu estado de lectura. Revisá tu conexión e intentá recargar la página.';
    }

    if (!this.libraryReadingStatus) {
      const work = this.isStoryGroup ? 'Esta historia' : 'Este libro';

      return `${work} todavía no está guardado en tu biblioteca. Agregalo para registrar tu avance y participar de la conversación.`;
    }

    const chapterMode = this.commentProgressType === 'CHAPTER';
    const progress = chapterMode
      ? this.libraryChapterProgress
      : this.libraryProgressPercent;
    const progressLabel = chapterMode
      ? `el capítulo ${progress}`
      : `${progress}%`;

    if (this.commentVisibility?.totalActiveComments === 0) {
      return 'Todavía no hay comentarios publicados para esta lectura.';
    }

    if (progress <= 0) {
      return chapterMode
        ? 'Registrá tu avance por capítulos en Mi biblioteca para acceder a la conversación.'
        : 'Registrá tu avance en Mi biblioteca para acceder a la conversación.';
    }

    if ((this.commentVisibility?.hiddenByProgressCount ?? 0) > 0) {
      return (
        `Todavía no hay comentarios visibles hasta ${progressLabel}. ` +
        'Los comentarios ubicados más adelante se ocultan para evitar spoilers. ' +
        'Si ya avanzaste más, actualizá tu progreso en Mi biblioteca.'
      );
    }

    return 'Todavía no hay comentarios visibles para esta lectura.';
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
      this.currentCycle?.status === 'ACTIVE' &&
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

    return this.currentCycle?.totalChapters ?? 0;
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
      .invite(this.group.idExternal, user.idExternal)
      .subscribe({
        next: () => {
          this.selectedInviteUser = null;
          this.showInviteForm = false;
          this.isUpdatingMembers = false;
          this.memberSuccessMessage = `Invitaste a @${user.username} al grupo.`;
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
      !this.currentCycle ||
      this.currentCycle.status !== 'ACTIVE' ||
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
      .create(this.group.idExternal, this.currentCycle.idExternal, {
        goalType: this.goalType,
        targetProgress: Number(this.targetProgress),
        targetDate: this.targetDate,
      })
      .subscribe({
        next: (goal) => {
          this.activeGoal = goal;
          this.goals = [goal, ...this.goals];
          this.isSavingGoal = false;
          this.loadProgress(
            this.group!.idExternal,
            this.currentCycle!.idExternal,
          );
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
      .changeStatus(
        this.group!.idExternal,
        this.currentCycle!.idExternal,
        this.activeGoal.idExternal,
        { status: 'COMPLETED' },
      )
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

    this.groupGoalsService
      .cancel(
        this.group!.idExternal,
        this.currentCycle!.idExternal,
        this.activeGoal.idExternal,
      )
      .subscribe({
        next: () => {
          this.activeGoal = null;
          this.progress = null;
          this.isChangingGoal = false;
          this.loadGoals(
            this.group!.idExternal,
            this.currentCycle!.idExternal,
          );
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => this.onGoalActionError(error),
      });
  }

  onCommentProgressSliderInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.commentProgress = Number(input.value);
  }

  canDeleteComment(comment: GroupComment): boolean {
    const currentUserId =
      this.userService.currentUser()?.idExternal ??
      localStorage.getItem('userId');

    return (
      comment.userId === currentUserId ||
      this.tokens.hasAnyRole('ROLE_ADMIN', 'ROLE_MODERATOR')
    );
  }

  isCommentAuthor(comment: GroupComment): boolean {
    const id = this.userService.currentUser()?.idExternal ?? localStorage.getItem('userId');
    return !!id && comment.userId === id;
  }

  editComment(comment: GroupComment): void {
    if (!this.isCommentAuthor(comment) || this.commentFormBusy) return;
    this.reportingCommentId = null;
    this.editingCommentId = comment.idExternal;
    this.editedCommentContent = comment.content;
    this.commentFormMessage = '';
  }

  saveEditedComment(comment: GroupComment): void {
    const content = this.editedCommentContent.trim();
    if (!this.isCommentAuthor(comment) || !content || this.commentFormBusy) return;
    this.commentFormBusy = true;
    this.commentFormMessage = '';
    this.groupCommentsService.update(comment.idExternal, {
      content, progressType: comment.progressType, progressValue: comment.progressValue,
    }).pipe(finalize(() => { this.commentFormBusy = false; this.changeDetector.markForCheck(); })).subscribe({
      next: updated => {
        this.comments = this.comments.map(item => item.idExternal === comment.idExternal ? updated : item);
        this.editingCommentId = null;
        this.commentFormMessage = 'Comentario actualizado.';
        this.changeDetector.markForCheck();
      },
      error: () => { this.commentFormMessage = 'No se pudo editar el comentario. Revisá tu progreso e intentá de nuevo.'; this.changeDetector.markForCheck(); },
    });
  }

  reportComment(comment: GroupComment): void {
    if (!this.isCurrentUserActiveMember || this.isCommentAuthor(comment) || this.commentFormBusy) return;
    this.editingCommentId = null;
    this.reportingCommentId = comment.idExternal;
    this.reportReason = '';
    this.reportDetails = '';
    this.commentFormMessage = '';
  }

  submitCommentReport(comment: GroupComment): void {
    const reason = this.reportReason.trim();
    if (!this.isCurrentUserActiveMember || this.isCommentAuthor(comment) || this.commentFormBusy || reason.length < 5 || reason.length > 1000 || this.reportDetails.length > 3000) return;
    this.commentFormBusy = true;
    this.commentFormMessage = '';
    this.commentReports.create(comment.idExternal, reason, this.reportDetails.trim() || null)
      .pipe(finalize(() => { this.commentFormBusy = false; this.changeDetector.markForCheck(); }))
      .subscribe({
        next: () => { this.reportingCommentId = null; this.commentFormMessage = 'Reporte enviado.'; this.changeDetector.markForCheck(); },
        error: (error: HttpErrorResponse) => { this.commentFormMessage = error.status === 409 ? 'Ya tenés un reporte pendiente para este comentario.' : 'No se pudo enviar el reporte. Intentá nuevamente.'; this.changeDetector.markForCheck(); },
      });
  }

  requestDeleteComment(comment: GroupComment): void {
    if (!this.canDeleteComment(comment) || this.deletingCommentId) {
      return;
    }

    this.deleteConfirmationCommentId = comment.idExternal;
  }

  cancelDeleteComment(): void {
    if (!this.deletingCommentId) {
      this.deleteConfirmationCommentId = null;
    }
  }

  confirmDeleteComment(comment: GroupComment): void {
    if (!this.canDeleteComment(comment) || this.deletingCommentId) {
      return;
    }

    this.deletingCommentId = comment.idExternal;
    this.commentActionMessage = '';

    this.groupCommentsService
      .delete(comment.idExternal)
      .pipe(
        timeout({ first: 15000 }),
        finalize(() => {
          this.deletingCommentId = null;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.comments = this.comments.filter(
            (item) => item.idExternal !== comment.idExternal,
          );

          if (this.commentVisibility) {
            this.commentVisibility = {
              ...this.commentVisibility,
              comments: this.comments,
              totalActiveComments: Math.max(
                0,
                this.commentVisibility.totalActiveComments - 1,
              ),
              visibleCount: Math.max(
                0,
                this.commentVisibility.visibleCount - 1,
              ),
            };
          }

          this.deleteConfirmationCommentId = null;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error eliminando comentario:', error);
          this.commentActionMessage =
            'No se pudo eliminar el comentario. Intentá nuevamente.';
          this.changeDetector.markForCheck();
        },
      });
  }

  publishComment(): void {
    if (!this.group || !this.commentContent.trim() || this.isSavingComment) {
      return;
    }

    if (
      this.currentCycle?.status !== 'ACTIVE' ||
      (!this.currentCycle?.bookId && !this.currentCycle?.storyId)
    ) {
      this.commentActionMessage =
        'Los comentarios estarán disponibles cuando haya una lectura activa.';
      return;
    }

    const chapterMode = this.commentProgressType === 'CHAPTER';

    const hasValidProgress = chapterMode
      ? this.hasChapterCommentProgress
      : this.hasPercentageCommentProgress;

    if (!hasValidProgress) {
      this.commentActionMessage = this.commentsEmptyStateMessage;
      return;
    }

    if (this.isCheckingLibraryStatus || this.libraryStatusError) {
      this.commentActionMessage =
        'No pudimos comprobar tu avance en Mi biblioteca. Intentá nuevamente.';
      return;
    }

    if (chapterMode && this.isCommentChapterInvalid) {
      this.commentActionMessage =
        `Elegí un capítulo entero entre 1 y ${this.libraryChapterProgress}, según tu avance guardado.`;
      return;
    }

    if (!chapterMode && this.isCommentProgressInvalid) {
      this.commentActionMessage =
        this.commentProgress < 1 || !Number.isInteger(this.commentProgress)
          ? `Elegí un porcentaje entero entre 1% y ${this.libraryProgressPercent}%.`
          : `El porcentaje del comentario no puede superar el ${this.libraryProgressPercent}% que ya leíste.`;
      return;
    }

    this.isSavingComment = true;
    this.commentActionMessage = '';

    this.groupCommentsService
      .create(this.group.idExternal, {
        content: this.commentContent.trim(),
        progressType: this.commentProgressType,
        progressValue: chapterMode
          ? Number(this.commentChapter)
          : Number(this.commentProgress),
      })
      .pipe(
        timeout({ first: 15000 }),
        finalize(() => {
          this.isSavingComment = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (comment) => {
          const savedComment = {
            ...comment,
            userName: this.currentUsername,
          };

          this.comments = [
            savedComment,
            ...this.comments.filter(
              (item) => item.idExternal !== savedComment.idExternal,
            ),
          ];
          this.commentsErrorMessage = '';
          this.commentActionMessage = '';
          this.commentContent = '';
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error creando el comentario del grupo:', error);

          const didTimeout =
            error instanceof Error && error.name === 'TimeoutError';

          this.commentActionMessage = didTimeout
            ? 'El servidor tardó en responder. Revisá si el comentario apareció antes de volver a intentarlo.'
            : 'No se pudo publicar el comentario. Revisá tu conexión y los permisos para participar de esta lectura.';

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
        this.loadGroupGoalHistory(groupId);
        this.loadCurrentCycle(groupId);
      },
      error: (error: unknown) => {
        console.error('Error loading reading group:', error);
        this.errorMessage = 'No se pudo cargar el grupo de lectura.';
        this.isLoading = false;
        this.isLoadingComments = false;
        this.isLoadingGoals = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadCurrentCycle(groupId: string): void {
    this.readingGroupsService.getCycles(groupId).subscribe({
      next: (cycles) => {
        this.readingCycles = cycles;
        this.loadReadingTitles(cycles);
        const latestCycle = [...cycles].sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        )[0];

        this.currentCycle =
          cycles.find((cycle) => cycle.status === 'ACTIVE') ??
          cycles.find((cycle) => cycle.status === 'PLANNED') ??
          latestCycle ??
          null;

        const cycle = this.currentCycle;

        if (!cycle) {
          this.linkedContentError =
            'Todavía no hay una lectura planificada. El creador puede elegir una obra para empezar.';
          this.isLoading = false;
          this.isLoadingGoals = false;
          this.isLoadingComments = false;
          this.changeDetector.markForCheck();
          return;
        }

        this.goalType = cycle.storyId ? 'CHAPTER' : 'PERCENTAGE';
        this.loadLinkedContent(cycle);
        this.checkLinkedWorkInLibrary(cycle);

        if (cycle.status === 'ACTIVE') {
          this.loadGoals(groupId, cycle.idExternal);
          this.loadCycleParticipants(groupId, cycle.idExternal);
        } else {
          this.goals = [];
          this.activeGoal = null;
          this.progress = null;
          this.isLoadingGoals = false;
          this.cycleParticipants = [];
          this.isLoadingCycleParticipants = false;
        }

        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Error loading group reading cycles:', error);
        this.linkedContentError = 'No se pudo cargar la lectura del grupo.';
        this.isLoading = false;
        this.isLoadingGoals = false;
        this.isLoadingComments = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadCycleParticipants(groupId: string, cycleId: string): void {
    this.isLoadingCycleParticipants = true;
    this.participantActionMessage = '';

    this.readingGroupsService
      .getCycleParticipants(groupId, cycleId)
      .subscribe({
        next: (participants) => {
          this.cycleParticipants = participants;
          this.isLoadingCycleParticipants = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error loading cycle participants:', error);
          this.cycleParticipants = [];
          this.isLoadingCycleParticipants = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  requestJoinCurrentCycle(): void {
    if (!this.group || !this.currentCycle || !this.canJoinCurrentCycle) {
      return;
    }

    // Las historias no tienen edición y total de capítulos de libro.
    if (!this.currentCycle.bookId) {
      this.joinCurrentCycle();
      return;
    }

    this.isCheckingLibraryStatus = true;
    this.participantActionMessage = '';

    this.libraryService.getBookStatus(this.currentCycle.bookId).subscribe({
      next: (readingStatus) => {
        this.libraryReadingStatus = readingStatus;
        this.isWorkInLibrary = readingStatus !== null;
        this.isCheckingLibraryStatus = false;

        if (!this.canJoinCurrentCycle) {
          this.participantActionMessage =
            'Revisá que el libro siga en tu biblioteca y tenga un estado válido para participar.';
          this.changeDetector.markForCheck();
          return;
        }

        if (this.hasDifferentBookChapterReference) {
          this.groupChapterAtJoin = null;
          this.referenceUpdateDialog().nativeElement.showModal();
          this.changeDetector.markForCheck();
          return;
        }

        this.joinCurrentCycle();
      },
      error: (error: unknown) => {
        console.error('Error comprobando la referencia del libro:', error);
        this.isCheckingLibraryStatus = false;
        this.participantActionMessage =
          'No se pudo comprobar tu referencia en Mi biblioteca. Intentá de nuevo.';
        this.changeDetector.markForCheck();
      },
    });
  }

  confirmJoinWithGroupReference(): void {
    const reading = this.libraryReadingStatus;
    const totalChapters = this.currentCycle?.totalChapters;
    const currentChapter = this.groupChapterAtJoin;

    if (
      !reading ||
      totalChapters == null ||
      currentChapter == null ||
      !this.isGroupChapterAtJoinValid
    ) {
      return;
    }

    this.referenceUpdateErrorMessage = '';
    this.isChangingParticipation = true;

    this.libraryService
      .updateStatus(reading, reading.status, {
        type: 'CHAPTER',
        value: currentChapter,
        total: totalChapters,
      })
      .subscribe({
        next: (updatedReading) => {
          this.libraryReadingStatus = updatedReading;
          this.isWorkInLibrary = true;
          this.referenceUpdateDialog().nativeElement.close();
          this.referenceUpdatedForJoin = true;

          // El progreso ya está actualizado; ahora se usa la unión existente.
          this.joinCurrentCycle();
        },
        error: (error: unknown) => {
          console.error('No se pudo actualizar el progreso del libro:', error);
          this.isChangingParticipation = false;
          this.referenceUpdateErrorMessage =
            'No se pudo guardar tu progreso. Revisá los datos e intentá de nuevo.';
          this.changeDetector.markForCheck();
        },
      });
  }

  joinCurrentCycle(): void {
    if (!this.group || !this.currentCycle || !this.canJoinCurrentCycle) {
      return;
    }

    this.isChangingParticipation = true;
    this.participantActionMessage = '';
    this.cycleSuccessMessage = '';

    this.readingGroupsService
      .joinCycle(this.group.idExternal, this.currentCycle.idExternal)
      .subscribe({
        next: () => {
          this.isChangingParticipation = false;

          this.cycleSuccessMessage = this.referenceUpdatedForJoin
            ? `Actualizaste tu referencia a ${this.groupChapterAtJoin} de ${this.currentCycle?.totalChapters} capítulos y ya te sumaste a la lectura.`
            : 'Ya te sumaste a esta lectura.';

          this.referenceUpdatedForJoin = false;
          this.groupChapterAtJoin = null;
          this.commentsErrorMessage = '';
          this.commentActionMessage = '';
          this.loadCommentsWhenProgressIsReady(this.currentCycle!);

          this.loadCycleParticipants(
            this.group!.idExternal,
            this.currentCycle!.idExternal,
          );
        },
        error: (error: unknown) => {
          console.error('Error joining reading cycle:', error);
          this.participantActionMessage =
            'No se pudo sumar a esta lectura. Revisá que la obra esté en tu biblioteca y figure como En curso, Releyendo o Finalizada.';
          this.isChangingParticipation = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  leaveCurrentCycle(): void {
    if (!this.group || !this.currentCycle || !this.currentUserCycleParticipation) {
      return;
    }

    this.isChangingParticipation = true;
    this.participantActionMessage = '';

    this.readingGroupsService
      .leaveCycle(this.group.idExternal, this.currentCycle.idExternal)
      .subscribe({
        next: () => {
          this.isChangingParticipation = false;
          this.loadCycleParticipants(
            this.group!.idExternal,
            this.currentCycle!.idExternal,
          );
        },
        error: (error: unknown) => {
          console.error('Error leaving reading cycle:', error);
          this.participantActionMessage = 'No se pudo salir de la lectura.';
          this.isChangingParticipation = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private loadReadingTitles(cycles: GroupReadingCycle[]): void {
    const requests = cycles.map((cycle) => {
      if (cycle.bookId) {
        return this.booksService.getById(cycle.bookId).pipe(
          map((book) => [cycle.idExternal, book.title] as const),
          catchError(() => of([cycle.idExternal, 'Libro'] as const)),
        );
      }

      if (cycle.storyId) {
        return this.storyService.getById(cycle.storyId).pipe(
          map((story) => [cycle.idExternal, story.title] as const),
          catchError(() => of([cycle.idExternal, 'Historia'] as const)),
        );
      }

      return of([cycle.idExternal, 'Lectura'] as const);
    });

    if (requests.length === 0) {
      this.readingTitles = {};
      return;
    }

    forkJoin(requests).subscribe({
      next: (entries) => {
        this.readingTitles = Object.fromEntries(entries);
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadLinkedContent(cycle: GroupReadingCycle): void {
    this.linkedBook = null;
    this.linkedStory = null;
    this.linkedContentError = '';

    if (cycle.bookId) {
      this.isLoadingLinkedContent = true;

      this.booksService.getById(cycle.bookId).subscribe({
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

    if (cycle.storyId) {
      this.isLoadingLinkedContent = true;

      this.storyService.getById(cycle.storyId).subscribe({
        next: (story) => {
          this.linkedStory = story;
          this.commentChapter = this.libraryChapterProgress;
          this.isLoadingLinkedContent = false;
          if (this.currentCycle) {
            this.loadCommentsWhenProgressIsReady(this.currentCycle);
          }
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
      'Esta lectura no tiene un libro o una historia asociados.';
  }

  private checkLinkedWorkInLibrary(cycle: GroupReadingCycle): void {
    this.isWorkInLibrary = null;
    this.libraryReadingStatus = null;
    this.commentProgress = 0;
    this.commentChapter = 0;
    this.libraryStatusError = '';
    this.commentsErrorMessage = '';
    this.comments = [];
    this.commentVisibility = null;
    this.isCheckingLibraryStatus = true;
    this.isLoadingComments =
      cycle.status === 'ACTIVE' && (!!cycle.bookId || !!cycle.storyId);

    const statusRequest = cycle.bookId
      ? this.libraryService.getBookStatus(cycle.bookId)
      : cycle.storyId
        ? this.libraryService.getStoryStatus(cycle.storyId)
        : null;

    if (!statusRequest) {
      this.isCheckingLibraryStatus = false;
      this.isLoadingComments = false;
      return;
    }

    statusRequest.subscribe({
      next: (readingStatus) => {
        this.libraryReadingStatus = readingStatus;
        if (cycle.storyId) {
          this.commentChapter = this.libraryChapterProgress;
        }
        this.isWorkInLibrary = readingStatus !== null;
        this.commentProgress = this.libraryProgressPercent;
        this.isCheckingLibraryStatus = false;
        this.loadCommentsWhenProgressIsReady(cycle);

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

  private loadCommentsWhenProgressIsReady(
    cycle: GroupReadingCycle,
  ): void {
    if (cycle.storyId && this.isLoadingLinkedContent) {
      return;
    }

    if (this.isCheckingLibraryStatus) {
      return;
    }

    if (
      this.commentProgressType === 'CHAPTER' &&
      this.libraryReadingStatus &&
      this.libraryChapterProgress > 0 &&
      (this.commentChapter < 1 ||
        this.commentChapter > this.libraryChapterProgress)
    ) {
      this.commentChapter = this.libraryChapterProgress;
    }

    const canLoadComments =
      this.commentProgressType === 'CHAPTER'
        ? this.hasChapterCommentProgress
        : this.hasPercentageCommentProgress;

    if (cycle.status === 'ACTIVE' && canLoadComments) {
      this.loadComments(cycle.groupId);
      return;
    }

    this.comments = [];
    this.commentVisibility = null;
    this.commentsErrorMessage = '';
    this.isLoadingComments = false;
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
        this.membersPage = 0;
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

  private loadGroupGoalHistory(groupId: string): void {
    this.isLoadingGoalHistory = true;
    this.goalHistoryErrorMessage = '';

    this.groupGoalsService.getHistoryByGroup(groupId).subscribe({
      next: (history) => {
        this.goalHistory = history;
        this.isLoadingGoalHistory = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        console.error('No se pudo cargar el historial de metas:', error);
        this.goalHistoryErrorMessage =
          'No se pudo cargar el historial de metas del grupo.';
        this.isLoadingGoalHistory = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadGoals(groupId: string, cycleId: string): void {
    this.isLoadingGoals = true;
    this.goalsErrorMessage = '';

    this.groupGoalsService.getByCycle(groupId, cycleId).subscribe({
      next: (goals) => {
        this.goals = goals;
        this.activeGoal =
          goals.find((goal) => goal.status === 'ACTIVE') ?? null;
        if (this.currentCycle) {
          this.loadCommentsWhenProgressIsReady(this.currentCycle);
        }
        this.isLoadingGoals = false;

        if (this.activeGoal) {
          this.loadProgress(groupId, cycleId);
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

  private loadProgress(groupId: string, cycleId: string): void {
    this.progressErrorMessage = '';

    this.groupProgressService.getByCycle(groupId, cycleId).subscribe({
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
    if (!(error instanceof HttpErrorResponse)) {
      return 'Ocurrió un problema al cargar los comentarios. Intentá nuevamente.';
    }

    const apiMessage =
      typeof error.error?.message === 'string'
        ? error.error.message.toLowerCase()
        : '';

    if (error.status === 404 && apiMessage.includes('reading status')) {
      const work = this.isStoryGroup ? 'Esta historia' : 'Este libro';

      return `${work} no está guardado en tu biblioteca. Agregalo y registrá tu progreso para acceder a los comentarios.`;
    }

    if (
      error.status === 400 &&
      apiMessage.includes('percentage-based reading status')
    ) {
      const progressType = this.isStoryGroup ? 'por capítulos' : 'en porcentaje';

      return `Tu estado de lectura no tiene un avance válido para esta conversación. Actualizalo ${progressType} en Mi biblioteca.`;
    }

    if (error.status === 403) {
      return 'Necesitás ser miembro activo del grupo y haberte unido a esta lectura para acceder a sus comentarios.';
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
        switchMap((visibility) => {
          const userIds = [
            ...new Set(visibility.comments.map((comment) => comment.userId)),
          ];

          if (userIds.length === 0) {
            return of(visibility);
          }

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

              return {
                ...visibility,
                comments: visibility.comments.map((comment) => ({
                  ...comment,
                  userName: usernames.get(comment.userId) ?? comment.userName,
                })),
              };
            }),
          );
        }),
      )
      .subscribe({
        next: (visibility) => {
          this.commentVisibility = visibility;
          this.comments = visibility.comments;
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

    const goalExistsInHistory = this.goalHistory.some(
      (current) => current.idExternal === goal.idExternal,
    );

    this.goalHistory = goalExistsInHistory
      ? this.goalHistory.map((current) =>
          current.idExternal === goal.idExternal ? goal : current,
        )
      : [...this.goalHistory, goal];

    this.isChangingGoal = false;
    this.progress = null;
    this.loadGoals(
      this.group!.idExternal,
      this.currentCycle!.idExternal,
    );
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
