import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Users, Mail, Clock, RefreshCw, Search, Shield } from 'lucide-react';

interface AppUser {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
    last_login: string;
    created_at: string;
}

export function UserManagement() {
    const { userEmail } = useAuth();
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('*')
                .order('last_login', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                            <Users className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight">User Management</h1>
                            <p className="text-blue-100 text-sm font-medium opacity-90">
                                Daftar semua user yang login via Google
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchUsers}
                        disabled={loading}
                        className="h-11 px-5 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl backdrop-blur-md transition-all flex items-center gap-2 border border-white/20"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-xl">
                        <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-gray-900">{users.length}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Users</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-xl">
                        <Shield className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-gray-900">{users.filter(u => {
                            const lastLogin = new Date(u.last_login);
                            const now = new Date();
                            return (now.getTime() - lastLogin.getTime()) < 24 * 60 * 60 * 1000;
                        }).length}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aktif 24 Jam</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
                    <div className="p-3 bg-amber-50 rounded-xl">
                        <Mail className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-gray-900 truncate max-w-[180px]">{userEmail}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Login Saat Ini</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari user berdasarkan email atau nama..."
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                />
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Login Terakhir</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Pertama Kali</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <RefreshCw className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Memuat data...</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <Users className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Belum ada user</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => {
                                    const isActive = (new Date().getTime() - new Date(user.last_login).getTime()) < 24 * 60 * 60 * 1000;
                                    const isCurrentUser = user.email === userEmail;
                                    return (
                                        <tr key={user.id} className={`hover:bg-blue-50/50 transition-colors ${isCurrentUser ? 'bg-blue-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {user.avatar_url ? (
                                                        <img
                                                            src={user.avatar_url}
                                                            alt={user.full_name}
                                                            className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-sm">
                                                            {(user.full_name || user.email || '?')[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-gray-900">{user.full_name || '-'}</p>
                                                        {isCurrentUser && (
                                                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-2 py-0.5 rounded-full">Anda</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-gray-700 font-medium">{user.email}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                                                    <span className="text-sm font-medium">{formatDate(user.last_login)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-gray-500 font-medium">{formatDate(user.created_at)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                                        Aktif
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-[10px] font-black uppercase tracking-wider border border-gray-100">
                                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                                                        Offline
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
