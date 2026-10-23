import { Component } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

@Component({
  selector: 'app-story-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './story-form.html',
  styleUrl: './story-form.css'
})
export class StoryForm {

  form = new FormGroup({

    title: new FormControl('', [
      Validators.required,
      Validators.maxLength(150)
    ]),

    description: new FormControl('', [
      Validators.required,
      Validators.maxLength(1000)
    ]),

    accessType: new FormControl('FREE')
  });

}