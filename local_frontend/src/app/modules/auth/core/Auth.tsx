/* eslint-disable react-refresh/only-export-components */
import {FC, useState, useEffect, createContext, useContext, Dispatch, SetStateAction} from 'react'
import {LayoutSplashScreen} from '../../../../_metronic/layout/core'
import {AuthModel, UserModel} from './_models'
import * as authHelper from './AuthHelpers'
import {getUserByToken} from './_requests'
import {WithChildren} from '../../../../_metronic/helpers'
import { userLogout } from '../../../helpers/api'


type AuthContextProps = {
  auth: AuthModel | undefined
  saveAuth: (auth: AuthModel | undefined) => void
  currentUser: UserModel | undefined
  setCurrentUser: Dispatch<SetStateAction<UserModel | undefined>>
  logout: () => void
}

const initAuthContextPropsState = {
  auth: authHelper.getAuth(),
  saveAuth: () => {},
  currentUser: undefined,
  setCurrentUser: () => {},
  logout: () => {},
}

const AuthContext = createContext<AuthContextProps>(initAuthContextPropsState)

const useAuth = () => {
  return useContext(AuthContext)
}

const AuthProvider: FC<WithChildren> = ({children}) => {
  const [auth, setAuth] = useState<AuthModel | undefined>(() => {
    // Try to get auth from authHelper first (correct key)
    const storedAuth = authHelper.getAuth();
    if (storedAuth) return storedAuth;
    
    // Fallback to legacy authToken key
    const legacyToken = localStorage.getItem("authToken");
    return legacyToken ? { api_token: legacyToken, data: undefined, refreshToken: undefined } : undefined;
  });
  const [currentUser, setCurrentUser] = useState<UserModel | undefined>(() => {
    const storedUser = localStorage.getItem("currentUser");
    return storedUser ? JSON.parse(storedUser) : undefined;
  });
  const saveAuth = (auth: AuthModel | undefined) => {
    setAuth(auth)
    if (auth) {
      authHelper.setAuth(auth)
      // Also store token for backward compatibility
      localStorage.setItem("authToken", auth.api_token || "");
    } else {
      authHelper.removeAuth()
      localStorage.removeItem("authToken");
    }
  }

  // const logout = () => {
  //   localStorage.clear();
  //   saveAuth(undefined)
  //   setCurrentUser(undefined)
  // }
  const logout = async () => {
    try {
      // Call the logout API
      const response = await userLogout("/api/user/logout");
        localStorage.clear();
      if (response.status === 200) {
        console.log("Logout successful");

        // Clear any authentication tokens or user data
        // localStorage.removeItem("authToken");
        // Redirect to login page
  
        saveAuth(undefined);
        setCurrentUser(undefined);
        
        
      } else {
        console.error("Failed to logout", response);
        saveAuth(undefined);
        setCurrentUser(undefined);
       
      }
    } catch (error) {
      console.error("Error while logging out:", error);
      saveAuth(undefined);
        setCurrentUser(undefined);
        
    }
  };

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    }
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{auth, saveAuth, currentUser, setCurrentUser, logout}}>
      {children}
    </AuthContext.Provider>
  )
}

const AuthInit: FC<WithChildren> = ({children}) => {
  const {auth, currentUser, setCurrentUser} = useAuth()
  const [showSplashScreen, setShowSplashScreen] = useState(true)

  // We should request user by authToken (IN OUR EXAMPLE IT'S API_TOKEN) before rendering the application
  useEffect(() => {
    const initializeApp = async () => {
      if (auth && auth.api_token) {
        // We have auth token, try to load user from localStorage
        const storedUser = localStorage.getItem("currentUser");
        
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            setCurrentUser(parsedUser);
            console.log('✅ User restored from localStorage:', parsedUser.email);
          } catch (error) {
            console.error('Failed to parse stored user:', error);
            // Clear invalid data
            localStorage.removeItem("currentUser");
          }
        }
      }
      // Don't call logout here - let the routing handle unauthenticated users
      setShowSplashScreen(false);
    };

    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  return showSplashScreen ? <LayoutSplashScreen /> : <>{children}</>
}

export {AuthProvider, AuthInit, useAuth}
