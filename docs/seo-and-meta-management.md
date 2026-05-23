# SEO & OGP Dynamic Meta Management

This document describes the routing structure, metadata synchronization, and indexing security boundaries orchestrated by the **SEO & OGP Dynamic Meta Manager** component (`src/components/seo-manager.tsx`). 

This component maintains clean search engine listings and secure rich-media preview snippets (Open Graph) across multiple languages without client-side hydration issues.

---

## 1. Multi-Lingual Route & Canonical URL Parsing

In a client-side Single Page Application (SPA), generating correct canonical paths for crawling engines is challenging, especially when routes are prefixed by dynamic language codes (e.g. `/ja/...`, `/en/...`).

### Root Normalization Flow
1. **Extraction**: The component reads the current route from React Router (`useLocation().pathname`).
2. **Prefix Matching**: Paths are split to verify if they are prefixed by any language registered under `SUPPORTED_LANGUAGES`.
3. **Locale-Locking Canonical Generation**:
   * It extracts the logical web path (e.g., `/dashboard`).
   * It reconstructs a fully localized, standard canonical URL locked to the active user language and ensures a trailing slash is appended to avoid duplications:
     `https://scripturehabit.app/{language}{normalizedPath}/`
   * Finally, it updates the document's `<link rel="canonical" href="...">` element dynamically.

```mermaid
flowchart TD
    Path[Get location.pathname] --> CheckPrefix{Has dynamic language prefix?}
    
    CheckPrefix -- Yes --> Extract[Strip language code from path]
    CheckPrefix -- No --> Keep[Keep path as is]
    
    Extract --> Canonical[Rebuild: 'https://scripturehabit.app/' + currentLanguage + baseRoute + '/']
    Keep --> Canonical
    
    Canonical --> Insert[Update link rel='canonical' in HTML Head]
```

---

## 2. Robots & Indexing Safety Boundaries (Privacy Guards)

One of the most critical aspects of SEO for private web apps is **excluding authenticated or user-specific pages** from Google and Bing search index repositories. 

`SEOManager` manages a dynamic robots meta tag injected into the document head, creating a clear demarcation between public content and private screens:

| Route Parameter | Target Path Examples | Indexed? | Robots Directive | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Public Core** | `/`, `/privacy`, `/terms`, `/legal` | **Yes** | `index, follow` | Drives organic traffic and maintains public legality terms. |
| **User Portal** | `/dashboard`, `/welcome` | **No** | `noindex, nofollow` | Avoids caching active portals or empty dynamic states. |
| **Auth Screen** | `/login`, `/signup`, `/forgot-password` | **No** | `noindex, nofollow` | Prevents exposing registration endpoints or blank form frames. |
| **Group / Social**| `/group/*`, `/join/*` | **No** | `noindex, nofollow` | Protects private study logs and participant directory rosters. |
| **Personal Space**| `/profile`, `/my-notes`, `/settings` | **No** | `noindex, nofollow` | Strictly isolates user-specific data from scraping engines. |

### Dynamic Directive Application
The manager parses the primary route. If the parsed route exists inside the authenticated/private block, it overrides the header:
```typescript
robotsTag.setAttribute('content', 'noindex, nofollow');
```
If it is a public-facing route or has standard language landing configurations, it dynamically applies:
```typescript
robotsTag.setAttribute('content', 'index, follow');
```

---

## 3. Dynamic Rich Preview Injection (OGP & Twitter Cards)

To ensure links shared on platforms like Slack, Facebook, LINE, and Twitter render rich thumbnails, standard social metadata is synchronized live.

### Synchronized Meta Properties
Whenever a route changes or a translation context is modified, the manager reads values translated by `useLanguage` and writes to the DOM:

1. **Document Title (`document.title`)**:
   * Appends localized branding suffix (e.g. `Dashboard | Scripture Habit` or `Login | Scripture Habit`).
   * Propagates automatically to `og:title` and `twitter:title`.
2. **Metadata Description (`meta[name="description"]`)**:
   * Evaluates the active localized value (`t('seo.description')`) and populates `description`, `og:description`, and `twitter:description`.
3. **Google Site Name Optimization (`og:site_name`)**:
   * Google utilizes specific micro-metadata to determine how the product name displays in search results.
   * `SEOManager` dynamically injects a dedicated `og:site_name` tag declaring `Scripture Habit` to ensure correct branding alignment.
4. **Canonical URL Alignment (`og:url`)**:
   * Synthesizes with the localized Canonical URL so social crawlers resolve shares back to the standard multi-lingual page.
