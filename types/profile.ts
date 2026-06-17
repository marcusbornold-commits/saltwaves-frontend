export type Profile = {
  id: string;
  subscription_status: string | null;
  lifetime_creator: boolean;
  founding_member_tier: string | null;
  current_price_id: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
};
