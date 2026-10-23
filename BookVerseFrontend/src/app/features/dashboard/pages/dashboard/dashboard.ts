import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../profile/services/user.service';

@Component({
  imports: [RouterLink],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly userService = inject(UserService);

  get userName(): string {
    return this.userService.currentUser()?.username ?? 'lector';
  }

  get fullName(): string {
    return this.userService.currentUser()?.username ?? 'Usuario';
  }

  get initials(): string {
    return this.getInitials(this.userService.currentUser()?.username);
  }

  private getInitials(name?: string): string {
    const value = name?.trim();
    return value ? value.slice(0, 2).toUpperCase() : 'BV';
  }

  logout(): void {
    this.userService.logout();
  }
}
