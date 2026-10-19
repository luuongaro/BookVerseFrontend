import { Component } from '@angular/core';
import { Header } from '../../../../shared/components/header/header';

@Component({
  imports: [Header],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {}