import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { CoreModule } from './core/core.module';

import { AngularFireModule } from 'angularfire2';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { environment } from '../environments/environment';

// Routes
import { UserProfileComponent } from './user-profile/user-profile.component';
import { WelcomeComponent } from './welcome/welcome.component';


const appRoutes: Routes = [
  { path: 'welcome', component: WelcomeComponent},
  { path: '', component: UserProfileComponent},
];


@NgModule({
  declarations: [
    AppComponent,
    UserProfileComponent,
    WelcomeComponent
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot(
      appRoutes,
      { enableTracing: true }  // debugging
    ),
    AngularFireModule.initializeApp(environment.firebase),
    NgbModule.forRoot(),
    CoreModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
