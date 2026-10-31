# 🚀 cURL to REST Assured Code Generator

A modern web application that parses cURL commands and generates REST Assured test code with an intuitive visual editor.

[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38bdf8.svg)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-Latest-black.svg)](https://ui.shadcn.com/)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#environment-variables)
- [Usage Guide](#-usage-guide)
- [Project Structure](#-project-structure)
- [API Integration](#-api-integration)
- [Components Overview](#-components-overview)
- [Customization](#-customization)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🎯 Core Features

#### **1. cURL Command Parsing**
- Parse any cURL command into structured, editable data
- Support for all HTTP methods (GET, POST, PUT, PATCH, DELETE, etc.)
- Extract and organize:
  - Request URL (base URL + endpoint)
  - HTTP headers
  - Query parameters
  - Request body (JSON, form-data, raw)
  - Authentication details
  - Cookies
  - Network configurations
  - SSL/TLS settings
  - Various flags and options

#### **2. Visual Editor**
- **Accordion-based Interface**: Organized sections for different request components
- **Inline Editing**: Click to edit any field directly
- **Expandable/Collapsible Sections**: 
  - Request Details
  - Headers
  - Query Parameters
  - Request Body (with nested object/array visualization)
  - Cookies
  - Authentication
  - Form Data
  - Network Configuration
  - SSL/TLS Configuration
  - Flags
  - Path Parameters
  - Client Context (User Agent, Referer, Proxy)

#### **3. Advanced Request Body Editor**
- **Hierarchical View**: Nested JSON objects and arrays
- **Expand/Collapse All**: Bulk control for complex payloads
- **Inline Editing**: Edit primitive values directly
- **Path Visualization**: Clear display of nested paths
- **Type Indicators**: Visual distinction between objects, arrays, and primitives

#### **4. Section Management**
- **Add Missing Sections**: Dynamic section addition based on valid cURL options
- **Delete Sections**: Remove entire sections when not needed
- **Add Entries**: Add new headers, query params, cookies, etc.
- **Delete Entries**: Remove individual fields with confirmation
- **Bulk Selection**: Select multiple fields for batch deletion
- **Smart Defaults**: Auto-open sections with data

#### **5. Code Generation**

##### **Configuration Options**:
- **Generation Type**:
  - Full Test Class (complete Java class with imports and setup)
  - Test Method Only (just the @Test method)
  
- **Customization**:
  - Custom class names
  - Custom method names
  - Include/exclude assertions
  - Configure expected status codes
  - Toggle logging
  - POJO class generation

##### **POJO Generation**:
- Automatic POJO creation from request body
- Lombok annotations (@Data, @Builder)
- Nested class support
- Custom class naming

##### **Output Formats**:
- **Test Code Tab**: Generated REST Assured test
- **POJO Classes Tab**: Generated data models (when enabled)
- **Dependencies Tab**: Complete pom.xml with all required dependencies

##### **Code Actions**:
- Copy to clipboard
- Download as .java file
- Download pom.xml
- Syntax-highlighted preview

#### **6. Data Management**
- **Reset to Original**: Revert all changes to initial parsed state
- **Export JSON**: Download edited data as JSON file
- **Save Changes**: Persist modifications (with callback support)
- **Validation**: Required fields protection (method, URL)

#### **7. Flag & Configuration Management**
- **Visual Flag Display**: Active flags shown as badges
- **Flag Types**:
  - Network flags (insecure, verbose, silent, etc.)
  - SSL/TLS flags
  - Redirect flags
  - Compression flags
  
#### **8. User Experience**

##### **Theme Support**:
- Light mode
- Dark mode
- System preference detection
- Smooth theme transitions

##### **Responsive Design**:
- Mobile-friendly interface
- Tablet-optimized layouts
- Desktop-first workflow
- Adaptive component sizing

##### **Navigation**:
- Back to playground
- Auto-navigation after parsing
- State preservation between routes
- Original cURL display

##### **Visual Feedback**:
- Hover effects on editable fields
- Success/error toast notifications
- Copy confirmation indicators
- Loading states
- Disabled state handling

---

## 🛠 Tech Stack

### **Frontend Framework**
- **React 18.x** - UI library
- **TypeScript 5.x** - Type safety
- **Vite** - Build tool and dev server

### **Styling**
- **Tailwind CSS 3.x** - Utility-first CSS
- **shadcn/ui** - Component library
- **Radix UI** - Headless UI primitives
- **Framer Motion** - Animations

### **UI Components**
- Accordion
- Button
- Card
- Checkbox
- Dialog
- Input
- Select
- Textarea
- Theme Provider

### **State Management**
- React Hooks (useState, useEffect, useReducer patterns)
- Custom hooks for business logic
- Location state for navigation

### **Routing**
- React Router v6

### **HTTP Client**
- Axios

### **Development Tools**
- ESLint
- Prettier (implied)
- TypeScript compiler

---

## 🚀 Getting Started

### Prerequisites
```bash
node >= 18.0.0
npm >= 9.0.0
```

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd <project-directory>
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure the backend URL**

   `npm run dev` works with no setup and talks to `http://127.0.0.1:8000`. To use a
   different backend, or for any deployed build, set the variables described in
   [Environment Variables](#environment-variables).

4. **Start development server**
```bash
npm run dev
```

5. **Build for production**
```bash
VITE_CURL_CRAFT_API_URL=https://api.example.com npm run build     # production
VITE_CURL_CRAFT_API_URL=https://api.example.com npm run preprod   # preprod (--mode preprod)
```
The build fails if `VITE_CURL_CRAFT_API_URL` is missing or points at a loopback host.

6. **Preview production build**
```bash
npm run preview
```

---

## Environment Variables

All configuration is read through `src/lib/env.ts`. Vite inlines `VITE_*` values at **build time**, so they
must be set in the environment that runs the build (Vercel: Project Settings > Environment Variables, scoped
to the environment being built), not at runtime.

| Variable | Default | Replaces (master) | Notes |
|----------|---------|-------------------|-------|
| `VITE_CURL_CRAFT_API_URL` | `http://127.0.0.1:8000` (dev only) | same name | Backend base URL. **Required for `production` and `preprod` builds**: `vite build` fails if it is missing, empty, not an absolute http(s) URL, or a loopback host (`localhost`, `127.0.0.0/8`, `::1`, `0.0.0.0`). The default applies to `npm run dev` only. |
| `VITE_CURL_CRAFT_API_PARSE_ENDPOINT` | `/api/parse` | same name | Parse a cURL command. |
| `VITE_CURL_CRAFT_API_GENERATE_ENDPOINT` | `/api/generate-from-parsed` | `VITE_CURL_CRAFT_API_GENERATE_FROM_PARSED_ENDPOINT` | **Renamed.** Generate code from parsed data (also used per item by batch generation). |
| `VITE_CURL_CRAFT_API_HEALTH_ENDPOINT` | `/health` | same name, same default | Health check (`GET`), polled on every app load (any route) to wake the sleeping hosted backend and drive the generator status chip. Production sets it in the Vercel project; `.env.development` uses `/api/health` for the local backend. A `2xx` or `4xx` answer counts as awake, so a wrong path never blocks the app; network errors, timeouts and `5xx` keep it waking. |
| `VITE_CURL_CRAFT_API_FEEDBACK_ENDPOINT` | `/api/feedback` | same name | Submit feedback. |
| `VITE_CURL_CRAFT_API_BODY_EDIT_ENDPOINT` | `/api/body/edit` | none (new in V3) | Edit a node of the parsed body. |
| `VITE_CURL_CRAFT_API_BODY_DELETE_ENDPOINT` | `/api/body/delete` | none (new in V3) | Delete a node of the parsed body. |
| `VITE_CURL_CRAFT_BODY_API_ENABLED` | off (`true` turns it on) | none (new in V3) | Feature flag. Request-body edits and deletes always apply locally in the editor. When on, they are also mirrored to the two `/api/body/*` endpoints above (fire-and-forget; a failure shows a notice but never blocks or rolls back the edit). Leave off unless the backend needs to see body edits. |

Only `VITE_CURL_CRAFT_API_URL` normally needs setting; the endpoint paths already default to the backend's routes.

**Master variables V3 no longer reads** (a leftover value is harmless but has no effect; check the Vercel
project before deploying V3 to it):

| Variable | What happened to it |
|----------|---------------------|
| `VITE_CURL_CRAFT_API_GENERATE_FROM_PARSED_ENDPOINT` | Renamed to `VITE_CURL_CRAFT_API_GENERATE_ENDPOINT`. If only the old name is set, V3 silently uses the default path. |
| `VITE_CURL_CRAFT_API_PARSE_AND_GENERATE_ENDPOINT` | Ignored. V3 has no one-shot parse-and-generate call. |
| `VITE_BE_WARMUP_WAIT_MINS` | Ignored. V3's warm-up (`src/contexts/BackendStatusContext.tsx`) polls the health endpoint for up to 90 seconds on every app load, then reports the generator unavailable with a Retry button. |
| `VITE_BE_WARMUP_MAX_RETRIES` | Ignored. Same warm-up as above; requests themselves also retry network errors and 502/503/504 (`src/lib/api/apiClient.ts`). |

**Per environment**

- `npm run dev` loads the committed `.env.development` (localhost backend).
- `npm run build` (mode `production`) and `npm run preprod` (mode `preprod`) load `.env.production` /
  `.env.preprod` if present, plus anything in the process environment. `.env.preprod` and
  `.env.production.local` are git-ignored; `.env.production` is not, so prefer Vercel settings or a
  `.env.production.local` for per-deployment values. Never put secrets in any `VITE_*` variable: every value
  is visible in the shipped JavaScript.

---

## 📖 Usage Guide

### 1. Parse a cURL Command

```bash
# Navigate to Playground
http://localhost:5173/playground

# Paste your cURL command, for example:
curl -X POST "https://api.example.com/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token123" \
  -d '{"name": "John", "email": "john@example.com"}'

# Click "Parse cURL"
```

### 2. Edit Parsed Data

- Auto-navigates to Editor after parsing
- Click any field to edit inline
- Use accordion sections to navigate components
- Add/delete sections and entries as needed
- Expand/collapse nested body structures

### 3. Generate Code

1. Click **"Generate Code"** button
2. Select generation type:
   - **Full Test Class**: Complete test file
   - **Test Method Only**: Just the method
3. Configure options:
   - Class name
   - Method name
   - Enable assertions
   - Set expected status code
   - Enable logging
   - Generate POJOs (optional)
4. Click **"Generate Code"**
5. View generated code in tabs:
   - Test Code
   - POJO Classes (if enabled)
   - Dependencies (pom.xml)
6. Copy or download as needed

### 4. Export & Save

- **Export JSON**: Download modified data
- **Save Changes**: Trigger save callback (if provided)
- **Reset**: Revert to original parsed state

---

## 📁 Project Structure

```
src/
├── components/
│   ├── features/
│   │   └── curl/
│   │       ├── CodeGenerationDialog.tsx    # Code generation UI
│   │       ├── CurlPlayground.tsx          # cURL input interface
│   │       └── ParsedCurlEditor.tsx        # Visual editor
│   ├── layout/
│   │   ├── AppLayout.tsx                   # Main layout wrapper
│   │   ├── Footer.tsx                      # Footer component
│   │   └── NavBar.tsx                      # Navigation bar
│   └── ui/
│       ├── accordion.tsx                   # Accordion component
│       ├── button.tsx                      # Button component
│       ├── card.tsx                        # Card component
│       ├── checkbox.tsx                    # Checkbox component
│       ├── dialog.tsx                      # Dialog component
│       ├── input.tsx                       # Input component
│       ├── select.tsx                      # Select component
│       ├── textarea.tsx                    # Textarea component
│       └── theme-provider.tsx              # Theme context
│
├── lib/
│   ├── api/
│   │   ├── apiClient.ts                    # Axios instance config
│   │   └── curl.ts                         # cURL API service
│   ├── hooks/
│   │   ├── useCurlParser.ts                # Parsing logic hook
│   │   └── useParsedCurlEditor.ts          # Editor state hook
│   └── utils/
│       ├── curl.ts                         # cURL utilities
│       └── utils.ts                        # General utilities
│
├── pages/
│   ├── EditorPage.tsx                      # Editor route
│   ├── Home.tsx                            # Landing page
│   └── Playground.tsx                      # Playground route
│
├── types/
│   └── curl.ts                             # TypeScript types
│
├── App.tsx                                 # Root component
├── main.tsx                                # Entry point
└── index.css                               # Global styles
```

---

## 🔌 API Integration

### Backend Requirements

The frontend expects a REST API with the following endpoint:

#### **POST /api/parse**
Parse cURL command to structured data

**Request:**
```json
{
  "curl": "curl -X GET https://api.example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "method": "GET",
    "url": "https://api.example.com",
    "base_url": "https://api.example.com",
    "endpoint": "/",
    "headers": {},
    "query_params": {},
    "data": null,
    ...
  }
}
```

#### **POST /api/generate-from-parsed**
Generate REST Assured code from parsed data

**Request:**
```json
{
  "parsed_data": { /* parsed cURL object */ },
  "config": {
    "option": "full",
    "className": "ApiTest",
    "methodName": "testApiRequest",
    "assertionRequired": true,
    "statusCode": "200",
    "loggingRequired": true,
    "needPojo": false,
    "pojoClassName": "RequestBody"
  }
}
```

**Response:**
```json
{
  "success": true,
  "generated_code": "import io.restassured...",
  "pojo_code": "public class RequestBody {...}",
  "error": null
}
```

---

## 🧩 Components Overview

### **CodeGenerationDialog**
- Multi-step dialog for code generation
- Configuration management
- Code preview and export
- Tab-based output view

### **CurlPlayground**
- cURL input textarea
- Parse button with loading state
- Error display
- Auto-navigation to editor

### **ParsedCurlEditor**
- Main editing interface
- Section-based data organization
- Inline field editing
- Bulk operations
- Code generation trigger

### **useParsedCurlEditor Hook**
- State management for editor
- CRUD operations on parsed data
- Section visibility logic
- Code generation logic
- Export/reset functionality

### **useCurlParser Hook**
- cURL parsing orchestration
- Error handling
- Data normalization
- Filter state management

---

## 🎨 Customization

### Theme Customization

Edit `src/index.css` to modify theme colors:

```css
:root {
  --primary: 220 90% 56%;        /* Primary brand color */
  --secondary: 210 14% 89%;      /* Secondary color */
  --accent: 210 40% 96.1%;       /* Accent color */
  /* ... more variables */
}
```

### Component Styling

All components use Tailwind CSS classes. Modify classes directly in components or extend in `tailwind.config.js`.

### API Configuration

Set `VITE_CURL_CRAFT_API_URL` (see [Environment Variables](#environment-variables)); there is no URL constant to edit in source.

---

## 🤝 Contributing

### Development Workflow

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

### Code Standards

- Use TypeScript for type safety
- Follow existing component patterns
- Use Tailwind CSS for styling
- Keep components focused and reusable
- Add proper error handling
- Document complex logic

---

## 📄 License

[Add your license here]

---

## 🐛 Known Issues

- Large nested objects may impact performance
- Browser localStorage not used (by design for Claude.ai compatibility)
- Direct URL access to /editor requires state from /playground

---

## 🔮 Roadmap

- [ ] Add undo/redo functionality
- [ ] Request history management
- [ ] Multiple code template support (TestNG, JUnit, etc.)
- [ ] Export as Postman collection
- [ ] Import from Postman/Swagger
- [ ] Batch cURL processing
- [ ] Request execution and testing
- [ ] Response mocking
- [ ] API documentation generation

---

## 📞 Support

For issues, questions, or contributions, please [open an issue](link-to-issues) or contact the maintainers.

---

**Built with ❤️ using Claude, React, TypeScript, and shadcn/ui**