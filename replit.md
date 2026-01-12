# Hospital Blog Automation

## Overview
A Next.js 16 application for hospital blog content automation. The system appears to be a Korean-language blog management tool with authentication and dashboard features.

## Project Structure
- `/hospital-blog-automation/` - Main Next.js application
  - `/src/app/` - Next.js App Router pages and API routes
  - `/src/components/` - React components (UI, auth, dashboard, admin)
  - `/src/lib/` - Utility functions and integrations (Google Drive, Sheets)
  - `/src/types/` - TypeScript type definitions
  - `/public/` - Static assets

## Tech Stack
- **Framework**: Next.js 16.1.1 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 with tailwindcss/postcss
- **UI Components**: Radix UI primitives with shadcn/ui patterns
- **AI Integration**: Anthropic SDK
- **Google Integration**: Google APIs (Drive, Sheets)

## Development
- **Port**: 5000 (bound to 0.0.0.0)
- **Dev Server**: `npm run dev -- -p 5000 -H 0.0.0.0`
- **Build**: `npm run build`
- **Start**: `npm start`

## Recent Changes
- January 12, 2026: Initial Replit setup and configuration
