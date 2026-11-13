import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Register } from './register';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  const auth = { register: vi.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    })
      .compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('accepts usernames up to 30 characters', () => {
    const username = component.registerForm.controls.username;
    username.setValue('a'.repeat(30));
    expect(username.valid).toBe(true);
    username.setValue('a'.repeat(31));
    expect(username.hasError('maxlength')).toBe(true);
  });

  it('offers account recovery when registration reports an existing email', () => {
    auth.register.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { message: 'Email is already in use' },
    })));
    component.registerForm.setValue({ username: 'reader', email: 'reader@example.com', password: 'Password1!' });
    component.onSubmit();
    fixture.detectChanges();
    expect(component.showRecoveryLink).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"] a')?.getAttribute('href')).toBe('/forgot-password');
  });
});
