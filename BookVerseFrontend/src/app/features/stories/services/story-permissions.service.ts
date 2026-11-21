import { inject, Injectable } from '@angular/core';
import { TokenService } from '../../../core/services/token.service';

@Injectable({ providedIn: 'root' })
export class StoryPermissions {
  private readonly tokens = inject(TokenService);

  isAuthor(story: { authorId: string }): boolean {
    return (
      this.tokens.isAuthenticated() &&
      story.authorId === localStorage.getItem('userId')
    );
  }

  canManage(story: { authorId: string }): boolean {
    return (
      this.tokens.isAuthenticated() &&
      (this.isAuthor(story) ||
        this.tokens.hasAnyRole('ROLE_ADMIN', 'ROLE_MODERATOR'))
    );
  }
}
