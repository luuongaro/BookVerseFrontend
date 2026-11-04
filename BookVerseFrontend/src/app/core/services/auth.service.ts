import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api/api.config';

interface AuthRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  userId: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  idExternal: string;
  username: string;
  email: string;
  status: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_URL}/auth`;

  login(credentials: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials);
  }

  register(userData: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, userData);
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/reset-password`, { token, password });
  }
}
