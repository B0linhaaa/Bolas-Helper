export type League = {
  slug: string;
  name: string;
  country: string;
};

export const LEAGUES: League[] = [
  { slug: "por.1", name: "Liga Portugal", country: "Portugal" },
  { slug: "eng.1", name: "Premier League", country: "Inglaterra" },
  { slug: "esp.1", name: "La Liga", country: "Espanha" },
  { slug: "ita.1", name: "Serie A", country: "Itália" },
  { slug: "ger.1", name: "Bundesliga", country: "Alemanha" },
  { slug: "fra.1", name: "Ligue 1", country: "França" },
  { slug: "ned.1", name: "Eredivisie", country: "Holanda" },
  { slug: "uefa.champions", name: "Champions League", country: "Europa" },
  { slug: "uefa.europa", name: "Europa League", country: "Europa" },
  { slug: "uefa.europa.conf", name: "Conference League", country: "Europa" },
  { slug: "uefa.nations", name: "Nations League", country: "Seleções" },
];

export const DEFAULT_LEAGUE = "por.1";

export function getLeague(slug: string): League | undefined {
  return LEAGUES.find((league) => league.slug === slug);
}
