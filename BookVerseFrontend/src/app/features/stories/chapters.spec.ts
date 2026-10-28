import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject, throwError } from 'rxjs';
import { ChapterService } from './services/chapter.service';
import { StoryService } from './services/story.services';
import { StoryPermissions } from './services/story-permissions.service';
import { ChapterForm } from './pages/chapter-form/chapter-form';
import { ChapterList } from './pages/chapter-list/chapter-list';
import { ChapterReader } from './pages/chapter-reader/chapter-reader';
import { StoryAccessType } from './models/story-access-type';
import { ChapterResponse } from './models/chapter-response';
import { StoryDetailResponse } from './models/story-detail-response';
import { PageResponse } from './models/page-response';
import { TokenService } from '../../core/services/token.service';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { UserService } from '../profile/services/user.service';
import { ReadingStatusService } from './services/reading-status.service';
import { ReadingStatusResponse } from './models/reading-status-response';

const chapter: ChapterResponse = {
  idExternal: 'chapter',
  storyId: 'story',
  storyTitle: 'Historia real',
  chapterNumber: 1,
  title: 'Capítulo real',
  content: 'Contenido del capítulo.',
  published: false,
  deleted: false,
  createdAt: '',
  updatedAt: '',
};
const story: StoryDetailResponse = {
  idExternal: 'story',
  authorId: 'owner',
  title: 'Historia real',
  description: 'Descripción',
  accessType: StoryAccessType.FREE,
  hidden: false,
  deleted: false,
  createdAt: '',
  updatedAt: '',
  chaptersCount: 1,
  chapters: [chapter],
};
const page = (content: ChapterResponse[], number = 0) =>
  ({
    content,
    totalElements: 21,
    totalPages: 2,
    number,
    first: number === 0,
    last: number === 1,
  }) as PageResponse<ChapterResponse>;
beforeEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe('Chapter API contracts', () => {
  it('paginates chapters and uses distinct create/update/delete contracts', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: TokenService, useValue: { getToken: () => 'token' } },
      ],
    });
    const service = TestBed.inject(ChapterService);
    const http = TestBed.inject(HttpTestingController);
    service.getByStory('story/id', 1).subscribe();
    const list = http.expectOne((r) => r.url.endsWith('/story/story%2Fid'));
    expect(list.request.params.get('page')).toBe('1');
    expect(list.request.params.get('size')).toBe('20');
    expect(list.request.headers.get('Authorization')).toBe('Bearer token');
    list.flush(page([chapter], 1));
    const content = { title: 'Título', content: 'Contenido', published: false };
    service.create({ ...content, storyId: 'story' }).subscribe();
    const create = http.expectOne('http://localhost:8080/api/chapters');
    expect(create.request.body).toEqual({ ...content, storyId: 'story' });
    create.flush(chapter);
    service.update('chapter/id', content).subscribe();
    const update = http.expectOne('http://localhost:8080/api/chapters/chapter%2Fid');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(content);
    update.flush(chapter);
    service.delete('chapter/id').subscribe();
    const remove = http.expectOne('http://localhost:8080/api/chapters/chapter%2Fid');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null, { status: 204, statusText: 'No Content' });
    http.verify();
  });
});

async function setup(mode: 'list' | 'create' | 'edit' | 'reader', allowed = true) {
  const getStory = vi.fn(() => of(story));
  const getById = vi.fn(() => of(chapter));
  const getByStory = vi.fn(() => of(page([chapter])));
  const create = vi.fn();
  const update = vi.fn();
  const remove = vi.fn();
  const currentUser = vi.fn((): { idExternal: string } | null => null);
  const getStatuses = vi.fn(() => of([] as ReadingStatusResponse[]));
  const createStatus = vi.fn();
  const updateStatus = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'stories/:id/chapters/new', component: ChapterForm },
        { path: 'stories/:id/chapters/:chapterId/edit', component: ChapterForm },
        { path: 'stories/:id/chapters/:chapterId', component: ChapterReader },
        { path: 'stories/:id/chapters', component: ChapterList },
      ]),
      {
        provide: ChapterService,
        useValue: { getById, getByStory, create, update, delete: remove },
      },
      { provide: StoryService, useValue: { getById: getStory } },
      { provide: StoryPermissions, useValue: { canManage: () => allowed } },
      {
        provide: UserService,
        useValue: { loadCurrentUser: () => of(null), currentUser },
      },
      {
        provide: ReadingStatusService,
        useValue: { getByUser: getStatuses, create: createStatus, update: updateStatus },
      },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const url =
    mode === 'list'
      ? '/stories/story/chapters'
      : mode === 'create'
        ? '/stories/story/chapters/new'
        : mode === 'edit'
          ? '/stories/story/chapters/chapter/edit'
          : '/stories/story/chapters/chapter';
  await harness.navigateByUrl(url);
  const component = harness.routeDebugElement!.componentInstance as
    ChapterForm | ChapterList | ChapterReader;
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  return {
    harness,
    component,
    getStory,
    getById,
    getByStory,
    create,
    update,
    remove,
    navigate,
    currentUser,
    getStatuses,
    createStatus,
    updateStatus,
  };
}

describe('Chapter management form', () => {
  it('keeps the same formatting tools and formatted content when moving from create to edit', async () => {
    const { component, harness, getById, create, update } = await setup('create');
    const form = component as ChapterForm;
    const tools = () =>
      Array.from(harness.routeNativeElement!.querySelectorAll('.format-toolbar button'), (button) =>
        button.getAttribute('aria-label'),
      );
    const createTools = tools();
    expect(createTools).toEqual([
      'Negrita',
      'Cursiva',
      'Subrayado',
      'Alinear a la izquierda',
      'Lista',
      'Cita',
    ]);
    const html =
      '<p>Un <b>capítulo</b> con <i>formato</i>.</p><ul><li>Un detalle</li></ul><blockquote>Una cita</blockquote>';
    const editor = harness.routeNativeElement!.querySelector<HTMLElement>('#chapter-content')!;
    editor.innerHTML = html;
    editor.dispatchEvent(new Event('input'));
    form.form.controls.title.setValue('Capítulo con formato');
    create.mockReturnValue(of(chapter));
    form.saveDraft();
    expect(create.mock.calls[0][0].content).toBe(html);

    getById.mockReturnValueOnce(of({ ...chapter, content: html }));
    await harness.navigateByUrl('/stories/story/chapters/chapter/edit');
    const edit = harness.routeDebugElement!.componentInstance as ChapterForm;
    expect(tools()).toEqual(createTools);
    expect(harness.routeNativeElement!.querySelector('#chapter-content')!.innerHTML).toBe(html);
    update.mockReturnValue(of(chapter));
    edit.publish();
    expect(update.mock.calls[0][1].content).toBe(html);
  });
  it('loads safe markup, rejects visually empty content and preserves edits after a failed save', async () => {
    const { component, harness, getById, update } = await setup('edit');
    const form = component as ChapterForm;
    getById.mockReturnValueOnce(
      of({ ...chapter, content: '<p>Texto</p><img src="x" onerror="alert(1)">' }),
    );
    form.load();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[onerror]')).toBeNull();
    const editor = harness.routeNativeElement!.querySelector<HTMLElement>('#chapter-content')!;
    editor.innerHTML = '<p><br></p><p>&nbsp;</p>';
    editor.dispatchEvent(new Event('input'));
    form.publish();
    expect(update).not.toHaveBeenCalled();
    expect(form.form.controls.content.invalid).toBe(true);

    editor.innerHTML = '<p>Texto <b>editado</b></p>';
    editor.dispatchEvent(new Event('input'));
    update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    form.publish();
    harness.detectChanges();
    expect(editor.innerHTML).toBe('<p>Texto <b>editado</b></p>');
    expect(form.form.controls.content.value).toBe(editor.innerHTML);
    expect(editor.getAttribute('contenteditable')).toBe('true');
  });
  it.each([false, true])(
    'creates a trimmed chapter with published=%s and blocks duplicate submits',
    async (published) => {
      const { component, create, navigate } = await setup('create');
      const form = component as ChapterForm;
      const pending = new Subject<ChapterResponse>();
      create.mockReturnValue(pending);
      form.form.patchValue({ title: '  Título nuevo  ', content: '  Texto del capítulo.  ' });
      if (published) form.publish();
      else form.saveDraft();
      form.publish();
      form.saveDraft();
      expect(create).toHaveBeenCalledExactlyOnceWith({
        storyId: 'story',
        title: 'Título nuevo',
        content: 'Texto del capítulo.',
        published,
      });
      expect(form.form.controls.published.value).toBe(published);
      pending.next({ ...chapter, published });
      pending.complete();
      expect(navigate).toHaveBeenCalledWith(['/stories', 'story', 'chapters']);
    },
  );
  it('updates without changing story association or chapter number', async () => {
    const { component, update } = await setup('edit');
    const form = component as ChapterForm;
    update.mockReturnValue(of(chapter));
    expect(form.form.controls.title.value).toBe('Capítulo real');
    form.publish();
    expect(update).toHaveBeenCalledWith('chapter', {
      title: 'Capítulo real',
      content: 'Contenido del capítulo.',
      published: true,
    });
  });
  it('rejects whitespace-only input and preserves input on server failure', async () => {
    const { component, create } = await setup('create');
    const form = component as ChapterForm;
    form.form.patchValue({ title: '   ', content: '   ' });
    form.publish();
    expect(create).not.toHaveBeenCalled();
    form.form.patchValue({ title: 'Título', content: 'Contenido' });
    create.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    form.saveDraft();
    expect(form.form.enabled).toBe(true);
    expect(form.form.controls.content.value).toBe('Contenido');
    expect(form.errorMessage()).toContain('permiso');
  });
  it('keeps failed and unauthorized loads disabled', async () => {
    const { component, harness, getById, update } = await setup('edit', false);
    const form = component as ChapterForm;
    form.publish();
    expect(update).not.toHaveBeenCalled();
    expect(form.form.disabled).toBe(true);
    expect(
      harness
        .routeNativeElement!.querySelector('#chapter-content')!
        .getAttribute('contenteditable'),
    ).toBe('false');
    expect(
      Array.from(
        harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('.format-toolbar button'),
      ).every((button) => button.disabled),
    ).toBe(true);
    getById.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })));
    form.load();
    form.saveDraft();
    expect(form.loadFailed()).toBe(true);
    expect(form.form.disabled).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });
  it('blocks mismatched chapter/story URLs', async () => {
    const { component, getById, update } = await setup('edit');
    const form = component as ChapterForm;
    getById.mockReturnValueOnce(of({ ...chapter, storyId: 'another-story' }));
    form.load();
    form.publish();
    expect(form.errorMessage()).toContain('no pertenece');
    expect(form.form.disabled).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });
  it('cancels stale chapter loads when navigating between editors', async () => {
    const { component, getById, harness } = await setup('edit');
    const form = component as ChapterForm;
    const old = new Subject<ChapterResponse>();
    getById.mockReturnValueOnce(old);
    form.load();
    getById.mockReturnValueOnce(
      of({ ...chapter, idExternal: 'second', title: 'Segundo capítulo' }),
    );
    await harness.navigateByUrl('/stories/story/chapters/second/edit');
    old.next(chapter);
    expect(form.chapterId()).toBe('second');
    expect(form.form.controls.title.value).toBe('Segundo capítulo');
  });
});

describe('Chapter list and deletion', () => {
  it('shows total chapter count, requests later pages and previews drafts for managers', async () => {
    const { component, harness, getByStory } = await setup('list');
    const list = component as ChapterList;
    expect(harness.routeNativeElement!.querySelectorAll('app-sidebar')).toHaveLength(0);
    expect(harness.routeNativeElement!.textContent).toContain('21');
    expect(harness.routeNativeElement!.textContent).toContain('Ver borrador');
    list.load(1);
    expect(getByStory).toHaveBeenLastCalledWith('story', 1);
  });
  it('hides management actions for readers and displays retryable errors', async () => {
    const { component, harness, getByStory } = await setup('list', false);
    const list = component as ChapterList;
    expect(harness.routeNativeElement!.querySelector('.new-chapter-button')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('.chapter-action.edit')).toBeNull();
    getByStory.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    list.load();
    expect(list.errorMessage()).toContain('permiso');
    expect(list.isLoading()).toBe(false);
    list.load();
    expect(list.errorMessage()).toBeNull();
  });
  it('cancels deletion, prevents duplicate deletes and returns from an empty last page', async () => {
    const { component, harness, remove, getByStory } = await setup('list');
    const list = component as ChapterList;
    const dialog = harness.routeNativeElement!.querySelector('dialog')!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    list.confirmDelete(chapter);
    list.cancelDelete();
    expect(remove).not.toHaveBeenCalled();
    getByStory.mockReturnValueOnce(of(page([chapter], 1)));
    list.load(1);
    const pending = new Subject<void>();
    remove.mockReturnValue(pending);
    list.confirmDelete(chapter);
    list.deleteChapter();
    list.deleteChapter();
    expect(remove).toHaveBeenCalledTimes(1);
    pending.next();
    pending.complete();
    expect(getByStory).toHaveBeenLastCalledWith('story', 0);
  });
  it('keeps the chapter and dialog when deletion fails', async () => {
    const { component, harness, remove } = await setup('list');
    const list = component as ChapterList;
    const dialog = harness.routeNativeElement!.querySelector('dialog')!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    remove.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    list.confirmDelete(chapter);
    list.deleteChapter();
    expect(list.chapters()).toHaveLength(1);
    expect(list.deleteError()).toContain('permiso');
    expect(dialog.hasAttribute('open')).toBe(true);
  });
});

describe('Chapter detail loading', () => {
  it.each([false, true])(
    'explains a plan restriction without hiding the chapter when updating existing progress=%s',
    async (existing) => {
      const { component, harness, currentUser, getStatuses, createStatus, updateStatus } =
        await setup('reader');
      const reader = component as ChapterReader;
      currentUser.mockReturnValue({ idExternal: 'reader' });
      if (existing) {
        getStatuses.mockReturnValueOnce(
          of([
            {
              idExternal: 'reading',
              userId: 'reader',
              bookId: null,
              storyId: 'story',
              status: 'IN_PROGRESS',
              progressType: 'CHAPTER',
              progressValue: 1,
              startedAt: null,
              finishedAt: null,
              updatedAt: '',
            },
          ]),
        );
      }
      const operation = existing ? updateStatus : createStatus;
      operation.mockReturnValueOnce(
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

      reader.retry();
      harness.detectChanges();

      expect(operation).toHaveBeenCalledTimes(1);
      expect(reader.chapter()?.content).toBe(chapter.content);
      expect(reader.errorMessage()).toBeNull();
      expect(reader.isSavingProgress()).toBe(false);
      expect(reader.progressMessage()).toBeNull();
      expect(harness.routeNativeElement!.textContent).toContain(
        'Tu plan actual no permite guardar el progreso de historias Premium.',
      );
    },
  );
  it('keeps other progress failures distinct from a subscription restriction', async () => {
    const { component, currentUser, createStatus } = await setup('reader');
    const reader = component as ChapterReader;
    currentUser.mockReturnValue({ idExternal: 'reader' });
    createStatus.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));

    reader.retry();

    expect(reader.progressError()).toBe('El capítulo cargó, pero no pudimos guardar tu progreso.');
    expect(reader.chapter()?.content).toBe(chapter.content);
    expect(reader.isSavingProgress()).toBe(false);
  });
  it('blocks a chapter belonging to a different story', async () => {
    const { component, getById, harness } = await setup('reader');
    const reader = component as ChapterReader;
    getById.mockReturnValueOnce(of({ ...chapter, storyId: 'different' }));
    reader.retry();
    harness.detectChanges();
    expect(reader.chapter()).toBeNull();
    expect(reader.errorMessage()).toContain('no pertenece');
    expect(harness.routeNativeElement!.querySelectorAll('app-sidebar')).toHaveLength(0);
  });
  it('ignores stale responses when changing chapter routes and supports retry', async () => {
    const { component, getById, harness } = await setup('reader');
    const reader = component as ChapterReader;
    const old = new Subject<ChapterResponse>();
    getById.mockReturnValueOnce(old);
    reader.retry();
    getById.mockReturnValueOnce(
      of({ ...chapter, idExternal: 'next', title: 'Capítulo siguiente' }),
    );
    await harness.navigateByUrl('/stories/story/chapters/next');
    old.next(chapter);
    expect(reader.chapter()?.title).toBe('Capítulo siguiente');
    getById.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    reader.retry();
    expect(reader.errorMessage()).toContain('permiso');
    reader.retry();
    expect(reader.errorMessage()).toBeNull();
  });
});
