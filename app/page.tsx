import { unstable_noStore as noStore } from "next/cache";
import { getHomeData } from "@/lib/home-data";
import { HomeExplorer } from "@/app/home-explorer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HomePageProps = {
  searchParams?: {
    country?: string;
    city?: string;
    q?: string;
    feature?: string;
    sort?: string;
  };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  noStore();
  const { countries, restaurants, stats, source, notice } = await getHomeData();

  return (
    <HomeExplorer
      countries={countries}
      restaurants={restaurants}
      stats={stats}
      source={source}
      notice={notice}
      initialCountry={searchParams?.country}
      initialCity={searchParams?.city}
      initialQuery={searchParams?.q}
      initialFeature={searchParams?.feature}
      initialSort={searchParams?.sort}
    />
  );
}
