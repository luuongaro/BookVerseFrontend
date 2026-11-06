import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ChapterReader } from './pages/chapter-reader/chapter-reader';
import { ChapterService } from './services/chapter.service';
import { StoryService } from './services/story.services';
import { ReadingStatusService } from './services/reading-status.service';
import { UserService } from '../profile/services/user.service';
import { ReadingStatusResponse } from './models/reading-status-response';

const reading: ReadingStatusResponse = {
  idExternal: 'reading',
  userId: 'reader',
  storyId: 'story',
  bookId: null,
  status: 'IN_PROGRESS',
  progressType: 'CHAPTER',
  progressValue: 1,
  startedAt: null,
  finishedAt: null,
  updatedAt: '',
};

describe('Chapter reader reading-state contract', () => {
  async function setup(status: string) {
    const existing = { ...reading, status };
    const update = vi.fn(() => of(existing));
    const create = vi.fn();
    const currentUser = signal({ idExternal: 'reader' });
    const chapter = {
      idExternal: 'chapter',
      storyId: 'story',
      storyTitle: 'Historia',
      chapterNumber: 2,
      title: 'Capítulo',
      content: 'Contenido',
      published: true,
    };
    TestBed.configureTestingModule({
      imports: [ChapterReader],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: {} },
            paramMap: of(convertToParamMap({ id: 'story', chapterId: 'chapter' })),
          },
        },
        {
          provide: UserService,
          useValue: { currentUser, loadCurrentUser: () => of(currentUser()) },
        },
        { provide: ChapterService, useValue: { getById: () => of(chapter) } },
        {
          provide: StoryService,
          useValue: {
            getById: () =>
              of({
                idExternal: 'story',
                title: 'Historia',
                chapters: [chapter],
                publishedChaptersCount: 1,
              }),
          },
        },
        {
          provide: ReadingStatusService,
          useValue: { getByUser: () => of([existing]), update, create },
        },
      ],
    });
    const fixture = TestBed.createComponent(ChapterReader);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, update, create };
  }

  it('keeps a finished story finished when opening one of its chapters', async () => {
    const { fixture, update, create } = await setup('FINISHED');
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(fixture.componentInstance.readingStatus()?.status).toBe('FINISHED');
    expect(fixture.componentInstance.progressMessage()).toContain('finalizada');
  });

  it.each(['IN_PROGRESS', 'RE_READING'])(
    'preserves the %s reading state while advancing a chapter',
    async (status) => {
      const { update } = await setup(status);
      expect(update).toHaveBeenCalledExactlyOnceWith(
        'reading',
        expect.objectContaining({
          status,
          storyId: 'story',
          progressType: 'CHAPTER',
          progressValue: 2,
        }),
      );
    },
  );
});
