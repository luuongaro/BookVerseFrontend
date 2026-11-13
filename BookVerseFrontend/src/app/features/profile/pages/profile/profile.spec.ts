import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';
import { Profile } from './profile';
import { UserService } from '../../services/user.service';
import { ReadingGroupsService } from '../../../groups/services/reading-groups.service';
import { GroupMembersService } from '../../../groups/services/group-members.service';
import { PROFILE_AVATARS } from '../../models/profile-avatars';

describe('Preserving the profile layout and personal appearance', () => {
  async function setup() {
    localStorage.setItem('userId', 'me');
    const users = {
      getProfileBadge: vi.fn(() => of({ badge: null })),
      getProfile: vi.fn(() => of({ idExternal: 'me', username: 'Lu' })),
      updateUser: vi.fn((_id: string, data: { username: string; email: string }) =>
        of({ idExternal: 'me', ...data, status: 'ACTIVE' })),
      setCurrentUser: vi.fn(),
      loadCurrentUser: () =>
        of({ idExternal: 'me', username: 'Lu', email: 'me@example.test', status: 'ACTIVE' }),
      currentUser: () => ({
        idExternal: 'me',
        username: 'Lu',
        email: 'me@example.test',
        status: 'ACTIVE',
      }),
      getProfileActivity: vi.fn(() =>
        of({ wantToRead: 1, inProgress: 2, finished: 3, createdStories: 4, activeGroups: 5 }),
      ),
      getProfileAppearance: vi.fn(() => of({ coverIndex: 2, avatarIndex: 1, configured: true })),
      updateProfileAppearance: vi.fn(() => of({ coverIndex: 4, avatarIndex: 1, configured: true })),
      updateProfileAvatar: vi.fn(() => of({ coverIndex: 2, avatarIndex: 5, configured: true })),
      getFavoriteStories: () => of({ content: [], number: 0, totalPages: 0 }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'profile', component: Profile }]),
        { provide: UserService, useValue: users },
        { provide: ReadingGroupsService, useValue: {} },
        { provide: GroupMembersService, useValue: {} },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/profile', Profile);
    const close = vi.fn();
    component.coverPicker!.nativeElement.close = close;
    component.avatarPicker!.nativeElement.close = close;
    return { component, harness, users, close };
  }
  afterEach(() => localStorage.clear());

  it('keeps the cover, avatar, username and all five activity counters', async () => {
    const { component, harness } = await setup();
    expect(harness.routeNativeElement!.querySelector('.cover')).not.toBeNull();
    for (const selector of ['.profile-avatar img', '.topbar-avatar img']) {
      expect(harness.routeNativeElement!.querySelector(selector)!.getAttribute('src')).toBe(
        PROFILE_AVATARS[1].src,
      );
    }
    expect(harness.routeNativeElement!.querySelector('h1')!.textContent).toContain('Lu');
    expect(component.readingCounts()).toEqual({ wantToRead: '1', inProgress: '2', finished: '3' });
    expect(component.createdStoriesCount()).toBe('4');
    expect(component.activeGroupsCount()).toBe('5');
    expect(harness.routeNativeElement!.textContent).toContain('Historias favoritas');
    expect(harness.routeNativeElement!.querySelectorAll('.avatar-option')).toHaveLength(6);
  });

  it('previews and cancels a cover without persisting a change', async () => {
    const { component, users } = await setup();
    component.selectCover(4);
    expect(component.selectedCoverIndex).toBe(4);
    component.closeCoverPicker();
    expect(component.selectedCoverIndex).toBe(2);
    expect(users.updateProfileAppearance).not.toHaveBeenCalled();
  });

  it('saves an avatar once and prevents closing while the request is pending', async () => {
    const { component, users, close } = await setup();
    const pending = new Subject<{ coverIndex: number; avatarIndex: number; configured: boolean }>();
    users.updateProfileAvatar.mockReturnValue(pending);
    component.selectAvatar(5);
    component.saveAvatar();
    component.saveAvatar();
    const event = new Event('cancel', { cancelable: true });
    component.closeAvatarPicker(event);
    expect(event.defaultPrevented).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(users.updateProfileAvatar).toHaveBeenCalledExactlyOnceWith(5);
    pending.next({ coverIndex: 2, avatarIndex: 5, configured: true });
    pending.complete();
    expect(component.currentAvatar?.name).toBe('Misterio');
    expect(close).toHaveBeenCalled();
    expect(users.updateProfileAppearance).not.toHaveBeenCalled();
  });

  it('shows an error instead of inventing zero activity counts', async () => {
    const { component, users } = await setup();
    users.getProfileActivity.mockReturnValue(throwError(() => new Error('offline')));
    component.loadActivity();
    expect(component.readingCounts().wantToRead).toBe('—');
    expect(component.activityError()).not.toBe('');
  });

  it('allows usernames up to 30 characters in profile settings', async () => {
    const { component, users, harness } = await setup();
    component.usernameDraft = 'a'.repeat(30);
    component.saveUsername();
    expect(users.updateUser).toHaveBeenCalledWith('me', {
      username: 'a'.repeat(30), email: 'me@example.test',
    });
    component.settingsMode.set('username');
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('#profile-username')?.getAttribute('maxlength')).toBe('30');
    component.usernameDraft = 'a'.repeat(31);
    component.saveUsername();
    expect(component.usernameError()).toContain('30 caracteres');
    expect(users.updateUser).toHaveBeenCalledTimes(1);
  });
});
