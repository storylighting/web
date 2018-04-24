import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { CoreModule } from './core/core.module';

import { AngularFireModule } from 'angularfire2';

import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { environment } from '../environments/environment';

// Routes
import { UserProfileComponent } from './user-profile/user-profile.component';


const appRoutes: Routes = [
  { path: '', component: UserProfileComponent},
];


@NgModule({
  declarations: [
    AppComponent,
    UserProfileComponent
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot(
      appRoutes,
      { enableTracing: true }  // debugging
    ),
    AngularFireModule.initializeApp(environment.firebase),
    CoreModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
