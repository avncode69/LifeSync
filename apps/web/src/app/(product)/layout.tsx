import { Consent } from "@/components/lifesync/consent";
import { Shell } from "@/components/lifesync/shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <Consent>{children}</Consent>
    </Shell>
  );
}
