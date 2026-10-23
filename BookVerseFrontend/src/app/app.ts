import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserService } from './features/profile/services/user.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly userService = inject(UserService);

  protected readonly title = signal('BookVerseFrontend');

  ngOnInit(): void {
    this.userService.loadCurrentUser().subscribe({
      error: () => this.userService.clearCurrentUser(),
    });
  }
}
