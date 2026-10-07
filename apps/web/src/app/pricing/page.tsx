import { PricingContent, PublicFooter, PublicHeader } from "@/components/lifesync/public";
export default function Page() {
  return (
    <>
      <PublicHeader />
      <main className="min-h-[65vh]">
        <PricingContent />
      </main>
      <PublicFooter />
    </>
  );
}
