import {
  calculateEmployerTaskCharge,
  calculateEscrowAmount,
  calculateWithdrawalNet,
  formatVnd,
  fromMinorUnits,
  toMinorUnits,
} from "@/lib/utils/money";

describe("financial math", () => {
  it("chuyển đổi minor units chính xác đến 2 chữ số thập phân", () => {
    expect(toMinorUnits("100000.25")).toBe(BigInt(10_000_025));
    expect(fromMinorUnits(BigInt(10_000_025))).toBe("100000.25");
  });

  it("tính phí tạo việc 10% trên escrow", () => {
    expect(calculateEscrowAmount("10000", 3)).toEqual("30000.00");
    expect(calculateEmployerTaskCharge("10000", 3)).toEqual({
      escrowAmount: "30000.00",
      platformFee: "3000.00",
      totalCharge: "33000.00",
    });
  });

  it("tính phí rút tiền 10% và số tiền thực nhận", () => {
    expect(calculateWithdrawalNet("250000")).toEqual({
      amount: "250000.00",
      fee: "25000.00",
      netAmount: "225000.00",
    });
  });

  it("không chấp nhận định dạng tiền vượt quá 2 chữ số thập phân", () => {
    expect(() => toMinorUnits("1000.999")).toThrow("Giá trị tiền không hợp lệ");
  });

  it("format VND theo locale Việt Nam", () => {
    expect(formatVnd("1500000")).toContain("1.500.000");
  });
});
