import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { UserSearch } from './user-search';
import { API_URL } from '../../../../core/api/api.config';

describe('User discovery and selection', () => {
  const user = { idExternal: 'reader-id', username: 'Marina', email: 'private@example.test' };
  const page = (content = [user], number = 0, totalPages = 1) => ({ content, number, totalPages });
  const tick = () => new Promise((resolve) => setTimeout(resolve, 280));

  function setup(selectable = false) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(UserSearch);
    fixture.componentRef.setInput('selectable', selectable);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      http: TestBed.inject(HttpTestingController),
    };
  }

  afterEach(() => TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true }));

  it('uses the public endpoint and links to profiles without rendering email', async () => {
    const { fixture, http } = setup();
    await tick();
    http.expectOne((request) => request.url === `${API_URL}/users/profiles`).flush(page());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('@Marina');
    expect(fixture.nativeElement.textContent).not.toContain('private@example.test');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/users/reader-id');
  });

  it('cancels obsolete searches, accepts @ and keeps the query when paginating', async () => {
    const { component, http } = setup();
    await tick();
    const obsolete = http.expectOne((request) => request.url.endsWith('/users/profiles'));
    component.search({ target: { value: '@Mar' } } as unknown as Event);
    component.search({ target: { value: '@Marina' } } as unknown as Event);
    expect(obsolete.cancelled).toBe(true);
    await tick();
    const search = http.expectOne((request) => request.params.get('username') === 'Marina');
    expect(search.request.params.get('page')).toBe('0');
    search.flush(page([user], 0, 2));
    component.request(1);
    await tick();
    http
      .expectOne(
        (request) =>
          request.params.get('username') === 'Marina' && request.params.get('page') === '1',
      )
      .flush(page([user], 1, 2));
    expect(component.page()).toBe(1);
  });

  it('prevents selecting existing members or selecting while an addition is pending', async () => {
    const { fixture, component, http } = setup(true);
    fixture.componentRef.setInput('memberIds', ['reader-id']);
    await tick();
    http.expectOne((request) => request.url.endsWith('/users/profiles')).flush(page());
    fixture.detectChanges();
    const selected = vi.spyOn(component.userSelected, 'emit');
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
    component.select(user);
    expect(selected).not.toHaveBeenCalled();
    fixture.componentRef.setInput('memberIds', []);
    fixture.componentRef.setInput('disabled', true);
    component.select(user);
    expect(selected).not.toHaveBeenCalled();
    fixture.componentRef.setInput('disabled', false);
    component.select(user);
    expect(selected).toHaveBeenCalledExactlyOnceWith(user);
  });

  it('shows a recoverable error and supports an empty result', async () => {
    const { fixture, component, http } = setup();
    await tick();
    http
      .expectOne((request) => request.url.endsWith('/users/profiles'))
      .flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    component.request(0);
    await tick();
    http.expectOne((request) => request.url.endsWith('/users/profiles')).flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No encontramos usuarios');
    expect(component.error()).toBe('');
  });
});
