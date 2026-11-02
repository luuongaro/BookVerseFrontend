import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { FavoriteStories } from './favorite-stories';
import { UserService } from '../../services/user.service';

describe('Profile favorite stories', () => {
  const story = {
    idExternal: 'story',
    title: 'Una historia',
    description: '',
    accessType: 'FREE' as const,
  };
  function setup(editable = false) {
    const users = {
      getFavoriteStories: vi.fn(() => of({ content: [story], number: 0, totalPages: 1 })),
      removeFavoriteStory: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UserService, useValue: users }],
    });
    const fixture = TestBed.createComponent(FavoriteStories);
    fixture.componentRef.setInput('userId', 'reader');
    fixture.componentRef.setInput('editable', editable);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, users };
  }

  it('links to real favorites and does not offer removal on another profile', () => {
    const { fixture, component, users } = setup();
    expect(users.getFavoriteStories).toHaveBeenCalledExactlyOnceWith('reader', 0);
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/stories/story');
    expect(fixture.nativeElement.querySelector('.remove-favorite')).toBeNull();
    component.remove(story);
    expect(users.removeFavoriteStory).not.toHaveBeenCalled();
  });

  it('only removes a favorite once while saving and refreshes the list', () => {
    const { component, users } = setup(true);
    const pending = new Subject<undefined>();
    users.removeFavoriteStory.mockReturnValue(pending);
    component.remove(story);
    component.remove(story);
    expect(users.removeFavoriteStory).toHaveBeenCalledExactlyOnceWith('story');
    users.getFavoriteStories.mockReturnValue(of({ content: [], number: 0, totalPages: 0 }));
    pending.next(undefined);
    pending.complete();
    expect(component.stories()).toEqual([]);
    expect(component.removing()).toBeNull();
  });

  it('keeps the favorite when deletion fails', () => {
    const { component, users } = setup(true);
    users.removeFavoriteStory.mockReturnValue(throwError(() => new Error('offline')));
    component.remove(story);
    expect(component.stories()).toEqual([story]);
    expect(component.actionError()).not.toBe('');
  });
});
