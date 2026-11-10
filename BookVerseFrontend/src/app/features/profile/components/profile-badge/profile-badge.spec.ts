import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TokenService } from '../../../../core/services/token.service';
import { UserService } from '../../services/user.service';
import { ProfileBadge } from './profile-badge';

describe('Profile badge', () => {
  function setup(admin: boolean) {
    const users = {
      getProfileBadge: vi.fn(() => of({ badge: 'FOUNDING_WRITER' as const })),
      updateProfileBadge: vi.fn(() => of({ badge: 'FOUNDING_READER_1' as const })),
    };
    TestBed.configureTestingModule({ imports: [ProfileBadge], providers: [
      { provide: UserService, useValue: users },
      { provide: TokenService, useValue: { hasAnyRole: () => admin } },
    ] });
    const fixture = TestBed.createComponent(ProfileBadge);
    fixture.componentRef.setInput('userId', 'profile-id');
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement | null;
    if (dialog) dialog.close = vi.fn();
    return { fixture, users };
  }
  it('shows the assigned badge without editing controls to a non-admin', () => {
    const { fixture, users } = setup(false);
    expect(fixture.nativeElement.textContent).toContain('Escritor fundador');
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toContain('founding-writer.jpg');
    expect(fixture.nativeElement.querySelector('.edit')).toBeNull();
    fixture.componentInstance.setBadge('FOUNDING_READER_1');
    expect(users.updateProfileBadge).not.toHaveBeenCalled();
  });
  it('allows an admin to choose a single badge for the viewed user', () => {
    const { fixture, users } = setup(true);
    expect(fixture.nativeElement.querySelector('.edit')).not.toBeNull();
    fixture.componentInstance.setBadge('FOUNDING_READER_1');
    expect(users.updateProfileBadge).toHaveBeenCalledWith('profile-id', 'FOUNDING_READER_1');
    expect(fixture.componentInstance.badge()).toBe('FOUNDING_READER_1');
  });
  it('retains the previous badge and reports an error if saving fails', () => {
    const { fixture, users } = setup(true);
    users.updateProfileBadge.mockReturnValueOnce(throwError(() => new Error('offline')));
    fixture.componentInstance.setBadge('FOUNDING_READER_1');
    expect(fixture.componentInstance.badge()).toBe('FOUNDING_WRITER');
    expect(fixture.componentInstance.error()).toContain('No pudimos guardar');
  });
});
