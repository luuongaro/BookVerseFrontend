import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { SessionExpiredService } from '../../../core/services/session-expired.service';

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [Sidebar, RouterOutlet],
  templateUrl: './authenticated-layout.html',
  styleUrl: './authenticated-layout.css',
})
export class AuthenticatedLayout {
  private readonly router = inject(Router);
  readonly sessionExpired = inject(SessionExpiredService);

  goToLogin(): void {
    const returnUrl = this.sessionExpired.returnUrl();
    this.sessionExpired.clear();

    void this.router.navigate(['/login'], {
      queryParams: { returnUrl },
    });
  }
}
