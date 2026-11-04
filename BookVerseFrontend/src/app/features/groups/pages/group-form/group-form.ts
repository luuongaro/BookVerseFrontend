import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, map, Observable, of, switchMap } from 'rxjs';

import { ReadingGroupsService } from '../../services/reading-groups.service';
import { UserService } from '../../../profile/services/user.service';
import { LibraryService } from '../../../library/services/library.service';
import { TokenService } from '../../../../core/services/token.service';
import { GroupMember } from '../../models/group-member.model';
import { ReadingGroup } from '../../models/reading-group.model';
import { GroupMembersService } from '../../services/group-members.service';

type GroupWorkType = 'book' | 'story';

@Component({
  selector: 'app-group-form',
  imports: [UserAvatar, FormsModule, ReactiveFormsModule, RouterLink],
  styleUrl: './group-form.css',
  templateUrl: './group-form.html',
})
export class GroupForm implements OnInit {
  @ViewChild('removeMemberDialog')
  removeMemberDialog?: ElementRef<HTMLDialogElement>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly readingGroupsService = inject(ReadingGroupsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly userService = inject(UserService);
  private readonly libraryService = inject(LibraryService);
  private readonly groupMembersService = inject(GroupMembersService);
  private readonly tokenService = inject(TokenService);

  groupId: string | null = null;
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  works: { idExternal: string; title: string }[] = [];
  isLoadingWorks = false;
  group: ReadingGroup | null = null;
  members: GroupMember[] = [];
  isLoadingMembers = false;
  removingUserId: string | null = null;
  memberMessage = '';
  memberSearch = '';
  selectedMemberForRemoval: GroupMember | null = null;

  get currentUsername(): string {
    return this.userService.currentUser()?.username ?? 'Usuario';
  }

  get canManageGroup(): boolean {
    const currentUserId = localStorage.getItem('userId');

    return !!this.group && (
      this.group.createdByUserId === currentUserId ||
      this.tokenService.hasAnyRole('ROLE_ADMIN', 'ROLE_MODERATOR')
    );
  }

  get visibleMembers(): GroupMember[] {
    const currentUserId = localStorage.getItem('userId');
    const search = this.memberSearch.trim().toLocaleLowerCase();

    return this.members.filter((member) => {
      const isCreatorViewingOwnRow =
        this.group?.createdByUserId === currentUserId &&
        member.userId === currentUserId;

      return (
        !isCreatorViewingOwnRow &&
        member.userName.toLocaleLowerCase().includes(search)
      );
    });
  }

  canRemoveMember(member: GroupMember): boolean {
    const isAdminOrModerator = this.tokenService.hasAnyRole(
      'ROLE_ADMIN',
      'ROLE_MODERATOR',
    );

    return this.canManageGroup &&
      (member.memberType !== 'CREATOR' || isAdminOrModerator);
  }

  requestRemoveMember(member: GroupMember): void {
    if (!this.canRemoveMember(member) || this.removingUserId) {
      return;
    }

    this.selectedMemberForRemoval = member;
    this.removeMemberDialog?.nativeElement.showModal();
  }

  cancelRemoveMember(): void {
    this.removeMemberDialog?.nativeElement.close();
    this.selectedMemberForRemoval = null;
  }

  confirmRemoveMember(): void {
    const member = this.selectedMemberForRemoval;

    if (!this.group || !member || !this.canRemoveMember(member)) {
      return;
    }

    this.removeMemberDialog?.nativeElement.close();
    this.selectedMemberForRemoval = null;
    this.memberMessage = '';
    this.removingUserId = member.userId;

    this.groupMembersService
      .removeMember(this.group.idExternal, member.userId)
      .pipe(
        finalize(() => {
          this.removingUserId = null;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.memberMessage = `@${member.userName} ya no forma parte del grupo.`;
          this.loadMembers(this.group!.idExternal);
        },
        error: (error: unknown) => {
          console.error('Error removing group member:', error);
          this.memberMessage =
            'No se pudo quitar al miembro. Revisá tus permisos e intentá nuevamente.';
        },
      });
  }

  private loadMembers(groupId: string): void {
    this.isLoadingMembers = true;

    this.groupMembersService
      .getActiveByGroup(groupId)
      .pipe(
        finalize(() => {
          this.isLoadingMembers = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (members) => {
          this.members = members;
        },
        error: (error: unknown) => {
          console.error('Error loading group members:', error);
          this.memberMessage = 'No se pudieron cargar los miembros del grupo.';
        },
      });
  }

  logout(): void {
    this.userService.logout();
  }

  groupForm = this.formBuilder.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(60),
      ],
    ],
    workType: ['book' as GroupWorkType, Validators.required],
    referenceId: ['', Validators.required],
  });

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('id');

    if (this.groupId) {
      this.loadGroup(this.groupId);
    } else {
      this.loadWorks();
    }
  }

  private loadAllPages<T>(
    getPage: (page: number) => Observable<{ content: T[]; last: boolean }>,
    page = 0,
    accumulated: T[] = [],
  ): Observable<T[]> {
    return getPage(page).pipe(
      switchMap((result) => {
        const allItems = [...accumulated, ...result.content];

        return result.last
          ? of(allItems)
          : this.loadAllPages(getPage, page + 1, allItems);
      }),
    );
  }

  loadWorks(): void {
    const workType = this.groupForm.controls.workType.value;

    this.isLoadingWorks = true;
    this.errorMessage = '';
    this.works = [];
    this.groupForm.controls.referenceId.setValue('');

    const request: Observable<{ idExternal: string; title: string }[]> = this.libraryService
      .getMyLibrary()
      .pipe(
        map((library) =>
          workType === 'book'
            ? library.entries.map(({ book }) => ({
                idExternal: book.idExternal,
                title: book.title,
              }))
            : (library.stories ?? []).map(({ story }) => ({
                idExternal: story.idExternal,
                title: story.title,
              })),
        ),
      );

    request
      .pipe(
        finalize(() => {
          this.isLoadingWorks = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (works) => {
          this.works = works;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error loading works:', error);
          this.errorMessage = 'No se pudieron cargar las obras disponibles.';
          this.cdr.markForCheck();
        },
      });
  }

  private loadGroup(groupId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.readingGroupsService
      .getById(groupId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (group) => {
          this.group = group;

          this.groupForm.patchValue({
            name: group.name,
            workType: group.storyId ? 'story' : 'book',
            referenceId: group.storyId ?? group.bookId ?? '',
          });

          // El backend solo permite cambiar el nombre del grupo.
          this.groupForm.controls.workType.disable();
          this.groupForm.controls.referenceId.disable();

          if (this.canManageGroup) {
            this.loadMembers(group.idExternal);
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error loading reading group for edit:', error);
          this.errorMessage = 'No se pudo cargar el grupo para editarlo.';
          this.cdr.markForCheck();
        },
      });
  }

  get isEditing(): boolean {
    return this.groupId !== null;
  }

  onSubmit(): void {
    if (this.groupForm.invalid || this.isSaving) {
      this.groupForm.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    this.isSaving = true;

    const { name, workType, referenceId } = this.groupForm.getRawValue();
    const normalizedName = name.trim();

    if (this.groupId) {
      this.readingGroupsService
        .update(this.groupId, { name: normalizedName })
        .subscribe({
          next: () => {
            void this.router.navigate(['/groups', this.groupId]);
          },
          error: (error: unknown) => {
            console.error('Error updating reading group:', error);
            this.errorMessage =
              'No se pudo actualizar el grupo. Revisá los permisos e intentá nuevamente.';
            this.isSaving = false;
            this.cdr.markForCheck();
          },
        });

      return;
    }

    this.readingGroupsService
      .create({
        name: normalizedName,
        bookId: workType === 'book' ? referenceId : null,
        storyId: workType === 'story' ? referenceId : null,
      })
      .subscribe({
        next: (group) => {
          void this.router.navigate(['/groups', group.idExternal]);
        },
        error: (error: unknown) => {
          console.error('Error creating reading group:', error);
          this.errorMessage =
            'No se pudo crear el grupo. Revisá los datos e intentá nuevamente.';
          this.isSaving = false;
          this.cdr.markForCheck();
        },
      });
  }
}
