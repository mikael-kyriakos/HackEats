# HackEats

HackEats is a lightweight hackathon snack-ordering app with:

- a glassmorphism storefront
- visible stock levels on each product
- a purchase form that captures quantity, room, and optional phone number
- a Supabase-backed product and order store
- a Stripe Checkout payment flow through serverless API routes

## Project structure

- `index.html` - static storefront markup
- `styles.css` - responsive visual styling
- `app.js` - product catalog loading and modal purchase flow
- `api/products.js` - Vercel serverless function that loads products from Supabase
- `api/create-checkout.js` - reserves stock, creates the Stripe Checkout session, and stores a pending order
- `api/stripe-webhook.js` - confirms paid orders and releases expired reservations
- `supabase/schema.sql` - database tables and order/stock functions
- `supabase/seed.sql` - starter products

## Deploying

This project is ready for static hosting on Vercel.

1. Create a new Vercel project from this folder or push it to GitHub and import it.
2. Add these environment variables:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SITE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy.

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

- Product and order state is stored in Supabase, so all users see the same stock levels.
- Stripe Checkout session creation and webhook verification use raw HTTP plus Node crypto, so no extra SDK is required.
- Stock is reserved when checkout starts, marked paid on the Stripe webhook, and released if the checkout session expires.
