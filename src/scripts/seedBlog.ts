import api from "@/lib/axios"

export async function seedArticle() {
  const catsRes = await api.get("/blog/categories")
  let categoryId: string
  if (catsRes.data?.data?.length > 0) {
    categoryId = catsRes.data.data[0].id
  } else {
    const catRes = await api.post("/blog/admin/categories", {
      name: "Travel",
      slug: "travel",
      description: "Travel stories and guides",
    })
    categoryId = catRes.data.data?.id || catRes.data?.id
  }

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
          { type: "text", text: "comprehensive safari guide", marks: [{ type: "link", attrs: { href: "https://example.com/safari-guide", target: "_blank" } }] },
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
          { type: "text", text: "curated list of luxury camps and lodges", marks: [{ type: "link", attrs: { href: "https://example.com/maasai-mara-lodges", target: "_blank" } }] },
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
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Neutral-colored clothing (khaki, olive, beige)" }] }],
          },
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Warm jacket for chilly morning game drives" }] }],
          },
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Binoculars — absolutely essential" }] }],
          },
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Camera with a zoom lens (200mm+ recommended)" }] }],
          },
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Sunscreen, hat, and insect repellent" }] }],
          },
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

  const article = await api.post("/blog/admin/articles", {
    title: "Exploring the Wild Beauty of Maasai Mara",
    slug: "exploring-wild-beauty-maasai-mara",
    excerpt: "Discover why Kenya's most famous reserve should be at the top of your travel bucket list — from the Great Migration to breathtaking landscapes that define the African safari experience.",
    body,
    featuredImage: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1200&q=80",
    metaTitle: "Exploring the Wild Beauty of Maasai Mara | Travio Ghana",
    metaDescription: "From the Great Migration to the Big Five — discover why Maasai Mara is Africa's most iconic safari destination. Complete travel guide with tips, best times to visit, and more.",
    status: "PUBLISHED",
    readTime: 8,
    locale: "en",
    authorName: "Alex Carter",
    categoryId,
    tags: ["safari", "kenya", "travel", "wildlife"],
  })

  return article.data
}

seedArticle()
  .then((res) => {
    console.log("✅ Article created:", res?.article?.id || res?.id)
    window.location.href = "/admin/blog"
  })
  .catch((err) => {
    console.error("❌ Failed:", err.response?.data || err.message)
  })
