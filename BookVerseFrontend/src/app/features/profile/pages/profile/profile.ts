import { Component, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-profile',
  styleUrl: './profile.css',
  templateUrl: './profile.html',
})
export class Profile {
  @ViewChild('coverPicker')
  coverPicker!: ElementRef<HTMLDialogElement>;

  profile = {
    name: 'Alex Lane',
    initials: 'AL',
    username: '@alexbetweenpages',
    membershipType: 'Miembro gratuito',
    biography:
      'Colecciono frases bonitas, ideas nocturnas y libros para los que siempre tengo lugar.',
    interests: ['Fantasía', 'Ficción literaria', 'Un poco de magia'],
  };

  covers = [
    {
      src: '/assets/profile-writer.png',
      name: 'La narradora',
      alt: 'Una escritora rodeada de páginas luminosas en una biblioteca mágica',
      objectPosition: 'center 50%',
    },
    {
      src: '/assets/profile-reader.png',
      name: 'La soñadora',
      alt: 'Una lectora sentada sobre una torre de libros',
      objectPosition: 'center 40%',
    },
    {
      src: '/assets/library.jpg',
      name: 'La biblioteca encantada',
      alt: 'Una biblioteca encantada con libros flotantes',
      objectPosition: 'center 44%',
    },
    {
      src: '/assets/writers-desk-v2.png',
      name: 'Un mundo para escribir',
      alt: 'Un cuaderno abierto frente a un reino fantástico',
      objectPosition: 'center 62%',
    },
    {
      src: '/assets/login-library.png',
      name: 'Una puerta a las posibilidades',
      alt: 'Una puerta luminosa en un rincón de lectura',
      objectPosition: 'center 48%',
    },
    {
      src: '/assets/sign-in-library.png',
      name: 'Entre los estantes',
      alt: 'Una lectora frente a los estantes de una biblioteca',
      objectPosition: 'center 55%',
    },
  ];

  selectedCoverIndex = 0;

  statistics = [
  { value: '12', description: 'Historias en mi estantería', icon: 'book' },
  { value: '2', description: 'Historias en proceso', icon: 'feather' },
  { value: '3', description: 'Círculos de lectura', icon: 'people' },
];

  get currentCover() {
    return this.covers[this.selectedCoverIndex];
  }

  openCoverPicker(): void {
    this.coverPicker.nativeElement.showModal();
  }

  closeCoverPicker(): void {
    this.coverPicker.nativeElement.close();
  }

  closeCoverPickerOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeCoverPicker();
    }
  }

  selectCover(index: number): void {
    this.selectedCoverIndex = index;
  }
}