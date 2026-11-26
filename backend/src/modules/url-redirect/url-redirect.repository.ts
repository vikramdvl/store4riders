import { UrlRedirectModel } from "./url-redirect.model";
import { IUrlRedirect, UrlRedirectSource } from "@store4riders/shared-types";

export class UrlRedirectRepository {
  static async findById(id: string): Promise<IUrlRedirect | null> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) return null;
    const doc = await UrlRedirectModel.findById(id).lean().exec();
    return doc as unknown as IUrlRedirect | null;
  }

  static async findByFromPath(fromPath: string): Promise<IUrlRedirect | null> {
    const doc = await UrlRedirectModel.findOne({ fromPath }).lean().exec();
    return doc as unknown as IUrlRedirect | null;
  }

  static async findActiveByFromPath(fromPath: string): Promise<IUrlRedirect | null> {
    const doc = await UrlRedirectModel.findOne({ fromPath, isActive: true }).lean().exec();
    return doc as unknown as IUrlRedirect | null;
  }

  static async findAllActiveMap(): Promise<
    Array<{ fromPath: string; toPath: string; statusCode: 301 | 302 }>
  > {
    const docs = await UrlRedirectModel.find({ isActive: true })
      .select("fromPath toPath statusCode -_id")
      .lean()
      .exec();
    return docs as unknown as Array<{ fromPath: string; toPath: string; statusCode: 301 | 302 }>;
  }

  static async list(page = 1, limit = 20, search?: string, source?: string) {
    const query: Record<string, any> = {};
    if (source && source !== "all") {
      query.source = source;
    }
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$or = [{ fromPath: regex }, { toPath: regex }, { note: regex }];
    }

    const skip = (page - 1) * limit;
    const [items, totalCount] = await Promise.all([
      UrlRedirectModel.find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      UrlRedirectModel.countDocuments(query).exec(),
    ]);

    return {
      items: items as unknown as IUrlRedirect[],
      totalCount,
    };
  }

  static async create(data: Partial<IUrlRedirect>): Promise<IUrlRedirect> {
    const created = await UrlRedirectModel.create(data);
    return created.toObject() as unknown as IUrlRedirect;
  }

  static async update(id: string, data: Partial<IUrlRedirect>): Promise<IUrlRedirect | null> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) return null;
    const updated = await UrlRedirectModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    )
      .lean()
      .exec();
    return updated as unknown as IUrlRedirect | null;
  }

  static async delete(id: string): Promise<IUrlRedirect | null> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) return null;
    const deleted = await UrlRedirectModel.findByIdAndDelete(id).lean().exec();
    return deleted as unknown as IUrlRedirect | null;
  }

  static async deleteByFromPath(fromPath: string): Promise<void> {
    await UrlRedirectModel.deleteOne({ fromPath }).exec();
  }

  static async upsertAutoRedirect(
    fromPath: string,
    toPath: string,
    source: UrlRedirectSource,
    note?: string
  ): Promise<IUrlRedirect> {
    const updated = await UrlRedirectModel.findOneAndUpdate(
      { fromPath },
      {
        $set: {
          toPath,
          statusCode: 301,
          source,
          isActive: true,
          ...(note ? { note } : {}),
        },
        $setOnInsert: {
          hitCount: 0,
        },
      },
      { upsert: true, new: true, runValidators: true }
    )
      .lean()
      .exec();

    return updated as unknown as IUrlRedirect;
  }

  static async repointDestination(oldTargetPath: string, newTargetPath: string): Promise<void> {
    await UrlRedirectModel.updateMany(
      { toPath: oldTargetPath, fromPath: { $ne: newTargetPath } },
      { $set: { toPath: newTargetPath } }
    ).exec();
  }

  static async incrementHitCount(id: string): Promise<void> {
    try {
      await UrlRedirectModel.findByIdAndUpdate(id, {
        $inc: { hitCount: 1 },
        $set: { lastHitAt: new Date() },
      }).exec();
    } catch {
      // Non-blocking telemetry
    }
  }
}
