import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserService } from "../user.service";
import { UserRepository } from "../user.repository";
import { UserValidator } from "../user.validator";
import { NextRequest } from "next/server";
import { ValidationError } from "../../../core/errors/AppError";

describe("UserService Address Operations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handles adding first address when user.addresses is undefined", async () => {
    const mockUser: any = {
      _id: "507f1f77bcf86cd799439011",
      email: "biker@example.com",
      firstName: "Rider",
      lastName: "Singh",
      addresses: undefined, // Simulating DB document where addresses field was omitted
    };

    vi.spyOn(UserRepository, "findById").mockResolvedValue(mockUser);
    vi.spyOn(UserRepository, "update").mockImplementation(async (id, data) => {
      return { ...mockUser, ...data } as any;
    });

    const result = await UserService.addAddress("507f1f77bcf86cd799439011", {
      street: "123 FC Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411004",
      country: "India",
      isDefault: false,
    });

    expect(result.addresses).toBeDefined();
    expect(result.addresses.length).toBe(1);
    expect(result.addresses[0].street).toBe("123 FC Road");
    // First address should automatically be set to default
    expect(result.addresses[0].isDefault).toBe(true);
    expect(result.addresses[0].id).toBeDefined();
  });

  it("adds subsequent address without unsetting existing default unless requested", async () => {
    const mockUser: any = {
      _id: "507f1f77bcf86cd799439011",
      email: "biker@example.com",
      firstName: "Rider",
      lastName: "Singh",
      addresses: [
        {
          id: "addr-1",
          street: "123 FC Road",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411004",
          country: "India",
          isDefault: true,
        },
      ],
    };

    vi.spyOn(UserRepository, "findById").mockResolvedValue(mockUser);
    vi.spyOn(UserRepository, "update").mockImplementation(async (id, data) => {
      return { ...mockUser, ...data } as any;
    });

    const result = await UserService.addAddress("507f1f77bcf86cd799439011", {
      street: "456 MG Road",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
      isDefault: false,
    });

    expect(result.addresses.length).toBe(2);
    expect(result.addresses[0].isDefault).toBe(true);
    expect(result.addresses[1].isDefault).toBe(false);
  });

  it("returns empty array for getAddresses when user.addresses is undefined", async () => {
    const mockUser: any = {
      _id: "507f1f77bcf86cd799439011",
      email: "biker@example.com",
      firstName: "Rider",
      lastName: "Singh",
      addresses: undefined,
    };

    vi.spyOn(UserRepository, "findById").mockResolvedValue(mockUser);

    const addresses = await UserService.getAddresses("507f1f77bcf86cd799439011");
    expect(Array.isArray(addresses)).toBe(true);
    expect(addresses.length).toBe(0);
  });

  it("safely removes an address", async () => {
    const mockUser: any = {
      _id: "507f1f77bcf86cd799439011",
      email: "biker@example.com",
      firstName: "Rider",
      lastName: "Singh",
      addresses: [
        {
          id: "addr-1",
          street: "123 FC Road",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411004",
          country: "India",
          isDefault: true,
        },
      ],
    };

    vi.spyOn(UserRepository, "findById").mockResolvedValue(mockUser);
    vi.spyOn(UserRepository, "update").mockImplementation(async (id, data) => {
      return { ...mockUser, ...data } as any;
    });

    const result = await UserService.removeAddress("507f1f77bcf86cd799439011", "addr-1");
    expect(result.addresses.length).toBe(0);
  });
});
