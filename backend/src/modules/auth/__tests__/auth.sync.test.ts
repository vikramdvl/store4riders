import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../auth.service";
import { UserModel } from "../../user/user.model";
import { OrderModel } from "../../order/order.model";

vi.mock("../../user/user.model", () => ({
  UserModel: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("../../order/order.model", () => ({
  OrderModel: {
    find: vi.fn(),
  },
}));

describe("AuthService - syncUserFromLinkedOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should inherit phone and shipping address from latest linked order when missing on user", async () => {
    const mockOrders = [
      {
        orderNumber: "ORD-10001",
        userId: "user_123",
        shippingAddress: {
          phone: "+919876543210",
          street: "123 High Street",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          country: "India",
        },
      },
    ];

    vi.mocked(OrderModel.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(mockOrders),
        }),
      }),
    } as any);

    const mockExec = vi.fn().mockResolvedValue({});
    vi.mocked(UserModel.findByIdAndUpdate).mockReturnValue({ exec: mockExec } as any);

    const userObj: any = {
      _id: "user_123",
      email: "rider@example.com",
      phone: "",
      addresses: [],
    };

    await AuthService.syncUserFromLinkedOrders("user_123", userObj);

    expect(userObj.phone).toBe("+919876543210");
    expect(userObj.addresses).toHaveLength(1);
    expect(userObj.addresses[0].street).toBe("123 High Street");
    expect(userObj.addresses[0].isDefault).toBe(true);

    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    const [calledId, calledUpdate] = vi.mocked(UserModel.findByIdAndUpdate).mock.calls[0];
    expect(calledId).toBe("user_123");
    expect((calledUpdate as any).$set.phone).toBe("+919876543210");
    expect((calledUpdate as any).$set.addresses).toHaveLength(1);
  });

  it("should not overwrite existing phone or addresses if already present", async () => {
    const mockOrders = [
      {
        orderNumber: "ORD-10002",
        userId: "user_456",
        shippingAddress: {
          phone: "+919999999999",
          street: "999 Old Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
          country: "India",
        },
      },
    ];

    vi.mocked(OrderModel.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(mockOrders),
        }),
      }),
    } as any);

    const userObj: any = {
      _id: "user_456",
      email: "existing@example.com",
      phone: "+911234567890",
      addresses: [
        {
          id: "addr_1",
          street: "Existing Flat 4B",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411001",
          country: "India",
          isDefault: true,
        },
      ],
    };

    await AuthService.syncUserFromLinkedOrders("user_456", userObj);

    expect(userObj.phone).toBe("+911234567890");
    expect(userObj.addresses).toHaveLength(1);
    expect(userObj.addresses[0].street).toBe("Existing Flat 4B");
    expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("should replace legacy dummy 'User' last name with real name from linked order", async () => {
    const mockOrders = [
      {
        orderNumber: "ORD-10003",
        userId: "user_789",
        shippingAddress: {
          fullName: "test vikram",
          phone: "+918789494262",
          street: "789 Park Ave",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          country: "India",
        },
      },
    ];

    vi.mocked(OrderModel.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(mockOrders),
        }),
      }),
    } as any);

    const mockExec = vi.fn().mockResolvedValue({});
    vi.mocked(UserModel.findByIdAndUpdate).mockReturnValue({ exec: mockExec } as any);

    const userObj: any = {
      _id: "user_789",
      email: "vikuraj209@gmail.com",
      firstName: "test",
      lastName: "User", // legacy dummy value
      phone: "+918789494262",
      addresses: [{ id: "1" }],
    };

    await AuthService.syncUserFromLinkedOrders("user_789", userObj);

    expect(userObj.firstName).toBe("test");
    expect(userObj.lastName).toBe("vikram");

    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    const [calledId, calledUpdate] = vi.mocked(UserModel.findByIdAndUpdate).mock.calls[0];
    expect(calledId).toBe("user_789");
    expect((calledUpdate as any).$set.firstName).toBe("test");
    expect((calledUpdate as any).$set.lastName).toBe("vikram");
  });
});
