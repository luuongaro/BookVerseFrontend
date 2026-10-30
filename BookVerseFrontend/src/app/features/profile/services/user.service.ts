import { HttpClient } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { of, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_URL } from '../../../core/api/api.config';
import { User } from '../models/user.model';
import { UserProfile, UserProfileStory } from '../models/user-profile.model';
import { PageResponse } from '../../stories/models/page-response';

@Service()
export class UserService {
  private readonly http = inject(HttpClient);

  readonly currentUser = signal<User | null>(null);

  searchProfiles(username = '', page = 0): Observable<PageResponse<UserProfile>> {
    return this.http.get<PageResponse<UserProfile>>(`${API_URL}/users/profiles`, {
      params: { username, page, size: 12 },
    });
  }

  getProfile(id: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${API_URL}/users/profiles/${encodeURIComponent(id)}`);
  }

  getProfileStories(id: string, page = 0): Observable<PageResponse<UserProfileStory>> {
    return this.http.get<PageResponse<UserProfileStory>>(
      `${API_URL}/users/profiles/${encodeURIComponent(id)}/stories`,
      { params: { page, size: 12 } },
    );
  }

  getByIdExternal(idExternal: string): Observable<User> {
    return this.http.get<User>(`${API_URL}/users/${encodeURIComponent(idExternal)}`);
  }

  setCurrentUser(user: User): void {
    this.currentUser.set(user);
  }

  clearCurrentUser(): void {
    this.currentUser.set(null);
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    this.clearCurrentUser();
  }

  loadCurrentUser(): Observable<User | null> {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');

    if (!userId || !token) {
      this.clearCurrentUser();
      return of(null);
    }

    const currentUser = this.currentUser();

    if (currentUser?.idExternal === userId) {
      return of(currentUser);
    }

    return this.getByIdExternal(userId).pipe(tap((user) => this.setCurrentUser(user)));
  }
}
