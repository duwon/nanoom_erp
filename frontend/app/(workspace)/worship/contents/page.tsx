import { redirect } from "next/navigation";

export default async function WorshipContentsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ anchorDate?: string; serviceId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = new URLSearchParams();
  if (resolvedSearchParams.anchorDate) {
    query.set("anchorDate", resolvedSearchParams.anchorDate);
  }
  if (resolvedSearchParams.serviceId) {
    query.set("serviceId", resolvedSearchParams.serviceId);
  }
  redirect(`/worship${query.toString() ? `?${query.toString()}` : ""}`);
}
