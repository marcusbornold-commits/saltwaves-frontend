import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f0ede8] px-5">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-[#1a1a1a]/80">
          Inloggad som{" "}
          <span className="font-medium text-[#1a1a1a]">
            {session.user.email}
          </span>
        </p>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="rounded-lg bg-[#ff6200] px-4 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#ff6200]/25"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
