import { redirect } from "next/navigation";
// Portalen är startsidan. Provmastringen ligger på /tools/audiobook/sjoberg/prov.
export const dynamic = "force-dynamic";
export default function Page() { redirect("/tools/audiobook/sjoberg/portal"); }
