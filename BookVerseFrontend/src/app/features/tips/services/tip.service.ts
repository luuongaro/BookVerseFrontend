import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/api/api.config';
import { TipRequest } from '../models/tip-request';
import { TipCheckoutResponse } from '../models/tip-checkout-response';

@Injectable({ providedIn: 'root' })
export class TipService {
  private readonly http = inject(HttpClient);

  createTip(request: TipRequest): Observable<TipCheckoutResponse> {
    return this.http.post<TipCheckoutResponse>(
      `${API_URL}/tips`,
      request,
    );
  }
}