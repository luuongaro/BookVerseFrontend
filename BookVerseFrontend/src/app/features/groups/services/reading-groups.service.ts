import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';


import {
  CreateReadingGroupRequest,
  ReadingGroup,
  UpdateReadingGroupRequest,
} from '../models/reading-group.model';

@Service()
export class ReadingGroupsService {
  private readonly http = inject(HttpClient);
  //private readonly url = `${environment.apiUrl}/reading-groups`;
  private readonly url = 'http://localhost:8080/api/reading-groups';


  getAll(): Observable<ReadingGroup[]> {
    return this.http.get<ReadingGroup[]>(this.url);
  }

  getById(idExternal: string): Observable<ReadingGroup> {
    return this.http.get<ReadingGroup>(`${this.url}/${idExternal}`);
  }

  getByBook(bookId: string): Observable<ReadingGroup[]> {
    return this.http.get<ReadingGroup[]>(`${this.url}/book/${bookId}`);
  }

  getByStory(storyId: string): Observable<ReadingGroup[]> {
    return this.http.get<ReadingGroup[]>(`${this.url}/story/${storyId}`);
  }

  getCreatedByUser(userId: string): Observable<ReadingGroup[]> {
    return this.http.get<ReadingGroup[]>(`${this.url}/user/${userId}`);
  }

  create(request: CreateReadingGroupRequest): Observable<ReadingGroup> {
    return this.http.post<ReadingGroup>(this.url, request);
  }

  update(
    idExternal: string,
    request: UpdateReadingGroupRequest,
  ): Observable<ReadingGroup> {
    return this.http.put<ReadingGroup>(
      `${this.url}/${idExternal}`,
      request,
    );
  }

  deactivate(idExternal: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${idExternal}`);
  }
}