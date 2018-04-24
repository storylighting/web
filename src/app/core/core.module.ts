import { NgModule } from '@angular/core';

import { AuthService } from './auth.service';
import { AngularFireAuthModule } from 'angularfire2/auth';
import { AngularFirestoreModule } from 'angularfire2/firestore';

import { CommonModule } from '@angular/common';

@NgModule({
  imports: [
    CommonModule,
    AngularFireAuthModule,
    AngularFirestoreModule
  ],
  providers: [
    AuthService
  ],
  declarations: []
})
export class CoreModule { }
