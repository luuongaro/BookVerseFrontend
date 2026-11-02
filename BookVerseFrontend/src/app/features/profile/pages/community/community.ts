import { Component } from '@angular/core';
import { UserSearch } from '../../components/user-search/user-search';

@Component({
  selector: 'app-community',
  imports: [UserSearch],
  template: `<main class="community-page">
    <header>
      <h1>Lectores</h1>
      <p>Buscá a alguien por su nombre de usuario.</p>
    </header>
    <app-user-search [searchOnly]="true" />
  </main>`,
  styleUrl: '../../community.css',
})
export class Community {}
