import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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

@Component({
  selector: 'app-group-detail',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink],
  styleUrl: './group-detail.css',
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
  private readonly userService = inject(UserService);

  group: ReadingGroup | null = null;
  members: GroupMember[] = [];
  goals: GroupGoal[] = [];
  activeGoal: GroupGoal | null = null;
  progress: GroupProgress | null = null;
  comments: GroupComment[] = [];

  goalType: 'CHAPTER' | 'PERCENTAGE' = 'PERCENTAGE';
  targetProgress = 1;
  targetDate = '';
  commentContent = '';
  commentProgress = 0;
  inviteUserId = '';
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
  goalActionMessage = '';
  commentActionMessage = '';
  memberActionMessage = '';

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

  get goalUnit(): string {
    return this.goalType === 'PERCENTAGE' ? '%' : 'capítulos';
  }

  get activeGoalLabel(): string {
    if (!this.activeGoal) {
      return '';
    }

    return this.activeGoal.goalType === 'PERCENTAGE'
      ? `Alcanzar ${this.activeGoal.targetProgress}% de progreso`
      : `Leer ${this.activeGoal.targetProgress} capítulos`;
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

  get canLeaveGroup(): boolean {
    return (
      !!this.group &&
      localStorage.getItem('userId') !== this.group.createdByUserId
    );
  }

  inviteMember(): void {
    if (!this.group || this.isUpdatingMembers || !this.inviteUserId.trim()) {
      return;
    }

    this.memberActionMessage = '';
    this.isUpdatingMembers = true;

    this.groupMembersService
      .addMember(this.group.idExternal, {
        userId: this.inviteUserId.trim(),
      })
      .subscribe({
        next: () => {
          this.inviteUserId = '';
          this.showInviteForm = false;
          this.isUpdatingMembers = false;
          this.loadMembers(this.group!.idExternal);
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error inviting group member:', error);
          this.memberActionMessage =
            'No se pudo agregar al lector. Revisá el UUID, que no sea miembro activo y que tengas permisos.';
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

    this.groupMembersService.leaveGroup(this.group.idExternal).subscribe({
      next: () => {
        this.isUpdatingMembers = false;
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
    if (
      !this.group ||
      this.isSavingGoal ||
      !this.targetDate ||
      this.targetProgress < 1 ||
      (this.goalType === 'PERCENTAGE' && this.targetProgress > 100)
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
        targetDate:
          this.targetDate.length === 16
            ? `${this.targetDate}:00`
            : this.targetDate,
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
          this.goalActionMessage =
            'No se pudo crear la meta. Puede que ya exista una meta activa o que no tengas permisos.';
          this.isSavingGoal = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  finishGoal(): void {
    if (!this.activeGoal || this.isChangingGoal) {
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
    if (!this.activeGoal || this.isChangingGoal) {
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

  publishComment(): void {
    if (!this.group || !this.commentContent.trim() || this.isSavingComment) {
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
          this.comments = [comment, ...this.comments];
          this.commentContent = '';
          this.isSavingComment = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error creating group comment:', error);
          this.commentActionMessage = this.isStoryGroup
            ? 'Los comentarios todavía están disponibles solo para grupos vinculados a libros.'
            : 'No se pudo publicar. Verificá tu progreso y que seas miembro activo del grupo.';
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

        if (group.bookId) {
          this.loadComments(groupId);
        } else {
          this.isLoadingComments = false;
        }

        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Error loading reading group:', error);
        this.errorMessage = 'No se pudo cargar el círculo de lectura.';
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadMembers(groupId: string): void {
    this.isLoadingMembers = true;
    this.membersErrorMessage = '';

    this.groupMembersService.getActiveByGroup(groupId).subscribe({
      next: (members) => {
        this.members = members;
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

  private loadComments(groupId: string): void {
    this.isLoadingComments = true;
    this.commentsErrorMessage = '';

    this.groupCommentsService.getVisibleByGroup(groupId).subscribe({
      next: (comments) => {
        this.comments = comments;
        this.isLoadingComments = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Error loading group comments:', error);
        this.commentsErrorMessage = this.isStoryGroup
          ? 'Los comentarios todavía están disponibles solo para grupos vinculados a libros.'
          : 'No se pudieron cargar los comentarios visibles.';
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
