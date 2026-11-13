import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { EMPTY, Subject, of } from 'rxjs';
import { GroupDetail } from './group-detail';
import { ReadingGroupsService } from '../../services/reading-groups.service';
import { GroupMembersService } from '../../services/group-members.service';
import { GroupGoalsService } from '../../services/group-goals.service';
import { GroupCommentsService } from '../../services/group-comments.service';
import { GroupProgressService } from '../../services/group-progress.service';
import { UserService } from '../../../profile/services/user.service';
import { TokenService } from '../../../../core/services/token.service';
import { BooksService } from '../../../books/services/books.service';
import { StoryService } from '../../../stories/services/story.services';
import { GroupCommentReportsService } from '../../services/group-comment-reports.service';

describe('Adding group members by selected user', () => {
  function setup() {
    localStorage.setItem('userId', 'creator');
    const addMember = vi.fn(() => new Subject<any>());
    const tokens = { hasAnyRole: vi.fn(() => false) };
    const updateComment = vi.fn((id: string, payload: { content: string; progressType: 'CHAPTER' | 'PERCENTAGE'; progressValue: number }) => of({ idExternal: id, ...payload }));
    const createReport = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: EMPTY } },
        { provide: ReadingGroupsService, useValue: {} },
        { provide: GroupMembersService, useValue: { invite: addMember, getActiveByGroup: () => of([]) } },
        { provide: GroupGoalsService, useValue: {} },
        { provide: GroupCommentsService, useValue: { update: updateComment } },
        { provide: GroupCommentReportsService, useValue: { create: createReport } },
        { provide: GroupProgressService, useValue: {} },
        { provide: UserService, useValue: { currentUser: () => null, getCachedProfileAppearance: () => undefined, getProfileAppearance: () => of({ avatarIndex: 0 }) } },
        { provide: BooksService, useValue: {} },
        { provide: StoryService, useValue: {} },
        { provide: TokenService, useValue: tokens },
      ],
    });
    const fixture = TestBed.createComponent(GroupDetail);
    const component = fixture.componentInstance;
    component.group = {
      idExternal: 'group',
      name: 'Lecturas',
      createdByUserId: 'creator',
      isActive: true,
      createdAt: '',
    };
    component.selectedInviteUser = { idExternal: 'reader', username: 'Marina' };
    component.members = [{ idExternal: 'creator-member', groupId: 'group', groupName: 'Lecturas', userId: 'creator', userName: 'Creador', memberType: 'CREATOR', status: 'ACTIVE', joinedAt: '' }];
    component.isLoading = false;
    component.isLoadingMembers = false;
    return { fixture, component, addMember, tokens, updateComment, createReport };
  }

  afterEach(() => localStorage.clear());

  it('adds the selected user and blocks duplicate submissions while saving', () => {
    const { component, addMember } = setup();
    component.inviteMember();
    component.inviteMember();
    expect(addMember).toHaveBeenCalledExactlyOnceWith('group', 'reader');
  });

  it('does not offer or perform member management to a regular group member', () => {
    const { fixture, component, addMember, tokens } = setup();
    localStorage.setItem('userId', 'reader');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Agregar lector');
    component.inviteMember();
    expect(addMember).not.toHaveBeenCalled();
    tokens.hasAnyRole.mockReturnValue(true);
    expect(component.canManageMembers).toBe(true);
  });

  it('does not add existing members or allow changes in inactive groups', () => {
    const { component, addMember } = setup();
    component.members = [
      {
        idExternal: 'membership',
        groupId: 'group',
        groupName: 'Lecturas',
        userId: 'reader',
        userName: 'Marina',
        memberType: 'MEMBER',
        status: 'ACTIVE',
        joinedAt: '',
      },
    ];
    component.inviteMember();
    expect(addMember).not.toHaveBeenCalled();
    component.members = [];
    component.group!.isActive = false;
    component.inviteMember();
    expect(addMember).not.toHaveBeenCalled();
  });

  it('edits only the author’s comment and reports another reader’s comment', () => {
    const { component, updateComment, createReport } = setup();
    const comment = { idExternal: 'c1', groupId: 'group', readingCycleId: 'cycle', userId: 'creator', userName: 'Lu', content: 'Original', progressType: 'CHAPTER' as const, progressValue: 2, createdAt: '' };
    component.comments = [comment];
    component.editComment(comment);
    component.editedCommentContent = ' Editado ';
    component.saveEditedComment(comment);
    expect(updateComment).toHaveBeenCalledWith('c1', { content: 'Editado', progressType: 'CHAPTER', progressValue: 2 });
    const other = { ...comment, idExternal: 'c2', userId: 'reader' };
    component.editComment(other);
    component.saveEditedComment(other);
    expect(updateComment).toHaveBeenCalledTimes(1);
    component.reportComment(other);
    component.reportReason = 'Motivo';
    component.submitCommentReport(other);
    expect(createReport).toHaveBeenCalledWith('c2', 'Motivo', null);
    component.reportComment(comment);
    component.submitCommentReport(comment);
    expect(createReport).toHaveBeenCalledTimes(1);
  });
});
