import { useEffect } from 'react'
import { Navigate, Routes, useNavigate } from 'react-router-dom'
import { useAuth } from './core/Auth'
import { userLogout } from '../../helpers/api';


export function Logout() {
    // const { logout } = useAuth()
    // useEffect(() => {
    //     logout()
    //     document.location.reload()
    // }, [logout])

    // return (
    //     <Routes>
    //         <Navigate to="/auth" />
    //     </Routes>
    // )
  const {logout} = useAuth()
  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      // Call the logout API
      const response = await userLogout("/api/user/logout");
     localStorage.clear();
      if (response.status === 200) {
        console.log("Logout successful");

        
        logout();
        navigate("/auth/login'");
      } else {
        console.error("Failed to logout", response);
      }
    } catch (error) {
      console.error("Error while logging out:", error);
    }
  };

  useEffect(() => {
    handleLogout();
  }, []);

  return (<div></div>)
}
