export type UrlRedirectStatusCode = 301 | 302;

export type UrlRedirectSource =
  | "manual"
  | "auto_product"
  | "auto_category"
  | "auto_brand"
  | "auto_blog";

export interface IUrlRedirect {
  _id?: string;
  fromPath: string;
  toPath: string;
  statusCode: UrlRedirectStatusCode;
  source: UrlRedirectSource;
  isActive: boolean;
  hitCount: number;
  lastHitAt?: Date | string | null;
  note?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IUrlRedirectResolveResult {
  matched: boolean;
  toPath?: string;
  statusCode?: UrlRedirectStatusCode;
}
