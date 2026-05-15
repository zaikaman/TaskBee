import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: any): string {
  if (amount === null || amount === undefined) return "0";
  
  // Handle Decimal type from Prisma
  let numAmount: number;
  if (typeof amount === "string") {
    numAmount = parseFloat(amount);
  } else if (typeof amount === "number") {
    numAmount = amount;
  } else if (amount && typeof amount.toNumber === "function") {
    // Prisma Decimal type
    numAmount = amount.toNumber();
  } else {
    numAmount = 0;
  }
  
  return new Intl.NumberFormat("vi-VN").format(numAmount);
}
