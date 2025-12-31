# 🚀 CurlCraft Assured - Frontend Documentation

[![React](https://img.shields.io/badge/React-18.x-61dafb?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff?style=flat-square&logo=vite)](https://vitejs.dev/)

> **Transform cURL commands into production-ready REST Assured+TestNG test code with an intelligent visual editor.**

[🎮 Live Demo](#) | [🐛 Report Bug](https://github.com/Nataraaj-Shanmugam/cURL-to-Code-Convertor-FrontEnd/issues) | [✨ Request Feature](https://github.com/Nataraaj-Shanmugam/cURL-to-Code-Convertor-FrontEnd/issues)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Usage Guide](#-usage-guide)
- [Configuration](#-configuration)
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
- Parse any cURL command from Chrome DevTools, Postman, or manual input
- Support for **all HTTP methods** (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Comprehensive extraction:
  - ✅ Request URL (automatic base URL + endpoint separation)
  - ✅ HTTP headers (case-insensitive handling)
  - ✅ Query parameters (URL-encoded and plain)
  - ✅ Request body (JSON, XML, form-data, raw text)
  - ✅ Authentication (Bearer, Basic, custom headers)
  - ✅ Cookies (name-value pairs)
  - ✅ Path parameters (template detection)
  - ✅ Network configurations (timeouts, retries, redirects)
  - ✅ SSL/TLS settings (certificates, versions)
  - ✅ cURL flags (--insecure, --verbose, --compressed, etc.)

#### **2. Advanced Visual Editor**

**Accordion-Based Interface**
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

**Editing Features**
- ✏️ **Inline Editing**: Click any field to edit directly
- ✨ **Syntax Highlighting**: Type-based color coding (strings in green, numbers in blue, booleans in purple)
- 🎨 **Visual Feedback**: Hover effects, focus states, smooth transitions
- 🔒 **Protected Fields**: Required fields (method, URL) cannot be deleted
- 📊 **Count Badges**: See entry counts at a glance
- 🎯 **Smart Defaults**: Auto-expand sections containing data

#### **3. Powerful Request Body Editor**

- 🌳 **Hierarchical View**: Navigate nested objects and arrays easily
- ⬆️⬇️ **Expand/Collapse**: Control individual nodes or all at once
- 📍 **Path Visualization**: Clear nested path display (`data.user.address.city`)
- 🎨 **Type Indicators**:
  - 🟢 Strings (green text)
  - 🔵 Numbers (blue text)
  - 🟣 Booleans (purple text)
  - 📦 Objects (with key count badge)
  - 📚 Arrays (with item count badge)
- ✏️ **Inline Value Editing**: Edit primitive values directly
- 🔍 **Deep Nesting Support**: Handle complex API payloads

#### **4. Section Management**

- ➕ **Add Missing Sections**: Dynamically add any valid cURL section
- 🗑️ **Delete Sections**: Remove entire sections (with confirmation)
- ➕ **Add Entries**: Add new headers, query params, cookies, flags
- ❌ **Delete Entries**: Remove individual fields with hover actions
- ☑️ **Bulk Selection**: Select multiple entries for batch deletion
- 🔄 **Reset to Original**: Revert all changes to initial parsed state
- 💾 **Export JSON**: Download edited data as JSON file

#### **5. Advanced Code Generation Wizard**

**Step 1: Choose Generation Type**
```
┌─────────────────────────────────────────┐
│ 📦 Full Test Class                      │
│ • Complete Java class                   │
│ • All imports included                  │
│ • @BeforeClass setup method             │
│ • @Test annotations                     │
│ • Ready to run (~70-100 lines)          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🎯 Test Method Only                     │
│ • Just the @Test method                 │
│ • Minimal imports                       │
│ • Quick integration (~30-50 lines)      │
│ • Easy to add to existing test classes  │
└─────────────────────────────────────────┘
```

**Step 2: Basic Configuration**

- 📝 **API Service Name**: Custom class name (e.g., `UserApiTest`)
- 🔤 **Method Name**: Custom test method name (e.g., `testCreateUser`)
- ✅ **Include Assertions**: Validate response status code
- 📊 **Expected Status Code**: 200, 201, 404, etc.
- 📋 **Include Logging**: Add request/response logging
- 📦 **Generate POJOs**: Automatic POJO creation from request body
  - 🚫 Automatically disabled for GET/DELETE/HEAD methods
  - 🤖 Creates Lombok-based classes with `@Data` and `@Builder`
  - 🏗️ Supports nested objects and arrays
- ⏱️ **Assert Response Time**: Performance validation
- ⏲️ **Max Response Time**: Time limit in milliseconds

**Step 3: POM Configuration (Full Test Class Only)**

- 📦 **POM Type**:
  - Full POM: Complete Maven project file
  - Dependencies Only: Just the `<dependencies>` block
- 🔍 **Auto-detect Data Format**:
  - Analyzes Content-Type headers
  - Inspects request body content
  - Detects JSON/XML/Both
  - Includes appropriate Jackson dependencies
- ☕ **Java Version**: 8, 11, 17, or 21
- 📚 **Optional Dependencies**:
  - JUnit Jupiter
  - Allure Reports
  - Extent Reports
  - Apache POI (Excel)
  - JavaFaker
  - Logback Logging
  - Commons IO
- 🏢 **Project Information** (for full POM):
  - Group ID
  - Artifact ID
  - Version
  - Project Name & Description

**Step 4: Preview & Download**

- 📑 **Tabbed Interface**:
  - `Test Code`: Generated REST Assured test
  - `POJO Classes`: Generated data models (when enabled)
  - `POM.xml`: Maven dependencies
- 📋 **Copy to Clipboard**: One-click copy
- ⬇️ **Download Individual Files**: `.java` or `.xml`
- 📦 **Download All Files**: Bulk export with staggered downloads

**POJO Generation Features**
```java
// Example generated POJO
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserApiTest_Model {
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

- 🤖 **Automatic Detection**: Analyzes request body structure
- 🏗️ **Nested Classes**: Supports deep object hierarchies
- 📦 **Lombok Integration**: `@Data` and `@Builder` annotations
- 🎯 **Smart Naming**: Converts JSON keys to Java conventions
- 📝 **Type Inference**: String, Integer, Boolean, nested objects
- 🔄 **Array Handling**: Generates `List<T>` for arrays

#### **6. Backend Status Management**

- 🔄 **Auto-Retry System**: Configurable warmup attempts (env: `VITE_BE_WARMUP_MAX_RETRIES`)
- ⏱️ **Wait Time Tracking**: Visual countdown timer (env: `VITE_BE_WARMUP_WAIT_MINS`)
- 📊 **Progress Indicators**: Real-time warmup progress with animated bar
- 🚦 **Status Display**:
  - ✅ **Ready** (green): Backend is up, playground unlocked
  - ⚠️ **Warning/Warming** (orange): Backend warming up, auto-retrying
  - ❌ **Down** (red): Backend offline after max retries
- 🔒 **Smart Blocking**: Playground locked until backend ready
- 📱 **Responsive Alerts**: User-friendly status messages with attempt counter
- 🔁 **Health Check Polling**: Every 30 seconds

#### **7. Undo/Redo System** ⭐

- ⏪ **Undo**: Revert recent changes (`Ctrl/Cmd+Z`)
- ⏩ **Redo**: Restore undone changes (`Ctrl/Cmd+Y`)
- 📚 **History Stack**: Last 5 operations tracked
- 🎯 **Smart Tracking**: Only tracks meaningful state changes
- 🔘 **Visual Indicators**: Buttons show enabled/disabled state
- ⌨️ **Keyboard Shortcuts**: Standard OS conventions

#### **8. Data Format Auto-Detection**

Intelligent detection algorithm:

1. **Content-Type Header** (highest priority)
   - `application/json` → JSON
   - `application/xml`, `text/xml` → XML
   - Both present → Both

2. **Request Body Content**
   - Starts with `{` or `[` → JSON
   - Starts with `<?xml` or `<` → XML

3. **Accept Header** (secondary indicator)

4. **URL Patterns** (context clues)
   - `/api/`, `.json` → JSON
   - `.xml`, `/soap` → XML

**Supported Formats**:
- 📘 **JSON**: Includes Jackson Databind
- 📙 **XML**: Includes Jackson XML + JAXB (auto-added for Java 11+)
- 📗 **Both**: All dependencies included

#### **9. Theme System**

- 🌙 **Dark Mode**: OLED-friendly dark theme
- ☀️ **Light Mode**: Clean, professional light theme
- 🎨 **Cyan/Teal Color Scheme**: Modern, vibrant gradients (no purple!)
- 🔄 **Auto-Detection**: Respects system preference
- 🎭 **Smooth Transitions**: Seamless theme switching (300ms cubic-bezier)
- 💾 **Persistence**: Theme choice saved to localStorage

#### **10. Enhanced User Experience**

**Loading States**
- 🔄 Parsing spinner with animation
- ⏳ Code generation progress indicator
- 🎬 Smooth enter/exit animations
- ⚡ Optimistic UI updates

**Error Handling**
- 🚨 Graceful error messages in alert dialogs
- 🔍 Detailed error descriptions from backend
- 🔄 Helpful retry suggestions
- 📋 Console error logging for debugging

**Visual Feedback**
- ✅ Success confirmations (copy, download)
- ⚠️ Warning notifications
- ❌ Error alerts
- 📋 Copy confirmation (2-second toast)
- 🎯 Hover states on all interactive elements
- 💡 Contextual tooltips

**Keyboard Shortcuts**
```
Ctrl/Cmd + Z     → Undo
Ctrl/Cmd + Y     → Redo
Ctrl/Cmd + S     → Save Changes (if callback provided)
Ctrl/Cmd + G     → Open Code Generation Dialog
```

**Responsive Design**
- 📱 Mobile-friendly (320px+)
- 📲 Tablet-optimized (768px+)
- 💻 Desktop-first (1024px+)
- 🖥️ Wide-screen support (1920px+)

**Quick Start Templates**
- 📚 6 pre-built cURL templates
- 🎯 GET with Headers
- 📝 POST with JSON
- ✏️ PUT with XML
- 🌳 Nested JSON (POJO testing)
- 📤 Form Data Upload
- 🔗 Query Parameters

---

## 🛠 Tech Stack

### **Core Technologies**

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2 | UI library with hooks |
| TypeScript | 5.2 | Type-safe development |
| Vite | 5.0 | Lightning-fast build tool & dev server |

### **Styling & UI**

| Library | Version | Purpose |
|---------|---------|---------|
| Tailwind CSS | 3.4 | Utility-first CSS framework |
| shadcn/ui | Latest | High-quality React components |
| Radix UI | Latest | Accessible component primitives |
| Framer Motion | 10.16 | Fluid animations |
| Lucide React | 0.294 | Beautiful icon library |

### **State & Routing**

| Library | Version | Purpose |
|---------|---------|---------|
| React Router | 6.20 | Client-side routing |
| Custom Hooks | - | Encapsulated business logic |
| Context API | - | Global state (theme, backend status) |

### **HTTP & Data**

| Library | Version | Purpose |
|---------|---------|---------|
| Axios | 1.6 | HTTP client with interceptors |

### **Development Tools**

| Tool | Version | Purpose |
|------|---------|---------|
| ESLint | 8.55 | Code linting |
| TypeScript Compiler | 5.2 | Type checking |
| Autoprefixer | 10.4 | CSS vendor prefixes |
| PostCSS | 8.4 | CSS processing |

### **UI Component Library (Radix UI)**
```typescript
@radix-ui/react-accordion    // Collapsible sections
@radix-ui/react-checkbox     // Checkboxes
@radix-ui/react-dialog       // Modal dialogs
@radix-ui/react-select       // Dropdown selects
@radix-ui/react-tabs         // Tab navigation
@radix-ui/react-slot         // Component composition
```

---

## 🚀 Getting Started

### Prerequisites
```bash
Node.js >= 18.0.0
npm >= 9.0.0
```

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/Nataraaj-Shanmugam/cURL-to-Code-Convertor-FrontEnd.git
cd cURL-to-Code-Convertor-FrontEnd
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure environment variables**

Create `.env.development`:
```env
# Backend API Configuration
VITE_CURL_CRAFT_API_URL=http://127.0.0.1:8000
VITE_CURL_CRAFT_API_PARSE_ENDPOINT=/api/parse
VITE_CURL_CRAFT_API_PARSE_AND_GENERATE_ENDPOINT=/api/parse-and-generate
VITE_CURL_CRAFT_API_GENERATE_FROM_PARSED_ENDPOINT=/api/generate-from-parsed
VITE_CURL_CRAFT_API_HEALTH_ENDPOINT=/health

# Backend warmup configuration
VITE_BE_WARMUP_WAIT_MINS=5
VITE_BE_WARMUP_MAX_RETRIES=3
```

Create `.env.production`:
```env
VITE_CURL_CRAFT_API_URL=https://your-production-api.com
# ... same endpoints as above
VITE_BE_WARMUP_WAIT_MINS=5
VITE_BE_WARMUP_MAX_RETRIES=3
```

**4. Start development server**
```bash
npm run dev
```

Application opens at `http://localhost:5173`

**5. Build for production**
```bash
npm run build
```

Output: `dist/` folder ready for deployment

**6. Preview production build**
```bash
npm run preview
```

### Available Scripts
```bash
npm run dev          # Start development server (uses .env.development)
npm run dev:prod     # Start dev server with production env
npm run preprod      # Build for pre-production
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues automatically
npm run type-check   # TypeScript type checking only (no build)
npm run format       # Format code with Prettier
```

---

## 🏗 Project Structure
```
src/
├── components/
│   ├── features/
│   │   └── curl/
│   │       ├── CurlPlayground.tsx              # cURL input & templates
│   │       ├── ParsedCurlEditor.tsx            # Main visual editor
│   │       ├── CodeGenerationDialog.tsx        # 3-step code wizard
│   │       └── editor/
│   │           ├── EditorHeader.tsx            # Original cURL display
│   │           ├── EditorActionBar.tsx         # Toolbar (undo/redo/export)
│   │           ├── AddEntryDialog.tsx          # Add header/param modal
│   │           ├── AddSectionDialog.tsx        # Add section modal
│   │           ├── EditableField.tsx           # Inline editable field
│   │           ├── BodyField.tsx               # Nested body tree editor
│   │           └── SectionRenderer.tsx         # Accordion section logic
│   │
│   ├── layout/
│   │   ├── AppLayout.tsx                       # App wrapper (navbar + footer)
│   │   ├── NavBar.tsx                          # Top navigation with theme toggle
│   │   └── Footer.tsx                          # Footer with tech stack badges
│   │
│   └── ui/                                      # shadcn/ui components
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
│   └── BackendStatusContext.tsx                # Backend health monitoring
│
├── lib/
│   ├── api/
│   │   ├── apiClient.ts                        # Axios instance with interceptors
│   │   └── curl.ts                             # cURL API service methods
│   │
│   ├── hooks/
│   │   ├── useCurlParser.ts                    # Parsing logic & state
│   │   ├── useParsedCurlEditor.ts              # Editor state (undo/redo)
│   │   └── useCodeGeneration.ts                # Code generation logic
│   │
│   └── utils/
│       ├── curl.ts                             # Data normalization utilities
│       ├── dataFormatDetector.ts               # JSON/XML auto-detection
│       └── utils.ts                            # General utilities (cn helper)
│
├── pages/
│   ├── Home.tsx                                 # Landing page with features
│   ├── Playground.tsx                           # cURL input page
│   └── EditorPage.tsx                           # Visual editor page
│
├── types/
│   └── curl.ts                                  # TypeScript interfaces
│
├── App.tsx                                      # Root component with routes
├── main.tsx                                     # Application entry point
└── index.css                                    # Global styles + Tailwind
```

---

## 📖 Usage Guide

### Quick Start (3 Steps)

#### **Step 1: Parse cURL**

1. Navigate to **Home** → Click **"Get Started"**
2. Or go directly to **Playground** (`/playground`)
3. Paste your cURL command
4. Click **"Parse & Edit"**

**Example cURL:**
```bash
curl -X POST "https://api.example.com/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token123" \
  -d '{"name":"John Doe","email":"john@example.com","age":30}'
```

**Get cURL from:**
- Chrome DevTools: `Network tab` → Right-click request → `Copy as cURL (bash)`
- Postman: Request → `Code` → `cURL`
- Manual construction

#### **Step 2: Edit Parsed Data (Optional)**

Auto-navigates to `/editor`:

- ✏️ **Click field to edit**: Change any value inline
- ➕ **Add entries**: Click "Add Entry" in any section
- 🗑️ **Delete fields**: Hover → Click trash icon
- 🌳 **Navigate body**: Expand/collapse nested objects
- ⏪ **Undo/Redo**: `Ctrl+Z` / `Ctrl+Y`
- 💾 **Export**: Download as JSON

#### **Step 3: Generate Code**

1. Click **"Generate Code"** button
2. **Choose type**: Full Test Class or Method Only
3. **Basic config**:
   - Service Name: `UserApiTest`
   - Method Name: `testCreateUser`
   - Enable assertions: ✅ (status 200)
   - Generate POJOs: ✅
4. **POM config** (if Full Test Class):
   - POM Type: Full POM
   - Data Format: Auto-detected (JSON)
   - Java Version: 11
5. Click **"Generate Code"**
6. **Preview** in tabs → **Copy** or **Download**

---

### Advanced Features

#### **Using Templates**

1. Click **"Show Templates"** in Playground
2. Select from 6 pre-built templates:
   - GET with Headers
   - POST with JSON
   - PUT with XML
   - Nested JSON (for POJO testing)
   - Form Data Upload
   - Query Parameters
3. Template auto-fills textarea
4. Click **"Parse & Edit"**

#### **Bulk Operations**

1. In Editor, check multiple field checkboxes
2. Toolbar shows count: `Delete (N)`
3. Click **"Delete (N)"**
4. Confirm bulk deletion

#### **Keyboard Shortcuts**

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo last change |
| `Ctrl/Cmd + Y` | Redo undone change |
| `Ctrl/Cmd + S` | Save changes (if callback provided) |
| `Ctrl/Cmd + G` | Open code generation dialog |

#### **Exporting Data**

- **Export JSON**: Toolbar → "Export JSON" → Downloads timestamped file
- **Download Code**: After generation → "Download" button per tab
- **Download All**: After generation → "Download All" (bulk export)

#### **Dark Mode**

- Click moon/sun icon in navbar
- Auto-detects system preference on first load
- Preference saved to localStorage

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_CURL_CRAFT_API_URL` | Backend API base URL | `http://127.0.0.1:8000` | ✅ |
| `VITE_CURL_CRAFT_API_PARSE_ENDPOINT` | Parse endpoint path | `/api/parse` | ✅ |
| `VITE_CURL_CRAFT_API_PARSE_AND_GENERATE_ENDPOINT` | One-shot parse+generate | `/api/parse-and-generate` | ✅ |
| `VITE_CURL_CRAFT_API_GENERATE_FROM_PARSED_ENDPOINT` | Generate from parsed data | `/api/generate-from-parsed` | ✅ |
| `VITE_CURL_CRAFT_API_HEALTH_ENDPOINT` | Health check endpoint | `/health` | ✅ |
| `VITE_BE_WARMUP_WAIT_MINS` | Backend warmup wait (minutes) | `5` | ❌ |
| `VITE_BE_WARMUP_MAX_RETRIES` | Max warmup retry attempts | `3` | ❌ |

### Customizing Theme

**Colors**

Edit `src/index.css`:
```css
:root {
  /* Primary cyan/teal */
  --primary: 180 66% 49%;
  --primary-foreground: 0 0% 100%;
  
  /* Background */
  --background: 0 0% 100%;
  --foreground: 222.2 47.4% 11.2%;
}

.dark {
  --primary: 180 71% 60%;        /* Lighter in dark mode */
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
}
```

**Animations**

Already included in `index.css`:
- `animate-float`
- `animate-pulse-glow`
- `animate-shimmer`
- `animate-slide-in-top`
- `animate-slide-in-bottom`
- `animate-fade-in`
- `animate-scale-in`

**Custom Utilities**

Available classes:
- `.glass` - Glass morphism effect
- `.glass-strong` - Stronger glass effect
- `.gradient-text` - Cyan/teal gradient text
- `.gradient-bg-hover` - Hover gradient background
- `.shadow-elevated` - Elevated shadow with hover lift

---

## 🤝 Contributing

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch:
```bash
   git checkout -b feature/amazing-feature
```
3. **Commit** changes:
```bash
   git commit -m 'feat: Add amazing feature'
```
4. **Push** to branch:
```bash
   git push origin feature/amazing-feature
```
5. **Open** a Pull Request

### Code Standards

#### **TypeScript**
- ✅ All new code must be typed
- ✅ Avoid `any` types (use `unknown` if needed)
- ✅ Export types from `src/types/curl.ts`

#### **Component Structure**
```typescript
// Good: Functional component with TypeScript
interface MyComponentProps {
  title: string;
  onSave: () => void;
}

export default function MyComponent({ title, onSave }: MyComponentProps) {
  // Implementation
}
```

#### **Styling**
- ✅ Use Tailwind utility classes
- ✅ Follow existing component patterns
- ✅ Use `cn()` helper for conditional classes:
```typescript
  className={cn(
    "base-classes",
    condition && "conditional-classes"
  )}
```

#### **Naming Conventions**
- **Files**: `PascalCase.tsx` for components, `camelCase.ts` for utilities
- **Components**: `PascalCase`
- **Hooks**: `useCamelCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`

#### **Error Handling**
```typescript
// Good: Try-catch with user-friendly message
try {
  const result = await apiCall();
} catch (error: any) {
  console.error('Detailed error:', error);
  alert('User-friendly message');
}
```

### Commit Message Convention
```
feat: Add new feature
fix: Bug fix
docs: Documentation update
style: Code formatting (no logic change)
refactor: Code restructuring
test: Adding tests
chore: Maintenance (dependencies, config)
```

**Examples:**
```
feat: Add undo/redo functionality to editor
fix: Prevent POJO generation for GET requests
docs: Update README with new features
refactor: Extract body editor to separate component
```

---

## 🐛 Known Issues

1. **Large Nested Objects**: Deep nesting (10+ levels) may impact UI performance
2. **Direct Editor Access**: Navigating directly to `/editor` without state from `/playground` redirects to home
3. **Backend Warmup**: Cold start can take 2-5 minutes (configurable retry system in place)
4. **No localStorage for Data**: By design (Claude.ai compatibility) - all edits lost on refresh

---

## 🗺️ Roadmap

- [ ] Request history management (save parsed cURLs)
- [ ] Multiple code templates (JUnit 5, Cucumber, Karate)
- [ ] Import from Postman collections
- [ ] Import from Swagger/OpenAPI specs
- [ ] Batch cURL processing (multiple cURLs → multiple tests)
- [ ] Request execution & testing (run tests in browser)
- [ ] Response mocking for testing
- [ ] API documentation generation
- [ ] Collaborative editing (share cURL edits)
- [ ] Code snippets library (reusable test components)

<!-- ---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- **shadcn/ui** for beautiful component primitives
- **Radix UI** for accessible headless components
- **Tailwind CSS** for utility-first styling
- **Lucide** for consistent iconography
- **React Router** for seamless navigation
- **Vite** for blazing-fast development experience -->

---

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/Nataraaj-Shanmugam/cURL-to-Code-Convertor-FrontEnd/issues)
- ✨ **Feature Requests**: [GitHub Issues](https://github.com/Nataraaj-Shanmugam/cURL-to-Code-Convertor-FrontEnd/issues)
- 💬 **Discussions**: [GitHub Discussions](#)
- 📧 **Feedbacks**: [Contact](https://curlcraftassured.vercel.app/feedback)