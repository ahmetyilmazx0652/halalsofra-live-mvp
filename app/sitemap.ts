import type { MetadataRoute } from "next";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const baseRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl(),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: absoluteUrl("/owner"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7
    }
  ];

  if (!hasSupabaseConfig || !supabase) {
    return baseRoutes;
  }

  const result = await supabase
    .from("restaurants")
    .select("slug,updated_at")
    .eq("status", "published")
    .order("updated_at", { ascending: false });

  if (result.error) {
    return baseRoutes;
  }

  const restaurantRoutes = (result.data ?? []).map((restaurant) => ({
    url: absoluteUrl(`/restaurants/${restaurant.slug}`),
    lastModified: restaurant.updated_at ? new Date(restaurant.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.8
  }));

  return [...baseRoutes, ...restaurantRoutes];
}
