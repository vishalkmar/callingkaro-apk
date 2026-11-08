import { useAuthStore } from '@store/authStore';
import { logout } from '@services/auth/authService';

export const useAuth = () => {
  const user = useAuthStore(s => s.user);
  const status = useAuthStore(s => s.status);
  return { user, status, isLoggedIn: status === 'authenticated', logout };
};

export default useAuth;
