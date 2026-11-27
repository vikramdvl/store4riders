import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderRepository } from "../order.repository";
import { ProductModel } from "../../product/product.model";

vi.mock("../../product/product.model", () => ({
  ProductModel: {
    find: vi.fn(),
  },
}));

describe("OrderRepository.populateItemShippingSpecs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("populates missing weight and L/B/H specs from parent product and child variant", async () => {
    const order: any = {
      items: [
        {
          productId: "507f1f77bcf86cd799439011",
          variantId: "var-m",
          sku: "AXOR-BLK-M",
          name: "Axor Helmet",
          quantity: 1,
        },
        {
          productId: "507f1f77bcf86cd799439012",
          sku: "LUBE-400",
          name: "Chain Lube",
          quantity: 1,
        },
      ],
    };

    (ProductModel.find as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([
            {
              _id: "507f1f77bcf86cd799439011",
              sku: "AXOR-BLK",
              weight: 1.5,
              weightUnit: "kg",
              length: 36,
              breadth: 28,
              height: 28,
              dimensionUnit: "cm",
              variants: [
                {
                  id: "var-m",
                  sku: "AXOR-BLK-M",
                  weight: 1.65,
                  weightUnit: "kg",
                  length: 37,
                  breadth: 29,
                  height: 29,
                },
              ],
            },
            {
              _id: "507f1f77bcf86cd799439012",
              sku: "LUBE-400",
              weight: 400,
              weightUnit: "ml",
              length: 18,
              breadth: 7,
              height: 7,
              dimensionUnit: "cm",
              variants: [],
            },
          ]),
        }),
      }),
    });

    await OrderRepository.populateItemShippingSpecs(order);

    expect(order.items[0]).toMatchObject({
      weight: 1.65,
      weightUnit: "kg",
      length: 37,
      breadth: 29,
      height: 29,
      dimensionUnit: "cm",
    });
    expect(order.items[1]).toMatchObject({
      weight: 400,
      weightUnit: "ml",
      length: 18,
      breadth: 7,
      height: 7,
      dimensionUnit: "cm",
    });
  });

  it("skips DB query when all items already have snapshot weight and dimensions", async () => {
    const order: any = {
      items: [
        {
          productId: "507f1f77bcf86cd799439011",
          sku: "SNAP-1",
          weight: 1.2,
          weightUnit: "kg",
          length: 30,
          breadth: 20,
          height: 15,
        },
      ],
    };

    await OrderRepository.populateItemShippingSpecs(order);

    expect(ProductModel.find).not.toHaveBeenCalled();
  });
});
