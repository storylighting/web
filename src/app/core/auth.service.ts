import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { User } from './user';

import * as firebase from 'firebase/app';
import { AngularFireAuth } from 'angularfire2/auth';
import { AngularFirestore, AngularFirestoreDocument } from 'angularfire2/firestore';

import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/switchMap';


@Injectable()
export class AuthService {

  user: Observable<User>;

  public constructor(
    protected readonly db: AngularFirestore,
    protected readonly auth: AngularFireAuth,
    private router: Router) {

    this.user = this.auth.authState.switchMap(user => {
      if (user){
        return this.db.doc<User>(`users/${user.uid}`).valueChanges();
      } else {
        return Observable.of(null);
      }
    });
  }

  private updateUserData(user: any) {
    const userReference: AngularFirestoreDocument<User> = this.db.doc(`users/${user.uid}`);

    const data: User = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };

    return userReference.set(data, {merge: true});
  }

  private oAuthLogin(provider: any) {
    return this.auth.auth.signInWithPopup(provider)
      .then(credential => {
        this.updateUserData(credential.user);
      });
  }

  public googleLogin(){
    const provider = new firebase.auth.GoogleAuthProvider();
    return this.oAuthLogin(provider);
  }

  public signOut() {
    this.auth.auth.signOut().then(()=> {
      this.router.navigate(['/']);
    })
  }

}
