export interface IBlockedIpActor {
  userId?: string;
  email?: string;
  name?: string;
}

export interface IBlockedIp {
  _id?: string;
  id?: string;
  ip: string;
  reason: string;
  blockedBy: IBlockedIpActor;
  expiresAt?: string | Date | null;
  createdAt: string | Date;
}
