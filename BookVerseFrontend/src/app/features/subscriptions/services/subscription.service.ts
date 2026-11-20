import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../../../core/api/api.config';

interface PremiumCheckoutResponse {
  checkoutUrl: string;
}

@Service()
export class SubscriptionService {
  private readonly http = inject(HttpClient);

  upgradeToPremium(): Observable<PremiumCheckoutResponse> {
    return this.http.post<PremiumCheckoutResponse>(
      `${API_URL}/subscriptions/upgrade-to-premium`,
      null,
    );
  }
}
