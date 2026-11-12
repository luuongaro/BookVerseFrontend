import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { StoryList } from './story-list';
import { StoryService } from '../../services/story.services';

describe('Story search', () => {
  it('shows the public author and applies filters before pagination', () => {
    const page = { content: [{ idExternal: 'story', title: 'Una historia', authorUsername: 'Luna', genre: 'Fantasía', description: '', accessType: 'FREE' }], number: 0, totalElements: 1, totalPages: 1, first: true, last: true };
    const stories = { getToExplore: vi.fn(() => of(page)), searchExplore: vi.fn(() => of(page)) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StoryService, useValue: stories }] });
    const fixture = TestBed.createComponent(StoryList);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.story-cover').textContent).toContain('Luna');
    fixture.componentInstance.titleFilter = ' historia ';
    fixture.componentInstance.authorFilter = ' Luna ';
    fixture.componentInstance.genreFilter = ' Fantasía ';
    fixture.componentInstance.friendsOnly = true;
    fixture.componentInstance.search();
    expect(stories.searchExplore).toHaveBeenCalledWith('historia', 'Luna', 'Fantasía', true, 0);
    fixture.componentInstance.load(1);
    expect(stories.searchExplore).toHaveBeenCalledWith('historia', 'Luna', 'Fantasía', true, 1);
  });
});
