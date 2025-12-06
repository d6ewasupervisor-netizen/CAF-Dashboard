export const msalConfig = {
    auth: {
      clientId: "c4c9b9bf-7758-4cce-8e17-3bc4c9e09169", 
      authority: "https://login.microsoftonline.com/cc2b0e56-cd66-40c4-8fb2-db5350eff092ws",
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: "sessionStorage", 
      storeAuthStateInCookie: false,
    },
  };
  
  export const loginRequest = {
    scopes: ["User.Read", "User.ReadBasic.All"]
  };