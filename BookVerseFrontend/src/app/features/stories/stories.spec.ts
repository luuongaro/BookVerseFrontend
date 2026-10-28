import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject, throwError } from 'rxjs';
import { StoryService } from './services/story.services';
import { LibraryService } from '../library/services/library.service';
import { StoryPermissions } from './services/story-permissions.service';
import { StoryList } from './pages/story-list/story-list';
import { StoryForm } from './pages/story-form/story-form';
import { StoryDetail } from './pages/story-detail/story-detail';
import { TokenService } from '../../core/services/token.service';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { StoryAccessType } from './models/story-access-type';
import { StoryDetailResponse } from './models/story-detail-response';
import { PageResponse } from './models/page-response';
import { StoryResponse } from './models/story-response';

const story: StoryDetailResponse = {
  idExternal: 'story',
  authorId: 'owner',
  title: 'Historia real',
  description: '<p>Descripción real</p>',
  accessType: StoryAccessType.FREE,
  hidden: false,
  deleted: false,
  createdAt: '',
  updatedAt: '',
  chaptersCount: 0,
  chapters: [],
};
const page = (content: StoryResponse[], number = 0) =>
  ({
    content,
    totalElements: content.length,
    totalPages: 2,
    number,
    first: number === 0,
    last: number === 1,
  }) as PageResponse<StoryResponse>;

beforeEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
  localStorage.setItem('userId', 'owner');
});
afterEach(() => localStorage.clear());

describe('Stories API contracts', () => {
  it('loads pages and encodes author and story identifiers, including deletion', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: TokenService, useValue: { getToken: () => 'token' } },
      ],
    });
    const service = TestBed.inject(StoryService);
    const http = TestBed.inject(HttpTestingController);
    service.getAll(2).subscribe((result) => expect(result.content).toEqual([story]));
    const all = http.expectOne((r) => r.url.endsWith('/stories'));
    expect(all.request.params.get('page')).toBe('2');
    expect(all.request.params.get('size')).toBe('12');
    expect(all.request.headers.get('Authorization')).toBe('Bearer token');
    all.flush(page([story], 2));
    service.getByAuthor('owner/id', 1).subscribe();
    const author = http.expectOne((r) => r.url.endsWith('/author/owner%2Fid'));
    expect(author.request.params.get('page')).toBe('1');
    author.flush(page([], 1));
    service.getById('story/id').subscribe();
    http.expectOne('http://localhost:8080/api/stories/story%2Fid').flush(story);
    service.delete('story/id').subscribe();
    const remove = http.expectOne('http://localhost:8080/api/stories/story%2Fid');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null, { status: 204, statusText: 'No Content' });
    http.verify();
  });
});

describe('Story management permissions', () => {
  it.each([
    ['owner', '', true],
    ['reader', '', false],
    ['reader', 'ROLE_ADMIN', true],
    ['reader', 'ROLE_MODERATOR', true],
  ])('%s with role %s can manage: %s', (user, role, allowed) => {
    localStorage.setItem('userId', user as string);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TokenService,
          useValue: {
            isAuthenticated: () => true,
            hasAnyRole: (...roles: string[]) => roles.includes(role as string),
          },
        },
      ],
    });
    expect(TestBed.inject(StoryPermissions).canManage(story)).toBe(allowed);
  });
});

describe('Story discovery and personal stories', () => {
  function setup(mine = false) {
    const getAll = vi.fn(() => of(page([story])));
    const getByAuthor = vi.fn(() => of(page([story])));
    TestBed.configureTestingModule({
      imports: [StoryList],
      providers: [provideRouter([]), { provide: StoryService, useValue: { getAll, getByAuthor } }],
    });
    const fixture = TestBed.createComponent(StoryList);
    fixture.componentRef.setInput('mine', mine);
    fixture.detectChanges();
    return { fixture, getAll, getByAuthor };
  }
  it('loads real pages and requests the next page instead of showing example stories', () => {
    const { fixture, getAll } = setup();
    expect(fixture.nativeElement.textContent).toContain('Historia real');
    expect(fixture.nativeElement.textContent).not.toContain('Cartas para la Luna');
    fixture.componentInstance.load(1);
    expect(getAll).toHaveBeenLastCalledWith(1);
  });
  it('requests only the logged-in author for Mis historias', () => {
    const { getAll, getByAuthor } = setup(true);
    expect(getAll).not.toHaveBeenCalled();
    expect(getByAuthor).toHaveBeenCalledWith('owner', 0);
  });
  it('shows an empty state and lets a failed request be retried', () => {
    const { fixture, getAll } = setup();
    getAll.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('conectar');
    getAll.mockReturnValueOnce(of(page([])));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay historias');
  });
});

describe('Story form and details', () => {
  async function setup(
    component: typeof StoryForm | typeof StoryDetail,
    role = true,
    response = of(story),
  ) {
    const getById = vi.fn(() => response);
    const update = vi.fn();
    const create = vi.fn();
    const remove = vi.fn();
    const saveStory = vi.fn(() => of({ idExternal: 'saved' }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'stories/:id/edit', component: StoryForm },
          { path: 'stories/new', component: StoryForm },
          { path: 'stories/:id', component: StoryDetail },
        ]),
        { provide: StoryService, useValue: { getById, update, create, delete: remove } },
        { provide: StoryPermissions, useValue: { canManage: () => role } },
        { provide: LibraryService, useValue: { saveStory } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const instance = await harness.navigateByUrl<StoryForm | StoryDetail>(
      component === StoryForm ? '/stories/story/edit' : '/stories/story',
      component,
    );
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    return { harness, instance, getById, update, create, remove, navigate, saveStory };
  }
  it('sanitizes stored description markup and preserves the original author for an administrator edit', async () => {
    const { harness, instance, update } = await setup(
      StoryForm,
      true,
      of({ ...story, description: '<p>Texto</p><img src="x" onerror="alert(1)">' }),
    );
    const form = instance as StoryForm;
    localStorage.setItem('userId', 'admin');
    expect(harness.routeNativeElement!.querySelector('[onerror]')).toBeNull();
    form.form.controls.title.setValue('  Título cambiado  ');
    update.mockReturnValue(of(story));
    form.onSubmit();
    expect(update.mock.calls[0][1].authorId).toBe('owner');
    expect(update.mock.calls[0][1].title).toBe('Título cambiado');
  });
  it('keeps a failed edit disabled until the story can be reloaded', async () => {
    const { instance, getById, update } = await setup(
      StoryForm,
      true,
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    const form = instance as StoryForm;
    form.onSubmit();
    expect(update).not.toHaveBeenCalled();
    expect(form.form.disabled).toBe(true);
    getById.mockReturnValue(of(story));
    form.load();
    expect(form.form.enabled).toBe(true);
    expect(form.loadFailed()).toBe(false);
  });
  it('blocks an unauthorized edit and rejects whitespace or empty rich text', async () => {
    const { instance, update } = await setup(StoryForm, false);
    const form = instance as StoryForm;
    form.onSubmit();
    expect(update).not.toHaveBeenCalled();
    expect(form.form.disabled).toBe(true);
    form.form.enable();
    form.form.controls.title.setValue('   ');
    expect(form.form.controls.title.invalid).toBe(true);
    form.form.controls.description.setValue('<p><br></p>');
    expect(form.form.controls.description.invalid).toBe(true);
  });
  it('preserves edited input on save failure and prevents duplicate submissions', async () => {
    const { instance, update } = await setup(StoryForm);
    const form = instance as StoryForm;
    const pending = new Subject<StoryResponse>();
    update.mockReturnValue(pending);
    form.form.controls.title.setValue('Nuevo título');
    form.onSubmit();
    form.onSubmit();
    expect(update).toHaveBeenCalledTimes(1);
    pending.error(new HttpErrorResponse({ status: 403 }));
    expect(form.form.enabled).toBe(true);
    expect(form.form.controls.title.value).toBe('Nuevo título');
    expect(form.errorMessage()).toContain('permiso');
  });
  it('offers the first chapter action even when a story has no chapters and permits cancelling deletion', async () => {
    const { instance, harness, remove, navigate } = await setup(StoryDetail);
    const detail = instance as StoryDetail;
    expect(harness.routeNativeElement!.textContent).toContain('Nuevo capítulo');
    const dialog = harness.routeNativeElement!.querySelector('dialog')!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    detail.confirmDelete();
    detail.cancelDelete();
    expect(remove).not.toHaveBeenCalled();
    const pending = new Subject<void>();
    remove.mockReturnValue(pending);
    detail.confirmDelete();
    detail.deleteStory();
    detail.deleteStory();
    expect(remove).toHaveBeenCalledTimes(1);
    pending.error(new HttpErrorResponse({ status: 403 }));
    expect(detail.deleted()).toBe(false);
    expect(detail.deleteError()).toContain('permiso');
    remove.mockReturnValueOnce(of(undefined));
    detail.deleteStory();
    expect(detail.deleted()).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/stories/mine']);
  });
  it('creates a story for the current user and sends trimmed data once', async () => {
    const { harness, create } = await setup(StoryForm);
    const form = await harness.navigateByUrl('/stories/new', StoryForm);
    const pending = new Subject<StoryResponse>();
    create.mockReturnValue(pending);
    form.form.controls.title.setValue('  Nueva historia  ');
    harness.routeNativeElement!.querySelector('#story-description')!.textContent =
      'Descripción nueva';
    form.onSubmit();
    form.onSubmit();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      authorId: 'owner',
      title: 'Nueva historia',
      accessType: StoryAccessType.FREE,
    });
    const text = document.createElement('div');
    text.innerHTML = create.mock.calls[0][0].description;
    expect(text.textContent).toBe('Descripción nueva');
  });
  it('refreshes the story when the route changes and cancels stale responses', async () => {
    const { instance, harness, getById } = await setup(StoryDetail);
    const detail = instance as StoryDetail;
    const old = new Subject<StoryDetailResponse>();
    getById.mockReturnValueOnce(old);
    detail.load();
    getById.mockReturnValueOnce(of({ ...story, idExternal: 'second', title: 'Segunda historia' }));
    await harness.navigateByUrl('/stories/second', StoryDetail);
    old.next(story);
    expect(detail.story()?.title).toBe('Segunda historia');
  });
  it('saves the opened story once and allows retry when personal saving fails', async () => {
    const { instance, saveStory } = await setup(StoryDetail);
    const detail = instance as StoryDetail;
    saveStory.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    detail.saveToLibrary();
    expect(detail.saved()).toBe(false);
    expect(detail.saveError()).toContain('permiso');
    detail.saveToLibrary();
    detail.saveToLibrary();
    expect(saveStory).toHaveBeenCalledTimes(2);
    expect(saveStory).toHaveBeenLastCalledWith('story');
    expect(detail.saved()).toBe(true);
  });
  it('explains the subscription restriction when a Free user saves a Premium story', async () => {
    const { instance, saveStory } = await setup(StoryDetail);
    const detail = instance as StoryDetail;
    saveStory.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: {
              message: 'Free users can only create or update reading statuses for free stories',
            },
          }),
      ),
    );

    detail.saveToLibrary();

    expect(detail.saved()).toBe(false);
    expect(detail.saving()).toBe(false);
    expect(detail.saveError()).toBe(
      'Esta historia es Premium. Tu plan actual solo permite guardar historias gratuitas.',
    );
  });
});
