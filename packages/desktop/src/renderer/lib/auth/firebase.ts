import { initializeApp, FirebaseApp } from 'firebase/app'
import {
  getAuth,
  Auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyBpIVXx5V_hlBxVW01a6HrLV8QXmK-j2UI',
  authDomain: 'gen-lang-client-0005794941.firebaseapp.com',
  databaseURL: 'https://gen-lang-client-0005794941-default-rtdb.firebaseio.com',
  projectId: 'gen-lang-client-0005794941',
  storageBucket: 'gen-lang-client-0005794941.firebasestorage.app',
  messagingSenderId: '723418668838',
  appId: '1:723418668838:web:966fc0ea67b3c6f5e8abe7',
}

let app: FirebaseApp
let auth: Auth
let initPromise: Promise<void>

export function initFirebase(): Promise<void> {
  if (!initPromise) {
    initPromise = new Promise((resolve) => {
      app = initializeApp(firebaseConfig)
      auth = getAuth(app)
      resolve()
    })
  }
  return initPromise
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error('Firebase not initialized. Call initFirebase() first.')
  return auth
}

export function onAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback)
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
  return cred.user
}

export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
  return cred.user
}

export async function loginWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  const cred = await signInWithPopup(getFirebaseAuth(), provider)
  return cred.user
}

export async function logout(): Promise<void> {
  await signOut(getFirebaseAuth())
}
