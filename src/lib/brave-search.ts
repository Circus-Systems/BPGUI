interface BraveSearchResult {
  title: string;
  url: string;
  snippet: string;
  age?: string;
}

export async function braveSearch(
  query: string,
  count: number = 10
): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error("BRAVE_SEARCH_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    q: query,
    count: count.toString(),
    text_decorations: "false",
    search_lang: "en",
  });

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Brave Search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return (data.web?.results ?? []).map(
    (r: { title: string; url: string; description: string; age?: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
      age: r.age,
    })
  );
}
