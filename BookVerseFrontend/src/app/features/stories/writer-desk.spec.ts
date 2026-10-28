import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject, throwError } from 'rxjs';
import { WriterDesk } from './pages/writer-desk/writer-desk';
import { StoryService } from './services/story.services';
import { ChapterService } from './services/chapter.service';
import { StoryResponse } from './models/story-response';
import { ChapterResponse } from './models/chapter-response';
import { PageResponse } from './models/page-response';
import { StoryAccessType } from './models/story-access-type';
import { storiesRoutes } from './stories.routes';

const story: StoryResponse = {
  idExternal: 'story',
  authorId: 'author',
  title: 'Mi historia',
  description: 'Descripción',
  accessType: StoryAccessType.FREE,
  hidden: false,
  deleted: false,
  createdAt: '',
  updatedAt: '',
  chaptersCount: 2,
};
const draft: ChapterResponse = {
  idExternal: 'draft',
  storyId: 'story',
  storyTitle: story.title,
  chapterNumber: 1,
  title: 'Capítulo pendiente',
  content: 'Texto privado',
  published: false,
  deleted: false,
  createdAt: '',
  updatedAt: '',
};
const published: ChapterResponse = {
  ...draft,
  idExternal: 'published',
  chapterNumber: 2,
  title: 'Capítulo publicado',
  published: true,
};
const page = <T>(content: T[], number = 0, totalPages = 1, totalElements = content.length) =>
  ({
    content,
    number,
    totalPages,
    totalElements,
    first: number === 0,
    last: number >= totalPages - 1,
  }) as PageResponse<T>;

beforeEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
  localStorage.setItem('userId', 'author');
});
afterEach(() => localStorage.clear());

async function setup(
  options: { url?: string; missingUser?: boolean; empty?: boolean; failure?: boolean } = {},
) {
  if (options.missingUser) localStorage.removeItem('userId');
  const getByAuthor = vi.fn(() => of(page(options.empty ? [] : [story])));
  const getByStory = vi.fn(() => of(page([draft, published])));
  if (options.failure)
    getByAuthor.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'writer', component: WriterDesk },
        { path: 'stories', children: storiesRoutes },
      ]),
      { provide: StoryService, useValue: { getByAuthor } },
      { provide: ChapterService, useValue: { getByStory } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const desk = await harness.navigateByUrl(options.url ?? '/writer', WriterDesk);
  return { harness, desk, getByAuthor, getByStory };
}

describe('Writing desk', () => {
  it('opens the existing personal-stories URL and loads only the current author with drafts and published chapters', async () => {
    const { harness, desk, getByAuthor, getByStory } = await setup({ url: '/stories/mine' });
    expect(getByAuthor).toHaveBeenCalledExactlyOnceWith('author', 0);
    expect(getByStory).toHaveBeenCalledExactlyOnceWith('story', 0);
    expect(desk.selected()?.title).toBe('Mi historia');
    const view = harness.routeNativeElement!;
    expect(view.textContent).toContain('Borrador');
    expect(view.textContent).toContain('Publicado');
    expect(view.querySelector('a[href="/stories/new"]')).not.toBeNull();
    expect(view.querySelector('a[href="/stories/story/edit"]')).not.toBeNull();
    expect(view.querySelector('a[href="/stories/story/chapters/new"]')).not.toBeNull();
    expect(view.querySelector('a[href="/stories/story/chapters/draft/edit"]')).not.toBeNull();
    expect(view.querySelector('a[href="/stories/story/chapters"]')).not.toBeNull();
  });

  it('does not request stories or chapters when the user is missing', async () => {
    const { desk, getByAuthor, getByStory } = await setup({ missingUser: true });
    expect(getByAuthor).not.toHaveBeenCalled();
    expect(getByStory).not.toHaveBeenCalled();
    expect(desk.error()).toContain('iniciar sesión');
    expect(desk.loading()).toBe(false);
  });

  it('offers creation when the author has no stories', async () => {
    const { harness, desk, getByStory } = await setup({ empty: true });
    expect(harness.routeNativeElement!.textContent).toContain('Todavía no creaste historias');
    expect(harness.routeNativeElement!.querySelector('.empty-desk a')?.getAttribute('href')).toBe(
      '/stories/new',
    );
    expect(getByStory).not.toHaveBeenCalled();
    expect(desk.selected()).toBeNull();
  });

  it('shows retryable story errors instead of an empty desk', async () => {
    const { harness, desk } = await setup({ failure: true });
    expect(desk.error()).toContain('Intentá nuevamente');
    expect(harness.routeNativeElement!.querySelector('.empty-desk')).toBeNull();
    desk.loadStories();
    expect(desk.error()).toBe('');
    expect(desk.selected()?.idExternal).toBe('story');
  });

  it('keeps chapter errors separate from the author list and supports retry', async () => {
    const { desk, getByStory } = await setup();
    getByStory.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    desk.loadChapters();
    expect(desk.error()).toBe('');
    expect(desk.chapterError()).toContain('permiso');
    expect(desk.selected()?.idExternal).toBe('story');
    expect(desk.chapterResult()).toBeNull();
    expect(desk.loadingChapters()).toBe(false);
    desk.loadChapters();
    expect(desk.chapterError()).toBe('');
    expect(desk.chapterResult()?.content).toHaveLength(2);
  });

  it('paginates stories and chapters independently and cancels stale chapter requests', async () => {
    const { desk, getByAuthor, getByStory } = await setup();
    const other = { ...story, idExternal: 'other', title: 'Otra historia' };
    getByAuthor.mockReturnValueOnce(of(page([story, other], 1, 3, 30)));
    desk.loadStories(1);
    expect(getByAuthor).toHaveBeenLastCalledWith('author', 1);
    const pending = new Subject<PageResponse<ChapterResponse>>();
    getByStory.mockReturnValueOnce(pending);
    desk.loadChapters(1);
    expect(getByStory).toHaveBeenLastCalledWith('story', 1);
    getByStory.mockReturnValueOnce(
      of(page([{ ...draft, storyId: 'other', title: 'Nuevo borrador' }])),
    );
    desk.selectStory(other);
    pending.next(page([published]));
    expect(getByStory).toHaveBeenLastCalledWith('other', 0);
    expect(desk.selected()?.idExternal).toBe('other');
    expect(desk.chapterResult()?.content[0].title).toBe('Nuevo borrador');
    expect(desk.chapterPage()).toBe(0);
  });

  it('does not expose management links for another author returned by mistake', async () => {
    const { desk, harness, getByAuthor, getByStory } = await setup();
    getByStory.mockClear();
    getByAuthor.mockReturnValueOnce(of(page([{ ...story, authorId: 'someone-else' }])));
    desk.loadStories();
    harness.detectChanges();
    expect(desk.error()).toContain('tus historias');
    expect(desk.selected()).toBeNull();
    expect(getByStory).not.toHaveBeenCalled();
    expect(harness.routeNativeElement!.querySelector('a[href="/stories/story/edit"]')).toBeNull();
  });

  it('rejects chapters from a different story', async () => {
    const { desk, getByStory } = await setup();
    getByStory.mockReturnValueOnce(of(page([{ ...draft, storyId: 'someone-else' }])));
    desk.loadChapters();
    expect(desk.chapterError()).toContain('capítulos');
    expect(desk.chapterResult()).toBeNull();
  });
});
