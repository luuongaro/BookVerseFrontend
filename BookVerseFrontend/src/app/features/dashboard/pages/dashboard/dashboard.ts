import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  nombreUsuario = 'Alex';
  nombreCompleto = 'Alex Lane';
  inicialesUsuario = 'AL';
}