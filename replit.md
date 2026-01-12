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

## Authentication
- **Provider**: Google OAuth via NextAuth.js
- **Session Management**: next-auth session with JWT strategy
- **Access Control**: Internal company employees only
- **Environment Variables**: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_URL, NEXTAUTH_SECRET

## API Routes
- `/api/auth/[...nextauth]` - NextAuth authentication endpoints
- `/api/hospitals` - Hospital data from Google Sheets
- `/api/requests` - Blog request management
- `/api/process` - Auto-processing of pending requests (30s polling)
- `/api/generate` - AI blog content generation
- `/api/regenerate` - Content regeneration with chat context

## Recent Changes
- January 12, 2026: Implemented production Google OAuth authentication, removed demo login
- January 12, 2026: Added automatic processing with 30-second polling interval
- January 12, 2026: Initial Replit setup and configuration
