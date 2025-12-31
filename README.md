YES

---

# ðŸš€ CurlCraft Assured - cURL to REST Assured Code Generator

[![React](https://img.shields.io/badge/React-18.x-61dafb?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff?style=flat-square&logo=vite)](https://vitejs.dev/)

> **Transform cURL commands into production-ready REST Assured+TestNG test code with an intelligent visual editor and automatic POJO generation.**

[🎮 Live Demo](#) | [📖 Documentation](#) | [🐛 Report Bug](#) | [✨ Request Feature](#)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Architecture](#-architecture)
- [Usage Guide](#-usage-guide)
- [API Documentation](#-api-documentation)
- [Configuration](#-configuration)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

---

## 🎯 Overview

**CurlCraft Assured** is a sophisticated web application that bridges the gap between API exploration and automated testing. It parses cURL commands (from Chrome DevTools, Postman, or any source), provides a visual editor for modification, and generates production-ready REST Assured test code with TestNG annotations.

### Why CurlCraft Assured?

- ⚡ **Save Time**: Convert cURL to test code in seconds
- 🎨 **Visual Editing**: No manual JSON manipulation required
- 🏗️ **Production Ready**: Generated code follows best practices
- 🔄 **Full Control**: Edit every aspect of your request visually
- 📦 **Complete Package**: Get test code + POJOs + Maven dependencies

---

## ✨ Features

### 🎯 Core Capabilities

#### **1. Intelligent cURL Parsing**
- ✅ Parse any cURL command from any source
- ✅ Support for **all HTTP methods** (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- ✅ Comprehensive extraction:
  - Request URL (automatic base URL + endpoint separation)
  - HTTP headers (with case-insensitive handling)
  - Query parameters (URL-encoded and plain)
  - Request body (JSON, XML, form-data, raw text)
  - Authentication (Bearer, Basic, custom headers)
  - Cookies (name-value pairs)
  - Path parameters (template detection)
  - Network configurations (timeouts, retries, redirects)
  - SSL/TLS settings (certificates, versions)
  - cURL flags (--insecure, --verbose, --compressed, etc.)

#### **2. Advanced Visual Editor**

##### **Accordion-Based Interface**
- 📂 **Request Details**: Method, URL, base URL, endpoint
- 📋 **Headers**: Key-value pairs with inline editing
- 🔍 **Query Parameters**: URL parameters management
- 📦 **Request Body**: Hierarchical JSON/XML viewer with expand/collapse
- 🍪 **Cookies**: Cookie management
- 🔐 **Authentication**: Auth header configuration
- 📝 **Form Data**: Multipart form handling
- ⚙️ **Network Config**: Timeouts, retries, max redirects
- 🔒 **SSL/TLS Config**: Certificate paths, SSL versions
- 🚩 **Flags**: Active cURL flags display
- 🛣️ **Path Parameters**: Dynamic path segments
- 🌐 **Client Context**: User-Agent, Referer, Proxy

##### **Editing Features**
- ✏️ **Inline Editing**: Click any field to edit
- ✨ **Syntax Highlighting**: Type-based color coding
- 🎨 **Visual Feedback**: Hover effects, focus states
- 🔒 **Protected Fields**: Required fields (method, URL) cannot be deleted
- 📊 **Count Badges**: See entry counts at a glance
- 🎯 **Smart Defaults**: Auto-expand sections with data

#### **3. Powerful Request Body Editor**

- 🌳 **Hierarchical View**: Nested objects and arrays
- ⬆️⬇️ **Expand/Collapse**: Individual nodes or all at once
- 📍 **Path Visualization**: Clear nested path display (`data.user.address.city`)
- 🎨 **Type Indicators**:
  - 🟢 Strings (green)
  - 🔵 Numbers (blue)
  - 🟣 Booleans (purple)
  - 📦 Objects (with key count)
  - 📚 Arrays (with item count)
- ✏️ **Inline Value Editing**: Edit primitives directly
- 🔍 **Deep Nesting Support**: Handle complex payloads

#### **4. Comprehensive Section Management**

- ➕ **Add Missing Sections**: Dynamically add any valid cURL section
- 🗑️ **Delete Sections**: Remove entire sections (with confirmation)
- ➕ **Add Entries**: Add headers, params, cookies, flags
- ❌ **Delete Entries**: Remove individual fields
- ☑️ **Bulk Selection**: Select multiple entries for batch deletion
- 🔄 **Reset to Original**: Revert all changes
- 💾 **Export JSON**: Download edited data

#### **5. Advanced Code Generation**

##### **Step 1: Choose Generation Type**
```
┌─────────────────────────────────────────┐
│ 🎯Full Test Class                       │
│ • Complete Java class                   │
│ • All imports included                  │
│ • @BeforeClass setup                    │
│ • @Test annotations                     │
│ • Ready to run (~70-100 lines)          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🎯Test Method Only                      │
│ • Just the @Test method                 │
│ • Minimal imports                       │
│ • Quick integration (~30-50 lines)      │
└─────────────────────────────────────────┘
```

##### **Step 2: Configure Generation**

**Basic Configuration**:
- 📝 API Service Name (class name)
- 🔤 Method Name
- ✅ Include Assertions (validate status code)
- 📊 Expected Status Code (200, 201, 404, etc.)
- 📋 Include Logging (request/response details)
- 📦 Generate POJOs (automatic from request body)
- ⏱️ Assert Response Time (performance validation)
- ⏲️ Max Response Time (milliseconds)

**POM.xml Generation**:
- 📦 Full POM (complete Maven project file)
- 📋 Dependencies Only (just the `<dependencies>` block)
- 🔧 Auto-detect Data Format:
  - JSON (Jackson Databind)
  - XML (Jackson XML + JAXB for Java 11+)
  - Both (all dependencies)
- ☕ Java Version Selection (8, 11, 17, 21)
- 📚 Optional Dependencies:
  - JUnit Jupiter
  - Allure Reports
  - Extent Reports
  - Apache POI (Excel)
  - JavaFaker
  - Logback
  - Commons IO

**Project Information** (for full POM):
- 🏢 Group ID (`com.example`)
- 📦 Artifact ID (`rest-assured-tests`)
- 🔢 Version (`1.0-SNAPSHOT`)
- 📝 Name & Description

##### **Step 3: Preview & Download**

**Tabbed Interface**:
```
┌─────────────────────────────────────────┐
│ [Test Code] [POJO Classes] [POM.xml]    │
├─────────────────────────────────────────┤
│                                         │
│  import io.restassured.RestAssured;     │
│  import org.testng.annotations.*;       │
│                                         │
│  public class ServiceName {             │
│      @BeforeClass                       │
│      public void setup() { ... }        │
│                                         │
│      @Test                              │
│      public void apiNameTest() { ... }  │
│  }                                      │
│                                         │
└─────────────────────────────────────────┘
```

**Actions**:
- 📋 Copy to Clipboard
- ⬇️ Download Individual Files
- 📦 Download All Files (bulk export)
- 🔍 Syntax-Highlighted Preview

##### **POJO Generation Features**

- 🤖 **Automatic Detection**: Analyzes request body structure
- 🏗️ **Nested Classes**: Supports deep object hierarchies
- 📦 **Lombok Integration**: `@Data` and `@Builder` annotations
- 🎯 **Smart Naming**: Converts JSON keys to Java naming conventions
- 📝 **Type Inference**: Detects String, Integer, Boolean, nested objects
- 🔄 **Array Handling**: Generates `List<T>` for arrays
- 🎨 **Custom Class Names**: Override default naming
- 🚫 **Disabled for GET/DELETE/HEAD**: POJOs only for requests with body

**Example POJO Output**:
```java
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ServiceName_Model {
    private String name;
    private String email;
    private Integer age;
    private Address address;
    
    @Data
    @Builder
    public static class Address {
        private String city;
        private String state;
    }
}
```

#### **6. Backend Status Management**

- 🔄 **Auto-Retry System**: Configurable warmup attempts (default: 3)
- ⏱️ **Wait Time Tracking**: Visual countdown timer
- 📊 **Progress Indicators**: Real-time warmup progress
- 🚦 **Status Display**:
  - ✅ Ready (green)
  - ⚠️ Warning/Warming (orange)
  - ❌ Down (red)
- 🔒 **Smart Blocking**: Playground locked until backend ready
- 📱 **Responsive Alerts**: User-friendly status messages

#### **7. Theme System**

- 🌙 **Dark Mode**: OLED-friendly dark theme
- ☀️ **Light Mode**: Clean, professional light theme
- 🎨 **Cyan/Teal Color Scheme**: Modern, vibrant gradients
- 🔄 **Auto-Detection**: System preference support
- 🎭 **Smooth Transitions**: Seamless theme switching
- 💾 **Persistence**: Theme choice saved locally

#### **8. Undo/Redo System** ⭐ NEW

- ⏪ **Undo**: Revert recent changes (Ctrl/Cmd+Z)
- ⏩ **Redo**: Restore undone changes (Ctrl/Cmd+Y)
- 📚 **History Stack**: Last 5 operations tracked
- 🎯 **Smart Tracking**: Only tracks meaningful changes
- 🔘 **Visual Indicators**: Enabled/disabled button states
- ⌨️ **Keyboard Shortcuts**: Standard OS shortcuts

#### **9. Data Format Auto-Detection**

Intelligent detection based on:
- 📋 **Content-Type Header** (highest priority)
- 📄 **Request Body Content** (XML tags, JSON braces)
- 🎯 **Accept Header** (secondary indicator)
- 🔗 **URL Patterns** (`/api/`, `.json`, `.xml`)
- 🧠 **Context Clues** (SOAP, REST indicators)

**Supported Formats**:
- 📘 JSON (default for modern APIs)
- 📙 XML (SOAP, legacy APIs)
- 📗 Both (hybrid APIs)

#### **10. Enhanced User Experience**

##### **Loading States**
- 🔄 Parsing spinner
- ⏳ Generation progress
- 🎬 Smooth animations
- ⚡ Optimistic updates

##### **Error Handling**
- 🚨 Graceful error messages
- 🔍 Detailed error descriptions
- 🔄 Retry suggestions
- 📋 Error logging for debugging

##### **Visual Feedback**
- ✅ Success toasts
- ⚠️ Warning notifications
- ❌ Error alerts
- 📋 Copy confirmations
- 🎯 Hover states
- 💡 Tooltips

##### **Keyboard Shortcuts**
```
Ctrl/Cmd + Z     → Undo
Ctrl/Cmd + Y     → Redo
Ctrl/Cmd + S     → Save Changes
Ctrl/Cmd + G     → Generate Code
```

##### **Responsive Design**
- 📱 Mobile-friendly (320px+)
- 📲 Tablet-optimized (768px+)
- 💻 Desktop-first (1024px+)
- 🖥️ Wide-screen support (1920px+)

---

## 🛠 Tech Stack

### **Core Technologies**
```
React 18.2       → UI library with hooks
TypeScript 5.2   → Type-safe development
Vite 5.0         → Lightning-fast build tool
```

### **Styling & UI**
```
Tailwind CSS 3.4    → Utility-first CSS framework
shadcn/ui (Latest)  → High-quality React components
Radix UI            → Accessible component primitives
Framer Motion 10.16 → Fluid animations
Lucide React 0.294  → Beautiful icon library
```

### **State & Routing**
```
React Router 6.20   → Client-side routing
Custom Hooks        → Encapsulated business logic
Context API         → Global state (theme, backend status)
```

### **HTTP & Data**
```
Axios 1.6          → HTTP client
JSON Normalization → Consistent data shapes
Type Guards        → Runtime type validation
```

### **Development Tools**
```
ESLint 8.55             → Code linting
TypeScript Compiler     → Type checking
Autoprefixer 10.4       → CSS vendor prefixes
PostCSS 8.4             → CSS processing
```

### **UI Component Library**
```
@radix-ui/react-accordion  → Collapsible sections
@radix-ui/react-checkbox   → Checkboxes
@radix-ui/react-dialog     → Modal dialogs
@radix-ui/react-select     → Dropdown selects
@radix-ui/react-tabs       → Tab navigation
@radix-ui/react-slot       → Component composition
```

---

## 🚀 Getting Started

### Prerequisites

```bash
Node.js >= 18.0.0
npm >= 9.0.0
```

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Nataraaj-Shanmugam/cURL-to-Code-Convertor-FrontEnd.git
cd cURL-to-Code-Convertor-FrontEnd
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create `.env.development` for local development:
```env
VITE_CURL_CRAFT_API_URL=http://127.0.0.1:8000
VITE_CURL_CRAFT_API_PARSE_ENDPOINT=/api/parse
VITE_CURL_CRAFT_API_PARSE_AND_GENERATE_ENDPOINT=/api/parse-and-generate
VITE_CURL_CRAFT_API_GENERATE_FROM_PARSED_ENDPOINT=/api/generate-from-parsed
VITE_CURL_CRAFT_API_HEALTH_ENDPOINT=/health

# Backend warmup configuration
VITE_BE_WARMUP_WAIT_MINS=5
VITE_BE_WARMUP_MAX_RETRIES=3
```

Create `.env.production` for production:
```env
VITE_CURL_CRAFT_API_URL=https://your-api-domain.com
# ... same endpoints as above
```

4. **Start development server**
```bash
npm run dev
```

Application will open at `http://localhost:5173`

5. **Build for production**
```bash
npm run build
```

Output: `dist/` folder ready for deployment

6. **Preview production build**
```bash
npm run preview
```

### Additional Scripts

```bash
npm run lint          # Run ESLint
npm run lint:fix      # Fix linting issues
npm run type-check    # TypeScript type checking
npm run format        # Format code with Prettier
```

---

## 🏗 Architecture

### Project Structure

```
src/
├── components/
│   ├── features/
│   │   └── curl/
│   │       ├── CurlPlayground.tsx           # cURL input interface
│   │       ├── ParsedCurlEditor.tsx         # Main visual editor
│   │       ├── CodeGenerationDialog.tsx     # Code generation wizard
│   │       └── editor/
│   │           ├── EditorHeader.tsx         # Original cURL display
│   │           ├── EditorActionBar.tsx      # Toolbar with actions
│   │           ├── AddEntryDialog.tsx       # Add header/param dialog
│   │           ├── AddSectionDialog.tsx     # Add section dialog
│   │           ├── EditableField.tsx        # Inline editable field
│   │           ├── BodyField.tsx            # Request body editor
│   │           └── SectionRenderer.tsx      # Accordion section renderer
│   │
│   ├── layout/
│   │   ├── AppLayout.tsx                    # Main app wrapper
│   │   ├── NavBar.tsx                       # Top navigation
│   │   └── Footer.tsx                       # Footer with tech stack
│   │
│   └── ui/                                   # shadcn/ui components
│       ├── accordion.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── checkbox.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── select.tsx
│       ├── tabs.tsx
│       ├── textarea.tsx
│       └── theme-provider.tsx
│
├── contexts/
│   └── BackendStatusContext.tsx             # Backend health monitoring
│
├── lib/
│   ├── api/
│   │   ├── apiClient.ts                     # Axios instance with interceptors
│   │   └── curl.ts                          # cURL API service methods
│   │
│   ├── hooks/
│   │   ├── useCurlParser.ts                 # cURL parsing logic
│   │   ├── useParsedCurlEditor.ts           # Editor state management
│   │   └── useCodeGeneration.ts             # Code generation logic
│   │
│   └── utils/
│       ├── curl.ts                          # cURL data utilities
│       ├── dataFormatDetector.ts            # Format auto-detection
│       └── utils.ts                         # General utilities (cn)
│
├── pages/
│   ├── Home.tsx                              # Landing page
│   ├── Playground.tsx                        # cURL input page
│   └── EditorPage.tsx                        # Visual editor page
│
├── types/
│   └── curl.ts                               # TypeScript type definitions
│
├── App.tsx                                   # Root component with routing
├── main.tsx                                  # Application entry point
└── index.css                                 # Global styles & Tailwind
```

### Data Flow

```
┌─────────────────┐
│  User pastes    │
│  cURL command   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  useCurlParser  │  ──► Parse cURL
│  hook           │      ├─ Axios POST /api/parse
└────────┬────────┘      ├─ Error handling
         │               └─ Data normalization
         ▼
┌─────────────────┐
│  Navigate to    │
│  EditorPage     │
│  with state     │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│  ParsedCurlEditor        │
│  ┌────────────────────┐  │
│  │ useParsedCurlEditor│  │  ──► Manage editor state
│  │ hook               │  │      ├─ Undo/redo history
│  └────────────────────┘  │      ├─ CRUD operations
│                          │      ├─ Section visibility
└──────────┬───────────────┘      └─ Export/reset
           │
           ▼
┌──────────────────────────┐
│  User edits data         │
│  ├─ Inline editing       │
│  ├─ Add/delete sections  │
│  └─ Bulk operations      │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  Click "Generate Code"   │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  CodeGenerationDialog    │
│  ┌────────────────────┐  │
│  │ useCodeGeneration  │  │  ──► Generate code
│  │ hook               │  │      ├─ Configuration
│  └────────────────────┘  │      ├─ API call
│                          │      └─ Preview/download
└──────────────────────────┘
```

### State Management Pattern

```typescript
// Editor state (useParsedCurlEditor)
{
  parsed: ParsedCurl,              // Current edited data
  history: HistoryEntry[],         // Undo/redo stack
  historyIndex: number,            // Current position
  selected: Set<string>,           // Selected fields
  editing: Record<string, boolean>, // Editing mode per field
  editedValues: Record<string, any>, // Temporary values
  openSections: string[],          // Expanded accordions
  bodyCollapsed: Record<string, boolean> // Body tree state
}
```

---

## 📖 Usage Guide

### Quick Start (3 Steps)

#### **Step 1: Parse cURL**

1. Navigate to **Playground** (`/playground`)
2. Paste your cURL command (get it from Chrome DevTools, Postman, etc.)
3. Click **"Parse & Edit"**

**Example cURL**:
```bash
curl -X POST "https://api.example.com/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token123" \
  -d '{"name":"John Doe","email":"john@example.com","age":30}'
```

#### **Step 2: Edit (Optional)**

Automatically navigated to Editor:
- ✏️ Click any field to edit
- ➕ Add new headers/params
- 🗑️ Delete unwanted fields
- 🌳 Expand/collapse body tree
- ⏪ Undo/redo changes

#### **Step 3: Generate Code**

1. Click **"Generate Code"** button
2. Choose **Full Test Class** or **Test Method Only**
3. Configure:
   - Class name: `UserApiTest`
   - Method name: `testCreateUser`
   - Enable assertions (status 200)
   - Generate POJOs: ✅
4. Click **"Generate Code"**
5. Preview in tabs, then **Copy** or **Download**

---

### Advanced Features

#### **Using Templates** 🎯

Playground offers 6 pre-built templates:
- GET with Headers
- POST with JSON
- PUT with XML
- Nested JSON body (for POJO testing)
- Form Data Upload
- Query Parameters

Click **"Show Templates"** to use them.

#### **Bulk Operations** ☑️

1. Select multiple checkboxes
2. Click **"Delete (N)"** in toolbar
3. Confirm bulk deletion

#### **Exporting Data** 💾

- **Export JSON**: Download edited cURL data as JSON
- **Download Code**: Save individual `.java` files
- **Download All**: Bulk export all generated files

#### **Keyboard Productivity** ⌨️

- `Ctrl/Cmd + Z` → Undo last change
- `Ctrl/Cmd + Y` → Redo undone change
- `Ctrl/Cmd + S` → Save changes (if callback provided)
- `Ctrl/Cmd + G` → Open code generation dialog

#### **Dark Mode Toggle** 🌙

Click theme icon in navigation bar (auto-detects system preference).

---

## 🔌 API Documentation

### Backend Endpoints Required

#### **1. Health Check**
```http
GET /health
```
**Response:**
```json
{
  "status": "ok"
}
```
*Returns 200 when backend is ready*

---

#### **2. Parse cURL**
```http
POST /api/parse
Content-Type: application/json
```

**Request Body:**
```json
{
  "curl": "curl -X GET https://api.example.com/users"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "method": "GET",
    "url": "https://api.example.com/users",
    "base_url": "https://api.example.com",
    "endpoint": "/users",
    "headers": {},
    "query_params": {},
    "data": null,
    "cookies": {},
    "auth": null,
    "flags": {},
    "network_config": {
      "timeout": null,
      "connect_timeout": null,
      "max_time": null
    },
    "ssl_config": {
      "cert": null,
      "key": null
    },
    "meta": {
      "timestamp": "2025-01-01T12:00:00Z"
    }
  },
  "meta": {
    "timestamp": "2025-01-01T12:00:00Z",
    "request_id": "abc123"
  }
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "error": {
    "code": "PARSE_ERROR",
    "message": "Invalid cURL command",
    "details": ["Unexpected token at position 5"]
  },
  "meta": {
    "timestamp": "2025-01-01T12:00:00Z",
    "request_id": "abc123"
  }
}
```

---

#### **3. Generate Code from Parsed Data**
```http
POST /api/generate-from-parsed
Content-Type: application/json
```

**Request Body:**
```json
{
  "parsed_data": {
    "method": "POST",
    "url": "https://api.example.com/users",
    "headers": {
      "Content-Type": "application/json"
    },
    "data": {
      "name": "John",
      "email": "john@example.com"
    }
  },
  "config": {
    "option": "full",
    "serviceName": "UserApiTest",
    "methodName": "testCreateUser",
    "assertionRequired": true,
    "statusCode": "200",
    "loggingRequired": true,
    "needPojo": true,
    "useFluentApi": true,
    "includeRetry": false,
    "testGroups": ["smoke"],
    "testPriority": 1,
    "testDescription": "Test user creation",
    "assertResponseTime": true,
    "maxResponseTimeMs": 2000,
    "generatePom": true,
    "dataFormat": "json",
    "pomConfig": {
      "pomType": "full",
      "projectInfo": {
        "groupId": "com.example",
        "artifactId": "rest-assured-tests",
        "version": "1.0-SNAPSHOT",
        "name": "REST Assured Test Project",
        "description": "Automated REST API tests"
      },
      "includeJunit": false,
      "includeAllure": false,
      "includeExtent": false,
      "includeExcel": false,
      "includeFaker": false,
      "includeLogging": true,
      "includeCommonsIo": false,
      "javaVersion": "11"
    }
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "generated_code": "import io.restassured.RestAssured;\n...",
  "pojo_code": "import lombok.Data;\n@Data\npublic class UserApiTest_Model {...}",
  "pomXml": "<?xml version=\"1.0\"?>\n<project>...</project>",
  "language": "java-restassured",
  "meta": {
    "timestamp": "2025-01-01T12:00:00Z",
    "request_id": "xyz789"
  }
}
```

---

#### **4. Parse and Generate (One-Shot)**
```http
POST /api/parse-and-generate
Content-Type: application/json
```

**Request Body:**
```json
{
  "curl": "curl -X POST ...",
  "config": {
    // Same as /api/generate-from-parsed
  }
}
```

**Response:** Same as `/api/generate-from-parsed`

---

### Error Codes

| Code | Description |
|------|-------------|
| `PARSE_ERROR` | Invalid cURL syntax |
| `VALIDATION_ERROR` | Missing required fields |
| `GENERATION_ERROR` | Code generation failed |
| `NETWORK_ERROR` | Backend unreachable |

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_CURL_CRAFT_API_URL` | Backend API base URL | `http://127.0.0.1:8000` |
| `VITE_CURL_CRAFT_API_PARSE_ENDPOINT` | Parse endpoint path | `/api/parse` |
| `VITE_CURL_CRAFT_API_PARSE_AND_GENERATE_ENDPOINT` | One-shot endpoint | `/api/parse-and-generate` |
| `VITE_CURL_CRAFT_API_GENERATE_FROM_PARSED_ENDPOINT` | Generate endpoint | `/api/generate-from-parsed` |
| `VITE_CURL_CRAFT_API_HEALTH_ENDPOINT` | Health check endpoint | `/health` |
| `VITE_BE_WARMUP_WAIT_MINS` | Backend warmup wait time (minutes) | `5` |
| `VITE_BE_WARMUP_MAX_RETRIES` | Max warmup retry attempts | `3` |

### Customizing Theme

Edit `src/index.css`:

```css
:root {
  /* Primary colors (Cyan/Teal) */
  --primary: 180 66% 49%;        /* hsl(180, 66%, 49%) - Cyan */
  --primary-foreground: 0 0% 100%;
  
  /* To change to another color scheme: */
  /* Purple: 270 91% 65% */
  /* Blue: 217 91% 60% */
  /* Green: 142 76% 36% */
}
```

### Tailwind Configuration

Extend in `tailwind.config.ts`:

<!-- ```typescript
export default {
  theme: {
    extend: {
      colors: {
        // Add custom colors
        brand: {
          cyan: '#06b6d4',
          teal: '#14b8a6' -->