import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { PublicProfile } from './public-profile';
import { UserService } from '../../services/user.service';
import { ReadingGroupsService } from '../../../groups/services/reading-groups.service';
import { GroupMembersService } from '../../../groups/services/group-members.service';
import { TipService } from '../../../tips/services/tip.service';

describe('Visiting user profiles', () => {
  const reader = { idExternal: 'reader', username: 'Marina', email: 'private@example.test' };
  const group = { idExternal: 'group', name: 'Fantasía', createdByUserId: 'me', isActive: true };
  const emptyPage = { content: [], number: 0, totalPages: 0 };

  async function setup() {
    localStorage.setItem('userId', 'me');
    const users = {
      getProfile: vi.fn(() => of(reader)),
      getProfileStories: vi.fn(() => of(emptyPage)),
      getFavoriteStories: vi.fn(() => of(emptyPage)),
      getProfileActivity: vi.fn(() =>
        of({
          wantToRead: 2,
          inProgress: 3,
          finished: 4,
          createdStories: 5,
          activeGroups: 1,
          tipStoryId: null as string | null,
        }),
      ),
      getProfileAppearance: vi.fn(() => of({ coverIndex: 1, avatarIndex: 2, configured: true })),
      setCurrentUser: vi.fn(),
    };
    const groups = {
      getCreatedByUser: vi.fn(() =>
        of([
          group,
          { ...group, idExternal: 'inactive', isActive: false },
          { ...group, idExternal: 'other', createdByUserId: 'someone-else' },
        ]),
      ),
    };
    const members = { addMember: vi.fn(() => of({})) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'users/:id', component: PublicProfile }]),
        { provide: UserService, useValue: users },
        { provide: ReadingGroupsService, useValue: groups },
        { provide: GroupMembersService, useValue: members },
        { provide: TipService, useValue: { createTip: vi.fn() } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/users/reader', PublicProfile);
    return { harness, component, users, groups, members };
  }

  afterEach(() => localStorage.clear());

  it('shows another user without replacing the session or exposing private fields', async () => {
    const { harness, component, users } = await setup();
    expect(harness.routeNativeElement!.textContent).toContain('@Marina');
    expect(harness.routeNativeElement!.textContent).not.toContain('private@example.test');
    expect(component.isOwnProfile()).toBe(false);
    expect(users.setCurrentUser).not.toHaveBeenCalled();
    expect(localStorage.getItem('userId')).toBe('me');
    for (const label of [
      'Quiero leer',
      'En curso',
      'Finalizadas',
      'Historias creadas',
      'Grupos activos',
      'Historias favoritas',
    ]) {
      expect(harness.routeNativeElement!.textContent).toContain(label);
    }
    expect(component.readingCounts()).toEqual({ wantToRead: '2', inProgress: '3', finished: '4' });
    expect(component.selectedCoverIndex).toBe(1);
    expect(
      harness.routeNativeElement!.querySelector('.profile-avatar img')?.getAttribute('src'),
    ).toContain('/avatars/romance.png');
    expect(harness.routeNativeElement!.querySelector('.cover-button')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('.avatar-edit')).toBeNull();
  });

  it('offers only active groups created by the current user and sends the selected identity once', async () => {
    const { component, members, groups } = await setup();
    component.openGroupPicker();
    expect(groups.getCreatedByUser).toHaveBeenCalledExactlyOnceWith('me');
    expect(component.groups()).toEqual([group]);
    const pending = new Subject<{}>();
    members.addMember.mockReturnValue(pending);
    component.selectedGroupId = 'group';
    component.addToGroup();
    component.addToGroup();
    expect(members.addMember).toHaveBeenCalledExactlyOnceWith('group', { userId: 'reader' });
    pending.next({});
    pending.complete();
    expect(component.groupMessage()).toContain('@Marina');
    expect(component.showGroupPicker()).toBe(false);
  });

  it('only offers a cafecito for another user with a published story', async () => {
    const { component, users, harness } = await setup();
    expect(harness.routeNativeElement!.querySelector('app-send-tip')).toBeNull();
    users.getProfileActivity.mockReturnValue(
      of({
        wantToRead: 2,
        inProgress: 3,
        finished: 4,
        createdStories: 5,
        activeGroups: 1,
        tipStoryId: 'published-story',
      }),
    );
    component.loadActivity();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('.tip-button')).not.toBeNull();
    users.getProfile.mockReturnValue(of({ ...reader, idExternal: 'me' }));
    component.retry();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('app-send-tip')).toBeNull();
  });

  it('does not accept an arbitrary group id and handles an existing membership', async () => {
    const { component, members } = await setup();
    component.openGroupPicker();
    component.selectedGroupId = 'someone-elses-group';
    component.addToGroup();
    expect(members.addMember).not.toHaveBeenCalled();
    component.selectedGroupId = 'group';
    members.addMember.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    component.addToGroup();
    expect(component.groupsError()).toContain('ya pertenece');
    expect(component.adding()).toBe(false);
  });

  it('disables adding oneself and allows recovering from an unavailable profile', async () => {
    const { harness, component, users, groups } = await setup();
    users.getProfile.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })));
    await harness.navigateByUrl('/users/missing', PublicProfile);
    expect(component.error()).toContain('no está disponible');
    users.getProfile.mockReturnValue(of({ ...reader, idExternal: 'me' }));
    component.retry();
    harness.detectChanges();
    expect(component.isOwnProfile()).toBe(true);
    expect(harness.routeNativeElement!.textContent).not.toContain('Agregar a un grupo');
    component.openGroupPicker();
    expect(groups.getCreatedByUser).not.toHaveBeenCalled();
  });
});
