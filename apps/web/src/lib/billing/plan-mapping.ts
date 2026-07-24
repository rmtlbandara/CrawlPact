export type PaidPlanId = "solo" | "pro" | "agency";

export type PriceIdMap = {
  PADDLE_PRICE_ID_SOLO: string;
  PADDLE_PRICE_ID_PRO: string;
  PADDLE_PRICE_ID_AGENCY: string;
};

export function mapPriceIdToPlanId(env: PriceIdMap, priceId: string): PaidPlanId | null {
  if (priceId === env.PADDLE_PRICE_ID_SOLO) return "solo";
  if (priceId === env.PADDLE_PRICE_ID_PRO) return "pro";
  if (priceId === env.PADDLE_PRICE_ID_AGENCY) return "agency";
  return null;
}

export function priceIdForPlan(env: PriceIdMap, planId: PaidPlanId): string {
  return {
    solo: env.PADDLE_PRICE_ID_SOLO,
    pro: env.PADDLE_PRICE_ID_PRO,
    agency: env.PADDLE_PRICE_ID_AGENCY,
  }[planId];
}
