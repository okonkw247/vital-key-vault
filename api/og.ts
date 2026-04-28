export default function handler(req: any, res: any) {
  const ua = req.headers['user-agent'] || '';
  const isBot =
    ua.includes('facebookexternalhit') ||
    ua.includes('Twitterbot') ||
    ua.includes('WhatsApp') ||
    ua.includes('LinkedInBot') ||
    ua.includes('Googlebot') ||
    ua.includes('Slackbot') ||
    ua.includes('Discordbot') ||
    ua.includes('TelegramBot');

  if (isBot) {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Adams X API Vault</title>
  <meta property="og:title" content="Adams X API Vault" />
  <meta property="og:description" content="Your personal API key command center — store, monitor, and serve active keys to any project, 24/7." />
  <meta property="og:image" content="https://vital-key-vault-cf3t.vercel.app/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="https://vital-key-vault-cf3t.vercel.app" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Adams X API Vault" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Adams X API Vault" />
  <meta name="twitter:description" content="Your personal API key command center" />
  <meta name="twitter:image" content="https://vital-key-vault-cf3t.vercel.app/og-image.png" />
</head>
<body></body>
</html>`);
  }

  res.redirect(302, '/');
}
