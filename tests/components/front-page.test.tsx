import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LiveFrontPage } from "@/components/marketing/front-page";

describe("the landing page's live front page", () => {
  it("before any story exists, says so and lists the sources, with nothing news-like in the space", () => {
    render(<LiveFrontPage headlines={[]} now={new Date("2026-10-18T12:00:00Z")} onPress={["Source One", "Source Two"]} />);
    expect(screen.getByText("The first edition is being set.")).toBeInTheDocument();
    expect(screen.getByText("Source One")).toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("listitem").map((item) => item.textContent)).toEqual(["Source One", "Source Two"]);
  });

  it("with stories, shows each with its publisher and a real time, and marks the column live", () => {
    render(
      <LiveFrontPage
        now={new Date("2026-10-18T12:00:00Z")}
        onPress={[]}
        headlines={[{ id: "a", headline: "An invented headline for the test", publisher: "Example Times", category: "cricket", scope: "india", sourceCount: 3, publishedAt: null, lastUpdatedAt: "2026-10-18T11:42:00Z" }]}
      />,
    );
    expect(screen.getByText("An invented headline for the test")).toBeInTheDocument();
    expect(screen.getByText(/Example Times/)).toHaveTextContent("Example Times + 2 more · 18 min ago");
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
