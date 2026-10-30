import { Component } from '@angular/core';
import { UserSearch } from '../../components/user-search/user-search';

@Component({
  selector: 'app-community',
  imports: [UserSearch],
  template: `<main class="community-page">
    <header>
      <h1>Fellow Readers</h1>
      <p>Buscá usuarios y visitá sus perfiles.</p>
    </header>
    <app-user-search />
  </main>`,
  styleUrl: '../../community.css',
})
export class Community {}
