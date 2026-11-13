import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Register } from './register';
import { provideRouter } from '@angular/router';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideRouter([])],
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
});
