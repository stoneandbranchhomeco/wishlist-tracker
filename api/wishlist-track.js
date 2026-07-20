const SHOP = "stoneandbranchhomeco.myshopify.com";
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = "2024-01";
const METAOBJECT_TYPE = "sidekick_wishlist_count";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export default async function handler(req, res) {
  res.set(corsHeaders);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { productId, productTitle, productUrl } = req.body;

  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": ADMIN_TOKEN,
  };

  const endpoint = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

  const searchRes = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: `query FindWishlist($handle: MetaobjectHandleInput!) {
        metaobjectByHandle(handle: $handle) {
          id
          wishlistCount: field(key: "wishlist_count") { value }
        }
      }`,
      variables: { handle: { type: METAOBJECT_TYPE, handle: `product-${productId}` } },
    }),
  });

  const searchData = await searchRes.json();
  const existing = searchData.data?.metaobjectByHandle;

  if (existing) {
    const currentCount = parseInt(existing.wishlistCount?.value || "0", 10);
    await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `mutation UpdateWishlist($id: ID!, $metaobject: MetaobjectUpdateInput!) {
          metaobjectUpdate(id: $id, metaobject: $metaobject) {
            metaobject { id }
            userErrors { message }
          }
        }`,
        variables: {
          id: existing.id,
          metaobject: { fields: [{ key: "wishlist_count", value: String(currentCount + 1) }] },
        },
      }),
    });
  } else {
    await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `mutation CreateWishlist($metaobject: MetaobjectCreateInput!) {
          metaobjectCreate(metaobject: $metaobject) {
            metaobject { id }
            userErrors { message }
          }
        }`,
        variables: {
          metaobject: {
            type: METAOBJECT_TYPE,
            handle: `product-${productId}`,
            fields: [
              { key: "product_id", value: String(productId) },
              { key: "product_title", value: productTitle },
              { key: "product_url", value: productUrl },
              { key: "wishlist_count", value: "1" },
            ],
          },
        },
      }),
    });
  }

  return res.status(200).json({ success: true });
}

