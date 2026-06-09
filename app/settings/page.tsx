"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Camera, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile } from 'firebase/auth';
import { SettingsSkeleton } from '@/components/Skeletons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function SettingsPage() {
    return (
        <ProtectedRoute>
            <SettingsContent />
        </ProtectedRoute>
    );
}

function SettingsContent() {
    const router = useRouter();
    const { user, userInfo, setUserInfo, deleteAccount, loading: loadingAuth } = useAuth();

    const [displayName, setDisplayName] = useState(userInfo?.name || '');
    const [username, setUsername] = useState(userInfo?.username || '');
    const [loading, setLoading] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [deleting, setDeleting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (userInfo) {
            setDisplayName(userInfo.name);
            setUsername(userInfo.username);
        }
    }, [userInfo]);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        if (file.size > 2 * 1024 * 1024) {
            setError('File size must be less than 2MB');
            return;
        }

        setUploadingPhoto(true);
        setError('');

        try {
            const storage = getStorage();
            const storageRef = ref(storage, `avatars/${user.uid}`);
            await uploadBytes(storageRef, file);
            const photoURL = await getDownloadURL(storageRef);

            await updateProfile(user, { photoURL });
            await updateDoc(doc(db, 'users', user.uid), { avatar: photoURL });

            setUserInfo(prev => prev ? { ...prev, avatar: photoURL } : null);
            setSuccess('Profile photo updated!');
        } catch (err) {
            console.error(err);
            setError('Failed to upload photo');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !displayName.trim()) return;

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            if (displayName !== userInfo?.name) {
                await updateProfile(user, { displayName });
                await updateDoc(doc(db, 'users', user.uid), { name: displayName });
                setUserInfo(prev => prev ? { ...prev, name: displayName } : null);
            }
            setSuccess('Profile updated successfully!');
        } catch (err) {
            setError('Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm('Are you absolutely sure? This action cannot be undone.')) return;

        setDeleting(true);
        try {
            await deleteAccount();
            router.push('/login');
        } catch (err) {
            console.error(err);
            setError('Failed to delete account. You may need to re-login just before deleting.');
            setDeleting(false);
        }
    };

    if (loadingAuth || !userInfo) {
        return <SettingsSkeleton />;
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href={userInfo?.username ? `/profile/${userInfo.username}` : '/'}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Profile Settings</h1>
                </div>

                {/* Profile Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="p-6 md:p-8 space-y-8">

                        {/* Avatar Section */}
                        <div className="flex flex-col items-center justify-center">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-zinc-100 dark:border-zinc-800 relative bg-zinc-100 dark:bg-zinc-800">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={userInfo?.avatar || '/user.png'}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Camera className="w-8 h-8 text-white" />
                                    </div>
                                    {uploadingPhoto && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                                        </div>
                                    )}
                                </div>
                                <div className="absolute bottom-0 right-0 bg-blue-600 border-2 border-white dark:border-zinc-900 rounded-full p-1.5">
                                    <Camera className="w-3 h-3 text-white" />
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handlePhotoUpload}
                                accept="image/*"
                                className="hidden"
                            />
                            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Click to update profile photo</p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSave} className="space-y-6">

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Display Name</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-zinc-900 dark:text-white"
                                    placeholder="Your Name"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    disabled
                                    className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-500 cursor-not-allowed"
                                />
                                <p className="text-xs text-zinc-400">Username cannot be changed.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
                                <input
                                    type="email"
                                    value={userInfo?.email || ''}
                                    disabled
                                    className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-500 cursor-not-allowed"
                                />
                                <p className="text-xs text-zinc-400">Email address cannot be changed.</p>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-lg flex items-center gap-2">
                                    <Save className="w-4 h-4" />
                                    {success}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || displayName === userInfo?.name}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Changes
                            </button>
                        </form>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="border border-red-200 dark:border-red-900/50 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/50">
                        <h3 className="text-red-700 dark:text-red-400 font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Danger Zone
                        </h3>
                    </div>
                    <div className="p-6">
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                            Deleting your account is permanent and cannot be undone. All your practice history, stats, and data will be lost immediately.
                        </p>
                        <button
                            onClick={handleDeleteAccount}
                            disabled={deleting}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Delete My Account
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
