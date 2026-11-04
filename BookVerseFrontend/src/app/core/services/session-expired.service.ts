import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionExpiredService {
  readonly visible = signal(false);
  readonly returnUrl = signal('/dashboard');

  show(returnUrl: string): void {
    if (this.visible()) return;

    this.returnUrl.set(returnUrl || '/dashboard');
    this.visible.set(true);
  }

  clear(): void {
    this.visible.set(false);
  }
}
