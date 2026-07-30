import { initializeApp } 
from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import { 
getAuth 
} 
from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";


const firebaseConfig = {

apiKey: "AIzaSyBIgw1w4vzEeiM-_PG4brcuxLyg-P_pBKE",

authDomain: "new-gen-rpg.firebaseapp.com",

projectId: "new-gen-rpg",

storageBucket: "new-gen-rpg.firebasestorage.app",

messagingSenderId:"1017527831620",

appId:"1:1017527831620:web:a9e02108e37a577ff88011"

};


const firebaseApp = initializeApp(firebaseConfig);


export const auth = getAuth(firebaseApp);