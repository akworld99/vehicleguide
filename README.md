# VehicleGuide (vehicleguide.lk)

Static site generator for model-by-model vehicle accessory guides in Sri Lanka, with WhatsApp lead capture. No dependencies: Node 18+ only.

## Build

    node build.js        # writes the site to ./dist

Pushing to `main` builds and deploys through GitHub Actions (Settings > Pages > Source: GitHub Actions).

## What to edit

| File | What it controls |
|---|---|
| `site.config.json` | WhatsApp number (`9477XXXXXXX`, no plus sign), GA4 ID, optional lead-logging endpoint, review date |
| `data/vehicles.json` | One line per vehicle. Adding a line creates its hub page and every accessory page that fits it |
| `data/accessories.json` | One block per accessory: guide text, checks, FAQs, `priceMin` / `priceMax` in rupees |
| `src/styles.css`, `src/app.js` | Design and front-end behaviour |

### Adding a vehicle

    {"make": "Toyota", "model": "Aqua", "type": "cars", "tags": ["car", "hybrid", "reconditioned"],
     "body": "Hatchback", "power": "Hybrid", "market": "Reconditioned Japanese imports",
     "note": "One sourced sentence on why it matters here.", "source": "Where that fact came from"}

`type` is one of: `cars`, `suvs`, `vans-and-pickups`, `motorbikes`, `scooters`, `three-wheelers`.
`tags` decide which accessories apply and which model-specific notes show:
`car` `suv` `van` `pickup` `motorbike` `scooter` `three-wheeler` plus `ev` `hybrid` `kei` `diesel` `new` `reconditioned` `cargo`.

### Prices

Pages show "Quoted on request" until an accessory has both `priceMin` and `priceMax`. Only fill these from real, current quotes.

## What the build produces

- Home, vehicle index, six type hubs, electric vehicles page
- One hub per vehicle and one page per vehicle x accessory
- One buying guide per accessory
- How it works, For shops, About, Privacy, 404
- `sitemap.xml`, `robots.txt` (AI crawlers allowed), `llms.txt`
- JSON-LD on every page: WebPage, BreadcrumbList, FAQPage; Organization and WebSite on the home page

## Leads

Every quote button and form opens WhatsApp with the vehicle, accessory, area and the page path (`Ref: /cars/byd-atto-1/dashcam/`) pre-filled, so each lead can be traced to the page that produced it. With `ga4` set, each click also fires a `generate_lead` event. With `leadEndpoint` set, each click is posted there as JSON.
