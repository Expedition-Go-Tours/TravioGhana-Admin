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
          { type: "text", text: "Kenya's Maasai Mara is one of Africa's most iconic safari destinations, and for good reason. The vast savannah stretches endlessly beneath a sky that seems to touch the earth at every horizon. " },
          { type: "text", text: "This is not just a travel destination — it's a life-changing experience.", marks: [{ type: "bold" }] },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "From the " },
          { type: "text", text: "Great Migration", marks: [{ type: "bold" }] },
          { type: "text", text: " to the Big Five, every moment here feels curated by nature itself. Planning a trip? Check out our " },
          { type: "text", text: "comprehensive safari guide", marks: [{ type: "link", attrs: { href: "https://example.com/safari-guide" } }] },
          { type: "text", text: " for everything you need to know." },
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
          { type: "text", text: " The wet season (November to May) transforms the landscape into a lush green paradise." },
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
          { type: "text", text: " in Nairobi, then take a short domestic flight to one of the Mara's many airstrips. Several operators offer daily flights, making the journey surprisingly accessible. For the adventurous, a 5-hour drive from Nairobi through the Great Rift Valley is an experience in itself." },
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
          { type: "text", text: "Most importantly, bring an open mind and a sense of wonder. The Mara has a way of exceeding every expectation." },
        ],
      },
      {
        type: "horizontalRule",
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Whether you're a first-time visitor or a seasoned safari-goer, " },
          { type: "text", text: "the Maasai Mara promises an adventure you'll never forget.", marks: [{ type: "bold" }, { type: "italic" }] },
          { type: "text", text: " Book your trip today and experience the wild heart of Africa." },
        ],
      },
    ],
  }

  const res = await fetch(`${base}/blog/admin/articles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Exploring the Wild Beauty of Maasai Mara",
      slug: "exploring-wild-beauty-maasai-mara-" + Date.now(),
      excerpt: "Discover why Kenya's most famous reserve should be at the top of your travel bucket list — from the Great Migration to breathtaking landscapes that define the African safari experience.",
      body,
      featuredImage: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1200&q=80",
      metaTitle: "Exploring the Wild Beauty of Maasai Mara | Travio Ghana",
      metaDescription: "From the Great Migration to the Big Five — discover why Maasai Mara is Africa's most iconic safari destination. Complete travel guide with tips, best times to visit, and more.",
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
