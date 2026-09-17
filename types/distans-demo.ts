/** Row shape for public.distans_demo_links (Saltwaves/PodMaster Supabase). */
export type DistansDemoLink = {
  id: string;
  token: string;
  prospect_id: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
  first_upload_at: string | null;
};

/** Public fields safe to pass into the client demo UI. */
export type DistansDemoLinkPublic = {
  id: string;
  token: string;
  prospectEmail: string | null;
};
