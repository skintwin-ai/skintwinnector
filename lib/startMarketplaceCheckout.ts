export async function startMarketplaceCheckout(input: {
  slug: string;
  serviceId: string;
  quantity: number;
}) {
  const response = await fetch('/api/marketplace/checkout', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      slug: input.slug,
      services: [{serviceId: input.serviceId, quantity: input.quantity}],
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Unable to start checkout');
  }
  return payload as {checkoutUrl: string; orderId: string};
}
