import { Component } from '@angular/core';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import { RouterLink } from '@angular/router';

@Component({
  imports: [Header, Footer, RouterLink],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {}