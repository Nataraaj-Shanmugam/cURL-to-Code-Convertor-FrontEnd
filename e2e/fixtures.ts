import { test as base, type Page, type Route } from '@playwright/test';

// ── Mock response data (mirrors MSW handlers) ──────────────────────────────

export const MOCK_PARSED_CURL = {
  method: 'POST',
  url: 'https://api.example.com/users',
  base_url: 'https://api.example.com',
  endpoint: '/users',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.token',
  },
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    address: { city: 'New York', zip: '10001' },
  },
  query_params: { page: '1', limit: '10' },
  cookies: { session_id: 'abc123' },
};

export const MOCK_GENERATED_CODE = `import io.restassured.RestAssured;
import io.restassured.response.Response;
import static io.restassured.RestAssured.*;
import org.testng.annotations.*;

public class ApiTest {
    @BeforeClass
    public void setup() {
        RestAssured.baseURI = "https://api.example.com";
    }

    @Test
    public void testApiRequest() {
        Response response = given()
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.token")
            .body("{\\"name\\": \\"John Doe\\", \\"email\\": \\"john@example.com\\"}")
        .when()
            .post("/users")
        .then()
            .statusCode(200)
            .extract().response();
    }
}`;

export const MOCK_POJO_CODE = `import lombok.Data;
import lombok.Builder;

@Data
@Builder
public class RequestBody {
    private String name;
    private String email;
}`;

// ── Route-mocking helper ────────────────────────────────────────────────────

/** Install API mocks for all backend endpoints on the given page. */
export async function mockApi(page: Page) {
  // Health check — match both localhost:8000 and any other origin
  await page.route(/\/api\/health/, (route: Route) =>
    route.fulfill({ json: { status: 'ok', version: '2.0.0' } }),
  );

  // Parse cURL — use regex for reliable matching across origins
  await page.route(/\/api\/parse$/, async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    if (!body.curl?.trim()) {
      return route.fulfill({
        status: 400,
        json: {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'cURL command is required' },
        },
      });
    }
    if (body.curl.includes('invalid-curl-garbage')) {
      return route.fulfill({
        status: 422,
        json: {
          success: false,
          error: { code: 'PARSE_ERROR', message: 'Invalid cURL command format' },
        },
      });
    }
    return route.fulfill({ json: { success: true, data: MOCK_PARSED_CURL } });
  });

  // Generate code
  await page.route(/\/api\/generate-from-parsed/, async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    const config = body.config;
    if (!config?.option) {
      return route.fulfill({
        status: 400,
        json: {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Generation option is required' },
        },
      });
    }
    return route.fulfill({
      json: {
        success: true,
        generated_code: MOCK_GENERATED_CODE,
        complete_code: MOCK_GENERATED_CODE,
        pojo_code: config.needPojo ? MOCK_POJO_CODE : '',
        warnings: [],
        language: 'java',
      },
    });
  });

  // Body edit
  await page.route(/\/api\/body\/edit/, (route: Route) =>
    route.fulfill({ json: { success: true } }),
  );

  // Body delete
  await page.route(/\/api\/body\/delete/, (route: Route) =>
    route.fulfill({ json: { success: true } }),
  );

  // Feedback
  await page.route(/\/api\/feedback/, (route: Route) =>
    route.fulfill({ json: { success: true } }),
  );
}

// ── Shared test fixture ─────────────────────────────────────────────────────

export const test = base.extend<{ mockPage: Page }>({
  mockPage: async ({ page }, use) => {
    await mockApi(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';

// ── Common cURL samples ─────────────────────────────────────────────────────

export const SAMPLE_CURL =
  'curl -X POST "https://api.example.com/users" -H "Content-Type: application/json" -H "Authorization: Bearer token123" -d \'{"name": "John Doe", "email": "john@example.com"}\'';

export const SAMPLE_CURL_GET =
  'curl -X GET "https://api.example.com/users" -H "Accept: application/json"';
