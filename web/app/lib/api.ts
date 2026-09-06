export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://holdcheck.onrender.com";

export function pricingPath(path: string) {
  if (typeof window !== "undefined") return `/pricing-api${path}`;
  return `${API_URL}${path}`;
}
