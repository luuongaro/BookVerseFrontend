import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
@Component({
  selector: 'app-catalog-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './catalog-nav.html',
  styleUrl: './catalog-nav.css',
})
export class CatalogNav {}
