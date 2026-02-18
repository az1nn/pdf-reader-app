# PageMark - PDF Reader App

## Overview
A mobile PDF reader app built with Expo/React Native. Features PDF import, in-app reading with customizable themes, page comments (notes and links), reading progress tracking, and monthly reading statistics.

## Architecture
- **Frontend**: Expo Router with file-based routing, React Native
- **Backend**: Express server for landing page / API (minimal usage)
- **Storage**: AsyncStorage for all local data (PDFs, comments, sessions, settings)
- **PDF Rendering**: WebView + PDF.js for in-app PDF viewing

## Key Features
- Import PDFs via document picker
- Searchable/sortable PDF library with status tracking
- In-app PDF reader with dark/light mode and 6 background color options
- Page-level comments (notes and links)
- Reading progress tracking (percentage and pages)
- Monthly reading statistics with calendar heatmap

## Project Structure
- `app/(tabs)/index.tsx` - Library screen (PDF list with search, sort, filter)
- `app/(tabs)/stats.tsx` - Monthly reading stats with heatmap
- `app/reader/[id].tsx` - PDF reader with WebView + PDF.js
- `lib/storage.ts` - AsyncStorage CRUD operations
- `lib/contexts.tsx` - Theme and PDF data contexts
- `constants/colors.ts` - Light/dark theme colors + reader bg options

## User Preferences
- Font: Manrope (Google Fonts)
- Theme: Warm amber/brown palette, bookish aesthetic
- No emojis, icon-based UI
