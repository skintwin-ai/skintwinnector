function isLocalStripeKey(key = process.env.STRIPE_SECRET_KEY || '') {
  return (
    !key ||
    /placeholder|changeme|your.?key|sk_test_\*+/i.test(key) ||
    key.length < 16
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_LOCAL_STRIPE_RAIL: isLocalStripeKey() ? '1' : '0',
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'files.stripe.com',
      },
    ],
  },
};

export default nextConfig;
