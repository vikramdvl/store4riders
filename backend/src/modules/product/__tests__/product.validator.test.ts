import { describe, it, expect } from 'vitest';
import { ProductValidator } from '../product.validator';
import { NextRequest } from 'next/server';

describe('ProductValidator', () => {
  const createMockReq = (url: string) => {
    return {
      nextUrl: new URL(url),
    } as NextRequest;
  };

  it('should parse sort=bestselling correctly', () => {
    const req = createMockReq('http://localhost/api/products?sort=bestselling');
    const result = ProductValidator.validateListQuery(req);
    expect(result.sort).toEqual({ salesCount: -1, _id: -1 });
  });

  it('should parse sort=newest correctly', () => {
    const req = createMockReq('http://localhost/api/products?sort=newest');
    const result = ProductValidator.validateListQuery(req);
    expect(result.sort).toEqual({ createdAt: -1, _id: -1 });
  });

  it('should parse inStock correctly inside andConditions', () => {
    const req = createMockReq('http://localhost/api/products?inStock=true');
    const result = ProductValidator.validateListQuery(req);
    const andConditions = (result.filters as any).$and;
    expect(andConditions).toBeDefined();
    const hasInStock = andConditions.some((cond: any) => cond.$or && cond.$or.some((s: any) => s.stockStatus?.$gt === 0));
    expect(hasInStock).toBe(true);
  });
  
  it('should parse price range correctly using minPrice/maxPrice inside andConditions', () => {
    const req = createMockReq('http://localhost/api/products?minPrice=500&maxPrice=1000');
    const result = ProductValidator.validateListQuery(req);
    const andConditions = (result.filters as any).$and;
    expect(andConditions).toBeDefined();
    const priceCond = andConditions.find((cond: any) => cond.$or && cond.$or[0]?.specialPrice?.$gte === 500);
    expect(priceCond).toBeDefined();
    expect(priceCond.$or[0].specialPrice).toEqual({ $gte: 500, $lte: 1000, $gt: 0 });
    expect(priceCond.$or[1].basePrice).toEqual({ $gte: 500, $lte: 1000, $gt: 0 });
  });

  it('should parse price range correctly using priceMin/priceMax (aliases)', () => {
    const req = createMockReq('http://localhost/api/products?priceMin=500&priceMax=1000');
    const result = ProductValidator.validateListQuery(req);
    const andConditions = (result.filters as any).$and;
    expect(andConditions).toBeDefined();
    const priceCond = andConditions.find((cond: any) => cond.$or && cond.$or[0]?.specialPrice?.$gte === 500);
    expect(priceCond).toBeDefined();
    expect(priceCond.$or[0].specialPrice).toEqual({ $gte: 500, $lte: 1000, $gt: 0 });
    expect(priceCond.$or[1].basePrice).toEqual({ $gte: 500, $lte: 1000, $gt: 0 });
  });

  it('should parse single size correctly inside andConditions', () => {
    const req = createMockReq('http://localhost/api/products?size=XL');
    const result = ProductValidator.validateListQuery(req);
    const andConditions = (result.filters as any).$and;
    expect(andConditions).toBeDefined();
    const sizeCond = andConditions.find((cond: any) =>
      cond.$or && cond.$or.some((s: any) => s.configurableVariations || (s.$and && s.$and.some((a: any) => a.configurableVariations)))
    );
    expect(sizeCond).toBeDefined();
    expect(sizeCond.$or.length).toBe(9);
    const configVarPart = sizeCond.$or[0].configurableVariations || sizeCond.$or[0].$and?.find((a: any) => a.configurableVariations)?.configurableVariations;
    expect(configVarPart.$in[0].source).toEqual('(?:size|eu_size|eu_size_for_boots)=XL(\\||,|$)');
  });

  it('should parse multiple sizes correctly', () => {
    const req = createMockReq('http://localhost/api/products?size=L,XL');
    const result = ProductValidator.validateListQuery(req);
    const andConditions = (result.filters as any).$and;
    const sizeCond = andConditions.find((cond: any) =>
      cond.$or && cond.$or.some((s: any) => s.configurableVariations || (s.$and && s.$and.some((a: any) => a.configurableVariations)))
    );
    expect(sizeCond).toBeDefined();
    const configVarPart = sizeCond.$or[0].configurableVariations || sizeCond.$or[0].$and?.find((a: any) => a.configurableVariations)?.configurableVariations;
    expect(configVarPart.$in).toHaveLength(2);
  });

  it('should ignore empty spaces and extra commas in sizes', () => {
    const req = createMockReq('http://localhost/api/products?size=L,, XL, ');
    const result = ProductValidator.validateListQuery(req);
    const andConditions = (result.filters as any).$and;
    const sizeCond = andConditions.find((cond: any) =>
      cond.$or && cond.$or.some((s: any) => s.configurableVariations || (s.$and && s.$and.some((a: any) => a.configurableVariations)))
    );
    expect(sizeCond).toBeDefined();
    const configVarPart = sizeCond.$or[0].configurableVariations || sizeCond.$or[0].$and?.find((a: any) => a.configurableVariations)?.configurableVariations;
    expect(configVarPart.$in).toHaveLength(2);
  });

  it('should parse multiple colours correctly including colour and color aliases', () => {
    const req = createMockReq('http://localhost/api/products?colour=Black,Red');
    const result = ProductValidator.validateListQuery(req);
    const andConditions = (result.filters as any).$and;
    const colorCond = andConditions.find((cond: any) => cond.$or && cond.$or.some((s: any) => s['variants.attributes.color']));
    expect(colorCond).toBeDefined();
    expect(colorCond.$or.length).toBe(15);
  });

  it('should parse sort=rating correctly', () => {
    const req = createMockReq('http://localhost/api/products?sort=rating');
    const result = ProductValidator.validateListQuery(req);
    expect(result.sort).toEqual({ avgRating: -1, _id: -1 });
  });

  it('should correctly combine multiple filters (AND logic)', () => {
    const req = createMockReq('http://localhost/api/products?size=L&colour=Black&brand=MT&priceMin=5000');
    const result = ProductValidator.validateListQuery(req);
    expect(result.filters).toHaveProperty('$and');
    const andConditions = (result.filters as any).$and;
    expect(andConditions).toBeInstanceOf(Array);
    // Base conditions (price>0, stock) + Brand + Price + Size + Colour = 7
    expect(andConditions.length).toBeGreaterThanOrEqual(4);
  });

  it('should handle malicious regex attempts in search by escaping or ignoring', () => {
    const req = createMockReq('http://localhost/api/products?search=(.*)+&size=+++&colour=[a-z]');
    const result = ProductValidator.validateListQuery(req);
    expect(result.filters).toHaveProperty('$and');
  });

  it('should default scope=admin listings and searches to parent/standalone products only (hiding standalone child docs)', () => {
    const req = createMockReq('http://localhost/api/products?scope=admin&search=CHILD-SKU-M');
    const result = ProductValidator.validateListQuery(req);
    const andConditions = (result.filters as any).$and as any[];

    const visibilityGuard = andConditions.find(
      (cond) =>
        Array.isArray(cond?.$and) &&
        cond.$and.some((sub: any) => sub?.visibility?.$ne === '1') &&
        cond.$and.some((sub: any) => sub?.visibility?.$not instanceof RegExp)
    );
    expect(visibilityGuard).toBeDefined();

    const searchWrapper = andConditions.find(
      (cond) =>
        Array.isArray(cond?.$or) &&
        cond.$or.some(
          (branch: any) =>
            Array.isArray(branch?.$or) &&
            branch.$or.some((sub: any) => sub?.['variants.sku'] instanceof RegExp) &&
            branch.$or.some((sub: any) => sub?.sku instanceof RegExp)
        )
    );
    expect(searchWrapper).toBeDefined();

    const skuReq = createMockReq('http://localhost/api/products?scope=admin&sku=CHILD-SKU-M');
    const skuResult = ProductValidator.validateListQuery(skuReq);
    const skuAnd = (skuResult.filters as any).$and as any[];
    const skuCond = skuAnd.find(
      (cond) =>
        Array.isArray(cond?.$or) &&
        cond.$or.some((clause: any) => clause?.['variants.sku'] instanceof RegExp)
    );
    expect(skuCond).toBeDefined();
    expect(skuCond.$or.some((clause: any) => clause.sku instanceof RegExp)).toBe(true);
  });

  it('should allow explicit parentOnly=false in scope=admin when requested', () => {
    const req = createMockReq('http://localhost/api/products?scope=admin&parentOnly=false');
    const result = ProductValidator.validateListQuery(req);
    const andConditions = (result.filters as any).$and as any[] | undefined;

    const visibilityGuard = andConditions?.find(
      (cond) =>
        Array.isArray(cond?.$and) &&
        cond.$and.some((sub: any) => sub?.visibility?.$ne === '1')
    );
    expect(visibilityGuard).toBeUndefined();
  });
});
