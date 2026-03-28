# HackEats

HackEats is a lightweight hackathon snack-ordering app with:

- a glassmorphism storefront
- visible stock levels on each product
- a purchase form that captures quantity, room, and optional phone number
- an optional Stripe Checkout payment flow through a serverless API route

## Project structure

- `index.html` - static storefront markup
- `styles.css` - responsive visual styling
- `app.js` - product catalog, modal purchase flow, and demo fallback logic
- `api/create-checkout.js` - Vercel serverless function for Stripe Checkout

## Deploying

This project is ready for static hosting on Vercel.

1. Create a new Vercel project from this folder or push it to GitHub and import it.
2. Add these environment variables:
   - `STRIPE_SECRET_KEY`
   - `SITE_URL`
3. Deploy.

If `STRIPE_SECRET_KEY` is missing, the frontend gracefully falls back to storing demo orders in the browser so the UI still works for previews.

## Local preview

You can preview the static site with any simple web server. For example:

```powershell
npx serve .
```

To test the API route locally with Vercel:

```powershell
npx vercel dev
```

## Notes for production

- Stock is currently stored client-side for demo simplicity. For a live event, move product data and stock updates to a backend or hosted database.
- Stripe Checkout session creation uses the raw Stripe HTTP API, so no SDK is required.
- Order metadata includes room, name, and phone number so runners can identify attendees if needed.
