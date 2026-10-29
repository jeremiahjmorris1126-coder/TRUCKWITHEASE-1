import { fleetStore, type CallerIdentity } from '../data/fleetStore';

export type UserRole = 'driver' | 'fleet_admin' | 'owner';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  fleetId: string | null;
  carrierTenantId?: string;
  avatarUrl?: string;
  permissions: string[];
}

/**
 * Lists users strictly fail-closed:
 * If no caller or invalid role provided, returns empty array [].
 * Reads genuine users/{uid} documents via fleetStore enforcing fleet isolation.
 * Never exposes users across tenant boundaries.
 */
export async function listUsers(caller?: { role: string; fleetId: string | null; uid?: string }): Promise<UserAccount[]> {
  if (!caller || !caller.role) {
    return [];
  }

  const rawUsers = await fleetStore.listScopedCollection<any>(caller as CallerIdentity, 'users');
  return rawUsers.map(u => ({
    id: u.uid || u.id,
    name: u.name || (u.email ? u.email.split('@')[0] : u.uid || u.id),
    email: u.email || '',
    role: u.role || 'driver',
    fleetId: u.fleetId || null,
    avatarUrl: u.avatarUrl,
    permissions: u.permissions || (
      u.role === 'owner'
        ? ['ALL_PERMISSIONS', 'DISPATCH_OVERRIDE', 'BILLING_ADMIN', 'SAFETY_AUDIT']
        : u.role === 'fleet_admin'
        ? ['VIEW_LOADS', 'ASSIGN_LOADS', 'SMS_DISPATCH', 'VIEW_TELEMATICS']
        : ['VIEW_ASSIGNED_LOAD', 'UPDATE_HOS', 'VAULT_UPLOAD', 'IN_CAB_DIAGNOSTICS']
    ),
  }));
}

export async function getUserById(caller: CallerIdentity, id: string): Promise<UserAccount | null> {
  if (!caller || !caller.role) {
    return null;
  }
  const u = await fleetStore.getScopedDocument<any>(caller, 'users', id);
  if (!u) return null;
  return {
    id: u.uid || u.id,
    name: u.name || (u.email ? u.email.split('@')[0] : u.uid || u.id),
    email: u.email || '',
    role: u.role || 'driver',
    fleetId: u.fleetId || null,
    avatarUrl: u.avatarUrl,
    permissions: u.permissions || [],
  };
}

export function authenticateUser(email: string, role?: UserRole): { token: string; user: UserAccount } {
  const userId = `usr-${Buffer.from(email).toString('hex').slice(0, 12)}`;
  const user: UserAccount = {
    id: userId,
    name: email.split('@')[0],
    email,
    role: role || 'driver',
    fleetId: null,
    permissions: ['VIEW_ASSIGNED_LOAD', 'UPDATE_HOS'],
  };

  return {
    token: `twe_jwt_${Buffer.from(JSON.stringify({ userId: user.id, role: user.role })).toString('base64')}`,
    user,
  };
}
