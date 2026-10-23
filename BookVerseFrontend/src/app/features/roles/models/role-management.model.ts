export interface ManagedRole {
  idExternal: string;
  name: string;
  usersCount: number;
}

export interface ManagedUser {
  idExternal: string;
  username: string;
  email: string;
  status: string;
  roles: string[];
}
