export type TeamRole = "owner" | "admin" | "member" | "viewer";

export interface Permission {
  resource: string;
  actions: string[];
}

// Define permissions for each role
export const ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
  owner: [
    { resource: "team", actions: ["read", "update", "delete"] },
    { resource: "members", actions: ["read", "invite", "remove", "update_role"] },
    { resource: "agents", actions: ["read", "create", "update", "delete"] },
    { resource: "worlds", actions: ["read", "create", "update", "delete"] },
    { resource: "billing", actions: ["read", "update"] },
  ],
  admin: [
    { resource: "team", actions: ["read", "update"] },
    { resource: "members", actions: ["read", "invite", "remove"] },
    { resource: "agents", actions: ["read", "create", "update", "delete"] },
    { resource: "worlds", actions: ["read", "create", "update", "delete"] },
    { resource: "billing", actions: ["read"] },
  ],
  member: [
    { resource: "team", actions: ["read"] },
    { resource: "members", actions: ["read"] },
    { resource: "agents", actions: ["read", "create", "update"] },
    { resource: "worlds", actions: ["read", "create", "update"] },
  ],
  viewer: [
    { resource: "team", actions: ["read"] },
    { resource: "members", actions: ["read"] },
    { resource: "agents", actions: ["read"] },
    { resource: "worlds", actions: ["read"] },
  ],
};

export function hasPermission(
  role: TeamRole,
  resource: string,
  action: string
): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  const resourcePermission = permissions.find((p) => p.resource === resource);
  return resourcePermission?.actions.includes(action) ?? false;
}

export function getRoleLevel(role: TeamRole): number {
  const levels: Record<TeamRole, number> = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
  };
  return levels[role];
}

export function canManageRole(managerRole: TeamRole, targetRole: TeamRole): boolean {
  // Owners can manage anyone
  if (managerRole === "owner") return true;
  // Admins can manage members and viewers
  if (managerRole === "admin") {
    return targetRole === "member" || targetRole === "viewer";
  }
  // Members and viewers can't manage anyone
  return false;
}
