import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { SessionExpiredService } from '../../../core/services/session-expired.service';
import { UserService } from '../../../features/profile/services/user.service';

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [Sidebar, RouterOutlet],
  templateUrl: './authenticated-layout.html',
  styleUrl: './authenticated-layout.css',
})
export class AuthenticatedLayout {
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  readonly sessionExpired = inject(SessionExpiredService);

  goToLogin(): void {
    const returnUrl = this.sessionExpired.returnUrl();

    this.sessionExpired.clear();
    this.userService.logout();

    void this.router.navigate(['/login'], {
      queryParams: { returnUrl },
    });
  }
}
