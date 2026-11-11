import { createFileRoute } from "@tanstack/react-router";
import { WikiPage } from "@/components/wiki/WikiPage";
import wikiCss from "@/styles/wiki.css?url";

const title = "Vexaria Wiki — Complete Game & Player Guide";
const description =
  "Current Vexaria rules for hero rarities, bombs, chest rewards, energy recovery, houses, minting, marketplace, player levels and saved progress.";

export const Route = createFileRoute("/wiki")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: wikiCss }],
  }),
  component: WikiPage,
});
