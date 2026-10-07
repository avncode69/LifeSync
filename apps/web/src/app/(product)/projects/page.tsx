import { ResourceTabs } from "@/components/lifesync/resource";
export default function Page() {
  return (
    <ResourceTabs
      tabs={[
        { resource: "projects", label: "projects" },
        { resource: "tags", label: "tags" },
        { resource: "driveLinks", label: "driveLinks" },
      ]}
    />
  );
}
