# OMNIV3 Consulting Website (Astro)

A modern, client-ready website for **OMNIV3 Consulting**, built with Astro and Tailwind.
This project focuses on web development and web design lead generation.

## What Is Included

- Service-focused landing page
- Delivery process and value proposition sections
- Interactive contact form with empty/loading/success/error states
- Mock API endpoint at `POST /api/contact` for lead capture testing

## Tech Stack

- Astro
- TypeScript
- Tailwind CSS
- Node adapter (`@astrojs/node`) for server routes and easy cloud deployment

## Run Locally

```bash
npm install
npm run dev -- --port 43123 --host 127.0.0.1
```

Open: `http://127.0.0.1:43123`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production output
- `npm run preview` - Preview production build
- `npm run start` - Run standalone Node server from `dist`

## Contact Form Integration

The contact form currently posts to a mock-safe endpoint: `POST /api/contact`.
Swap this endpoint with your production lead workflow:

- SendGrid/Postmark email service
- HubSpot/Salesforce/Pipedrive CRM API
- Existing .NET backend endpoint

## Deployment Options

### AWS
- **Amplify Hosting**: connect GitHub repo and deploy directly.
- **App Runner/ECS Fargate**: deploy the `npm run build` output and run `npm run start`.

### Azure
- **Azure App Service (Linux)**: deploy from GitHub Actions and start with `npm run start`.
- **Container-based deployment**: build image from this project and deploy to Azure Container Apps.

## Repository

GitHub target repository:

`https://github.com/epdsn/OMNIV3-Consulting`
