import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInAsDevMode: () => void;
    signOut: () => Promise<void>;
    userEmail: string;
    userName: string;
    userAvatar: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [mockUser, setMockUser] = useState<User | null>(() => {
        const stored = localStorage.getItem('dev_mock_user');
        return stored === 'true' ? {
            id: 'dev-mode-1234',
            email: 'devmode',
            app_metadata: {},
            user_metadata: { full_name: 'Dev Mode Admin' },
            aud: 'authenticated',
            created_at: new Date().toISOString()
        } as User : null;
    });
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                logUserLogin(session.user);
            }
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                if (_event === 'SIGNED_IN' && session?.user) {
                    logUserLogin(session.user);
                }
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const logUserLogin = async (user: User) => {
        try {
            const { error } = await supabase
                .from('app_users')
                .upsert({
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
                    last_login: new Date().toISOString(),
                }, { onConflict: 'id' });

            if (error) {
                console.error('Error logging user login:', error);
            }
        } catch (err) {
            console.error('Error in logUserLogin:', err);
        }
    };

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
        if (error) {
            console.error('Error signing in with Google:', error);
        }
    };

    const signInAsDevMode = () => {
        const devUser = {
            id: 'dev-mode-1234',
            email: 'devmode',
            app_metadata: {},
            user_metadata: { full_name: 'Dev Mode Admin' },
            aud: 'authenticated',
            created_at: new Date().toISOString()
        } as User;
        localStorage.setItem('dev_mock_user', 'true');
        setMockUser(devUser);
    };

    const signOut = async () => {
        if (mockUser) {
            setMockUser(null);
            localStorage.removeItem('dev_mock_user');
            return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error signing out:', error);
        }
    };

    const effectiveUser = mockUser || user;
    const userEmail = effectiveUser?.email || '';
    const userName = effectiveUser?.user_metadata?.full_name || effectiveUser?.user_metadata?.name || userEmail;
    const userAvatar = effectiveUser?.user_metadata?.avatar_url || effectiveUser?.user_metadata?.picture || '';

    return (
        <AuthContext.Provider value={{
            user: effectiveUser,
            session,
            loading: loading && !mockUser,
            signInWithGoogle,
            signInAsDevMode,
            signOut,
            userEmail,
            userName,
            userAvatar,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
