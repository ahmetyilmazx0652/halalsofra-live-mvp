import { unstable_noStore as noStore } from "next/cache";
import { getHomeData } from "@/lib/home-data";
import { HomeExplorer } from "@/app/home-explorer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  noStore();
  const { countries, restaurants, stats, source, notice } = await getHomeData();

  return (
    <HomeExplorer
      countries={countries}
      restaurants={restaurants}
      stats={stats}
      source={source}
      notice={notice}
    />
  );
}
