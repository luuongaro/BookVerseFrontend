import { Component } from '@angular/core';
import { WriterDesk } from '../writer-desk/writer-desk';
@Component({
  selector: 'app-my-stories',
  imports: [WriterDesk],
  templateUrl: './my-stories.html',
  styleUrl: './my-stories.css',
})
export class MyStories {}
