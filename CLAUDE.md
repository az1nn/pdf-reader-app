# PageMark - PDF Reader App

## Overview

A mobile PDF reader app built with Expo/React Native. Features PDF import, in-app reading with customizable themes, page comments (notes and links), reading progress tracking, and monthly reading statistics.

## Architecture

- **Frontend**: Expo Router with file-based routing, React Native
- **Backend**: Express server for landing page / API (minimal usage)
- **Storage**: AsyncStorage for all local data (PDFs, comments, sessions, settings)
- **PDF Rendering**: WebView + PDF.js for in-app PDF viewing

## Commands

- `npm start` - Start Expo dev server
- `npm run server:dev` - Start Express backend in dev mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run db:push` - Push Drizzle schema to database
- `npm run expo:static:build` - Build static Expo deployment

## Project Structure

- `app/(tabs)/index.tsx` - Library screen (PDF list with search, sort, filter)
- `app/(tabs)/stats.tsx` - Monthly reading stats with heatmap
- `app/reader/[id].tsx` - PDF reader with WebView + PDF.js
- `lib/storage.ts` - AsyncStorage CRUD operations
- `lib/contexts.tsx` - Theme and PDF data contexts
- `constants/colors.ts` - Light/dark theme colors + reader bg options
- `server/` - Express backend (landing page, API routes)
- `shared/schema.ts` - Drizzle ORM schema & Zod types
- `scripts/build.ts` - Static build script for deployment

## Code Style

- TypeScript strict mode enabled
- ESLint with Expo config
- Font: Manrope (Google Fonts)
- No emojis in code or UI - icon-based UI only
