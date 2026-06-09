'use client';

import { useState, useEffect } from 'react';
import { X, User, Mail, Lock, Shield, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { usersService, type UserDetail } from '@/services/users';

interface EditUserModalProps {
  user: UserDetail;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditUserModal({ user, isOpen, onClose, onSuccess }: EditUserModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Profile form state
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username || '');
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);

  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Reset form when user changes
  useEffect(() => {
    setEmail(user.email);
    setUsername(user.username || '');
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setRole(user.role);
    setStatus(user.status);
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMessage(null);
  }, [user]);

  // Reset messages on tab change
  useEffect(() => {
    setError(null);
    setSuccessMessage(null);
  }, [activeTab]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Update profile
      await usersService.updateUser(user.id, {
        email: email.trim(),
        username: username.trim() || undefined,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });

      // Update role if changed
      if (role !== user.role) {
        await usersService.updateRole(user.id, role);
      }

      // Update status if changed
      if (status !== user.status) {
        await usersService.updateStatus(user.id, status);
      }

      setSuccessMessage('User profile updated successfully!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Validation
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      await usersService.changePassword(user.id, newPassword);
      setSuccessMessage('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Edit User</h2>
            <p className="text-sm text-text-tertiary mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'profile'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
          >
            <User className="w-4 h-4 inline-block mr-2" />
            Profile Information
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'password'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
          >
            <Lock className="w-4 h-4 inline-block mr-2" />
            Change Password
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{successMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-2">
                  <Mail className="w-4 h-4 inline-block mr-1" />
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="user@example.com"
                />
              </div>

              {/* Username */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-text-primary mb-2">
                  <User className="w-4 h-4 inline-block mr-1" />
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="username"
                />
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-text-primary mb-2">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-text-primary mb-2">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Doe"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-text-primary mb-2">
                  <Shield className="w-4 h-4 inline-block mr-1" />
                  Role
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-text-primary mb-2">
                  Account Status
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UserDetail['status'])}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="banned">Banned</option>
                  <option value="deleted">Deleted</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="px-5 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm">
                <AlertCircle className="w-4 h-4 inline-block mr-2" />
                You are changing the password for <strong>{user.email}</strong>
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-text-primary mb-2">
                  <Lock className="w-4 h-4 inline-block mr-1" />
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Enter new password (min 8 characters)"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-primary mb-2">
                  <Lock className="w-4 h-4 inline-block mr-1" />
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Confirm new password"
                />
              </div>

              {/* Password Requirements */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs space-y-1">
                <p className="font-medium mb-2">Password Requirements:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>At least 8 characters long</li>
                  <li>Passwords must match</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="px-5 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? 'Changing Password...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
