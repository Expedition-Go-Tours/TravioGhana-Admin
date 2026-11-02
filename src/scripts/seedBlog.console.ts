// Paste the entire block below into the browser console on the admin page.
// Make sure you're logged in at http://localhost:8080/admin/blog

;(async () => {
  const base = "/api"

  // 0. Get current user's ID
  const meRes = await fetch(`${base}/admin/me`)
  const me = await meRes.json()
  const authorId = me?.data?.id
  if (!authorId) { console.error("❌ Not logged in as admin"); return }

  // 1. Get or create a category
  const catsRes = await fetch(`${base}/blog/categories`)
  const cats = await catsRes.json()
  let categoryId = cats?.data?.[0]?.id

  if (!categoryId) {
    const newCat = await fetch(`${base}/blog/admin/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Travel", slug: "travel", description: "Travel stories and guides" }),
    })
    const catData = await newCat.json()
    categoryId = catData?.data?.id || catData?.id
  }

  // 2. Create article
  const body = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Kenya's Maasai Mara is one of Africa's best-known safari destinations. The savannah stretches to the horizon in every direction." },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "From the " },
          { type: "text", text: "Great Migration", marks: [{ type: "bold" }] },
          { type: "text", text: " to the Big Five, wildlife drives the visit. Planning a trip? Read our " },
          { type: "text", text: "safari planning guide", marks: [{ type: "link", attrs: { href: "https://example.com/safari-guide" } }] },
          { type: "text", text: " before you book." },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "When to Visit" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "The dry season (July to October) offers the best wildlife viewing. This is when herds of wildebeest, zebra, and gazelle cross the Mara River in what Sir David Attenborough called " },
          { type: "text", text: '"the greatest show on Earth."', marks: [{ type: "italic" }] },
          { type: "text", text: " The wet season (November to May) brings rain and turns the plains green." },
        ],
      },
      {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: '"The Mara is not a place you visit. It\'s a place that visits you — long after you\'ve left, the red dust and golden light stay with you forever."', marks: [{ type: "italic" }] },
            ],
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Getting There" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Most travelers fly into " },
          { type: "text", text: "Jomo Kenyatta International Airport (NBO)", marks: [{ type: "bold" }] },
          { type: "text", text: " in Nairobi, then take a short domestic flight to one of the Mara's many airstrips. Several operators offer daily flights. For the adventurous, a five-hour drive from Nairobi crosses the Great Rift Valley." },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Looking for accommodation? Browse our " },
          { type: "text", text: "curated list of luxury camps and lodges", marks: [{ type: "link", attrs: { href: "https://example.com/maasai-mara-lodges" } }] },
          { type: "text", text: " that range from classic tented camps to ultra-luxe eco-resorts." },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "What to Pack" }],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Neutral-colored clothing (khaki, olive, beige)" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Warm jacket for chilly morning game drives" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Binoculars — absolutely essential" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Camera with a zoom lens (200mm+ recommended)" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Sunscreen, hat, and insect repellent" }] }] },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Game drives start early, so bring layers for cold mornings." },
        ],
      },
      {
        type: "horizontalRule",
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Book your trip around the dry season for the best wildlife viewing.", marks: [{ type: "bold" }] },
        ],
      },
    ],
  }

  const res = await fetch(`${base}/blog/admin/articles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "A Practical Guide to the Maasai Mara",
      slug: "exploring-wild-beauty-maasai-mara-" + Date.now(),
      excerpt: "When to visit the Maasai Mara, how to get there, and what to pack for a safari built around the Great Migration.",
      body,
      featuredImage: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1200&q=80",
      metaTitle: "A Practical Guide to the Maasai Mara | Travio Ghana",
      metaDescription: "Plan a Maasai Mara safari: the best months for wildlife viewing, flights and road access from Nairobi, and what to pack.",
      status: "PUBLISHED",
      readTime: 8,
      locale: "en",
      authorId,
      categoryId,
      tags: ["safari", "kenya", "travel", "wildlife"],
    }),
  })

  const result = await res.json()
  if (res.ok) {
    console.log("✅ Article created:", result?.data?.article?.id || result?.data?.id || result?.id)
    window.location.href = "/admin/blog"
  } else {
    console.error("❌ Failed:", result)
  }
})()
