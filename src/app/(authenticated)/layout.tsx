import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/nav-bar";
import { VerticalProvider } from "@/providers/vertical-provider";
import { VerticalSelector } from "@/components/vertical-selector";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName = user?.email ?? null;

  return (
    <VerticalProvider>
      <NavBar displayName={displayName} />
      <div className="border-b border-border bg-white px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center">
          <VerticalSelector />
        </div>
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </VerticalProvider>
  );
}
