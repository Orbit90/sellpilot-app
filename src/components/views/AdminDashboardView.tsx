import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  Search,
  RefreshCw,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Download,
  Building2,
  Mail,
  Zap,
  X,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Check,
  ChevronDown,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  businessId: string;
  businessName: string;
  businessCategory: string;
  plan: 'FREE_TRIAL' | 'STARTER' | 'PRO' | 'BUSINESS';
  status: 'active' | 'trialing' | 'expired' | 'cancelled' | 'inactive';
  subscriptionId?: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
}

export const AdminDashboardView: React.FC = () => {
  const { user, showToast, setActiveSection } = useApp();

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');

  // Modal for manual subscription management
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [newPlan, setNewPlan] = useState<'FREE_TRIAL' | 'STARTER' | 'PRO' | 'BUSINESS'>('PRO');
  const [newStatus, setNewStatus] = useState<'active' | 'trialing' | 'expired' | 'cancelled'>('active');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const fetchUsers = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const data = await api.getAdminUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load registered users:', err);
      showToast('Could not load users list. Please try again.', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  // Access check
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Administrator Access Required</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          The Users and Subscription Management Dashboard is restricted to SellPilot platform administrators.
        </p>
        <button
          onClick={() => setActiveSection('dashboard')}
          className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Summary Metrics
  const totalUsers = users.length;
  const activePaid = users.filter((u) => u.status === 'active' && u.plan !== 'FREE_TRIAL').length;
  const activeTrials = users.filter((u) => u.status === 'trialing' || u.plan === 'FREE_TRIAL').length;
  const expiredOrCancelled = users.filter((u) => u.status === 'expired' || u.status === 'cancelled').length;

  // Approximate Monthly Recurring Revenue (MRR) calculation
  const calculatedMRR = users.reduce((acc, u) => {
    if (u.status !== 'active') return acc;
    if (u.plan === 'STARTER') return acc + 5000;
    if (u.plan === 'PRO') return acc + 10000;
    if (u.plan === 'BUSINESS') return acc + 20000;
    return acc;
  }, 0);

  // Filtering & Sorting
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = u.name.toLowerCase().includes(q);
          const matchesEmail = u.email.toLowerCase().includes(q);
          const matchesBiz = (u.businessName || '').toLowerCase().includes(q);
          if (!matchesName && !matchesEmail && !matchesBiz) return false;
        }

        // Plan filter
        if (planFilter !== 'all' && u.plan !== planFilter) return false;

        // Status filter
        if (statusFilter !== 'all' && u.status !== statusFilter) return false;

        // Role filter
        if (roleFilter !== 'all' && u.role !== roleFilter) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortOrder === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortOrder === 'name') {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [users, searchQuery, planFilter, statusFilter, roleFilter, sortOrder]);

  const handleOpenManageModal = (targetUser: AdminUserRecord) => {
    setSelectedUser(targetUser);
    setNewPlan(targetUser.plan);
    setNewStatus(targetUser.status === 'inactive' ? 'active' : targetUser.status);
    setDurationDays(30);
  };

  const handleApplySubscriptionChange = async () => {
    if (!selectedUser) return;
    setIsUpdating(true);

    try {
      await api.updateAdminUserSubscription(selectedUser.id, {
        plan: newPlan,
        status: newStatus,
        durationDays: durationDays,
      });

      showToast(`Updated subscription for ${selectedUser.name} to ${newPlan} (${newStatus})!`, 'success');
      setSelectedUser(null);
      await fetchUsers(false);
    } catch (err: any) {
      console.error('Failed to update subscription:', err);
      showToast(err.message || 'Failed to update user subscription', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickActivate = async (targetUser: AdminUserRecord, plan: 'STARTER' | 'PRO' | 'BUSINESS') => {
    try {
      await api.updateAdminUserSubscription(targetUser.id, {
        plan,
        status: 'active',
        durationDays: 30,
      });
      showToast(`Activated 30 days of ${plan} for ${targetUser.name}!`, 'success');
      await fetchUsers(false);
    } catch (err: any) {
      showToast('Quick activation failed', 'error');
    }
  };

  const handleQuickDowngrade = async (targetUser: AdminUserRecord) => {
    try {
      await api.updateAdminUserSubscription(targetUser.id, {
        plan: 'FREE_TRIAL',
        status: 'expired',
        durationDays: 0,
      });
      showToast(`Downgraded ${targetUser.name} to Free Trial (Expired).`, 'info');
      await fetchUsers(false);
    } catch (err: any) {
      showToast('Downgrade failed', 'error');
    }
  };

  const handleExportCSV = () => {
    if (filteredUsers.length === 0) {
      showToast('No users to export', 'info');
      return;
    }

    const headers = ['User ID', 'Name', 'Email', 'Role', 'Store Name', 'Category', 'Plan', 'Status', 'Join Date', 'Period End'];
    const rows = filteredUsers.map((u) => [
      `"${u.id}"`,
      `"${u.name.replace(/"/g, '""')}"`,
      `"${u.email}"`,
      `"${u.role}"`,
      `"${(u.businessName || '').replace(/"/g, '""')}"`,
      `"${u.businessCategory || ''}"`,
      `"${u.plan}"`,
      `"${u.status}"`,
      `"${new Date(u.createdAt).toISOString()}"`,
      `"${u.currentPeriodEnd ? new Date(u.currentPeriodEnd).toISOString() : ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sellpilot-subscribers-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported users directory to CSV', 'success');
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getRelativeTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays}d ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
      return `${Math.floor(diffDays / 365)}y ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold tracking-widest text-teal-400 uppercase">
                Admin Control Room
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Users & Subscribers Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-normal leading-relaxed">
              Real-time monitoring of all registered merchants, subscription tier statuses, and administrative plan activations or downgrades.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchUsers(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors disabled:opacity-50"
              title="Refresh database records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-400' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors shadow-sm"
              title="Export filtered records to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Users</span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalUsers}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Across all stores</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Active Paid</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">{activePaid}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Starter, Pro & Biz</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Active Trials</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-600">{activeTrials}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">7-Day Free Trial</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Expired / Free</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-rose-600">{expiredOrCancelled}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Requires renewal</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">Est. MRR</span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600 font-extrabold text-xs">
              ₦
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              ₦{calculatedMRR.toLocaleString()}
            </div>
            <p className="text-[11px] text-teal-600 font-semibold mt-0.5">Active recurring revenue</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by user name, email, or store name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Plan Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="text-[11px] font-bold text-slate-400">Plan:</span>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Plans</option>
              <option value="FREE_TRIAL">Free Trial</option>
              <option value="STARTER">Starter (₦5k)</option>
              <option value="PRO">Pro (₦10k)</option>
              <option value="BUSINESS">Business (₦20k)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="text-[11px] font-bold text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="text-[11px] font-bold text-slate-400">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="merchant">Merchants</option>
              <option value="admin">Admins</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="text-[11px] font-bold text-slate-400">Sort:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Registered Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Registered Users Directory</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                {filteredUsers.length} shown
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any user to activate, upgrade, or downgrade their subscription.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Loading registered users from Supabase...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No users match your filters</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting the search bar or filter dropdowns.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] sm:text-xs uppercase font-extrabold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">User & Role</th>
                  <th className="py-3.5 px-4">Store Profile</th>
                  <th className="py-3.5 px-4">Join Date</th>
                  <th className="py-3.5 px-4">Subscription Plan</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Expires / Renews</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Manual Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const planColors: Record<string, string> = {
                    BUSINESS: 'bg-purple-50 text-purple-700 border-purple-200',
                    PRO: 'bg-teal-50 text-teal-700 border-teal-200',
                    STARTER: 'bg-blue-50 text-blue-700 border-blue-200',
                    FREE_TRIAL: 'bg-amber-50 text-amber-700 border-amber-200',
                  };

                  const statusColors: Record<string, string> = {
                    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    trialing: 'bg-amber-50 text-amber-700 border-amber-200',
                    expired: 'bg-rose-50 text-rose-700 border-rose-200',
                    cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
                    inactive: 'bg-slate-100 text-slate-400 border-slate-200',
                  };

                  const expiry = u.currentPeriodEnd || u.trialEndsAt;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* User & Role */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 truncate">{u.name}</span>
                              {u.role === 'admin' && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-200">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Store Profile */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 text-xs">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{u.businessName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 capitalize pl-5">
                          {u.businessCategory}
                        </div>
                      </td>

                      {/* Join Date */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-semibold text-xs">{formatDate(u.createdAt)}</div>
                        <div className="text-[10px] text-slate-400">{getRelativeTime(u.createdAt)}</div>
                      </td>

                      {/* Current Plan */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${
                            planColors[u.plan] || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {u.plan}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border capitalize ${
                            statusColors[u.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.status === 'active'
                                ? 'bg-emerald-500'
                                : u.status === 'trialing'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                          />
                          <span>{u.status}</span>
                        </span>
                      </td>

                      {/* Renewal / Expiry */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {expiry ? (
                          <div>
                            <div className="font-semibold">{formatDate(expiry)}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(expiry) > new Date() ? 'Active until date' : 'Ended'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Activate Button */}
                          {u.status !== 'active' ? (
                            <button
                              type="button"
                              onClick={() => handleQuickActivate(u, 'PRO')}
                              className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold border border-teal-200 transition-colors flex items-center gap-1"
                              title="Activate 30 Days Pro Immediately"
                            >
                              <Zap className="w-3 h-3 text-teal-600" />
                              <span className="hidden sm:inline">Activate Pro</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleQuickDowngrade(u)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-semibold transition-colors"
                              title="Downgrade to Expired Free Trial"
                            >
                              <span className="hidden sm:inline">Downgrade</span>
                            </button>
                          )}

                          {/* Detailed Modal Trigger */}
                          <button
                            type="button"
                            onClick={() => handleOpenManageModal(u)}
                            className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-sm"
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Subscription Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 p-6 text-white relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">Manual Subscription Control</h3>
                    <p className="text-xs text-slate-400">Override billing & access privileges</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Target User Info */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-900 text-teal-400 font-extrabold flex items-center justify-center text-sm">
                  {selectedUser.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{selectedUser.name}</h4>
                  <p className="text-xs text-slate-500">{selectedUser.email}</p>
                  <p className="text-[11px] text-teal-700 font-medium mt-0.5">
                    Store: {selectedUser.businessName} ({selectedUser.businessCategory})
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Current Plan</span>
                  <div className="font-bold text-slate-800">{selectedUser.plan} ({selectedUser.status})</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Joined On</span>
                  <div className="font-bold text-slate-800">{formatDate(selectedUser.createdAt)}</div>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Subscription Tier
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'FREE_TRIAL', name: 'Free Trial', price: '₦0' },
                    { id: 'STARTER', name: 'Starter', price: '₦5,000/mo' },
                    { id: 'PRO', name: 'Pro', price: '₦10,000/mo' },
                    { id: 'BUSINESS', name: 'Business', price: '₦20,000/mo' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setNewPlan(p.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        newPlan === p.id
                          ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20 text-teal-900 font-bold'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>{p.name}</span>
                        {newPlan === p.id && <Check className="w-3.5 h-3.5 text-teal-600" />}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{p.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Account Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="active">Active (Full access to chosen tier)</option>
                  <option value="trialing">Trialing (In 7-day trial period)</option>
                  <option value="expired">Expired (Features locked; renewal prompt)</option>
                  <option value="cancelled">Cancelled (User unsubscribed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Access Duration (from today)
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { days: 7, label: '7 Days (Trial)' },
                    { days: 30, label: '30 Days (1 Month)' },
                    { days: 90, label: '90 Days (Quarter)' },
                    { days: 180, label: '6 Months' },
                    { days: 365, label: '1 Year' },
                    { days: 3650, label: '10 Years (Lifetime)' },
                  ].map((d) => (
                    <button
                      key={d.days}
                      type="button"
                      onClick={() => setDurationDays(d.days)}
                      className={`py-2 px-2 rounded-xl border text-center font-bold text-xs transition-colors ${
                        durationDays === d.days
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  <strong>Admin Notice:</strong> This action updates the database record directly and immediately activates or restricts feature quotas for this merchant.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                disabled={isUpdating}
                className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplySubscriptionChange}
                disabled={isUpdating}
                className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Apply Subscription</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
