import { createContext } from 'react';
import { User } from 'firebase/auth';
import { UserData } from '../types/user';

export interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  dataLoading: boolean;
  error: Error | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
