import mongoose from "mongoose";
import { IBlockedIp, IBlockedIpActor } from "@store4riders/shared-types";
import { BlockedIpModel } from "./blocked-ip.model";

export class BlockedIpRepository {
  static async findActiveByIp(ip: string): Promise<IBlockedIp | null> {
    if (!ip) return null;
    const now = new Date();
    return BlockedIpModel.findOne({
      ip,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .lean()
      .exec() as unknown as Promise<IBlockedIp | null>;
  }

  static async findAllActive(): Promise<IBlockedIp[]> {
    const now = new Date();
    return BlockedIpModel.find({
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
      .exec() as unknown as Promise<IBlockedIp[]>;
  }

  static async upsertBlock(data: {
    ip: string;
    reason: string;
    blockedBy: IBlockedIpActor;
    expiresAt: Date | null;
  }): Promise<IBlockedIp> {
    const doc = await BlockedIpModel.findOneAndUpdate(
      { ip: data.ip },
      {
        $set: {
          reason: data.reason,
          blockedBy: data.blockedBy,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true }
    )
      .lean()
      .exec();

    return doc as unknown as IBlockedIp;
  }

  static async deleteByIpOrId(ipOrId: string): Promise<IBlockedIp | null> {
    const query = mongoose.Types.ObjectId.isValid(ipOrId)
      ? { $or: [{ _id: ipOrId }, { ip: ipOrId }] }
      : { ip: ipOrId };
    return BlockedIpModel.findOneAndDelete(query).lean().exec() as unknown as Promise<IBlockedIp | null>;
  }
}
